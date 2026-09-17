/**
 * api/ceremonia.js
 *
 * Lee (solo lectura) la lista de SharePoint "ENAP_Ceremonias" — la MISMA
 * lista donde el Portal principal (módulo "Gestión de Ceremonias de
 * Grado") crea y edita las ceremonias — para que la vía "Ceremonia" del
 * formulario del estudiante reconozca una ceremonia real en vez de
 * depender de una fecha manual guardada aparte en este proyecto.
 *
 * Antes de este cambio, `vigenciaCeremonia()` (ver src/services/
 * reglasNegocio.ts) se alimentaba de `fechaTentativaGrado` en
 * localStorage (src/services/configService.ts) — un campo que nadie
 * conectaba con lo que el Portal realmente guarda en SharePoint. Por eso
 * una ceremonia marcada "Activa" en el Portal nunca se veía reflejada
 * aquí. Este endpoint cierra esa brecha leyendo la lista real.
 *
 * Mismo sitio y mismo esquema de columnas que usa el Portal (ver su
 * `guardarCeremonia()`): Title/Nombre, FechaCeremonia, FechaLimite
 * Documentos, Estado ("Borrador" | "Activa" | "Cerrada"), Observaciones —
 * resueltas dinámicamente por nombre visible, nunca hardcodeadas, por si
 * el nombre interno real difiere.
 *
 * Variables de entorno: las mismas GRAPH_TENANT_ID / GRAPH_CLIENT_ID /
 * GRAPH_CLIENT_SECRET que ya usan api/notificar.js y api/solicitudes.js.
 * El App Registration necesita, como mínimo, permiso de lectura sobre el
 * sitio (Sites.Read.All o Sites.ReadWrite.All — este último ya se pidió
 * en BACKEND_SHAREPOINT.md para las solicitudes, así que no hace falta
 * pedir uno adicional si ya se concedió ese).
 */

import {
  getAccessToken,
  resolveSiteId,
  resolveListId,
  resolveColumns,
  listAllItems,
  manejarPeticion,
} from './_lib/graphSharePoint.js';

const LISTA_CEREMONIAS = 'ENAP_Ceremonias';

const CANDIDATOS_COLUMNAS = {
  nombre: ['Title', 'Nombre', 'Nombre de la ceremonia'],
  fechaCeremonia: ['FechaCeremonia', 'Fecha de la ceremonia', 'Fecha_ceremonia'],
  fechaLimiteDocumentos: ['FechaLimiteDocumentos', 'Fecha limite de documentos', 'Fecha limite', 'FechaLimite'],
  estado: ['Estado'],
  observaciones: ['Observaciones'],
};

function normalizarEstado(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** yyyy-mm-dd a partir de lo que SharePoint entregue (fecha completa ISO u otro formato de fecha). */
function soloFecha(valor) {
  if (!valor) return null;
  const texto = String(valor);
  const m = texto.match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
}

async function leerCeremonias() {
  const token = await getAccessToken();
  const siteId = await resolveSiteId(token);
  const listaId = await resolveListId(token, siteId, LISTA_CEREMONIAS);
  const { resolved: col } = await resolveColumns(token, siteId, listaId, CANDIDATOS_COLUMNAS);
  const items = await listAllItems(token, siteId, listaId);

  return items.map((item) => {
    const f = item.fields || {};
    return {
      id: item.id,
      nombre: col.nombre ? f[col.nombre] ?? '' : '',
      fechaCeremonia: col.fechaCeremonia ? soloFecha(f[col.fechaCeremonia]) : null,
      fechaLimiteDocumentos: col.fechaLimiteDocumentos ? soloFecha(f[col.fechaLimiteDocumentos]) : null,
      estado: col.estado ? f[col.estado] ?? '' : '',
      observaciones: col.observaciones ? f[col.observaciones] ?? '' : '',
    };
  });
}

/**
 * De todas las ceremonias marcadas "Activa", elige la más relevante para
 * el estudiante: la de fecha más próxima que todavía no haya pasado: si
 * ninguna Activa tiene fecha futura, se toma la Activa más reciente (mejor
 * mostrar algo que el admin marcó explícitamente como vigente, que nada).
 */
function elegirCeremoniaActiva(ceremonias) {
  const activas = ceremonias.filter((c) => normalizarEstado(c.estado) === 'activa');
  if (!activas.length) return null;

  const hoyIso = new Date().toISOString().slice(0, 10);
  const futuras = activas
    .filter((c) => c.fechaCeremonia && c.fechaCeremonia >= hoyIso)
    .sort((a, b) => a.fechaCeremonia.localeCompare(b.fechaCeremonia));
  if (futuras.length) return futuras[0];

  const conFecha = activas.filter((c) => c.fechaCeremonia).sort((a, b) => b.fechaCeremonia.localeCompare(a.fechaCeremonia));
  return conFecha[0] || activas[0];
}

export default async function handler(req, res) {
  await manejarPeticion(req, res, {
    async vigente() {
      const ceremonias = await leerCeremonias();
      const elegida = elegirCeremoniaActiva(ceremonias);
      if (!elegida) {
        return { activa: false };
      }
      return {
        activa: true,
        nombre: elegida.nombre,
        fechaCeremonia: elegida.fechaCeremonia,
        fechaLimiteDocumentos: elegida.fechaLimiteDocumentos,
      };
    },
  });
}
