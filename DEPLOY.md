# Publicar este módulo como sitio aparte

Este proyecto (módulo de Solicitud de Titulación, la vista del estudiante) está listo
para publicarse como un sitio **independiente** del Portal principal, con su propia URL.
No pude crear el repositorio de GitHub yo mismo (esta sesión solo tiene permiso sobre el
repositorio ya conectado, `BEYTYC/PortalENAP`, no para crear repositorios nuevos), así que
estos son los pasos para hacerlo tú, son rápidos:

## 1. Crear el repositorio en GitHub

1. Entra a https://github.com/new
2. Nombre sugerido: `PortalENAP-Titulacion`
3. Visibilidad: **Privado**
4. NO marques "Add a README" ni ningún otro archivo inicial (el proyecto ya trae todo).
5. Clic en "Create repository". Copia la URL que te da (algo como
   `https://github.com/BEYTYC/PortalENAP-Titulacion.git`).

## 2. Subir este código

Descomprime el zip que te envié en una carpeta, abre una terminal ahí dentro, y ejecuta
(reemplazando la URL por la que copiaste en el paso 1):

```
git remote add origin https://github.com/BEYTYC/PortalENAP-Titulacion.git
git branch -M main
git push -u origin main
```

El proyecto ya viene con su primer commit hecho, así que estos tres comandos son
todo lo que hace falta.

## 3. Conectar el repositorio a Vercel como proyecto nuevo

1. En Vercel, "Add New… → Project".
2. Selecciona el repositorio `PortalENAP-Titulacion` que acabas de crear.
3. Framework: Vercel debería detectar **Vite** automáticamente. Déjalo así.
4. En "Environment Variables" agrega las mismas que ya usa el proyecto del Portal /
   Registro para el envío de correos (mismo App Registration de Entra ID puede
   reutilizarse):
   - `GRAPH_TENANT_ID`
   - `GRAPH_CLIENT_ID`
   - `GRAPH_CLIENT_SECRET`
   - `GRAPH_MAIL_FROM`
5. Clic en "Deploy". Al terminar, Vercel te da una URL (algo como
   `portal-enap-titulacion.vercel.app`) — esa es la URL pública del módulo del
   estudiante. Puedes luego configurarle un dominio propio si quieres uno más corto,
   por ejemplo `titulacion.enap.co` o similar, desde Vercel → Settings → Domains.

## 4. Antes de que quede realmente en producción (ver BACKEND_SHAREPOINT.md)

Con el sitio ya desplegado, todavía falta lo del backend de SharePoint para que las
solicitudes no se guarden solo en el navegador del estudiante:

1. Dar al App Registration de Entra ID el permiso de aplicación
   **`Sites.ReadWrite.All`** de Microsoft Graph, con consentimiento de administrador.
2. Crear en SharePoint (sitio `escuelanaval.sharepoint.com`, el mismo del Portal) las
   listas `ENAP_Solicitudes` y `ENAP_Bitacora_Titulacion` — columnas detalladas en
   `BACKEND_SHAREPOINT.md`.
3. Hacer una prueba real de punta a punta: radicar una solicitud, consultarla desde
   otro computador o el celular, y confirmar que el correo de confirmación llega con
   el PDF adjunto.

## 5. Avísame la URL final

Una vez tengas la URL de Vercel (o tu dominio propio), dímela para actualizar el enlace
"Solicitud de Grado — Estudiantes" en el menú del Portal principal, que hoy muestra este
módulo embebido temporalmente — apenas tengamos la URL lo cambio para que abra el sitio
aparte en vez del iframe.
