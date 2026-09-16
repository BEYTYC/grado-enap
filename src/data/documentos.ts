/**
 * documentos.ts
 * C — Catálogo de los 13 tipos de documento y sus reglas de aplicabilidad.
 *
 * El orden de este arreglo importa: define el número (01, 02, 03…) con el
 * que cada documento se nombra dentro del expediente final unido, para que
 * el PDF quede armado en el orden oficial (F).
 */

import type { DocumentoDef } from '../types';

export const CATALOGO_DOCUMENTOS: DocumentoDef[] = [
  {
    id: 'cedula',
    orden: 1,
    nombre: 'Documento de Identidad (ambas caras)',
    etapa: 'estudiante',
    aplica: () => true,
  },
  {
    id: 'balance',
    orden: 2,
    nombre: 'Balance Académico',
    etapa: 'facultad',
    aplica: () => true,
  },
  {
    id: 'calificacion_grado',
    orden: 3,
    nombre: 'Formato Calificación de Grado',
    etapa: 'facultad',
    aplica: () => true,
  },
  {
    id: 'promedio',
    orden: 4,
    nombre: 'Certificado de Promedio Ponderado',
    etapa: 'facultad',
    aplica: () => true,
  },
  {
    id: 'pago_derechos',
    orden: 5,
    nombre: 'Comprobante de Pago de Derechos de Grado',
    etapa: 'estudiante',
    aplica: () => true,
  },
  {
    id: 'estampilla',
    orden: 6,
    nombre: 'Comprobante de Pago Estampilla Procultura',
    etapa: 'estudiante',
    aplica: () => true,
  },
  {
    id: 'diploma_anterior',
    orden: 7,
    nombre: 'Diploma o Acta de Grado de Bachiller (pregrado) / de Pregrado (posgrado)',
    etapa: 'estudiante',
    aplica: () => true,
  },
  {
    id: 'idioma',
    orden: 8,
    nombre: 'Certificación de Idioma (Inglés / CIEN)',
    etapa: 'facultad',
    aplica: () => true,
  },
  {
    id: 'saber_pro',
    orden: 9,
    nombre: 'Resultados Pruebas Saber Pro / TyT',
    etapa: 'estudiante',
    aplica: ({ nivel }) => nivel === 'Pregrado',
  },
  {
    id: 'constancia_diplomado',
    orden: 10,
    nombre: 'Constancia Diplomado',
    etapa: 'estudiante',
    aplica: ({ opcionGrado }) => opcionGrado === 'Diplomado',
  },
  {
    id: 'anexo2_1',
    orden: 11,
    nombre: 'Evaluación de Trabajo de Grado — Anexo 2 (Evaluación 1)',
    etapa: 'facultad',
    aplica: ({ opcionGrado }) => opcionGrado === 'Trabajo de grado',
  },
  {
    id: 'anexo2_2',
    orden: 12,
    nombre: 'Evaluación de Trabajo de Grado — Anexo 2 (Evaluación 2)',
    etapa: 'facultad',
    aplica: ({ opcionGrado }) => opcionGrado === 'Trabajo de grado',
  },
  {
    id: 'reconocimiento_1',
    orden: 13,
    nombre: 'Solicitud de Reconocimiento — Evaluador 1',
    etapa: 'facultad',
    aplica: ({ opcionGrado, distincion }) =>
      opcionGrado === 'Trabajo de grado' && Boolean(distincion) && distincion !== 'Ninguna',
  },
  {
    id: 'reconocimiento_2',
    orden: 14,
    nombre: 'Solicitud de Reconocimiento — Evaluador 2',
    etapa: 'facultad',
    aplica: ({ opcionGrado, distincion }) =>
      opcionGrado === 'Trabajo de grado' && Boolean(distincion) && distincion !== 'Ninguna',
  },
  {
    id: 'foto',
    orden: 15,
    nombre: 'Fotografía 3x4, fondo azul (civil) o de uniforme 3A marinera (militar)',
    etapa: 'estudiante',
    aplica: () => true,
    // Única excepción del catálogo que no es PDF — ver PasoDocumentos.tsx.
    tipoArchivo: 'imagen',
  },
];

/** Límite de tamaño por documento — A.5. */
export const LIMITE_TAMANO_DOCUMENTO_BYTES = 15 * 1024 * 1024;
