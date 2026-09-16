/**
 * api/notificar.js
 *
 * Correos de aviso del módulo de Titulación, vía Microsoft Graph (mismo
 * permiso de aplicación "Mail.Send" que usa api/enviar-codigo.js). Por ahora
 * atiende una sola acción:
 *
 *   accion: "radicacion" — confirmación al estudiante apenas queda radicada
 *   su solicitud (D.3), con el número de radicado. Se llama desde
 *   src/services/correoService.ts justo después de guardar la solicitud —
 *   si este correo falla, la radicación ya quedó hecha de todas formas: al
 *   estudiante nunca se le bloquea ni se le muestra error por esto.
 *
 * Variables de entorno (Vercel → Settings → Environment Variables, en ESTE
 * proyecto — pueden ser las mismas del proyecto de Registro/Auditoría si se
 * reutiliza el mismo App Registration de Entra ID):
 *
 *   GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET, GRAPH_MAIL_FROM
 *   API_KEY   (opcional) clave compartida, cabecera x-api-key.
 */

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

let cachedToken = null; // { value, expiresAt }

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const { GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET } = process.env;
  if (!GRAPH_TENANT_ID || !GRAPH_CLIENT_ID || !GRAPH_CLIENT_SECRET) {
    throw new Error(
      'Faltan GRAPH_TENANT_ID, GRAPH_CLIENT_ID o GRAPH_CLIENT_SECRET en las variables de entorno de Vercel.',
    );
  }

  const body = new URLSearchParams({
    client_id: GRAPH_CLIENT_ID,
    client_secret: GRAPH_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const resp = await fetch(`https://login.microsoftonline.com/${GRAPH_TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!resp.ok) {
    throw new Error(`No se pudo autenticar con Microsoft Graph (${resp.status}): ${await resp.text()}`);
  }

  const data = await resp.json();
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

async function enviarCorreo({ to, subject, html, adjunto }) {
  const from = process.env.GRAPH_MAIL_FROM;
  if (!from) {
    const error = new Error('Falta GRAPH_MAIL_FROM en las variables de entorno de Vercel.');
    error.status = 500;
    throw error;
  }

  const token = await getAccessToken();
  const mensaje = {
    message: {
      subject,
      body: { contentType: 'HTML', content: html },
      toRecipients: [{ emailAddress: { address: to } }],
      // Adjunto opcional (hoy, el PDF de Autorización de Tratamiento de
      // Datos generado al radicar — ver correoService.ts). Graph espera los
      // bytes ya en base64 en "contentBytes"; el llamador ya nos los manda así.
      ...(adjunto
        ? {
            attachments: [
              {
                '@odata.type': '#microsoft.graph.fileAttachment',
                name: adjunto.nombre,
                contentType: adjunto.contentType || 'application/pdf',
                contentBytes: adjunto.contentBytesBase64,
              },
            ],
          }
        : {}),
    },
    saveToSentItems: true,
  };

  const resp = await fetch(`${GRAPH_BASE}/users/${encodeURIComponent(from)}/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(mensaje),
  });

  if (!resp.ok) {
    const error = new Error('No se pudo enviar el correo.');
    error.status = 502;
    error.detail = await resp.text();
    throw error;
  }
}

async function notificarRadicacion(payload) {
  const correo = String(payload.correo || '').trim();
  if (!correo) {
    const error = new Error('Falta "correo" del estudiante.');
    error.status = 400;
    throw error;
  }

  const radicado = escapeHtml(payload.radicado);
  const nombres = escapeHtml(payload.nombres);
  const apellidos = escapeHtml(payload.apellidos);
  const programa = escapeHtml(payload.programa);
  const adjunto = payload.adjunto && payload.adjunto.contentBytesBase64 ? payload.adjunto : null;

  await enviarCorreo({
    to: correo,
    subject: `Solicitud de titulación radicada — ${payload.radicado ?? ''}`,
    adjunto,
    html: `
      <p>Estimado(a) <b>${nombres} ${apellidos}</b>:</p>
      <p>Su solicitud de titulación para el programa <b>${programa}</b> quedó radicada con el
      siguiente número:</p>
      <p style="font-size:22px;font-weight:bold;letter-spacing:1px;">${radicado}</p>
      <p>Enviamos una confirmación a ${escapeHtml(correo)} con este radicado${adjunto ? ' y adjunto el resumen de su solicitud (Autorización de Tratamiento de Datos)' : ''}.</p>
      <p>Guarde este número: lo va a necesitar para consultar el estado de su trámite. Puede hacerlo
      en cualquier momento desde el portal, ingresando su número de documento.</p>
      <p>La facultad revisará su solicitud y los documentos adjuntos; si falta algo, se lo hará saber
      a través del mismo portal.</p>
      <p style="color:#888;font-size:12px;">Este es un mensaje generado automáticamente por el Sistema
      de Solicitud de Titulación — Escuela Naval de Cadetes "Almirante Padilla".</p>
    `,
  });
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido: use POST.' });
    return;
  }

  const apiKey = process.env.API_KEY;
  if (apiKey && req.headers['x-api-key'] !== apiKey) {
    res.status(401).json({ error: 'Clave de API inválida o ausente.' });
    return;
  }

  const payload = typeof req.body === 'object' && req.body ? req.body : {};

  try {
    if (payload.accion === 'radicacion') {
      await notificarRadicacion(payload);
      res.status(200).json({ ok: true });
      return;
    }
    res.status(400).json({ error: `Acción desconocida: "${payload.accion}".` });
  } catch (error) {
    const status = error && error.status ? error.status : 500;
    res.status(status).json({
      error: error instanceof Error ? error.message : String(error),
      detail: error && error.detail ? error.detail : undefined,
    });
  }
}
