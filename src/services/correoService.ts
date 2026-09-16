/**
 * correoService.ts
 * Envío real de correo para el módulo de Titulación: dos funciones de
 * servidor (`api/enviar-codigo.js` y `api/notificar.js`, en la carpeta
 * `api/` de este mismo proyecto), llamadas igual que ya se hace en el
 * proyecto hermano de Registro/Auditoría — mismo patrón, misma cuenta de
 * Microsoft Graph.
 *
 * Las dos funciones fallan "en silencio" desde el punto de vista de quien
 * llama: si el correo real no sale (por ejemplo, todavía no se cargaron las
 * variables de entorno en Vercel), se devuelve `false` y quien llama decide
 * el respaldo (mostrar el código en pantalla, o simplemente no bloquear la
 * radicación de la solicitud — la confirmación por correo nunca debe impedir
 * que el estudiante siga).
 */

import { cargarConfig } from './configService';
import type { Solicitud } from '../types';

function endpoint(ruta: string): string {
  const base = cargarConfig().apiBaseUrl;
  return base ? `${base}${ruta}` : ruta;
}

/** E.1 — código de acceso del panel administrativo (Jefe de Programa / Secretaría / acceso total). */
export async function enviarCodigoAdmin(correo: string, code: string): Promise<boolean> {
  try {
    const resp = await fetch(endpoint('/api/enviar-codigo'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: correo, code }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * D.3 — confirmación al estudiante apenas queda radicada la solicitud.
 * `autorizacionPdfBase64` (opcional) es el PDF de Autorización de Tratamiento
 * de Datos ya generado en `radicarSolicitud` (ver solicitudService.ts),
 * convertido a base64 con `bytesABase64` — si viene, api/notificar.js lo
 * adjunta al correo; si no viene (por ejemplo, un reenvío posterior sin el
 * PDF a mano), el correo igual sale, solo que sin adjunto.
 */
export async function enviarConfirmacionRadicacion(
  solicitud: Solicitud,
  autorizacionPdfBase64?: string,
): Promise<boolean> {
  try {
    const resp = await fetch(endpoint('/api/notificar'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: 'radicacion',
        correo: solicitud.correo,
        nombres: solicitud.nombres,
        apellidos: solicitud.apellidos,
        radicado: solicitud.radicado,
        programa: solicitud.programa,
        ...(autorizacionPdfBase64
          ? {
              adjunto: {
                nombre: `Autorizacion_Datos_${solicitud.radicado}.pdf`,
                contentType: 'application/pdf',
                contentBytesBase64: autorizacionPdfBase64,
              },
            }
          : {}),
      }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}
