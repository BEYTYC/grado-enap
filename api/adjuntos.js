/**
 * api/adjuntos.js
 *
 * Reemplaza el object store `blobs` de IndexedDB: guarda cada documento
 * adjunto (cédula, PDFs de la facultad, foto, la Autorización de Datos
 * autogenerada, el expediente final unido, etc.) en la biblioteca de
 * documentos por defecto del mismo sitio de SharePoint
 * (`/sites/{siteId}/drive`), uno por carpeta: `Titulacion/_adjuntos/{blobId}/{nombreArchivo}`.
 *
 * Dos restricciones duras de Vercel/Graph que este archivo existe para
 * resolver:
 *
 *  1) Vercel limita el cuerpo de una función serverless a ~4.5MB, pero los
 *     documentos de este módulo pueden pesar hasta 15MB (ver
 *     LIMITE_TAMANO_DOCUMENTO_BYTES en src/data/documentos.ts). Por eso la
 *     subida se hace en fragmentos ("chunked upload") desde el navegador,
 *     relayados uno por uno hacia una sesión de carga reanudable de Graph
 *     (`createUploadSession`). Esta función NUNCA junta el archivo completo
 *     en memoria: cada llamada a `fragmento` solo ve, decodifica y reenvía
 *     UN fragmento (~1.9MB en crudo, ~2.5MB en base64 dentro del JSON), muy
 *     por debajo del límite de Vercel.
 *
 *  2) Para DESCARGAR un documento no se hace un proxy de los bytes a través
 *     de esta función (mismo problema de tamaño, en sentido contrario):
 *     `obtener` solo devuelve la URL de descarga pre-autenticada y de corta
 *     duración que entrega Graph (`@microsoft.graph.downloadUrl`), y el
 *     navegador se trae los bytes directamente desde ahí.
 *
 * Acciones (POST, body JSON con "accion"):
 *   iniciar   — { blobId, nombre, tipo } -> { uploadUrl }
 *   fragmento — { uploadUrl, chunkBase64, start, end, total } -> { status, item? }
 *               (relay de un PUT a Graph con Content-Range correcto; 202 =
 *               falta más, 200/201 = el driveItem ya quedó completo)
 *   obtener   — { blobId } -> { nombre, downloadUrl } (o ambos null si no existe)
 *   eliminar  — { blobId } -> { ok: true }
 */

import { encodePathForGraph, errorConEstado, getAccessToken, manejarPeticion, resolveSiteId, sanitizarNombreArchivo, GRAPH_BASE } from './_lib/graphSharePoint.js';

const CARPETA_ADJUNTOS = 'Titulacion/_adjuntos';

async function accionIniciar(payload) {
  const blobId = String(payload.blobId || '');
  const nombre = String(payload.nombre || '');
  if (!blobId || !nombre) throw errorConEstado('Faltan "blobId" o "nombre".', 400);

  const token = await getAccessToken();
  const siteId = await resolveSiteId(token);
  const nombreSanitizado = sanitizarNombreArchivo(nombre);
  const ruta = `${CARPETA_ADJUNTOS}/${blobId}/${nombreSanitizado}`;
  const url = `${GRAPH_BASE}/sites/${siteId}/drive/root:/${encodePathForGraph(ruta)}:/createUploadSession`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      item: { '@microsoft.graph.conflictBehavior': 'replace' },
    }),
  });
  if (!resp.ok) {
    throw errorConEstado(
      `No se pudo iniciar la carga del documento en SharePoint (${resp.status}).`,
      502,
      await resp.text(),
    );
  }
  const data = await resp.json();
  if (!data.uploadUrl) {
    throw errorConEstado('Microsoft Graph no devolvió una URL de carga.', 502);
  }
  return { uploadUrl: data.uploadUrl, nombreSanitizado };
}

/**
 * Relay de un fragmento: recibe el fragmento en base64, lo decodifica a un
 * Buffer (nunca junta más de un fragmento en memoria) y lo reenvía a Graph
 * con las cabeceras Content-Range/Content-Length correctas. La uploadUrl de
 * Graph ya viene pre-autenticada por la sesión de carga — no lleva el
 * Authorization de esta app.
 */
async function accionFragmento(payload) {
  const { uploadUrl, start, end, total } = payload;
  const chunkBase64 = typeof payload.chunkBase64 === 'string' ? payload.chunkBase64 : '';
  if (!uploadUrl) throw errorConEstado('Falta "uploadUrl".', 400);
  if (typeof start !== 'number' || typeof end !== 'number' || typeof total !== 'number') {
    throw errorConEstado('Faltan "start"/"end"/"total" (numéricos) del fragmento.', 400);
  }

  const buffer = Buffer.from(chunkBase64, 'base64');
  const resp = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Length': String(buffer.length),
      'Content-Range': `bytes ${start}-${end}/${total}`,
    },
    body: buffer,
  });

  const texto = await resp.text();
  let item = null;
  if (texto) {
    try {
      item = JSON.parse(texto);
    } catch {
      item = null;
    }
  }

  // 202 = sesión sigue abierta, esperando más fragmentos. 200/201 = ya quedó
  // el archivo completo (el body es el driveItem final). Cualquier otro
  // código es un fallo real de la subida.
  if (!resp.ok && resp.status !== 202) {
    throw errorConEstado(`Microsoft Graph rechazó el fragmento de carga (${resp.status}).`, 502, texto);
  }
  return { status: resp.status, item };
}

async function accionObtener(payload) {
  const blobId = String(payload.blobId || '');
  if (!blobId) throw errorConEstado('Falta "blobId".', 400);

  const token = await getAccessToken();
  const siteId = await resolveSiteId(token);
  const ruta = `${CARPETA_ADJUNTOS}/${blobId}`;
  const url = `${GRAPH_BASE}/sites/${siteId}/drive/root:/${encodePathForGraph(ruta)}:/children`;

  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (resp.status === 404) return { nombre: null, downloadUrl: null };
  if (!resp.ok) {
    throw errorConEstado(`No se pudo consultar el documento en SharePoint (${resp.status}).`, 502, await resp.text());
  }
  const data = await resp.json();
  const archivo = (data.value || []).find((item) => item.file);
  if (!archivo) return { nombre: null, downloadUrl: null };
  return { nombre: archivo.name, downloadUrl: archivo['@microsoft.graph.downloadUrl'] || null };
}

async function accionEliminar(payload) {
  const blobId = String(payload.blobId || '');
  if (!blobId) throw errorConEstado('Falta "blobId".', 400);

  const token = await getAccessToken();
  const siteId = await resolveSiteId(token);
  const ruta = `${CARPETA_ADJUNTOS}/${blobId}`;
  const url = `${GRAPH_BASE}/sites/${siteId}/drive/root:/${encodePathForGraph(ruta)}`;

  // Borra la carpeta del blob completa (recursivo por naturaleza en Graph) —
  // si ya no existe, se trata como éxito (mismo comportamiento no-bloqueante
  // que tenía `db.delete` de IndexedDB con una clave inexistente).
  const resp = await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok && resp.status !== 404) {
    throw errorConEstado(`No se pudo eliminar el documento en SharePoint (${resp.status}).`, 502, await resp.text());
  }
  return { ok: true };
}

export default async function handler(req, res) {
  await manejarPeticion(req, res, {
    iniciar: accionIniciar,
    fragmento: accionFragmento,
    obtener: accionObtener,
    eliminar: accionEliminar,
  });
}
