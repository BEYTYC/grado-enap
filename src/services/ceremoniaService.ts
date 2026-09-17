/**
 * ceremoniaService.ts
 * Consulta la ceremonia activa real, creada por Secretaría Académica desde
 * el Portal principal ("Gestión de Ceremonias de Grado" → lista de
 * SharePoint ENAP_Ceremonias) — ver api/ceremonia.js. Antes, la vía
 * "Ceremonia" del formulario dependía de una fecha guardada aparte en este
 * mismo proyecto (configService.ts), que nadie conectaba con lo que el
 * Portal realmente guarda: por eso una ceremonia marcada "Activa" ahí nunca
 * se veía aquí. Esta consulta reemplaza esa fuente.
 *
 * Si la consulta falla (por ejemplo, el permiso de Graph aún no está
 * concedido, o la lista todavía no existe), se resuelve como "sin
 * ceremonia activa" en vez de romper la pantalla — igual de estricto que
 * antes cuando no había fecha configurada.
 */

export interface CeremoniaActiva {
  nombre: string;
  fechaCeremonia: string | null;
  /** Decide si la vía "Ceremonia" está activa: hoy <= esta fecha. */
  fechaLimiteSolicitudEstudiante: string | null;
  /** Informativa aquí (cargue de documentos + aval del decano); la usan las pantallas de facultad. */
  fechaLimiteValidacionFacultades: string | null;
}

export async function obtenerCeremoniaActiva(): Promise<CeremoniaActiva | null> {
  try {
    const resp = await fetch('/api/ceremonia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'vigente' }),
    });
    if (!resp.ok) {
      console.warn('[Titulación] No se pudo consultar la ceremonia activa:', resp.status);
      return null;
    }
    const data = await resp.json();
    if (!data.activa) return null;
    return {
      nombre: data.nombre ?? '',
      fechaCeremonia: data.fechaCeremonia ?? null,
      fechaLimiteSolicitudEstudiante: data.fechaLimiteSolicitudEstudiante ?? null,
      fechaLimiteValidacionFacultades: data.fechaLimiteValidacionFacultades ?? null,
    };
  } catch (error) {
    console.warn('[Titulación] Error consultando la ceremonia activa:', error);
    return null;
  }
}
