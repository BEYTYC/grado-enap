/**
 * api/bitacora.js
 *
 * Igual que api/solicitudes.js pero para la bitácora administrativa
 * (BitacoraEntry): lista de SharePoint `ENAP_Bitacora_Titulacion`, solo
 * lectura desde la interfaz (nunca se edita ni se borra una entrada ya
 * escrita — ver bitacoraService.ts), guardada también como JSON completo en
 * una columna `DatosJson`, con `Fecha`/`Actor` replicados aparte solo para
 * que la lista sea legible directamente en SharePoint.
 *
 * Acciones (POST, body JSON con "accion"):
 *   agregar — { entry: BitacoraEntry } -> { ok: true }
 *   listar  — {} -> { entradas: [] }, ya ordenadas más reciente primero
 */

import {
  createItem,
  getAccessToken,
  errorConEstado,
  listAllItems,
  manejarPeticion,
  resolveColumns,
  resolveListId,
  resolveSiteId,
} from './_lib/graphSharePoint.js';

const LISTA_BITACORA = 'ENAP_Bitacora_Titulacion';

const COLUMNAS_CANDIDATAS = {
  entryId: ['EntryId', 'Id', 'IdLocal'],
  fecha: ['Fecha'],
  actor: ['Actor', 'Quien'],
  datosJson: ['DatosJson', 'Datos_Json', 'Datos', 'JSON'],
};

async function contexto() {
  const token = await getAccessToken();
  const siteId = await resolveSiteId(token);
  const listId = await resolveListId(token, siteId, LISTA_BITACORA);
  const columnas = await resolveColumns(token, siteId, listId, COLUMNAS_CANDIDATAS);
  return { token, siteId, listId, columnas };
}

function construirCampos(entry, columnas) {
  const fields = { Title: entry.id };
  const set = (clave, valor) => {
    const interno = columnas.resolved[clave];
    if (interno && valor !== undefined && valor !== null) fields[interno] = valor;
  };
  set('entryId', entry.id);
  set('fecha', entry.fechaIso);
  set('actor', entry.quien);
  set('datosJson', JSON.stringify(entry));
  return fields;
}

function parsearEntrada(item, columnas) {
  const interno = columnas.resolved.datosJson;
  const crudo = interno ? item.fields?.[interno] : undefined;
  if (!crudo) return null;
  try {
    return JSON.parse(crudo);
  } catch (e) {
    console.warn(`[bitacora] elemento ${item.id} tiene DatosJson inválido, se omite:`, e);
    return null;
  }
}

async function accionAgregar(payload) {
  const entry = payload.entry;
  if (!entry || typeof entry !== 'object' || !entry.id) {
    throw errorConEstado('Falta "entry" (o su id) en la petición.', 400);
  }
  const { token, siteId, listId, columnas } = await contexto();
  await createItem(token, siteId, listId, construirCampos(entry, columnas));
  return { ok: true };
}

async function accionListar() {
  const { token, siteId, listId, columnas } = await contexto();
  const items = await listAllItems(token, siteId, listId);
  const entradas = items
    .map((item) => parsearEntrada(item, columnas))
    .filter(Boolean)
    .sort((a, b) => b.fechaIso.localeCompare(a.fechaIso));
  return { entradas };
}

export default async function handler(req, res) {
  await manejarPeticion(req, res, {
    agregar: accionAgregar,
    listar: accionListar,
  });
}
