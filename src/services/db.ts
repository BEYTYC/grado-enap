/**
 * db.ts
 * Capa de datos del módulo de Titulación — hoy habla con SharePoint (vía
 * Microsoft Graph, con las mismas funciones serverless que ya se usan para
 * correo: ver api/solicitudes.js, api/adjuntos.js, api/bitacora.js), no con
 * IndexedDB. El cambio corrige que antes cada solicitud solo era visible
 * desde el navegador donde se radicó: un estudiante que radicaba en un
 * computador de biblioteca no podía consultar su estado desde otro equipo,
 * y el panel administrativo tampoco veía nada radicado en otro navegador.
 *
 * Igual que antes con IndexedDB: esto sigue siendo la ÚNICA capa que sabe
 * cómo se guardan los datos. `solicitudService.ts` / `bitacoraService.ts`
 * (y a través de ellos, todas las pantallas) siguen llamando exactamente a
 * las mismas funciones, con la misma firma — si el día de mañana cambia otra
 * vez el backend, solo este archivo se toca.
 */

import type { BitacoraEntry, Solicitud } from '../types';

/** Tamaño de cada fragmento de subida — múltiplo de 327 680 bytes (lo que exige Graph), suficientemente
 *  por debajo del límite de ~4.5MB de cuerpo de una función de Vercel una vez codificado en base64
 *  (1 966 080 bytes en crudo ≈ 2.5MB en base64). */
const TAMANO_FRAGMENTO_BYTES = 6 * 327_680; // 1 966 080

async function postJson<T>(url: string, body: unknown, mensajeError: string): Promise<T> {
  let resp: Response;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor. Verifique su conexión e intente de nuevo.');
  }

  let data: unknown = null;
  try {
    data = await resp.json();
  } catch {
    // respuesta vacía o no-JSON — se maneja abajo según resp.ok.
  }

  if (!resp.ok) {
    const detalle = data as { error?: unknown } | null;
    const mensaje = detalle && typeof detalle.error === 'string' && detalle.error ? detalle.error : mensajeError;
    throw new Error(mensaje);
  }

  return data as T;
}

function uint8ArrayABase64(bytes: Uint8Array): string {
  let binario = '';
  const tamanoBloque = 0x8000;
  for (let i = 0; i < bytes.length; i += tamanoBloque) {
    const bloque = bytes.subarray(i, i + tamanoBloque);
    binario += String.fromCharCode(...bloque);
  }
  return btoa(binario);
}

/* ---------------------------- Solicitudes ---------------------------- */

export async function guardarSolicitud(solicitud: Solicitud): Promise<void> {
  await postJson(
    '/api/solicitudes',
    { accion: 'guardar', solicitud },
    'No se pudo guardar la solicitud en el servidor. Intente de nuevo.',
  );
}

export async function obtenerSolicitud(id: string): Promise<Solicitud | undefined> {
  const data = await postJson<{ solicitud: Solicitud | null }>(
    '/api/solicitudes',
    { accion: 'obtener', id },
    'No se pudo consultar la solicitud en el servidor.',
  );
  return data.solicitud ?? undefined;
}

export async function listarSolicitudesPorIdentificacion(identificacion: string): Promise<Solicitud[]> {
  const data = await postJson<{ solicitudes: Solicitud[] }>(
    '/api/solicitudes',
    { accion: 'listarPorIdentificacion', identificacion },
    'No se pudo consultar las solicitudes en el servidor.',
  );
  return data.solicitudes ?? [];
}

export async function buscarPorRadicado(radicado: string): Promise<Solicitud | undefined> {
  const data = await postJson<{ solicitud: Solicitud | null }>(
    '/api/solicitudes',
    { accion: 'buscarPorRadicado', radicado },
    'No se pudo consultar la solicitud en el servidor.',
  );
  return data.solicitud ?? undefined;
}

export async function listarTodasLasSolicitudes(): Promise<Solicitud[]> {
  const data = await postJson<{ solicitudes: Solicitud[] }>(
    '/api/solicitudes',
    { accion: 'listarTodas' },
    'No se pudo consultar las solicitudes en el servidor.',
  );
  return data.solicitudes ?? [];
}

export async function eliminarSolicitud(id: string): Promise<void> {
  await postJson(
    '/api/solicitudes',
    { accion: 'eliminar', id },
    'No se pudo eliminar la solicitud en el servidor.',
  );
}

/* ------------------------------- Blobs -------------------------------- */

/**
 * Sube un documento a SharePoint en fragmentos (nunca en una sola petición:
 * los documentos de este módulo pueden pesar hasta 15MB, muy por encima del
 * límite de ~4.5MB por petición de una función serverless de Vercel — ver
 * api/adjuntos.js). Solo retorna cuando el último fragmento ya quedó
 * confirmado por Microsoft Graph.
 */
export async function guardarBlob(id: string, blob: Blob, nombre: string): Promise<void> {
  if (blob.size === 0) {
    throw new Error('El archivo está vacío. Seleccione un archivo válido e intente de nuevo.');
  }

  const { uploadUrl } = await postJson<{ uploadUrl: string }>(
    '/api/adjuntos',
    { accion: 'iniciar', blobId: id, nombre, tipo: blob.type || 'application/octet-stream' },
    'No se pudo iniciar la carga del documento en el servidor. Intente de nuevo.',
  );
  if (!uploadUrl) {
    throw new Error('No se pudo iniciar la carga del documento en el servidor. Intente de nuevo.');
  }

  const total = blob.size;
  let inicio = 0;
  while (inicio < total) {
    const fin = Math.min(inicio + TAMANO_FRAGMENTO_BYTES, total) - 1;
    const trozo = blob.slice(inicio, fin + 1);
    const bytes = new Uint8Array(await trozo.arrayBuffer());
    const chunkBase64 = uint8ArrayABase64(bytes);

    await postJson(
      '/api/adjuntos',
      { accion: 'fragmento', uploadUrl, chunkBase64, start: inicio, end: fin, total },
      'No se pudo guardar el documento en el servidor. Intente de nuevo.',
    );

    inicio = fin + 1;
  }
}

export async function obtenerBlob(id: string): Promise<{ blob: Blob; nombre: string } | undefined> {
  let info: { nombre: string | null; downloadUrl: string | null };
  try {
    info = await postJson(
      '/api/adjuntos',
      { accion: 'obtener', blobId: id },
      'No se pudo consultar el documento en el servidor.',
    );
  } catch {
    return undefined;
  }
  if (!info.downloadUrl || !info.nombre) return undefined;

  try {
    const resp = await fetch(info.downloadUrl);
    if (!resp.ok) return undefined;
    const blob = await resp.blob();
    return { blob, nombre: info.nombre };
  } catch {
    return undefined;
  }
}

export async function eliminarBlob(id: string): Promise<void> {
  try {
    await postJson('/api/adjuntos', { accion: 'eliminar', blobId: id }, 'No se pudo eliminar el documento en el servidor.');
  } catch (error) {
    // No bloqueante a propósito, igual que el `db.delete` de IndexedDB sobre
    // una clave inexistente: quien llama (por ejemplo, al eliminar una
    // solicitud completa) no debe quedar a medio camino por esto.
    console.warn('[db] no se pudo eliminar un documento en el servidor:', error);
  }
}

/* ------------------------------ Bitácora ------------------------------ */

export async function agregarEntradaBitacora(entry: BitacoraEntry): Promise<void> {
  await postJson(
    '/api/bitacora',
    { accion: 'agregar', entry },
    'No se pudo registrar la entrada de bitácora en el servidor.',
  );
}

export async function listarBitacora(): Promise<BitacoraEntry[]> {
  const data = await postJson<{ entradas: BitacoraEntry[] }>(
    '/api/bitacora',
    { accion: 'listar' },
    'No se pudo consultar la bitácora en el servidor.',
  );
  return data.entradas ?? [];
}
