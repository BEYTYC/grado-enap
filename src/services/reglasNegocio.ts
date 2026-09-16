/**
 * reglasNegocio.ts
 * Reglas de negocio compartidas entre la Parte 1 (estudiante) y la Parte 2
 * (panel administrativo) — secciones B, C y G de la especificación. Viven en
 * un solo lugar a propósito: ninguna pantalla debe reimplementar ninguna de
 * estas cuentas.
 */

import { CATALOGO_DOCUMENTOS } from '../data/documentos';
import { facultadDelPrograma } from '../data/facultades';
import { buscarPrograma, SIGLA_POR_DEFECTO } from '../data/programas';
import type {
  Distincion,
  DocumentoDef,
  DocumentoId,
  EstadoSolicitud,
  Nivel,
  OpcionGrado,
  RolTitulacion,
  Solicitud,
} from '../types';

/* -------------------------------------------------------------------- */
/* A.1 — deducciones a partir del programa (G.1, G.2: nunca se confía en  */
/* el valor guardado, siempre se recalcula desde el programa).            */
/* -------------------------------------------------------------------- */

/** Nivel deducido del programa — B.1 #11. El usuario nunca lo elige. */
export function nivelDesdePrograma(nombrePrograma: string): Nivel | null {
  return buscarPrograma(nombrePrograma)?.nivel ?? null;
}

/**
 * Título académico — B.1 #23 / G.2. SIEMPRE deducido de la tabla de 15
 * programas, nunca editable manualmente por ningún rol (ni por acceso
 * total). Si el programa no está en la tabla, "Por definir" — nunca se
 * inventa un título.
 */
export function tituloDesdePrograma(nombrePrograma: string): string {
  return buscarPrograma(nombrePrograma)?.titulo ?? 'Por definir';
}

/** Sigla para el nombre del PDF final — F. `CERT` si el programa no está en la tabla. */
export function siglaDesdePrograma(nombrePrograma: string): string {
  return buscarPrograma(nombrePrograma)?.sigla ?? SIGLA_POR_DEFECTO;
}

/**
 * Facultad de una solicitud — B.1 #4 / G.1. Se recalcula siempre a partir
 * del programa; el campo `facultadReferencial` guardado es solo un dato
 * histórico de cuando se radicó y puede estar desactualizado si el
 * programa cambió de facultad en el catálogo.
 */
export function facultadDesdePrograma(nombrePrograma: string): string | null {
  return facultadDelPrograma(nombrePrograma)?.nombre ?? null;
}

/* -------------------------------------------------------------------- */
/* B.3 — Código EK                                                       */
/* -------------------------------------------------------------------- */

/** Normaliza el código EK: mayúsculas, sin espacios sobrantes. Solo aplica a Pregrado. */
export function normalizarCodigoEk(valor: string): string {
  return valor.trim().toUpperCase().replace(/\s+/g, '');
}

export function codigoEkRequerido(nivel: Nivel): boolean {
  return nivel === 'Pregrado';
}

/* -------------------------------------------------------------------- */
/* B.4 — Graduado de Honor (Artículo 91)                                 */
/* -------------------------------------------------------------------- */

export const PROMEDIO_DE_CORTE_HONOR = 9.5;

/**
 * true cuando se cumplen las dos condiciones simultáneamente: promedio
 * ESTRICTAMENTE mayor a 9.5, y una distinción distinta de "Ninguna"/vacía.
 * Cálculo puro y síncrono para poder recalcularse en el cliente mientras el
 * Jefe de Programa escribe, sin esperar al servidor.
 */
export function esGraduadoDeHonor(promedioPonderado: number | null, distincion: Distincion | ''): boolean {
  if (promedioPonderado === null) return false;
  if (!(promedioPonderado > PROMEDIO_DE_CORTE_HONOR)) return false;
  return Boolean(distincion) && distincion !== 'Ninguna';
}

/** Texto exacto de la portada del PDF cuando aplica Graduado de Honor — B.4. */
export function textoGraduadoDeHonor(params: {
  nombres: string;
  apellidos: string;
  promedioPonderado: number;
  distincion: Distincion;
}): string {
  const { nombres, apellidos, promedioPonderado, distincion } = params;
  return (
    `De acuerdo con el Artículo No. 91, el estudiante ${nombres} ${apellidos} es acreedor de la ` +
    `distinción "Graduado de Honor", por obtener un promedio ponderado de ${promedioPonderado} ` +
    `(superior a 9.5) y la distinción ${distincion} en su trabajo de grado.`
  );
}

/* -------------------------------------------------------------------- */
/* C — Documentos aplicables y avance                                    */
/* -------------------------------------------------------------------- */

/** Catálogo de documentos que aplican a esta combinación, en el orden oficial. */
export function documentosAplicables(ctx: {
  nivel: Nivel;
  opcionGrado: OpcionGrado | '';
  distincion: Distincion | '';
}): DocumentoDef[] {
  return CATALOGO_DOCUMENTOS.filter((doc) => doc.aplica(ctx)).sort((a, b) => a.orden - b.orden);
}

export function documentosDelEstudiante(ctx: {
  nivel: Nivel;
  opcionGrado: OpcionGrado | '';
  distincion: Distincion | '';
}): DocumentoDef[] {
  return documentosAplicables(ctx).filter((doc) => doc.etapa === 'estudiante');
}

export function documentosDeLaFacultad(ctx: {
  nivel: Nivel;
  opcionGrado: OpcionGrado | '';
  distincion: Distincion | '';
}): DocumentoDef[] {
  return documentosAplicables(ctx).filter((doc) => doc.etapa === 'facultad');
}

/** "5 de 8" — B.1 #20. Se deriva siempre de los documentos cargados, nunca se guarda aparte. */
export function avanceDocumentos(solicitud: Pick<Solicitud, 'nivel' | 'opcionGrado' | 'distincion' | 'documentos'>): {
  cargados: number;
  total: number;
  texto: string;
} {
  const aplicables = documentosAplicables({
    nivel: solicitud.nivel,
    opcionGrado: solicitud.opcionGrado,
    distincion: solicitud.distincion,
  });
  const idsCargados = new Set(solicitud.documentos.map((d) => d.id));
  const cargados = aplicables.filter((doc) => idsCargados.has(doc.id)).length;
  return { cargados, total: aplicables.length, texto: `${cargados} de ${aplicables.length}` };
}

/**
 * B.5 — para poder cerrar el expediente: todos los documentos requeridos
 * deben existir, y todos los que requieren aval (los del estudiante) deben
 * estar avalados. Los de la facultad se dan por avalados al cargarlos.
 */
export function expedienteListoParaCerrar(solicitud: Solicitud): boolean {
  const aplicables = documentosAplicables({
    nivel: solicitud.nivel,
    opcionGrado: solicitud.opcionGrado,
    distincion: solicitud.distincion,
  });
  const porId = new Map(solicitud.documentos.map((d) => [d.id, d] as const));

  const todosCargados = aplicables.every((doc) => porId.has(doc.id));
  if (!todosCargados) return false;

  const todosAvalados = aplicables.every((doc) => {
    const cargado = porId.get(doc.id);
    if (!cargado) return false;
    // Los que sube la facultad no llevan checkbox: quedan avalados al cargarlos (B.5).
    if (doc.etapa === 'facultad') return true;
    return cargado.avalado;
  });
  if (!todosAvalados) return false;

  if (codigoEkRequerido(solicitud.nivel) && !solicitud.codigoEk.trim()) return false;

  return true;
}

/* -------------------------------------------------------------------- */
/* B.2 — Texto del estado según el rol de quien lo ve                    */
/* -------------------------------------------------------------------- */

const TEXTO_ESTADO_GENERICO: Record<EstadoSolicitud, string> = {
  radicada: 'Radicada por el estudiante',
  en_revision: 'En revisión de la facultad',
  completa: 'Completa',
  aprobada: 'Aprobada por Secretaría Académica',
  anulada: 'Anulada',
};

/**
 * Mismo dato, redacción distinta según quién lo ve (B.2). Nunca se guarda
 * una redacción por rol: se calcula aquí, en el momento de mostrarla.
 */
export function textoEstadoParaRol(
  estado: EstadoSolicitud,
  facultadNombre: string | null,
  viewer: 'estudiante' | RolTitulacion,
): string {
  if (viewer === 'estudiante' && estado === 'en_revision') {
    return `En revisión por parte de la Facultad de ${facultadNombre ?? '—'}`;
  }
  if (viewer === 'jefe_programa' && estado === 'completa') {
    return 'Solicitud Completa';
  }
  // Secretaría Académica es quien aprueba: para ella (y acceso total, que ve
  // lo mismo que ella), "Completa" significa "ya la cerró la facultad,
  // pendiente de que Secretaría la apruebe" — no "en revisión del Consejo",
  // que no aplica a este flujo.
  if ((viewer === 'secretaria' || viewer === 'acceso_total') && estado === 'completa') {
    return 'Completa - Pendiente de aprobación';
  }
  return TEXTO_ESTADO_GENERICO[estado];
}

/**
 * Ventana de radicación que define Secretaría Académica (fechas AAAA-MM-DD,
 * comparadas contra la fecha de hoy en el huso horario del navegador —
 * suficiente para este modo local, sin backend con hora de servidor).
 * Sin fecha de apertura = siempre abierto (comportamiento de antes).
 */
export function solicitudesAbiertas(
  fechaAperturaSolicitudes: string | null,
  fechaCierreSolicitudes: string | null,
  hoy: Date = new Date(),
): { abiertas: boolean; motivo: 'antes-de-apertura' | 'despues-de-cierre' | null } {
  const hoyIso = hoy.toISOString().slice(0, 10);
  if (fechaAperturaSolicitudes && hoyIso < fechaAperturaSolicitudes) {
    return { abiertas: false, motivo: 'antes-de-apertura' };
  }
  if (fechaCierreSolicitudes && hoyIso > fechaCierreSolicitudes) {
    return { abiertas: false, motivo: 'despues-de-cierre' };
  }
  return { abiertas: true, motivo: null };
}

/**
 * Vigencia de la vía "Ceremonia" (nueva, junto con "Ventanilla" — ver
 * ViaRadicacion en types.ts). Solo está disponible cuando hay una fecha
 * tentativa de ceremonia definida Y la ventana de radicación general sigue
 * abierta; si cualquiera de las dos condiciones falta, se deshabilita con el
 * motivo correspondiente para mostrar el aviso exacto en pantalla.
 *
 * NOTA: la regla exacta de "plazos" para la ceremonia (por ejemplo, cerrar
 * la vía Ceremonia unos días antes de la fecha tentativa) no ha sido
 * confirmada por la institución — por ahora reutiliza la misma ventana de
 * apertura/cierre que ya define Secretaría Académica. Si el plazo debe ser
 * distinto (p. ej. "hasta 15 días antes de la ceremonia"), hay que decirlo
 * explícitamente para no inventar esa regla aquí.
 */
export function vigenciaCeremonia(
  config: Pick<
    import('../types').ConfiguracionTitulacion,
    'fechaTentativaGrado' | 'fechaAperturaSolicitudes' | 'fechaCierreSolicitudes'
  >,
  hoy: Date = new Date(),
): { vigente: boolean; motivo: 'sin-fecha-tentativa' | 'antes-de-apertura' | 'despues-de-cierre' | null } {
  if (!config.fechaTentativaGrado) {
    return { vigente: false, motivo: 'sin-fecha-tentativa' };
  }
  const ventana = solicitudesAbiertas(config.fechaAperturaSolicitudes, config.fechaCierreSolicitudes, hoy);
  if (!ventana.abiertas) {
    return { vigente: false, motivo: ventana.motivo };
  }
  return { vigente: true, motivo: null };
}

/** Color de estado para la consulta pública (D.4): gris=pendiente, amarillo=en revisión, verde=completa. */
export function colorEstadoPublico(estado: EstadoSolicitud): 'gris' | 'amarillo' | 'verde' {
  if (estado === 'completa' || estado === 'aprobada') return 'verde';
  if (estado === 'en_revision') return 'amarillo';
  return 'gris';
}

/* -------------------------------------------------------------------- */
/* G.8 — Normalización de correos de configuración                       */
/* -------------------------------------------------------------------- */

export const DOMINIO_INSTITUCIONAL = 'enap.edu.co';

/** Sin dominio, minúsculas, sin espacios — replicar exactamente en cualquier comparación. */
export function normalizarCorreoConfig(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(new RegExp(`@${DOMINIO_INSTITUCIONAL.replace('.', '\\.')}$`), '');
}

export function correoCompleto(usuarioSinDominio: string): string {
  return `${normalizarCorreoConfig(usuarioSinDominio)}@${DOMINIO_INSTITUCIONAL}`;
}

export function esCorreoInstitucional(correo: string): boolean {
  return correo.trim().toLowerCase().endsWith(`@${DOMINIO_INSTITUCIONAL}`);
}

/* -------------------------------------------------------------------- */
/* Radicado                                                               */
/* -------------------------------------------------------------------- */

/** `SG-yyyyMMdd-HHmmss` en hora de Bogotá (America/Bogota), sin excepción (A.5). */
export function generarRadicado(fecha: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(fecha);

  const get = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '00';
  const yyyy = get('year');
  const MM = get('month');
  const dd = get('day');
  const HH = get('hour') === '24' ? '00' : get('hour');
  const mm = get('minute');
  const ss = get('second');

  return `SG-${yyyy}${MM}${dd}-${HH}${mm}${ss}`;
}

/* -------------------------------------------------------------------- */
/* Formato y capitalización                                              */
/* -------------------------------------------------------------------- */

/** Capitaliza cada palabra ("juan carlos" -> "Juan Carlos") — se aplica a nombres/apellidos. */
export function capitalizarPalabras(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/(^|[\s.'-])([a-záéíóúñü])/g, (_, sep, letra) => sep + letra.toUpperCase());
}

/**
 * Conectores que en un nombre de municipio colombiano van en minúscula,
 * salvo que sean la primera palabra ("El Líbano", pero "Santa Rosa de Lima").
 */
const CONECTORES_LUGAR_MINUSCULA = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'en']);

/**
 * Capitaliza un lugar de expedición tal como aparece en la cédula: cada
 * palabra en mayúscula inicial, salvo los conectores ("de", "del", "la",
 * "las", "los", "y", "en") cuando no son la primera palabra del nombre.
 */
export function capitalizarLugar(valor: string): string {
  const limpio = valor.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!limpio) return '';
  return limpio
    .split(' ')
    .map((palabra, indice) => {
      if (indice > 0 && CONECTORES_LUGAR_MINUSCULA.has(palabra)) return palabra;
      return palabra.replace(/(^|[.'-])([a-záéíóúñü])/g, (_, sep, letra) => sep + letra.toUpperCase());
    })
    .join(' ');
}

/** Puntos de miles en vivo para el número de documento ("1234567" -> "1.234.567"). */
export function formatearMilesDocumento(valor: string): string {
  const soloDigitos = valor.replace(/\D/g, '');
  return soloDigitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Nombre del archivo final del expediente — F: `[SIGLA] - [APELLIDOS NOMBRES].pdf`, sin tildes, mayúsculas. */
export function nombreArchivoExpediente(sigla: string, apellidos: string, nombres: string): string {
  const sinTildes = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();
  return `${sinTildes(sigla)} - ${sinTildes(apellidos)} ${sinTildes(nombres)}.pdf`;
}

export function idDocumentoIndex(id: DocumentoId): number {
  return CATALOGO_DOCUMENTOS.findIndex((d) => d.id === id);
}
