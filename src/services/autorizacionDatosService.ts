/**
 * autorizacionDatosService.ts
 *
 * Genera el PDF de "Autorización de Tratamiento de Datos" que queda
 * asociado a la solicitud y se adjunta al correo de confirmación de
 * radicado. Usa el mismo texto legal ya aprobado (TEXTO_AUTORIZACION_DATOS
 * en solicitudService.ts) — este archivo NO redacta un texto nuevo, solo lo
 * pone en un documento con los datos del estudiante y la fecha de
 * aceptación.
 *
 * IMPORTANTE — qué es y qué NO es este documento todavía: el estudiante
 * acepta marcando el checkbox obligatorio en el paso 4 del formulario (D.2);
 * este PDF es el REGISTRO de esa aceptación electrónica (nombre, documento,
 * fecha/hora de Bogotá y el texto exacto que aceptó), no una firma
 * criptográfica ni una "imagen de firma" dibujada a mano — eso sería un paso
 * aparte, no incluido aquí. No se debe llamar a esto "firma digital
 * certificada": ese término queda reservado para una firma con certificado
 * real, que no es lo que se está construyendo ahora.
 *
 * El formato visual de este documento es provisional (no hay una plantilla
 * institucional oficial para esto todavía) — si Secretaría Académica define
 * un formato propio más adelante, este archivo es el único lugar que hay
 * que cambiar.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { TEXTO_AUTORIZACION_DATOS, type DatosPersonalesFormulario } from './solicitudService';

export interface AutorizacionDatosParams {
  datosPersonales: DatosPersonalesFormulario;
  radicado: string;
  fecha: Date;
}

/** Envuelve `texto` en líneas que no superen `maxWidth` con la fuente/tamaño dados. */
function envolverTexto(
  texto: string,
  font: import('pdf-lib').PDFFont,
  tamano: number,
  maxWidth: number,
): string[] {
  const palabras = texto.split(/\s+/);
  const lineas: string[] = [];
  let actual = '';
  for (const palabra of palabras) {
    const intento = actual ? `${actual} ${palabra}` : palabra;
    if (font.widthOfTextAtSize(intento, tamano) > maxWidth && actual) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = intento;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

/**
 * Genera el PDF y devuelve sus bytes. Quien llama decide qué hacer con
 * ellos (guardarlos como blob local, adjuntarlos a un correo en base64,
 * etc.) — esta función no toca IndexedDB ni red.
 */
export async function generarAutorizacionDatosPdf(params: AutorizacionDatosParams): Promise<Uint8Array> {
  const { datosPersonales, radicado, fecha } = params;

  const pdf = await PDFDocument.create();
  const pagina = pdf.addPage([595.28, 841.89]); // A4
  const fuente = await pdf.embedFont(StandardFonts.Helvetica);
  const fuenteNegrita = await pdf.embedFont(StandardFonts.HelveticaBold);

  const margen = 56;
  const anchoUtil = pagina.getWidth() - margen * 2;
  let y = pagina.getHeight() - margen;

  const fechaTexto = fecha.toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'long',
    timeStyle: 'short',
  });

  pagina.drawText('Escuela Naval de Cadetes "Almirante Padilla"', {
    x: margen,
    y,
    size: 13,
    font: fuenteNegrita,
    color: rgb(0.04, 0.16, 0.35),
  });
  y -= 18;
  pagina.drawText('Autorización de Tratamiento de Datos Personales', {
    x: margen,
    y,
    size: 11.5,
    font: fuenteNegrita,
    color: rgb(0.04, 0.16, 0.35),
  });
  y -= 28;

  const datos: [string, string][] = [
    ['Radicado', radicado],
    ['Nombres y apellidos', `${datosPersonales.nombres} ${datosPersonales.apellidos}`],
    ['Documento de identidad', `${datosPersonales.tipoDocumento} No. ${datosPersonales.identificacion}`],
    ['Correo electrónico', datosPersonales.correo],
    ['Fecha y hora de aceptación', `${fechaTexto} (hora de Bogotá)`],
  ];

  for (const [etiqueta, valor] of datos) {
    pagina.drawText(`${etiqueta}:`, { x: margen, y, size: 10, font: fuenteNegrita, color: rgb(0.2, 0.2, 0.2) });
    pagina.drawText(valor, { x: margen + 160, y, size: 10, font: fuente, color: rgb(0.1, 0.1, 0.1) });
    y -= 16;
  }
  y -= 14;

  pagina.drawLine({
    start: { x: margen, y },
    end: { x: pagina.getWidth() - margen, y },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  });
  y -= 24;

  const lineasTexto = envolverTexto(TEXTO_AUTORIZACION_DATOS, fuente, 10.5, anchoUtil);
  for (const linea of lineasTexto) {
    pagina.drawText(linea, { x: margen, y, size: 10.5, font: fuente, color: rgb(0.15, 0.15, 0.15) });
    y -= 15;
  }
  y -= 20;

  pagina.drawText(
    'Aceptado electrónicamente por el estudiante mediante el checkbox obligatorio del formulario de',
    { x: margen, y, size: 9.5, font: fuente, color: rgb(0.35, 0.35, 0.35) },
  );
  y -= 13;
  pagina.drawText(
    'solicitud de titulación, en la fecha y hora indicadas arriba. Documento generado automáticamente.',
    { x: margen, y, size: 9.5, font: fuente, color: rgb(0.35, 0.35, 0.35) },
  );

  return pdf.save();
}

/** Uint8Array -> base64, para adjuntar el PDF al correo de confirmación (Graph sendMail espera contentBytes en base64). */
export function bytesABase64(bytes: Uint8Array): string {
  let binario = '';
  for (let i = 0; i < bytes.length; i++) {
    binario += String.fromCharCode(bytes[i]);
  }
  return btoa(binario);
}
