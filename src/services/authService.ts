/**
 * authService.ts
 * E.1 — autenticación del panel administrativo: correo institucional
 * autorizado → código de 6 dígitos → sesión de 6 horas. Sin contraseñas.
 *
 * Mismo patrón que el resto de módulos del Proyecto de Transformación
 * Digital (código con vigencia + respaldo en pantalla si el correo real no
 * sale): la única diferencia es que aquí el correo debe estar autorizado en
 * la configuración de Titulación (por facultad, Secretaría o acceso total —
 * A.4), no en una lista aparte, y los correos en "modo pruebas" (A.4) entran
 * sin que se les pida código en absoluto.
 */

import { esCorreoInstitucional, normalizarCorreoConfig } from './reglasNegocio';
import { entraSinCodigoDeVerificacion, rolDeCorreo, type ResultadoConfig } from './configService';
import type { ConfiguracionTitulacion, RolTitulacion } from '../types';

const AUTH_STORAGE_KEY = 'titulacion.auth.session.v1';
export const CODE_TTL_MINUTES = 10;
export const MAX_INTENTOS_CODIGO = 5;
export const SESSION_TTL_HORAS = 6;

export interface AuthSession {
  correo: string;
  rol: RolTitulacion;
  facultades: string[];
  loggedInAt: number;
}

export interface PendingCode {
  correo: string;
  code: string;
  expiresAt: number;
  intentos: number;
}

function generarCodigo(): string {
  return Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0');
}

export function crearCodigoPendiente(correo: string): PendingCode {
  return {
    correo: normalizarCorreoConfig(correo),
    code: generarCodigo(),
    expiresAt: Date.now() + CODE_TTL_MINUTES * 60_000,
    intentos: 0,
  };
}

export function codigoVencido(pending: PendingCode): boolean {
  return Date.now() > pending.expiresAt;
}

export function codigoCoincide(pending: PendingCode, intento: string): boolean {
  return pending.code === intento.trim();
}

/**
 * Resuelve si un correo puede entrar y con qué rol — E.1: "solo entra quien
 * está en la lista de correos autorizados de alguna facultad, o es
 * Secretaría, o es acceso total".
 */
export function resolverAcceso(
  config: ConfiguracionTitulacion,
  correo: string,
): { ok: true; rol: RolTitulacion; facultades: string[] } | { ok: false; mensaje: string } {
  // Los correos de configuración se guardan y comparan sin dominio (G.8), así
  // que aquí se acepta tanto "jcley" como "jcley@enap.edu.co" — pero si trae
  // un dominio, tiene que ser el institucional.
  if (correo.includes('@') && !esCorreoInstitucional(correo)) {
    return { ok: false, mensaje: 'Use su correo institucional, terminado en «@enap.edu.co».' };
  }

  const resuelto = rolDeCorreo(config, correo);
  if (!resuelto) {
    return {
      ok: false,
      mensaje:
        'Este correo no está autorizado en ninguna facultad, ni es Secretaría Académica ni tiene acceso total. ' +
        'Si cree que debería estarlo, comuníquese con la Oficina de Estadística.',
    };
  }
  return { ok: true, rol: resuelto.rol, facultades: resuelto.facultades };
}

export function correoEnModoPruebas(config: ConfiguracionTitulacion, correo: string): boolean {
  return entraSinCodigoDeVerificacion(config, correo);
}

export function crearSesion(correo: string, rol: RolTitulacion, facultades: string[]): AuthSession {
  return { correo: normalizarCorreoConfig(correo), rol, facultades, loggedInAt: Date.now() };
}

export function cargarSesion(): AuthSession | null {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed || typeof parsed.correo !== 'string') return null;
    // E.1 / A.5: sesión válida por 6 horas.
    if (Date.now() - parsed.loggedInAt > SESSION_TTL_HORAS * 60 * 60_000) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function guardarSesion(session: AuthSession): void {
  try {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Sin almacenamiento disponible: la sesión dura mientras la pestaña siga abierta.
  }
}

export function borrarSesion(): void {
  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Nada que borrar.
  }
}

export type { ResultadoConfig };
