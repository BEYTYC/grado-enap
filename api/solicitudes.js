/**
 * api/solicitudes.js
 *
 * Reemplaza IndexedDB como almacén de las solicitudes de titulación: guarda y
 * lee cada `Solicitud` completa como JSON en una lista de SharePoint
 * (`ENAP_Solicitudes`, en el mismo sitio que usa el Portal para
 * ENAP_Ceremonias — ver api/_lib/graphSharePoint.js), vía Microsoft Graph con
 * el mismo App Registration app-only que ya usan api/notificar.js y
 * api/enviar-codigo.js.
 *
 * Por qué JSON-en-una-columna en vez de ~20 columnas 1 a 1: crear a mano en
 * SharePoint una columna exacta por cada uno de los 26 campos de `Solicitud`
 * es frágil (cualquier typo del administrador rompe el guardado). En cambio,
 * el objeto completo se guarda como texto en una sola columna multilínea
 * (`DatosJson`), y unos pocos campos se REPLICAN aparte solo para que la
 * vista de lista de SharePoint siga siendo útil a simple vista y para poder
 * filtrar sin tener que traer y parsear todo. La fuente de verdad al LEER
 * siempre es `DatosJson` — nunca se reconstruye una Solicitud a partir de las
 * columnas replicadas.
 *
 * Acciones (POST, body JSON con "accion"):
 *   guardar               — upsert por `solicitud.id` (columna candidata
 *                            SolicitudId/Id/IdLocal; si no existe esa
 *                            columna, se cae a comparar el `id` ya guardado
 *                            dentro de DatosJson).
 *   obtener                — { id } -> { solicitud | null }
 *   listarPorIdentificacion — { identificacion } -> { solicitudes: [] }
 *   buscarPorRadicado       — { radicado } -> { solicitud | null }
 *   listarTodas             — {} -> { solicitudes: [] } (pagina toda la lista)
 *   eliminar                — { id } -> { ok: true }
 */

import {
  createItem,
  deleteItem,
  getAccessToken,
  errorConEstado,
  listAllItems,
  manejarPeticion,
  patchItemFields,
  resolveColumns,
  resolveListId,
  resolveSiteId,
} from './_lib/graphSharePoint.js';

const LISTA_SOLICITUDES = 'ENAP_Solicitudes';

/** Nombres candidatos (displayName) de cada columna — se resuelven en runtime, nunca se asume el nombre interno exacto. */
const COLUMNAS_CANDIDATAS = {
  solicitudId: ['SolicitudId', 'Id', 'IdLocal'],
  radicado: ['Radicado'],
  identificacion: ['Identificacion', 'Identificación'],
  estado: ['Estado'],
  nombres: ['Nombres'],
  apellidos: ['Apellidos'],
  programa: ['Programa'],
  correo: ['Correo'],
  datosJson: ['DatosJson', 'Datos_Json', 'Datos', 'JSON'],
};

async function contexto() {
  const token = await getAccessToken();
  const siteId = await resolveSiteId(token);
  const listId = await resolveListId(token, siteId, LISTA_SOLICITUDES);
  const columnas = await resolveColumns(token, siteId, listId, COLUMNAS_CANDIDATAS);
  return { token, siteId, listId, columnas };
}

function construirCampos(solicitud, columnas) {
  const fields = { Title: solicitud.radicado || solicitud.id };
  const set = (clave, valor) => {
    const interno = columnas.resolved[clave];
    if (interno && valor !== undefined && valor !== null) fields[interno] = valor;
  };
  set('solicitudId', solicitud.id);
  set('radicado', solicitud.radicado);
  set('identificacion', solicitud.identificacion);
  set('estado', solicitud.estado);
  set('nombres', solicitud.nombres);
  set('apellidos', solicitud.apellidos);
  set('programa', solicitud.programa);
  set('correo', solicitud.correo);
  set('datosJson', JSON.stringify(solicitud));
  return fields;
}

/** Reconstruye la Solicitud completa SIEMPRE desde DatosJson — nunca desde las columnas replicadas. */
function parsearSolicitud(item, columnas) {
  const interno = columnas.resolved.datosJson;
  const crudo = interno ? item.fields?.[interno] : undefined;
  if (!crudo) return null;
  try {
    return JSON.parse(crudo);
  } catch (e) {
    console.warn(`[solicitudes] elemento ${item.id} tiene DatosJson inválido, se omite:`, e);
    return null;
  }
}

async function buscarItemPorId(token, siteId, listId, columnas, id) {
  const items = await listAllItems(token, siteId, listId);
  const internoId = columnas.resolved.solicitudId;
  for (const item of items) {
    if (internoId && item.fields?.[internoId] === id) return item;
  }
  // Si la columna SolicitudId no existe o no coincidió, se cae a comparar el
  // id que ya viene dentro del propio JSON guardado.
  for (const item of items) {
    const parsed = parsearSolicitud(item, columnas);
    if (parsed && parsed.id === id) return item;
  }
  return null;
}

async function accionGuardar(payload) {
  const solicitud = payload.solicitud;
  if (!solicitud || typeof solicitud !== 'object' || !solicitud.id) {
    throw errorConEstado('Falta "solicitud" (o su id) en la petición.', 400);
  }
  const { token, siteId, listId, columnas } = await contexto();
  const fields = construirCampos(solicitud, columnas);

  const existente = await buscarItemPorId(token, siteId, listId, columnas, solicitud.id);
  if (existente) {
    await patchItemFields(token, siteId, listId, existente.id, fields);
  } else {
    await createItem(token, siteId, listId, fields);
  }
  return { ok: true };
}

async function accionObtener(payload) {
  const id = String(payload.id || '');
  if (!id) throw errorConEstado('Falta "id".', 400);
  const { token, siteId, listId, columnas } = await contexto();
  const item = await buscarItemPorId(token, siteId, listId, columnas, id);
  return { solicitud: item ? parsearSolicitud(item, columnas) : null };
}

async function accionListarPorIdentificacion(payload) {
  const identificacion = String(payload.identificacion || '').trim();
  const { token, siteId, listId, columnas } = await contexto();
  const items = await listAllItems(token, siteId, listId);
  const solicitudes = items
    .map((item) => parsearSolicitud(item, columnas))
    .filter((s) => s && s.identificacion === identificacion);
  return { solicitudes };
}

async function accionBuscarPorRadicado(payload) {
  const radicado = String(payload.radicado || '').trim();
  const { token, siteId, listId, columnas } = await contexto();
  const items = await listAllItems(token, siteId, listId);
  for (const item of items) {
    const parsed = parsearSolicitud(item, columnas);
    if (parsed && parsed.radicado === radicado) return { solicitud: parsed };
  }
  return { solicitud: null };
}

async function accionListarTodas() {
  const { token, siteId, listId, columnas } = await contexto();
  const items = await listAllItems(token, siteId, listId);
  const solicitudes = items.map((item) => parsearSolicitud(item, columnas)).filter(Boolean);
  return { solicitudes };
}

async function accionEliminar(payload) {
  const id = String(payload.id || '');
  if (!id) throw errorConEstado('Falta "id".', 400);
  const { token, siteId, listId, columnas } = await contexto();
  const item = await buscarItemPorId(token, siteId, listId, columnas, id);
  if (item) await deleteItem(token, siteId, listId, item.id);
  return { ok: true };
}

export default async function handler(req, res) {
  await manejarPeticion(req, res, {
    guardar: accionGuardar,
    obtener: accionObtener,
    listarPorIdentificacion: accionListarPorIdentificacion,
    buscarPorRadicado: accionBuscarPorRadicado,
    listarTodas: accionListarTodas,
    eliminar: accionEliminar,
  });
}
