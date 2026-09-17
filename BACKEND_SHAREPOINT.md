# Backend en SharePoint — qué falta configurar antes de usarlo con estudiantes reales

Este módulo ya no guarda las solicitudes en el navegador (IndexedDB). Ahora
las guarda en SharePoint, usando las mismas funciones de Vercel que ya
mandan los correos (`api/enviar-codigo.js`, `api/notificar.js`) más tres
nuevas: `api/solicitudes.js`, `api/adjuntos.js` y `api/bitacora.js`.

Esto corrige el problema original: antes, una solicitud radicada en un
computador de biblioteca solo era visible desde ESE navegador. Ahora todo
queda en SharePoint, visible desde cualquier equipo.

Además, ahora la vía "Ceremonia" del formulario del estudiante (`api/
ceremonia.js`) lee la MISMA lista `ENAP_Ceremonias` donde el Portal
principal crea las ceremonias, en vez de una fecha manual que se guardaba
aparte y que nunca reflejaba lo que el Portal registraba — por eso antes
una ceremonia marcada "Activa" en el Portal no se veía aquí. No necesita
ningún permiso ni lista adicional: reutiliza el mismo permiso
`Sites.ReadWrite.All` del punto 1 y la lista `ENAP_Ceremonias` que el
Portal ya usa.

**Regla de vigencia, ahora exacta y sin pasos manuales:** el Portal define
cada ceremonia con exactamente 3 fechas (Nombre y Observaciones aparte):
Fecha de la ceremonia, Fecha límite de solicitud del estudiante, y Fecha
límite de validación de facultades (documentos + aval del decano). La
ceremonia aparece ACTIVA para el estudiante si y solo si HOY es menor o
igual a la "Fecha límite de solicitud del estudiante" — en cuanto esa
fecha pasa, se bloquea sola. El campo "Estado" del Portal (Borrador/Activa/
Cerrada) ya no decide esto, queda solo informativo. Si la lista
`ENAP_Ceremonias` todavía no tiene una columna para "Fecha límite de
solicitud del estudiante", agréguela (columna de fecha, cualquier nombre
reconocible como "FechaLimiteSolicitudEstudiante" o "Fecha límite de
solicitud del estudiante" — se resuelve dinámicamente igual que las demás).

**Aviso automático a Secretaría Académica:** cada solicitud radicada ahora
también notifica por correo a Secretaría Académica, además de la
confirmación que ya recibía el estudiante — sin importar desde qué
computador, red o ciudad se haya radicado, porque el envío lo hace el
servidor, no el navegador del estudiante. Por defecto se envía a
`sac@enap.edu.co`; si esa dirección cambia, se puede fijar otra con la
variable de entorno opcional `GRAPH_SAC_NOTIFICACION_EMAIL` en Vercel, sin
tocar código. Un fallo en este aviso nunca bloquea la radicación ni la
confirmación al estudiante — solo queda registrado en los logs de la
función.

**Inicio de sesión de Secretaría Académica corregido:** el correo de
fábrica con el que el sistema reconocía a Secretaría Académica estaba mal
— decía `secretariaacademica`, que no es el correo real de nadie, así que
intentar entrar como `sac@enap.edu.co` siempre se rechazaba como "no
autorizado" (no era una sesión atascada ni caché del navegador: el botón
de cerrar sesión ya funcionaba correctamente). Ya quedó corregido a `sac`
(es decir, `sac@enap.edu.co`), con una migración automática para que los
navegadores que ya habían cargado esta app antes también se corrijan
solos, sin tener que borrar caché ni datos de sitio a mano.

**Importante:** este código no se pudo probar contra el tenant real de
Microsoft 365 (no hay credenciales disponibles en este entorno de
desarrollo). Antes de confiar en él con solicitudes de estudiantes reales,
hay que hacer una prueba de extremo a extremo ya en producción (ver el
punto 3 al final de este documento).

## 0. Si sale el error "No se encontró la lista... las listas que SÍ existen son: Documentos"

Esto NO es un error de permisos ni de nombre de columna: significa que
Microsoft Graph, al resolver `https://escuelanaval.sharepoint.com` por su
nombre de host, encontró un sitio de SharePoint distinto al que se ve en el
navegador al entrar a esa misma URL — un sitio casi vacío, con solo la
biblioteca "Documentos" por defecto. Es un comportamiento real y documentado
de Microsoft 365 (no un error nuestro de código): cuando un tenant tiene
configurado un **"Home Site"** (sitio de inicio) en el centro de
administración de SharePoint, el navegador redirige la URL raíz hacia ese
sitio de inicio, pero Graph, al pedir `/sites/{hostname}`, puede seguir
devolviendo el sitio raíz ORIGINAL (el que existía antes de configurar el
Home Site), que es un sitio diferente aunque comparta el mismo hostname.
También puede pasar si la lista vive en un sitio de equipo/grupo de
Microsoft 365 en vez de en el sitio raíz mismo. Cambiar la sintaxis de la
consulta (por ejemplo pedir `/sites/root/lists/ENAP_Ceremonias` en vez de
buscar por nombre) NO arregla esto, porque `/sites/root` y
`/sites/{hostname}` resuelven exactamente al MISMO sitio raíz — el
problema no es cómo se pregunta, es que ese sitio raíz no es el sitio
correcto.

El código ya intenta dos cosas automáticamente antes de rendirse: (1)
busca entre todos los sitios visibles para la aplicación
(`/sites?search=*`), y (2) revisa el sitio raíz de cada grupo de Microsoft
365 del tenant (`/groups/{id}/sites/root`), por si la lista vive en un
sitio de equipo. Si aun así no la encuentra, la forma 100% confiable de
resolverlo es indicarle el sitio exacto, sin que el código tenga que
adivinar nada:

1. Con la sesión iniciada en el navegador donde SÍ se ve la lista, abrir
   esta URL (reemplazando el hostname si es distinto):
   `https://escuelanaval.sharepoint.com/_api/site/id`
   Esto devuelve un XML con un GUID entre `<d:Id>...</d:Id>` — cópielo.
2. Abrir también:
   `https://escuelanaval.sharepoint.com/_api/web/id`
   Copie ese otro GUID.
3. En Vercel (proyecto `grado-enap`) → Settings → Environment Variables,
   agregar una nueva variable:
   - Nombre: `GRAPH_SITE_ID`
   - Valor: `escuelanaval.sharepoint.com,GUID_DEL_PASO_1,GUID_DEL_PASO_2`
     (los tres valores separados por comas, sin espacios)
4. Redeploy. Con `GRAPH_SITE_ID` configurada, el código deja de adivinar
   por completo y usa siempre ese sitio exacto.

(Si en vez del sitio raíz la lista vive bajo una ruta como
`/sites/NombreDelSitio`, también se puede usar `GRAPH_SITE_PATH` con el
valor `sites/NombreDelSitio` en lugar de `GRAPH_SITE_ID` — pero el método
de los dos GUID de arriba es el más directo y funciona siempre, sin
importar dónde viva el sitio.)

## 1. Variable de entorno / permiso de Microsoft Graph

En Vercel, este proyecto ya debería tener configuradas estas variables (las
mismas que usan `api/enviar-codigo.js` y `api/notificar.js`, y se puede
reutilizar el mismo App Registration de Entra ID / Azure AD):

- `GRAPH_TENANT_ID`
- `GRAPH_CLIENT_ID`
- `GRAPH_CLIENT_SECRET`
- `GRAPH_SITE_ID` (opcional pero recomendada — ver sección 0 de arriba si
  sigue el error de "lista no encontrada")
- `GRAPH_MAIL_FROM` (solo la usan las funciones de correo)
- `API_KEY` (opcional, cabecera `x-api-key`, igual que las de correo)

**Paso manual nuevo y obligatorio:** ese mismo App Registration necesita
además el permiso de **aplicación** de Microsoft Graph
`Sites.ReadWrite.All`, con **consentimiento de administrador concedido**.
Esto se hace en el portal de Azure / Entra ID:

1. Entra ID → Registros de aplicaciones → (la app que ya usa Mail.Send).
2. Permisos de API → Agregar un permiso → Microsoft Graph → **Permisos de
   aplicación** (no delegados) → buscar `Sites.ReadWrite.All` → agregar.
3. Botón "Conceder consentimiento de administrador para [tenant]" — sin
   este paso el permiso queda pedido pero no activo, y todas las llamadas a
   SharePoint fallarán con error 403.

No hace falta un secreto nuevo ni cambiar `GRAPH_CLIENT_SECRET`: es el mismo
App Registration, solo con un permiso adicional.

## 2. Crear las dos listas en SharePoint

Sitio: `escuelanaval.sharepoint.com` (el mismo sitio raíz donde ya vive la
lista `ENAP_Ceremonias` del Portal).

Un administrador de SharePoint debe crear ahí **dos listas nuevas**:

### Lista `ENAP_Solicitudes`

Columnas de texto de una sola línea (los nombres no tienen que coincidir
exactamente — el código los busca dinámicamente por su nombre visible, así
que basta con que existan en una forma reconocible):

- `Radicado`
- `Identificacion`
- `Estado`
- `Nombres`
- `Apellidos`
- `Programa`
- `Correo`
- `SolicitudId`

Y una columna de **texto multilínea**:

- `DatosJson`

`DatosJson` guarda la solicitud completa (los 26 campos); las demás columnas
son solo para que la lista se vea útil en SharePoint y para poder filtrar
sin descargar todo — el sistema siempre lee el dato real desde `DatosJson`.

### Lista `ENAP_Bitacora_Titulacion`

Columnas de texto de una sola línea:

- `Fecha`
- `Actor`

Y una columna de texto multilínea:

- `DatosJson`

### Biblioteca de documentos

No hay que crear nada aparte para los archivos adjuntos (cédulas, PDFs,
fotos, expedientes finales): se guardan automáticamente en la biblioteca de
documentos por defecto del mismo sitio, dentro de una carpeta
`Titulacion/_adjuntos/`, que el sistema crea sola la primera vez que se sube
un documento.

## 3. Probar antes de usar con estudiantes reales

Como este entorno de desarrollo no tuvo acceso al tenant real, hay que
hacer, ya en producción (o en un entorno de pruebas con las mismas listas),
al menos:

1. Radicar una solicitud de prueba completa, con documentos adjuntos, y
   confirmar que aparece en `ENAP_Solicitudes` (columna `DatosJson` con el
   JSON completo) y que los archivos aparecen en
   `Titulacion/_adjuntos/<id>/` en la biblioteca de documentos.
2. Consultar esa misma solicitud por número de documento desde **otro
   navegador o equipo** — para confirmar que el problema original (datos
   solo visibles desde el navegador donde se radicó) ya no ocurre.
3. Abrir/descargar uno de los documentos adjuntos desde el panel
   administrativo.
4. Eliminar la solicitud de prueba y confirmar que también desaparecen sus
   documentos adjuntos.

Si algo falla, revisar primero los logs de la función en Vercel: los errores
de este backend (falta de permiso, lista no encontrada, columna no
resuelta) se devuelven con mensajes en español que indican la causa
concreta.
