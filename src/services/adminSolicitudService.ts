/**
 * adminSolicitudService.ts
 * E.2/E.3 — operaciones del panel administrativo sobre una solicitud.
 * Ninguna pantalla debe llamar a `db.ts` directamente: todo pasa por aquí,
 * para que las reglas de negocio (G) se apliquen siempre igual.
 */

import { PDFDocument, rgb } from 'pdf-lib';
import { guardarBlob, guardarSolicitud, listarTodasLasSolicitudes, obtenerBlob, obtenerSolicitud } from './db';
import { registrarEnBitacora } from './bitacoraService';
import {
  esGraduadoDeHonor,
  expedienteListoParaCerrar,
  facultadDesdePrograma,
  nombreArchivoExpediente,
  normalizarCodigoEk,
  siglaDesdePrograma,
  textoGraduadoDeHonor,
  tituloDesdePrograma,
} from './reglasNegocio';
import { CATALOGO_DOCUMENTOS } from '../data/documentos';
import type { DocumentoId, RolTitulacion, Solicitud, TipoDocumentoIdentidad } from '../types';

/** E.2 — qué solicitudes puede ver cada rol. Las anuladas nunca aparecen (B.2). */
export async function listarSolicitudesParaRol(
  rol: RolTitulacion,
  facultades: string[],
): Promise<Solicitud[]> {
  const todas = (await listarTodasLasSolicitudes()).filter((s) => s.estado !== 'anulada');

  if (rol === 'acceso_total') return todas;

  if (rol === 'secretaria') {
    // "Completa" (pendiente de aprobar) y "Aprobada" (ya aprobadas) — así
    // Secretaría también puede ver y descargar el reporte de lo ya aprobado.
    return todas.filter((s) => s.estado === 'completa' || s.estado === 'aprobada');
  }

  // jefe_programa: solo las de los programas de sus facultades.
  return todas.filter((s) => {
    const facultadReal = facultadDesdePrograma(s.programa);
    return facultadReal !== null && facultades.includes(facultadReal);
  });
}

export async function obtenerExpediente(id: string): Promise<Solicitud | undefined> {
  return obtenerSolicitud(id);
}

/** E.3 — el Jefe de Programa puede editar datos personales, pero nunca el programa (G.4). */
export interface EdicionDatosPersonales {
  nombres: string;
  apellidos: string;
  tipoDocumento: TipoDocumentoIdentidad;
  identificacion: string;
  correo: string;
  telefono: string;
  lugarExpedicion: string;
}

export async function editarDatosPersonales(
  id: string,
  cambios: EdicionDatosPersonales,
  quien: string,
): Promise<Solicitud> {
  const solicitud = await requerirSolicitud(id);
  const siguiente: Solicitud = { ...solicitud, ...cambios };
  await guardarSolicitud(siguiente);
  await registrarEnBitacora(quien, 'Edición de datos personales', `${solicitud.radicado}`);
  return siguiente;
}

/** E.3 — promedio, código EK (solo pregrado), distinción, título del trabajo/producto. */
export interface CamposDeLaFacultad {
  promedioPonderado: number | null;
  codigoEk: string;
  distincion: Solicitud['distincion'];
  nombreTrabajoGrado: string;
}

export async function completarCamposDeLaFacultad(
  id: string,
  campos: CamposDeLaFacultad,
  quien: string,
): Promise<Solicitud> {
  const solicitud = await requerirSolicitud(id);
  const codigoEk = solicitud.nivel === 'Pregrado' ? normalizarCodigoEk(campos.codigoEk) : '';
  const graduadoDeHonor = esGraduadoDeHonor(campos.promedioPonderado, campos.distincion);

  const siguiente: Solicitud = {
    ...solicitud,
    promedioPonderado: campos.promedioPonderado,
    codigoEk,
    distincion: campos.distincion,
    nombreTrabajoGrado: campos.nombreTrabajoGrado,
    graduadoDeHonor,
  };

  // Si ya había avanzado a "en_revision" se mantiene; si estaba "radicada" y
  // ya se le cargó o completó algo, pasa a "en_revision" (B.2 #2).
  if (siguiente.estado === 'radicada') siguiente.estado = 'en_revision';

  await guardarSolicitud(siguiente);
  await registrarEnBitacora(quien, 'Actualización de campos académicos', solicitud.radicado);
  return siguiente;
}

/**
 * E.3 — cargar un documento (el Jefe de Programa puede cargar cualquiera,
 * incluso los que le correspondían al estudiante). Los que sube la facultad
 * quedan avalados automáticamente (B.5); si REEMPLAZA uno que había subido
 * el estudiante, el aval anterior se invalida (G.3) y hay que volver a
 * avalarlo — por eso al reemplazar uno ya avalado por el estudiante, este
 * método lo deja SIN avalar de nuevo salvo que quien lo suba sea justamente
 * la facultad reemplazando el suyo propio (que ya se auto-avala).
 */
export async function cargarDocumento(
  id: string,
  documentoId: DocumentoId,
  archivo: File,
  quien: string,
): Promise<Solicitud> {
  const solicitud = await requerirSolicitud(id);
  const def = CATALOGO_DOCUMENTOS.find((d) => d.id === documentoId);
  const esDocumentoDeFacultad = def?.etapa === 'facultad';

  const blobId = crypto.randomUUID();
  await guardarBlob(blobId, archivo, archivo.name);

  const documentos = solicitud.documentos.filter((d) => d.id !== documentoId);
  documentos.push({
    id: documentoId,
    nombreArchivo: archivo.name,
    tamanoBytes: archivo.size,
    blobId,
    cargadoEnIso: new Date().toISOString(),
    // B.5: los de la facultad quedan avalados solos; un reemplazo de uno del
    // estudiante invalida el aval anterior (G.3) — siempre entra sin avalar.
    avalado: esDocumentoDeFacultad,
  });

  const siguiente: Solicitud = {
    ...solicitud,
    documentos,
    estado: solicitud.estado === 'radicada' ? 'en_revision' : solicitud.estado,
  };
  await guardarSolicitud(siguiente);
  await registrarEnBitacora(quien, 'Carga de documento', `${solicitud.radicado} — ${def?.nombre ?? documentoId}`);
  return siguiente;
}

/** B.5 — avalar/desavalar un documento del estudiante. No hay checkbox para los de la facultad. */
export async function alternarAval(id: string, documentoId: DocumentoId, avalado: boolean, quien: string): Promise<Solicitud> {
  const solicitud = await requerirSolicitud(id);
  const documentos = solicitud.documentos.map((d) => (d.id === documentoId ? { ...d, avalado } : d));
  const siguiente: Solicitud = { ...solicitud, documentos };
  await guardarSolicitud(siguiente);
  await registrarEnBitacora(quien, avalado ? 'Aval de documento' : 'Retiro de aval', `${solicitud.radicado} — ${documentoId}`);
  return siguiente;
}

/** E.3 — "Guardar expediente": parcial, en cualquier momento (no cambia el estado por sí solo). */
export async function guardarExpedienteParcial(solicitud: Solicitud, quien: string): Promise<void> {
  await guardarSolicitud(solicitud);
  await registrarEnBitacora(quien, 'Guardado parcial del expediente', solicitud.radicado);
}

/**
 * Secretaría Académica (o acceso total) aprueba una solicitud ya "Completa"
 * — la facultad ya cerró el expediente; esto es la aprobación final del
 * trámite, no vuelve a tocar documentos ni el PDF.
 */
export async function aprobarSolicitud(id: string, quien: string): Promise<Solicitud> {
  const solicitud = await requerirSolicitud(id);
  if (solicitud.estado !== 'completa') return solicitud;
  const siguiente: Solicitud = { ...solicitud, estado: 'aprobada' };
  await guardarSolicitud(siguiente);
  await registrarEnBitacora(quien, 'Aprobación de Secretaría Académica', solicitud.radicado);
  return siguiente;
}

/** Aprobar en bloque todas las que estén "Completa" — mismo efecto que aprobar una por una. */
export async function aprobarTodasLasCompletas(ids: string[], quien: string): Promise<void> {
  for (const id of ids) {
    // Secuencial a propósito: cada una queda registrada en la bitácora por separado.
    await aprobarSolicitud(id, quien);
  }
}

/** E.3 — anular, con motivo opcional. El registro nunca se borra (B.2 #4). */
export async function anularSolicitud(id: string, motivo: string | undefined, quien: string): Promise<Solicitud> {
  const solicitud = await requerirSolicitud(id);
  const siguiente: Solicitud = {
    ...solicitud,
    estado: 'anulada',
    anuladoPor: quien,
    anuladoEnIso: new Date().toISOString(),
    motivoAnulacion: motivo,
  };
  await guardarSolicitud(siguiente);
  await registrarEnBitacora(quien, 'Anulación de solicitud', `${solicitud.radicado}${motivo ? ` — ${motivo}` : ''}`);
  return siguiente;
}

/* ---------------------------------------------------------------------- */
/* F — Generación del PDF final                                           */
/* ---------------------------------------------------------------------- */

/** Portada del expediente — F: todos los datos, y el recuadro dorado de Graduado de Honor si aplica. */
async function construirPortada(solicitud: Solicitud): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const pagina = doc.addPage([612, 792]); // carta
  const { height } = pagina.getSize();
  const azul = rgb(0x0b / 255, 0x2a / 255, 0x5b / 255);
  const dorado = rgb(0xc9 / 255, 0xa2 / 255, 0x27 / 255);
  const negro = rgb(0.1, 0.1, 0.12);

  let y = height - 70;
  const linea = (texto: string, tam = 11, color = negro, salto = 20) => {
    pagina.drawText(texto, { x: 56, y, size: tam, color });
    y -= salto;
  };

  pagina.drawText('SOLICITUD DE TITULACION', { x: 56, y, size: 20, color: azul });
  y -= 30;
  pagina.drawText('Escuela Naval de Cadetes "Almirante Padilla"', { x: 56, y, size: 11, color: negro });
  y -= 34;

  const titulo = tituloDesdePrograma(solicitud.programa);
  linea(`Radicado: ${solicitud.radicado}`, 12);
  linea(`Nombres: ${solicitud.nombres}`);
  linea(`Apellidos: ${solicitud.apellidos}`);
  linea(`Tipo y número de identificación: ${solicitud.tipoDocumento} ${solicitud.identificacion}`);
  linea(`Correo: ${solicitud.correo}`);
  linea(`Teléfono: ${solicitud.telefono}`);
  linea(`Nivel: ${solicitud.nivel}`);
  linea(`Programa: ${solicitud.programa}`);
  linea(`Título académico: ${titulo}`);
  linea(`Promedio ponderado: ${solicitud.promedioPonderado ?? '—'}`);
  linea(`Opción de grado: ${solicitud.opcionGrado || '—'}`);
  if (solicitud.nombreTrabajoGrado) linea(`Trabajo / producto: ${solicitud.nombreTrabajoGrado}`);
  linea(`Distinción: ${solicitud.distincion}`);

  if (solicitud.graduadoDeHonor && solicitud.promedioPonderado !== null && solicitud.distincion !== 'Ninguna') {
    y -= 10;
    const texto = textoGraduadoDeHonor({
      nombres: solicitud.nombres,
      apellidos: solicitud.apellidos,
      promedioPonderado: solicitud.promedioPonderado,
      distincion: solicitud.distincion,
    });
    pagina.drawRectangle({
      x: 48,
      y: y - 70,
      width: 516,
      height: 78,
      color: rgb(0.97, 0.93, 0.78),
      borderColor: dorado,
      borderWidth: 1.5,
    });
    const palabras = texto.match(/.{1,90}(\s|$)/g) ?? [texto];
    let yy = y - 15;
    for (const linea2 of palabras) {
      pagina.drawText(linea2.trim(), { x: 58, y: yy, size: 9.5, color: azul });
      yy -= 13;
    }
    y -= 90;
  }

  return doc.save();
}

/**
 * F — une la portada con todos los PDFs cargados, en el orden oficial de la
 * tabla C. Reporta si algún documento no se pudo leer, sin fallar todo el
 * proceso (E.4 pide el mismo comportamiento para el ZIP; aquí se aplica
 * igual para un solo expediente).
 */
export async function generarExpedientePdf(
  solicitud: Solicitud,
): Promise<{ blob: Blob; nombreArchivo: string; omitidos: string[] }> {
  const salida = await PDFDocument.create();
  const portadaBytes = await construirPortada(solicitud);
  const portada = await PDFDocument.load(portadaBytes);
  const [paginaPortada] = await salida.copyPages(portada, [0]);
  salida.addPage(paginaPortada);

  const ordenados = [...solicitud.documentos].sort((a, b) => {
    const oa = CATALOGO_DOCUMENTOS.find((d) => d.id === a.id)?.orden ?? 999;
    const ob = CATALOGO_DOCUMENTOS.find((d) => d.id === b.id)?.orden ?? 999;
    return oa - ob;
  });

  const omitidos: string[] = [];
  for (const doc of ordenados) {
    try {
      const archivo = await obtenerBlob(doc.blobId);
      if (!archivo) {
        omitidos.push(`${doc.nombreArchivo} (no se encontró el archivo)`);
        continue;
      }
      const bytes = new Uint8Array(await archivo.blob.arrayBuffer());
      const origen = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const paginas = await salida.copyPages(origen, origen.getPageIndices());
      paginas.forEach((p) => salida.addPage(p));
    } catch {
      omitidos.push(`${doc.nombreArchivo} (no se pudo leer como PDF)`);
    }
  }

  const bytes = await salida.save();
  const sigla = siglaDesdePrograma(solicitud.programa);
  const nombreArchivo = nombreArchivoExpediente(sigla, solicitud.apellidos, solicitud.nombres);
  return { blob: new Blob([bytes.slice().buffer], { type: 'application/pdf' }), nombreArchivo, omitidos };
}

/**
 * E.3 — "Radicar Solicitud / cerrar expediente": solo habilitado cuando todo
 * está cargado + avalado + código EK si aplica (B.5). Genera el PDF final y
 * pasa el estado a "completa" (envío a Secretaría queda pendiente de
 * conectar un servicio de correo real — ver nota en authService.ts).
 */
export async function cerrarExpediente(
  id: string,
  quien: string,
): Promise<{ ok: true; solicitud: Solicitud; omitidos: string[] } | { ok: false; mensaje: string }> {
  const solicitud = await requerirSolicitud(id);
  if (!expedienteListoParaCerrar(solicitud)) {
    return {
      ok: false,
      mensaje: 'Faltan documentos por cargar o avalar, o el código EK, antes de poder cerrar el expediente.',
    };
  }

  const { blob, nombreArchivo, omitidos } = await generarExpedientePdf(solicitud);
  const blobId = crypto.randomUUID();
  await guardarBlob(blobId, blob, nombreArchivo);

  const siguiente: Solicitud = {
    ...solicitud,
    estado: 'completa',
    enlacePdf: blobId,
  };
  await guardarSolicitud(siguiente);
  await registrarEnBitacora(quien, 'Cierre de expediente', `${solicitud.radicado} — PDF: ${nombreArchivo}`);
  return { ok: true, solicitud: siguiente, omitidos };
}

async function requerirSolicitud(id: string): Promise<Solicitud> {
  const solicitud = await obtenerSolicitud(id);
  if (!solicitud) throw new Error('La solicitud ya no existe.');
  return solicitud;
}
