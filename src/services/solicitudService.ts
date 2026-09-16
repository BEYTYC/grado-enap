/**
 * solicitudService.ts
 * Operaciones sobre solicitudes que sí conocen las reglas de negocio (a
 * diferencia de db.ts, que solo sabe leer/escribir). Es lo único que las
 * pantallas de la Parte 1 deben usar — nunca `db.ts` directamente.
 */

import {
  buscarPorRadicado,
  eliminarBlob,
  eliminarSolicitud,
  guardarBlob,
  guardarSolicitud,
  listarSolicitudesPorIdentificacion,
  listarTodasLasSolicitudes,
  obtenerBlob,
  obtenerSolicitud,
} from './db';
import { registrarEnBitacora } from './bitacoraService';
import { facultadDesdePrograma, generarRadicado, nivelDesdePrograma } from './reglasNegocio';
import { generarAutorizacionDatosPdf } from './autorizacionDatosService';
import type { DocumentoId, Solicitud, TipoDocumentoIdentidad, ViaRadicacion } from '../types';

export interface DatosPersonalesFormulario {
  nombres: string;
  apellidos: string;
  tipoDocumento: TipoDocumentoIdentidad;
  identificacion: string;
  lugarExpedicion: string;
  correo: string;
  telefono: string;
}

export interface DatosProgramaFormulario {
  programa: string;
  opcionGrado: Solicitud['opcionGrado'];
  /** Solo cuando opcionGrado es "Diplomado": el nombre del diplomado, lo diligencia el estudiante. */
  nombreDiplomado?: string;
}

/**
 * Nombres de diplomado ya usados en solicitudes anteriores (Diplomado como
 * opción de grado), para sugerirlos en el paso 2 — sin lista aparte: se
 * derivan siempre de lo ya radicado, así nunca queda desactualizada.
 */
export async function listarNombresDiplomados(): Promise<string[]> {
  const todas = await listarTodasLasSolicitudes();
  const nombres = new Set<string>();
  for (const s of todas) {
    if (s.opcionGrado === 'Diplomado' && s.nombreTrabajoGrado.trim()) {
      nombres.add(s.nombreTrabajoGrado.trim());
    }
  }
  return [...nombres].sort((a, b) => a.localeCompare(b));
}

/** Texto de autorización de datos — D.2 paso 4. Copiado literal, no parafrasear. */
export const TEXTO_AUTORIZACION_DATOS =
  'Autorizo a la Escuela Naval de Cadetes "Almirante Padilla" a recolectar, almacenar, usar y ' +
  'tratar mis datos personales y los documentos que adjunto, con la finalidad exclusiva de tramitar ' +
  'y verificar mi solicitud de titulación, de conformidad con la Ley 1581 de 2012 y sus normas ' +
  'reglamentarias. Declaro que la información y los documentos aportados son veraces y auténticos, ' +
  'y entiendo que puedo conocer, actualizar, rectificar o suprimir mis datos escribiendo a la institución.';

/**
 * D.3 — radica una solicitud nueva: genera el radicado, crea el registro en
 * estado "radicada" y guarda cada documento adjunto como blob local. No
 * existe "guardar sin terminar" del lado del estudiante (D.3): esta función
 * solo se llama al final, con todo listo.
 */
export interface ResultadoRadicacion {
  solicitud: Solicitud;
  /** Bytes del PDF de Autorización de Datos recién generado — para adjuntarlo al correo de confirmación sin tener que releerlo de IndexedDB. */
  autorizacionPdfBytes: Uint8Array;
}

export async function radicarSolicitud(params: {
  datosPersonales: DatosPersonalesFormulario;
  datosPrograma: DatosProgramaFormulario;
  documentos: { id: DocumentoId; archivo: File }[];
  viaRadicacion: ViaRadicacion;
}): Promise<ResultadoRadicacion> {
  const { datosPersonales, datosPrograma, documentos, viaRadicacion } = params;
  const nivel = nivelDesdePrograma(datosPrograma.programa);
  if (!nivel) throw new Error('Programa no reconocido en el catálogo institucional.');

  const id = crypto.randomUUID();
  const radicado = generarRadicado();
  const facultad = facultadDesdePrograma(datosPrograma.programa);
  const fechaRadicacion = new Date();

  const documentosCargados = [];
  for (const doc of documentos) {
    const blobId = crypto.randomUUID();
    await guardarBlob(blobId, doc.archivo, doc.archivo.name);
    documentosCargados.push({
      id: doc.id,
      nombreArchivo: doc.archivo.name,
      tamanoBytes: doc.archivo.size,
      blobId,
      cargadoEnIso: new Date().toISOString(),
      // Los documentos que trae el estudiante al radicar no llevan aval
      // todavía: eso lo hace el Jefe de Programa después (B.5).
      avalado: false,
    });
  }

  // Autorización de Tratamiento de Datos (D.2 paso 4 / requerimiento 4 del
  // Portal): se genera SIEMPRE al radicar, con los datos ya diligenciados y
  // el radicado recién asignado, y queda asociada al trámite como un blob
  // más en IndexedDB (autorizacionDatosPdfBlobId) — igual que los demás
  // documentos, pero generado por el sistema en vez de subido por el
  // estudiante. Los bytes también se devuelven aquí mismo para que quien
  // llama los adjunte de una vez al correo de confirmación, sin tener que
  // volver a leer el blob.
  const autorizacionPdfBytes = await generarAutorizacionDatosPdf({
    datosPersonales,
    radicado,
    fecha: fechaRadicacion,
  });
  const autorizacionDatosPdfBlobId = crypto.randomUUID();
  await guardarBlob(
    autorizacionDatosPdfBlobId,
    // pdf-lib tipa PDFDocument.save() como Uint8Array<ArrayBufferLike>, que
    // TS no acepta directamente como BlobPart (por el caso, teórico aquí, de
    // un SharedArrayBuffer) — un Uint8Array nuevo, propio, cierra esa brecha.
    new Blob([new Uint8Array(autorizacionPdfBytes)], { type: 'application/pdf' }),
    `Autorizacion_Datos_${radicado}.pdf`,
  );

  const solicitud: Solicitud = {
    id,
    fecha: new Date().toISOString(),
    radicado,
    estado: 'radicada',
    facultadReferencial: facultad ?? '',
    nombres: datosPersonales.nombres,
    apellidos: datosPersonales.apellidos,
    tipoDocumento: datosPersonales.tipoDocumento,
    identificacion: datosPersonales.identificacion,
    correo: datosPersonales.correo,
    telefono: datosPersonales.telefono,
    nivel,
    programa: datosPrograma.programa,
    opcionGrado: datosPrograma.opcionGrado,
    // Si la opción de grado es "Diplomado", el nombre lo da el estudiante al
    // radicar; para las demás opciones lo completa la facultad después.
    nombreTrabajoGrado: datosPrograma.nombreDiplomado?.trim() ?? '',
    distincion: 'Ninguna',
    viaRadicacion,
    autorizacionDatosPdfBlobId,
    graduadoDeHonor: false,
    codigoEk: '',
    promedioPonderado: null,
    enlacePdf: null,
    autorizacionDatos: `Autorizado el ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`,
    lugarExpedicion: datosPersonales.lugarExpedicion,
    documentosAvaladosPorFacultad: [],
    documentos: documentosCargados,
  };

  await guardarSolicitud(solicitud);
  await registrarEnBitacora(
    datosPersonales.correo,
    'Radicación de solicitud',
    `${radicado} — ${datosPersonales.apellidos} ${datosPersonales.nombres} (${datosPrograma.programa})`,
  );
  return { solicitud, autorizacionPdfBytes };
}

/** D.4 — consultar mis solicitudes, solo por número de documento, sin login. */
export async function consultarPorIdentificacion(identificacion: string): Promise<Solicitud[]> {
  const todas = await listarSolicitudesPorIdentificacion(identificacion.trim());
  // B.2: las anuladas nunca aparecen en ningún listado.
  return todas.filter((s) => s.estado !== 'anulada');
}

export interface ResultadoEliminacion {
  ok: boolean;
  mensaje: string;
}

/**
 * D.4 — "Eliminar esta solicitud" exige radicado + identificación (dos
 * factores, G.5) y no se permite si el estado ya es "Completa".
 */
export async function eliminarSolicitudDelEstudiante(
  identificacion: string,
  radicado: string,
): Promise<ResultadoEliminacion> {
  const solicitud = await buscarPorRadicado(radicado.trim());
  if (!solicitud || solicitud.identificacion.trim() !== identificacion.trim()) {
    return { ok: false, mensaje: 'El número de radicado no coincide con esta solicitud.' };
  }
  if (solicitud.estado === 'completa') {
    return {
      ok: false,
      mensaje:
        'Esta solicitud ya está Completa y no se puede eliminar desde aquí. Comuníquese directamente con la facultad.',
    };
  }

  for (const doc of solicitud.documentos) {
    await eliminarBlob(doc.blobId);
  }
  await eliminarSolicitud(solicitud.id);
  await registrarEnBitacora(
    identificacion,
    'Eliminación de solicitud por el estudiante',
    `${solicitud.radicado} — ${solicitud.apellidos} ${solicitud.nombres}`,
  );
  return { ok: true, mensaje: 'La solicitud fue eliminada.' };
}

export async function obtenerSolicitudPorId(id: string): Promise<Solicitud | undefined> {
  return obtenerSolicitud(id);
}

export async function obtenerArchivoDocumento(blobId: string) {
  return obtenerBlob(blobId);
}
