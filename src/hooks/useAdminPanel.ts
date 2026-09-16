/**
 * useAdminPanel.ts
 * Estado del panel administrativo tras iniciar sesión: listado según el rol
 * y el expediente actualmente abierto.
 */

import { useCallback, useEffect, useState } from 'react';
import type { AuthSession } from '../services/authService';
import { listarSolicitudesParaRol, obtenerExpediente } from '../services/adminSolicitudService';
import type { Solicitud } from '../types';

export function useAdminPanel(session: AuthSession) {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [cargando, setCargando] = useState(true);
  const [idAbierto, setIdAbierto] = useState<string | null>(null);

  const recargarListado = useCallback(async () => {
    setCargando(true);
    const lista = await listarSolicitudesParaRol(session.rol, session.facultades);
    setSolicitudes(lista);
    setCargando(false);
  }, [session.rol, session.facultades]);

  useEffect(() => {
    void recargarListado();
  }, [recargarListado]);

  const abrir = useCallback((id: string) => setIdAbierto(id), []);
  const cerrar = useCallback(() => {
    setIdAbierto(null);
    void recargarListado();
  }, [recargarListado]);

  const [expediente, setExpediente] = useState<Solicitud | null>(null);
  useEffect(() => {
    if (!idAbierto) {
      setExpediente(null);
      return;
    }
    let cancelado = false;
    void obtenerExpediente(idAbierto).then((s) => {
      if (!cancelado) setExpediente(s ?? null);
    });
    return () => {
      cancelado = true;
    };
  }, [idAbierto]);

  return { solicitudes, cargando, recargarListado, idAbierto, abrir, cerrar, expediente, setExpediente };
}
