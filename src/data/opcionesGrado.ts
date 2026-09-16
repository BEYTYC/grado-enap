/**
 * opcionesGrado.ts
 * A.3 — Opciones de grado y distinciones posibles, por nivel.
 */

import type { Distincion, Nivel, OpcionGrado } from '../types';

export const OPCIONES_GRADO_POR_NIVEL: Record<Nivel, OpcionGrado[]> = {
  Pregrado: ['Trabajo de grado', 'Diplomado'],
  Posgrado: [
    'Trabajo de grado',
    'Producción científica',
    'Diplomado',
    'Solución de problemas del sector',
    'Caso de Estudio',
    'Pasantía',
  ],
};

export const DISTINCIONES_POR_NIVEL: Record<Nivel, Distincion[]> = {
  Pregrado: ['Cum Laude'],
  Posgrado: ['Cum Laude', 'Summa Cum Laude', 'Magna Cum Laude'],
};
