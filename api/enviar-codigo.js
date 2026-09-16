/**
 * api/enviar-codigo.js
 *
 * Manda por correo real (Microsoft Graph, permiso de aplicación "Mail.Send")
 * el código de acceso de un solo uso del panel administrativo de Titulación
 * (Jefe de Programa, Secretaría Académica, acceso total). Mismo patrón que
 * usa el proyecto hermano de Registro/Auditoría — puede reutilizar el MISMO
 * App Registration de Entra ID (ya tiene el permiso Mail.Send concedido),
 * solo hace falta cargar las mismas variables de entorno aquí, en ESTE
 * proyecto de Vercel (titulacion-grados-alumno o como se haya llamado):
 *
 *   GRAPH_TENANT_ID       Id. de directorio (tenant) de Entra ID.
 *   GRAPH_CLIENT_ID       Id. de aplicación (cliente) del App Registration.
 *   GRAPH_CLIENT_SECRET   Secreto de cliente de ese registro.
 *   GRAPH_MAIL_FROM       Cuenta remitente, por ejemplo jestadisticaplen@enap.edu.co.
 *   API_KEY               (opcional) clave compartida, cabecera x-api-key.
 *
 * El código se genera y se valida en el navegador (ver
 * src/hooks/useAuthAdmin.ts): esta función NO decide si el código es
 * válido, solo lo entrega por correo.
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

/** Correo institucional válido — segunda barrera además de la ya hecha en el navegador. */
function esCorreoInstitucional(email) {
  return /^[^\s@]+@enap\.edu\.co$/i.test(String(email || '').trim());
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
  const email = String(payload.email || '').trim();
  const code = String(payload.code || '').trim();

  if (!esCorreoInstitucional(email)) {
    res.status(400).json({ error: 'Correo institucional inválido.' });
    return;
  }
  if (!/^\d{4,8}$/.test(code)) {
    res.status(400).json({ error: 'Código inválido.' });
    return;
  }

  const from = process.env.GRAPH_MAIL_FROM;
  if (!from) {
    res.status(500).json({ error: 'Falta GRAPH_MAIL_FROM en las variables de entorno de Vercel.' });
    return;
  }

  try {
    const token = await getAccessToken();

    const mensaje = {
      message: {
        subject: 'Código de acceso — Panel de Titulación',
        body: {
          contentType: 'HTML',
          content: `
            <p>Su código de acceso de un solo uso es:</p>
            <p style="font-size:28px;font-weight:bold;letter-spacing:4px;">${escapeHtml(code)}</p>
            <p>Vence en 10 minutos. Si usted no lo solicitó, ignore este mensaje.</p>
            <p style="color:#888;font-size:12px;">Sistema de Solicitud de Titulación — Escuela Naval de
            Cadetes "Almirante Padilla".</p>
          `,
        },
        toRecipients: [{ emailAddress: { address: email } }],
      },
      saveToSentItems: false,
    };

    const resp = await fetch(`${GRAPH_BASE}/users/${encodeURIComponent(from)}/sendMail`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(mensaje),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      res.status(502).json({ error: 'No se pudo enviar el código por correo.', detail });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}
