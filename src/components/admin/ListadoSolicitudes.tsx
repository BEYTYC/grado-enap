/**
 * ListadoSolicitudes.tsx
 * E.2 — qué ve cada rol:
 *  - Jefe de Programa: solo las de sus facultades, agrupadas por estado y
 *    luego por programa, ordenadas alfabéticamente por apellido.
 *  - Secretaría: "Completa" (pendiente de aprobar) y "Aprobada", agrupadas
 *    por Facultad → Programa. Puede aprobar una por una o todas de una vez,
 *    y descargar un reporte de las ya aprobadas.
 *  - Acceso total: todo, agrupado por Facultad → Programa, con las mismas
 *    herramientas de aprobación que Secretaría.
 *
 * Cada grupo de más alto nivel (estado, o facultad) numera sus filas desde
 * el 1 — la numeración no es un id global, es solo para ubicarse dentro de
 * ese grupo. Todas las filas de un mismo grupo viven en UNA sola tarjeta
 * (renglones separados por una línea), nunca una tarjeta por solicitud.
 */

import { AlertCircle, AlertTriangle, CheckCheck, CheckCircle2, Download, Star, XCircle } from 'lucide-react';
import { useState } from 'react';
import { aprobarSolicitud, aprobarTodasLasCompletas } from '../../services/adminSolicitudService';
import {
  esGraduadoDeHonor,
  facultadDesdePrograma,
  formatearMilesDocumento,
  textoEstadoParaRol,
} from '../../services/reglasNegocio';
import type { EstadoSolicitud, RolTitulacion, Solicitud } from '../../types';

function agruparPor<T>(items: T[], clave: (item: T) => string): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  for (const item of items) {
    const k = clave(item);
    if (!mapa.has(k)) mapa.set(k, []);
    mapa.get(k)!.push(item);
  }
  return mapa;
}

const ORDEN_ESTADOS = ['radicada', 'en_revision', 'completa'] as const;
const NOMBRE_ESTADO_GRUPO: Record<string, string> = {
  radicada: 'Radicadas',
  en_revision: 'En revisión',
  completa: 'Completas',
};

/** Preparado para cuando exista el estado "rechazada" (aún no forma parte del tipo). */
const ESTADOS_RECHAZO = new Set<EstadoSolicitud>([]);

/** Chulo de color de la fila: verde = completa/aprobada, amarillo = todavía en trámite, rojo = rechazada. */
function IconoEstado({ estado }: { estado: EstadoSolicitud }) {
  if (estado === 'completa' || estado === 'aprobada') {
    return <CheckCircle2 size={16} className="shrink-0 text-emerald-600" aria-label={estado} />;
  }
  if (ESTADOS_RECHAZO.has(estado)) {
    return <XCircle size={16} className="shrink-0 text-rose-600" aria-label="Rechazada" />;
  }
  return <AlertTriangle size={16} className="shrink-0 text-amber-500" aria-label="Faltan documentos" />;
}

function FilaSolicitud({
  numero,
  solicitud,
  rol,
  puedeAprobar,
  onAbrir,
  onAprobar,
}: {
  numero: number;
  solicitud: Solicitud;
  rol: RolTitulacion;
  puedeAprobar: boolean;
  onAbrir: () => void;
  onAprobar: () => void;
}) {
  const texto = textoEstadoParaRol(solicitud.estado, solicitud.facultadReferencial, rol);
  const tieneDistincion = solicitud.distincion !== 'Ninguna';
  const esHonor = esGraduadoDeHonor(solicitud.promedioPonderado, solicitud.distincion);
  const esPositivo = solicitud.estado === 'completa' || solicitud.estado === 'aprobada';
  const [aprobando, setAprobando] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onAbrir}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onAbrir();
      }}
      className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-slate-100 bg-white px-4 py-3 text-left transition hover:bg-slate-50"
    >
      <span className="shrink-0 text-xs font-semibold text-slate-400">{numero}.</span>
      <IconoEstado estado={solicitud.estado} />
      <span className="shrink-0 font-mono text-xs text-slate-500">{solicitud.radicado}</span>
      <span className="shrink-0 text-sm font-semibold text-navy-900">
        {solicitud.apellidos} {solicitud.nombres}
      </span>
      <span className="shrink-0 font-mono text-xs text-slate-500">
        {formatearMilesDocumento(solicitud.identificacion)}
      </span>
      {tieneDistincion && (
        <span className="chip shrink-0 gap-1 bg-gold-50 text-gold-700">
          {esHonor && <Star size={12} className="fill-gold-500 text-gold-500" />}
          {esHonor ? <span className="uppercase tracking-wide">{solicitud.distincion}</span> : solicitud.distincion}
        </span>
      )}
      <span
        className={
          esPositivo
            ? 'chip ml-auto shrink-0 gap-1 border border-emerald-200 bg-emerald-100 text-emerald-800'
            : 'chip ml-auto shrink-0 bg-slate-100 text-slate-700'
        }
      >
        {esPositivo && <CheckCircle2 size={12} />}
        {texto}
      </span>
      {puedeAprobar && solicitud.estado === 'completa' && (
        <button
          type="button"
          disabled={aprobando}
          onClick={(e) => {
            e.stopPropagation();
            setAprobando(true);
            void onAprobar();
          }}
          className="btn-success shrink-0 !px-3 !py-1.5 text-xs"
        >
          <CheckCircle2 size={13} /> Aprobar
        </button>
      )}
    </div>
  );
}

function GrupoPorPrograma({
  filas,
  rol,
  puedeAprobar,
  onAbrir,
  onAprobar,
}: {
  filas: Solicitud[];
  rol: RolTitulacion;
  puedeAprobar: boolean;
  onAbrir: (id: string) => void;
  onAprobar: (id: string) => void;
}) {
  const porPrograma = agruparPor(filas, (s) => s.programa);
  let contador = 0;
  return (
    <>
      {[...porPrograma.entries()].map(([programa, items]) => (
        <div key={programa} className="contents">
          <p className="border-b border-slate-100 bg-slate-50 px-4 py-1.5 text-xs font-semibold text-slate-500">{programa}</p>
          {items
            .sort((a, b) => a.apellidos.localeCompare(b.apellidos))
            .map((s) => {
              contador += 1;
              return (
                <FilaSolicitud
                  key={s.id}
                  numero={contador}
                  solicitud={s}
                  rol={rol}
                  puedeAprobar={puedeAprobar}
                  onAbrir={() => onAbrir(s.id)}
                  onAprobar={() => onAprobar(s.id)}
                />
              );
            })}
        </div>
      ))}
    </>
  );
}

/** Reporte CSV de las solicitudes ya aprobadas — se abre en Excel sin problema. */
function descargarReporteAprobados(solicitudes: Solicitud[]) {
  const aprobadas = solicitudes.filter((s) => s.estado === 'aprobada');
  const encabezados = ['Radicado', 'Apellidos', 'Nombres', 'Identificación', 'Programa', 'Facultad', 'Nivel', 'Distinción', 'Promedio ponderado'];
  const filas = aprobadas.map((s) => [
    s.radicado,
    s.apellidos,
    s.nombres,
    s.identificacion,
    s.programa,
    facultadDesdePrograma(s.programa) ?? '',
    s.nivel,
    s.distincion,
    s.promedioPonderado?.toString() ?? '',
  ]);
  const escapar = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = [encabezados, ...filas].map((fila) => fila.map(escapar).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aprobados-titulacion-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ListadoSolicitudes({
  solicitudes,
  rol,
  correo,
  onAbrir,
  onCambiado,
}: {
  solicitudes: Solicitud[];
  rol: RolTitulacion;
  correo: string;
  onAbrir: (id: string) => void;
  onCambiado: () => void;
}) {
  const puedeAprobar = rol === 'secretaria' || rol === 'acceso_total';
  const pendientes = solicitudes.filter((s) => s.estado === 'completa');
  const aprobadas = solicitudes.filter((s) => s.estado === 'aprobada');

  const aprobar = async (id: string) => {
    await aprobarSolicitud(id, correo);
    onCambiado();
  };

  const aprobarTodas = async () => {
    await aprobarTodasLasCompletas(pendientes.map((s) => s.id), correo);
    onCambiado();
  };

  if (solicitudes.length === 0) {
    return (
      <div className="card flex items-center gap-3 p-5 text-sm text-slate-600">
        <AlertCircle size={18} className="shrink-0 text-slate-400" />
        {rol === 'secretaria' || rol === 'acceso_total'
          ? 'No hay ninguna solicitud pendiente.'
          : 'No hay solicitudes para mostrar todavía.'}
      </div>
    );
  }

  if (rol === 'jefe_programa') {
    const porEstado = agruparPor(solicitudes, (s) => s.estado);
    return (
      <div className="space-y-6">
        {ORDEN_ESTADOS.filter((e) => porEstado.has(e)).map((estado) => {
          const items = porEstado.get(estado)!;
          return (
            <section key={estado}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-navy-700">
                {NOMBRE_ESTADO_GRUPO[estado] ?? estado} <span className="text-slate-400">({items.length})</span>
              </h3>
              <div className="card overflow-hidden">
                <GrupoPorPrograma filas={items} rol={rol} puedeAprobar={false} onAbrir={onAbrir} onAprobar={() => {}} />
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  // secretaria / acceso_total: Facultad → Programa, más las herramientas de aprobación.
  const porFacultad = agruparPor(solicitudes, (s) => facultadDesdePrograma(s.programa) ?? 'Sin facultad');
  return (
    <div className="space-y-6">
      {puedeAprobar && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            Pendientes de aprobar: <strong className="text-navy-900">{pendientes.length}</strong> · Aprobadas:{' '}
            <strong className="text-navy-900">{aprobadas.length}</strong>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-success !px-3 !py-1.5 text-xs"
              disabled={pendientes.length === 0}
              onClick={() => void aprobarTodas()}
            >
              <CheckCheck size={14} /> Aprobar todas ({pendientes.length})
            </button>
            <button
              type="button"
              className="btn-secondary !px-3 !py-1.5 text-xs"
              disabled={aprobadas.length === 0}
              onClick={() => descargarReporteAprobados(solicitudes)}
            >
              <Download size={14} /> Descargar reporte de aprobados
            </button>
          </div>
        </div>
      )}

      {[...porFacultad.entries()].map(([facultad, items]) => (
        <section key={facultad}>
          <h3 className="mb-2 text-sm font-semibold text-navy-700">
            Facultad de {facultad} <span className="text-slate-400">({items.length})</span>
          </h3>
          <div className="card overflow-hidden">
            <GrupoPorPrograma filas={items} rol={rol} puedeAprobar={puedeAprobar} onAbrir={onAbrir} onAprobar={aprobar} />
          </div>
        </section>
      ))}
    </div>
  );
}
