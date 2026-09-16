/**
 * ConsultarSolicitud.tsx
 * D.4 — Consultar mi solicitud. Solo pide número de documento, sin login.
 * Puede haber varias solicitudes de la misma persona: una tarjeta por cada
 * una. Por seguridad no se muestra el enlace al PDF ni se reexpone
 * correo/teléfono. "Eliminar esta solicitud" exige el radicado exacto
 * (dos factores: cédula + radicado) y no se permite si el estado ya es
 * "Completa".
 */

import { AlertCircle, Loader2, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { avanceDocumentos, colorEstadoPublico, textoEstadoParaRol } from '../../services/reglasNegocio';
import { consultarPorIdentificacion, eliminarSolicitudDelEstudiante } from '../../services/solicitudService';
import type { Solicitud } from '../../types';

const COLOR_PUNTO: Record<ReturnType<typeof colorEstadoPublico>, string> = {
  gris: 'bg-slate-400',
  amarillo: 'bg-amber-400',
  verde: 'bg-emerald-500',
};

function TarjetaSolicitud({ solicitud, onEliminada }: { solicitud: Solicitud; onEliminada: (id: string) => void }) {
  const [eliminando, setEliminando] = useState(false);
  const [radicadoIngresado, setRadicadoIngresado] = useState('');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);

  const avance = avanceDocumentos(solicitud);
  const texto = textoEstadoParaRol(solicitud.estado, solicitud.facultadReferencial, 'estudiante');
  const color = colorEstadoPublico(solicitud.estado);
  const puedeEliminar = solicitud.estado !== 'completa';

  const confirmarEliminacion = async () => {
    setProcesando(true);
    setMensaje(null);
    const resultado = await eliminarSolicitudDelEstudiante(solicitud.identificacion, radicadoIngresado);
    setProcesando(false);
    if (resultado.ok) {
      onEliminada(solicitud.id);
    } else {
      setMensaje(resultado.mensaje);
    }
  };

  return (
    <div className="card p-5 text-left">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-semibold text-navy-900">{solicitud.radicado}</p>
          <p className="mt-0.5 text-sm text-slate-600">{solicitud.programa}</p>
          <p className="text-xs text-slate-500">{solicitud.nivel} · Facultad de {solicitud.facultadReferencial || '—'}</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">
          <span className={`h-2 w-2 rounded-full ${COLOR_PUNTO[color]}`} />
          {texto}
        </span>
      </div>

      <p className="mt-3 text-xs text-slate-500">Documentos: {avance.texto}</p>

      {puedeEliminar && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          {!eliminando ? (
            <button
              type="button"
              className="btn-ghost !px-2 !py-1 text-xs text-rose-600 hover:bg-rose-50"
              onClick={() => setEliminando(true)}
            >
              <Trash2 size={13} /> Eliminar esta solicitud
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-600">
                Para confirmar, escriba exactamente el número de radicado de esta solicitud:
              </p>
              <input
                className="field text-sm"
                placeholder="SG-20260101-120000"
                value={radicadoIngresado}
                onChange={(e) => setRadicadoIngresado(e.target.value)}
              />
              {mensaje && (
                <p className="flex items-start gap-1.5 text-xs text-rose-600">
                  <AlertCircle size={13} className="mt-0.5 shrink-0" /> {mensaje}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-primary !px-3 !py-1.5 text-xs"
                  disabled={!radicadoIngresado.trim() || procesando}
                  onClick={confirmarEliminacion}
                >
                  {procesando ? <Loader2 size={13} className="animate-spin" /> : null} Confirmar eliminación
                </button>
                <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setEliminando(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ConsultarSolicitud({ onVolver }: { onVolver: () => void }) {
  const [identificacion, setIdentificacion] = useState('');
  const [solicitudes, setSolicitudes] = useState<Solicitud[] | null>(null);
  const [buscando, setBuscando] = useState(false);

  const buscar = async () => {
    if (!identificacion.trim()) return;
    setBuscando(true);
    const resultado = await consultarPorIdentificacion(identificacion);
    setSolicitudes(resultado);
    setBuscando(false);
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <header className="text-center">
        <h2 className="text-xl font-semibold text-navy-900">Consultar mi solicitud</h2>
        <p className="mt-1 text-sm text-slate-500">Ingrese su número de documento. No necesita usuario ni contraseña.</p>
      </header>

      <section className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="label" htmlFor="buscarId">Número de documento</label>
          <input
            id="buscarId"
            className="field font-mono"
            inputMode="numeric"
            value={identificacion}
            onChange={(e) => setIdentificacion(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
          />
        </div>
        <button type="button" className="btn-primary px-5 py-2" disabled={buscando} onClick={buscar}>
          {buscando ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Buscar
        </button>
      </section>

      {solicitudes !== null && (
        <div className="space-y-3">
          {solicitudes.length === 0 ? (
            <p className="text-center text-sm text-slate-500">No se encontraron solicitudes con ese número de documento.</p>
          ) : (
            solicitudes.map((s) => (
              <TarjetaSolicitud
                key={s.id}
                solicitud={s}
                onEliminada={(id) => setSolicitudes((actual) => actual?.filter((x) => x.id !== id) ?? null)}
              />
            ))
          )}
        </div>
      )}

      <div className="flex justify-center">
        <button type="button" className="btn-secondary px-5" onClick={onVolver}>Volver al inicio</button>
      </div>
    </div>
  );
}
