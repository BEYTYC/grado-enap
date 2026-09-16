/**
 * useAuthAdmin.ts
 * E.1 — estado de acceso del panel administrativo.
 */

import { useCallback, useState } from 'react';
import {
  borrarSesion,
  cargarSesion,
  codigoCoincide,
  codigoVencido,
  correoEnModoPruebas,
  crearCodigoPendiente,
  crearSesion,
  guardarSesion,
  MAX_INTENTOS_CODIGO,
  resolverAcceso,
  type AuthSession,
  type PendingCode,
} from '../services/authService';
import { registrarEnBitacora } from '../services/bitacoraService';
import { cargarConfig } from '../services/configService';
import { enviarCodigoAdmin } from '../services/correoService';

type Etapa = 'correo' | 'codigo';

export function useAuthAdmin() {
  const [session, setSession] = useState<AuthSession | null>(() => cargarSesion());
  const [etapa, setEtapa] = useState<Etapa>('correo');
  const [pendiente, setPendiente] = useState<PendingCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Código a mostrar en pantalla — solo cuando el envío por correo real falló (respaldo). */
  const [codigoRespaldo, setCodigoRespaldo] = useState<string | null>(null);
  /** `true` mientras se espera la respuesta del envío de correo. */
  const [enviandoCodigo, setEnviandoCodigo] = useState(false);

  const dispararEnvio = useCallback((code: PendingCode) => {
    setEnviandoCodigo(true);
    setCodigoRespaldo(null);
    void enviarCodigoAdmin(code.correo, code.code).then((enviado) => {
      setEnviandoCodigo(false);
      if (!enviado) {
        // Respaldo: si el correo real falla (por ejemplo, faltan variables de
        // entorno en Vercel), se muestra el código en pantalla para no dejar
        // a nadie bloqueado mientras se resuelve el envío.
        setCodigoRespaldo(code.code);
      }
    });
  }, []);

  const solicitarCodigo = useCallback(
    (correoIngresado: string) => {
      setError(null);
      const config = cargarConfig();
      const acceso = resolverAcceso(config, correoIngresado);
      if (!acceso.ok) {
        setError(acceso.mensaje);
        return;
      }

      if (correoEnModoPruebas(config, correoIngresado)) {
        const nuevaSesion = crearSesion(correoIngresado, acceso.rol, acceso.facultades);
        guardarSesion(nuevaSesion);
        setSession(nuevaSesion);
        void registrarEnBitacora(nuevaSesion.correo, 'Ingreso en modo pruebas', 'Entró sin código de verificación.');
        return;
      }

      const code = crearCodigoPendiente(correoIngresado);
      setPendiente(code);
      setEtapa('codigo');
      dispararEnvio(code);
    },
    [dispararEnvio],
  );

  const reenviarCodigo = useCallback(() => {
    if (!pendiente) return;
    const code = crearCodigoPendiente(pendiente.correo);
    setPendiente(code);
    setError(null);
    dispararEnvio(code);
  }, [pendiente, dispararEnvio]);

  const cambiarCorreo = useCallback(() => {
    setEtapa('correo');
    setPendiente(null);
    setCodigoRespaldo(null);
    setError(null);
  }, []);

  const verificarCodigo = useCallback(
    (intento: string) => {
      if (!pendiente) return;
      if (codigoVencido(pendiente)) {
        setError('El código venció. Solicite uno nuevo.');
        return;
      }
      if (pendiente.intentos >= MAX_INTENTOS_CODIGO) {
        setError('Se agotaron los intentos. Solicite un código nuevo.');
        return;
      }
      if (!codigoCoincide(pendiente, intento)) {
        const siguiente = { ...pendiente, intentos: pendiente.intentos + 1 };
        setPendiente(siguiente);
        const restantes = MAX_INTENTOS_CODIGO - siguiente.intentos;
        setError(
          restantes > 0
            ? `El código no coincide. Le quedan ${restantes} intento${restantes === 1 ? '' : 's'}.`
            : 'El código no coincide. Se agotaron los intentos: solicite uno nuevo.',
        );
        return;
      }

      const config = cargarConfig();
      const acceso = resolverAcceso(config, pendiente.correo);
      if (!acceso.ok) {
        setError(acceso.mensaje);
        return;
      }
      const nuevaSesion = crearSesion(pendiente.correo, acceso.rol, acceso.facultades);
      guardarSesion(nuevaSesion);
      setSession(nuevaSesion);
      setPendiente(null);
      setCodigoRespaldo(null);
      setError(null);
      setEtapa('correo');
      void registrarEnBitacora(nuevaSesion.correo, 'Ingreso al panel', `Rol: ${nuevaSesion.rol}`);
    },
    [pendiente],
  );

  const cerrarSesion = useCallback(() => {
    borrarSesion();
    setSession(null);
    setEtapa('correo');
    setPendiente(null);
    setCodigoRespaldo(null);
    setError(null);
  }, []);

  return {
    session,
    isAuthenticated: session !== null,
    etapa,
    correoPendiente: pendiente?.correo ?? null,
    codigoRespaldo,
    enviandoCodigo,
    error,
    solicitarCodigo,
    reenviarCodigo,
    cambiarCorreo,
    verificarCodigo,
    cerrarSesion,
  };
}
