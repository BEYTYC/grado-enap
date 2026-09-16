/**
 * bitacoraService.ts
 * B.1 (párrafo final) / E.5 — bitácora administrativa: solo lectura desde la
 * interfaz, nunca se edita ni se borra una entrada ya escrita. Solo visible
 * para el rol "acceso total".
 */

import { agregarEntradaBitacora, listarBitacora } from './db';
import type { BitacoraEntry } from '../types';

export async function registrarEnBitacora(quien: string, accion: string, detalle: string): Promise<void> {
  const entry: BitacoraEntry = {
    id: crypto.randomUUID(),
    fechaIso: new Date().toISOString(),
    quien,
    accion,
    detalle,
  };
  await agregarEntradaBitacora(entry);
}

export async function obtenerBitacora(): Promise<BitacoraEntry[]> {
  return listarBitacora();
}
