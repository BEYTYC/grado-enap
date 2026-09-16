/**
 * programas.ts
 * A.1 — Los 15 programas académicos. Tabla fija, textual, NO editable desde
 * ninguna pantalla de administración (es una decisión de diseño deliberada:
 * le da validez legal al trámite). Nombres, títulos y siglas copiados
 * literalmente de la especificación — no parafrasear.
 */

import type { Programa } from '../types';

export const PROGRAMAS: Programa[] = [
  { nombre: 'Ciencias Navales para Oficiales Navales', nivel: 'Pregrado', titulo: 'Profesional en Ciencias Navales', sigla: 'NAV' },
  { nombre: 'Ciencias Navales para Oficiales de Infantería de Marina', nivel: 'Pregrado', titulo: 'Profesional en Ciencias Navales', sigla: 'IM' },
  { nombre: 'Ciencias Náuticas para Oficiales Mercantes', nivel: 'Pregrado', titulo: 'Profesional en Ciencias Náuticas', sigla: 'MC' },
  { nombre: 'Ciencias Náuticas para Oficiales Mercantes de Máquinas', nivel: 'Pregrado', titulo: 'Profesional en Ciencias Náuticas', sigla: 'MM' },
  { nombre: 'Administración', nivel: 'Pregrado', titulo: 'Administrador', sigla: 'CCPAD' },
  { nombre: 'Administración Marítima', nivel: 'Pregrado', titulo: 'Administrador Marítimo', sigla: 'CCPAM' },
  { nombre: 'Oceanografía Física', nivel: 'Pregrado', titulo: 'Oceanógrafo Físico', sigla: 'CCPOF' },
  { nombre: 'Ingeniería Naval', nivel: 'Pregrado', titulo: 'Ingeniero Naval', sigla: 'CCPIN' },
  { nombre: 'Ingeniería Electrónica', nivel: 'Pregrado', titulo: 'Ingeniero Electrónico', sigla: 'CCPEL' },
  { nombre: 'Especialización en Logística', nivel: 'Posgrado', titulo: 'Especialista en Logística', sigla: 'ESP.LOG' },
  { nombre: 'Especialización en Política y Estrategia Marítima', nivel: 'Posgrado', titulo: 'Especialista en Política y Estrategia Marítima', sigla: 'ESP. POL' },
  { nombre: 'Maestría en Gestión Logística', nivel: 'Posgrado', titulo: 'Magíster en Gestión Logística', sigla: 'MSC. LOG' },
  { nombre: 'Maestría en Oceanografía', nivel: 'Posgrado', titulo: 'Magíster en Oceanografía', sigla: 'MSC. OCE' },
  { nombre: 'Maestría en Ingeniería Naval', nivel: 'Posgrado', titulo: 'Magíster en Ingeniería Naval', sigla: 'MSC. ING' },
  { nombre: 'Doctorado en Ciencias del Mar', nivel: 'Posgrado', titulo: 'Doctor en Ciencias del Mar', sigla: 'DOCTORADO' },
];

/** Sigla por defecto cuando un programa no coincide con ninguno de los 15 (tras normalizar texto). */
export const SIGLA_POR_DEFECTO = 'CERT';

export function buscarPrograma(nombre: string): Programa | null {
  const norm = nombre.trim().toLowerCase();
  return PROGRAMAS.find((p) => p.nombre.trim().toLowerCase() === norm) ?? null;
}
