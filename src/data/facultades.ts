/**
 * facultades.ts
 * A.2 — Las 6 facultades. Los programas que le pertenecen a cada una son
 * fijos (parte del catálogo institucional); los correos autorizados son solo
 * los valores de fábrica — en runtime son editables y viven en
 * `ConfiguracionTitulacion` (ver services/configService.ts), nunca aquí.
 */

import type { FacultadDef } from '../types';

export const FACULTADES: FacultadDef[] = [
  {
    nombre: 'Administración',
    programas: [
      'Administración',
      'Administración Marítima',
      'Especialización en Logística',
      'Maestría en Gestión Logística',
    ],
  },
  {
    nombre: 'Oceanografía',
    programas: ['Oceanografía Física', 'Maestría en Oceanografía'],
  },
  {
    nombre: 'Ingeniería',
    programas: ['Ingeniería Naval', 'Ingeniería Electrónica', 'Maestría en Ingeniería Naval'],
  },
  {
    nombre: 'Marina Mercante',
    programas: [
      'Ciencias Náuticas para Oficiales Mercantes',
      'Ciencias Náuticas para Oficiales Mercantes de Máquinas',
    ],
  },
  {
    nombre: 'Infantería de Marina',
    programas: ['Ciencias Navales para Oficiales de Infantería de Marina'],
  },
  {
    nombre: 'Ciencias Navales',
    programas: [
      'Ciencias Navales para Oficiales Navales',
      'Especialización en Política y Estrategia Marítima',
      'Doctorado en Ciencias del Mar',
    ],
  },
];

/** Correos autorizados de fábrica (sin dominio), por facultad — A.2. Solo se usan para poblar la configuración la primera vez. */
export const CORREOS_DE_FABRICA: Record<string, string[]> = {
  'Administración': ['posfam', 'cpadm', 'dfam'],
  'Oceanografía': ['jpfof', 'maestriaoceanografia'],
  'Ingeniería': ['maestriaingnaval', 'jdiv.electronica', 'jdivmecanica', 'dfin'],
  'Marina Mercante': ['jpcn', 'dfmm'],
  'Infantería de Marina': ['cpmim', 'jpfim', 'dfim'],
  'Ciencias Navales': ['cadoctoradocm', 'jpcna', 'jcley', 'dfcn'],
};

/** A.2 — la facultad dueña de un programa (búsqueda fija, no depende de configuración). */
export function facultadDelPrograma(nombrePrograma: string): FacultadDef | null {
  const norm = nombrePrograma.trim().toLowerCase();
  return (
    FACULTADES.find((f) => f.programas.some((p) => p.trim().toLowerCase() === norm)) ?? null
  );
}
