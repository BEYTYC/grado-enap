/**
 * configService.ts
 * A.2 / A.4 / A.5 — configuración editable en runtime: correos autorizados
 * por facultad, correo de Secretaría, correos de acceso total y el
 * interruptor de "modo pruebas". Vive fuera del código fuente (aquí:
 * localStorage, como el resto de módulos de este proyecto en modo local);
 * en producción real sería una tabla de configuración en el backend.
 *
 * Reglas que este servicio hace cumplir (A.2, G.6):
 *  - Un correo puede pertenecer a varias facultades.
 *  - No se puede agregar un correo a una segunda facultad si ya pertenece a
 *    otra sin quitarlo antes de la primera.
 *  - No se puede quitar el último correo de una facultad.
 */

import { CORREOS_DE_FABRICA, FACULTADES } from '../data/facultades';
import { normalizarCorreoConfig } from './reglasNegocio';
import type { ConfiguracionTitulacion } from '../types';

const STORAGE_KEY = 'titulacion.config.v1';

/** Correo de Secretaría Académica de fábrica — A.4 (un único correo con este rol). */
const SECRETARIA_DE_FABRICA = 'secretariaacademica';

/**
 * Jefe de Estadística (planta): única administradora permanente del portal,
 * con acceso total siempre habilitado. No depende de la configuración
 * guardada — se garantiza en `cargarConfig` para que nunca quede afuera por
 * accidente (por ejemplo, si alguien la retira por error desde el panel de
 * permisos). Es la única entrada de acceso total marcada "Fijo" en el panel.
 */
const ACCESO_TOTAL_PERMANENTE = ['jestadisticaplen'];

/**
 * Acceso total de fábrica que SÍ se puede quitar desde el panel de permisos
 * (no está protegido como `jestadisticaplen`): solo define con qué arranca
 * una configuración nueva, no se vuelve a forzar en `cargarConfig`.
 */
const ACCESO_TOTAL_DE_FABRICA_REMOVIBLE = ['jestadistica', 'prueba'];

/**
 * Usuario de pruebas: entra con el correo «prueba» y acceso total, sin
 * código de verificación (modo pruebas). Igual que con la Jefe de
 * Estadística, se garantiza en `cargarConfig` para que quede disponible
 * siempre, sin importar la configuración ya guardada.
 *
 * A.5: en un despliegue real a producción esta lista debe quedar vacía —
 * aquí se deja «prueba» a propósito, para las pruebas de este proyecto.
 */
const MODO_PRUEBAS_PERMANENTE = ['prueba'];

function configDeFabrica(): ConfiguracionTitulacion {
  const correosPorFacultad: Record<string, string[]> = {};
  for (const facultad of FACULTADES) {
    correosPorFacultad[facultad.nombre] = [...(CORREOS_DE_FABRICA[facultad.nombre] ?? [])];
  }
  return {
    correosPorFacultad,
    correoSecretaria: SECRETARIA_DE_FABRICA,
    correosAccesoTotal: [...ACCESO_TOTAL_PERMANENTE, ...ACCESO_TOTAL_DE_FABRICA_REMOVIBLE],
    correosModoPruebas: [...MODO_PRUEBAS_PERMANENTE],
    fechaAperturaSolicitudes: null,
    fechaCierreSolicitudes: null,
    fechaTentativaGrado: null,
    apiBaseUrl: null,
  };
}

export function cargarConfig(): ConfiguracionTitulacion {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return configDeFabrica();
    const parsed = JSON.parse(raw) as ConfiguracionTitulacion;
    // Defensivo: si se agregó una facultad nueva al catálogo fijo después de
    // guardar esta configuración, que aparezca con su lista de fábrica en
    // vez de quedar sin correos.
    for (const facultad of FACULTADES) {
      if (!parsed.correosPorFacultad[facultad.nombre]) {
        parsed.correosPorFacultad[facultad.nombre] = [...(CORREOS_DE_FABRICA[facultad.nombre] ?? [])];
      }
    }
    // La Jefe de Estadística es la administradora del portal: su acceso total
    // no se pierde aunque la configuración guardada sea de antes de tener
    // este correo, o aunque alguien la haya quitado sin querer desde el panel.
    const accesoTotal = new Set(
      [...ACCESO_TOTAL_PERMANENTE, ...(parsed.correosAccesoTotal ?? [])].map(normalizarCorreoConfig),
    );
    parsed.correosAccesoTotal = Array.from(accesoTotal);

    const modoPruebas = new Set(
      [...MODO_PRUEBAS_PERMANENTE, ...(parsed.correosModoPruebas ?? [])].map(normalizarCorreoConfig),
    );
    parsed.correosModoPruebas = Array.from(modoPruebas);
    // Defensivo también para configuraciones guardadas antes de que estos
    // dos campos existieran.
    if (parsed.fechaAperturaSolicitudes === undefined) parsed.fechaAperturaSolicitudes = null;
    if (parsed.fechaCierreSolicitudes === undefined) parsed.fechaCierreSolicitudes = null;
    if (parsed.fechaTentativaGrado === undefined) parsed.fechaTentativaGrado = null;
    if (parsed.apiBaseUrl === undefined) parsed.apiBaseUrl = null;
    return parsed;
  } catch {
    return configDeFabrica();
  }
}

function guardarConfig(config: ConfiguracionTitulacion): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export interface ResultadoConfig {
  ok: boolean;
  mensaje?: string;
  config: ConfiguracionTitulacion;
}

/** Facultad (si alguna) a la que ya pertenece este correo. */
export function facultadDelCorreo(config: ConfiguracionTitulacion, correo: string): string | null {
  const norm = normalizarCorreoConfig(correo);
  for (const [facultad, correos] of Object.entries(config.correosPorFacultad)) {
    if (correos.some((c) => normalizarCorreoConfig(c) === norm)) return facultad;
  }
  return null;
}

/** A.2 — agrega un correo a una facultad. Falla si ya pertenece a otra distinta. */
export function agregarCorreoAFacultad(
  config: ConfiguracionTitulacion,
  facultad: string,
  correo: string,
): ResultadoConfig {
  const norm = normalizarCorreoConfig(correo);
  if (!norm) return { ok: false, mensaje: 'El correo no puede estar vacío.', config };

  const actual = facultadDelCorreo(config, norm);
  if (actual && actual !== facultad) {
    return {
      ok: false,
      mensaje: `Ese correo ya pertenece a la facultad de ${actual}. Quítelo de ahí antes de agregarlo aquí.`,
      config,
    };
  }
  if (actual === facultad) {
    return { ok: true, config }; // ya estaba, no hay nada que hacer.
  }

  const siguiente: ConfiguracionTitulacion = {
    ...config,
    correosPorFacultad: {
      ...config.correosPorFacultad,
      [facultad]: [...(config.correosPorFacultad[facultad] ?? []), norm],
    },
  };
  guardarConfig(siguiente);
  return { ok: true, config: siguiente };
}

/** A.2 — quita un correo de una facultad. Falla si es el último correo de esa facultad. */
export function quitarCorreoDeFacultad(
  config: ConfiguracionTitulacion,
  facultad: string,
  correo: string,
): ResultadoConfig {
  const norm = normalizarCorreoConfig(correo);
  const correosActuales = config.correosPorFacultad[facultad] ?? [];
  if (correosActuales.length <= 1 && correosActuales.some((c) => normalizarCorreoConfig(c) === norm)) {
    return {
      ok: false,
      mensaje: `No se puede quitar: es el único correo autorizado de la facultad de ${facultad}. Agregue otro antes de retirar este.`,
      config,
    };
  }

  const siguiente: ConfiguracionTitulacion = {
    ...config,
    correosPorFacultad: {
      ...config.correosPorFacultad,
      [facultad]: correosActuales.filter((c) => normalizarCorreoConfig(c) !== norm),
    },
  };
  guardarConfig(siguiente);
  return { ok: true, config: siguiente };
}

export function establecerCorreoSecretaria(
  config: ConfiguracionTitulacion,
  correo: string,
): ConfiguracionTitulacion {
  const siguiente = { ...config, correoSecretaria: normalizarCorreoConfig(correo) };
  guardarConfig(siguiente);
  return siguiente;
}

export function establecerAccesoTotal(
  config: ConfiguracionTitulacion,
  correos: string[],
): ConfiguracionTitulacion {
  const siguiente = { ...config, correosAccesoTotal: correos.map(normalizarCorreoConfig).filter(Boolean) };
  guardarConfig(siguiente);
  return siguiente;
}

/** A.4 — encender/apagar el modo pruebas. Cada cambio queda en la bitácora (ver bitacoraService). */
export function establecerModoPruebas(
  config: ConfiguracionTitulacion,
  correos: string[],
): ConfiguracionTitulacion {
  const siguiente = { ...config, correosModoPruebas: correos.map(normalizarCorreoConfig).filter(Boolean) };
  guardarConfig(siguiente);
  return siguiente;
}

/** Secretaría Académica define cuándo abren (y opcionalmente cuándo cierran) las solicitudes de grado. */
export function establecerFechasDeApertura(
  config: ConfiguracionTitulacion,
  apertura: string | null,
  cierre: string | null,
): ConfiguracionTitulacion {
  const siguiente = { ...config, fechaAperturaSolicitudes: apertura || null, fechaCierreSolicitudes: cierre || null };
  guardarConfig(siguiente);
  return siguiente;
}

/** Fecha tentativa de la ceremonia de grado — informativa para todas las facultades. */
export function establecerFechaTentativaGrado(
  config: ConfiguracionTitulacion,
  fecha: string | null,
): ConfiguracionTitulacion {
  const siguiente = { ...config, fechaTentativaGrado: fecha || null };
  guardarConfig(siguiente);
  return siguiente;
}

/** Dominio base de las funciones de correo — ver el comentario en types.ts. */
export function establecerApiBaseUrl(
  config: ConfiguracionTitulacion,
  url: string | null,
): ConfiguracionTitulacion {
  const limpio = (url ?? '').trim().replace(/\/+$/, '');
  const siguiente = { ...config, apiBaseUrl: limpio || null };
  guardarConfig(siguiente);
  return siguiente;
}

/** A.4 — resuelve el rol de un correo autorizado, o null si no está autorizado en ninguna parte. */
export function rolDeCorreo(
  config: ConfiguracionTitulacion,
  correo: string,
): { rol: 'jefe_programa' | 'secretaria' | 'acceso_total'; facultades: string[] } | null {
  const norm = normalizarCorreoConfig(correo);
  if (config.correosAccesoTotal.some((c) => normalizarCorreoConfig(c) === norm)) {
    return { rol: 'acceso_total', facultades: FACULTADES.map((f) => f.nombre) };
  }
  if (normalizarCorreoConfig(config.correoSecretaria) === norm) {
    return { rol: 'secretaria', facultades: FACULTADES.map((f) => f.nombre) };
  }
  const facultades = Object.entries(config.correosPorFacultad)
    .filter(([, correos]) => correos.some((c) => normalizarCorreoConfig(c) === norm))
    .map(([facultad]) => facultad);
  if (facultades.length) return { rol: 'jefe_programa', facultades };
  return null;
}

export function entraSinCodigoDeVerificacion(config: ConfiguracionTitulacion, correo: string): boolean {
  const norm = normalizarCorreoConfig(correo);
  return config.correosModoPruebas.some((c) => normalizarCorreoConfig(c) === norm);
}
