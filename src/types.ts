/**
 * types.ts
 * Modelo de datos compartido del módulo de Titulación (Partes 1 y 2).
 *
 * Traduce 1:1 las secciones A y B de la especificación: los 24 campos de una
 * solicitud (B.1), los estados (B.2), el catálogo de documentos (C) y los
 * catálogos fijos de programas/facultades (A.1, A.2). No se simplifica ni se
 * inventa ningún campo — donde la especificación dice "siempre calculado" o
 * "nunca editable", el tipo lo refleja dejando esos campos fuera de los
 * formularios de edición y calculándolos en un solo lugar (reglasNegocio.ts).
 */

export type Nivel = 'Pregrado' | 'Posgrado';

export type TipoDocumentoIdentidad =
  | 'Cédula de Ciudadanía'
  | 'Tarjeta de Identidad'
  | 'Cédula de Extranjería'
  | 'Pasaporte';

export const TIPOS_DOCUMENTO_IDENTIDAD: TipoDocumentoIdentidad[] = [
  'Cédula de Ciudadanía',
  'Tarjeta de Identidad',
  'Cédula de Extranjería',
  'Pasaporte',
];

/**
 * Estado interno de una solicitud (B.2). El texto que se le muestra a cada
 * rol es distinto — eso se resuelve en `reglasNegocio.ts` con
 * `textoEstadoParaRol`, nunca guardando una redacción distinta por rol.
 */
export type EstadoSolicitud =
  | 'radicada'
  | 'en_revision'
  | 'completa'
  | 'aprobada'
  | 'anulada';

export type OpcionGrado =
  | 'Trabajo de grado'
  | 'Diplomado'
  | 'Producción científica'
  | 'Solución de problemas del sector'
  | 'Caso de Estudio'
  | 'Pasantía';

/**
 * Vía por la que el estudiante radica: "Ceremonia" (entra al lote de una
 * ceremonia de grado con fecha tentativa; solo disponible si esa fecha está
 * vigente y dentro de la ventana de radicación) o "Ventanilla" (trámite
 * individual, siempre disponible, sin depender de ninguna ceremonia). Ver
 * `vigenciaCeremonia` en reglasNegocio.ts.
 */
export type ViaRadicacion = 'Ceremonia' | 'Ventanilla';

export type Distincion =
  | 'Ninguna'
  | 'Cum Laude'
  | 'Magna Cum Laude'
  | 'Summa Cum Laude';

/** A.1 — fila fija de la tabla de programas. Nunca editable en runtime. */
export interface Programa {
  nombre: string;
  nivel: Nivel;
  titulo: string;
  sigla: string;
}

/** A.2 — una facultad y sus programas fijos; los correos sí son editables. */
export interface FacultadDef {
  nombre: string;
  programas: string[];
}

/** id de documento del catálogo C. */
export type DocumentoId =
  | 'cedula'
  | 'balance'
  | 'calificacion_grado'
  | 'promedio'
  | 'pago_derechos'
  | 'estampilla'
  | 'diploma_anterior'
  | 'idioma'
  | 'saber_pro'
  | 'constancia_diplomado'
  | 'anexo2_1'
  | 'anexo2_2'
  | 'reconocimiento_1'
  | 'reconocimiento_2'
  | 'foto';

export type EtapaDocumento = 'estudiante' | 'facultad';

/** C — un tipo de documento del catálogo, con su regla de aplicabilidad. */
export interface DocumentoDef {
  id: DocumentoId;
  orden: number;
  nombre: string;
  etapa: EtapaDocumento;
  /** true si el documento aplica a esta combinación de nivel/opción/distinción. */
  aplica: (ctx: { nivel: Nivel; opcionGrado: OpcionGrado | ''; distincion: Distincion | '' }) => boolean;
  /**
   * Tipo de archivo aceptado — por defecto 'pdf' (todo el catálogo original
   * son PDF). Solo la fotografía ('foto') acepta 'imagen' (JPG/PNG), porque
   * pedirle al estudiante que convierta una foto a PDF no tiene sentido.
   */
  tipoArchivo?: 'pdf' | 'imagen';
}

/** Un documento ya cargado dentro de una solicitud. */
export interface DocumentoCargado {
  id: DocumentoId;
  nombreArchivo: string;
  tamanoBytes: number;
  /** El propio blob, para el modo local (IndexedDB). En producción real sería una URL de almacenamiento. */
  blobId: string;
  cargadoEnIso: string;
  /** Solo tiene sentido para documentos que sube el estudiante (B.5). */
  avalado: boolean;
}

/**
 * B.1 — los 24 campos de una solicitud. El id de Mongo/IndexedDB y el
 * "documentos" cargados van aparte para no forzar 24 columnas planas en el
 * almacenamiento, pero cada campo de la tabla original tiene su contraparte
 * exacta aquí (se anota el número de la tabla en el comentario).
 */
export interface Solicitud {
  id: string;
  fecha: string; // 1. Fecha (ISO)
  radicado: string; // 2. Radicado — SG-yyyyMMdd-HHmmss
  estado: EstadoSolicitud; // 3. Estado
  facultadReferencial: string; // 4. Facultad (solo referencial, se recalcula siempre)
  nombres: string; // 5.
  apellidos: string; // 6.
  tipoDocumento: TipoDocumentoIdentidad; // 7.
  identificacion: string; // 8.
  correo: string; // 9.
  telefono: string; // 10.
  nivel: Nivel; // 11. — siempre deducido del programa
  programa: string; // 12. — uno de los 15 exactos
  opcionGrado: OpcionGrado | ''; // 13.
  nombreTrabajoGrado: string; // 14. — la completa la facultad
  distincion: Distincion; // 15. — "Ninguna" por defecto
  graduadoDeHonor: boolean; // 16. — calculado, ver B.4
  codigoEk: string; // 17. — solo pregrado
  promedioPonderado: number | null; // 18. — la completa la facultad
  enlacePdf: string | null; // 19. — expediente final unido
  // 20. Avance de documentos ("5 de 8") se deriva de documentos + catálogo aplicable, no se guarda aparte.
  autorizacionDatos: string | null; // 21. — "Autorizado el [fecha]" | null = "No registrada"
  lugarExpedicion: string; // 22.
  // 23. Título académico: se deriva siempre de `programa` vía catalogoProgramas — no se guarda como campo editable.
  documentosAvaladosPorFacultad: DocumentoId[]; // 24. — ids ya avalados que subió la facultad (informativo; el aval real vive en cada DocumentoCargado)

  /** 25. — nuevo: por cuál vía se radicó (ver ViaRadicacion). */
  viaRadicacion: ViaRadicacion;
  /**
   * 26. — nuevo: blobId (IndexedDB local) del PDF de Autorización de Datos
   * generado automáticamente al radicar — ver autorizacionDatosService.ts.
   * null solo puede pasar en solicitudes radicadas antes de este cambio.
   */
  autorizacionDatosPdfBlobId: string | null;

  documentos: DocumentoCargado[];

  // Metadatos de anulación (parte de "Estado = anulada", no un campo aparte en la tabla original).
  anuladoPor?: string;
  anuladoEnIso?: string;
  motivoAnulacion?: string;
}

export type RolTitulacion = 'jefe_programa' | 'secretaria' | 'acceso_total';

/** Una entrada de la bitácora administrativa (B.1, párrafo final). Solo lectura. */
export interface BitacoraEntry {
  id: string;
  fechaIso: string;
  quien: string;
  accion: string;
  detalle: string;
}

/** A.2 + A.4 — configuración editable en runtime (correos, secretaría, acceso total, modo pruebas). */
export interface ConfiguracionTitulacion {
  correosPorFacultad: Record<string, string[]>; // clave = nombre de facultad
  correoSecretaria: string;
  correosAccesoTotal: string[];
  correosModoPruebas: string[]; // debe estar vacía en producción
  /** Fecha (AAAA-MM-DD) desde la que el estudiante puede radicar — null = sin restricción, siempre abierto. Lo define Secretaría Académica. */
  fechaAperturaSolicitudes: string | null;
  /** Fecha (AAAA-MM-DD) límite para radicar — null = sin fecha de cierre. */
  fechaCierreSolicitudes: string | null;
  /**
   * Fecha (AAAA-MM-DD) tentativa de la ceremonia de grado. Informativa: la
   * define Secretaría Académica (o acceso total) junto con la ventana de
   * radicación, y se muestra también al Jefe de Programa de cada facultad —
   * null = todavía no hay fecha definida.
   */
  fechaTentativaGrado: string | null;
  /**
   * Dominio base de las funciones de correo (`api/enviar-codigo` y
   * `api/notificar`), por ejemplo `https://titulacion-grados-alumno.vercel.app`.
   * Solo hace falta configurarlo cuando esta app corre embebida en OTRO
   * dominio (por ejemplo, dentro del Portal) — ahí una ruta relativa como
   * "/api/enviar-codigo" apuntaría al dominio del Portal, que no tiene esas
   * funciones. Si esta app se abre directamente en su propio dominio, se
   * puede dejar en null: usa rutas relativas y funciona igual.
   */
  apiBaseUrl: string | null;
}
