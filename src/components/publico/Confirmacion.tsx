/**
 * Confirmacion.tsx
 * D.3 — pantalla final tras radicar: el radicado en grande y explicación de
 * qué sigue.
 */

import { CheckCircle2, Mail } from 'lucide-react';
import type { Solicitud } from '../../types';

export function Confirmacion({ solicitud, onNuevaSolicitud }: { solicitud: Solicitud; onNuevaSolicitud: () => void }) {
  return (
    <div className="mx-auto w-full max-w-xl space-y-5 text-center">
      <CheckCircle2 size={48} className="mx-auto text-emerald-600" />
      <h2 className="text-2xl font-semibold text-navy-900">Su solicitud fue radicada</h2>

      <div className="card space-y-1 p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Número de radicado</p>
        <p className="font-mono text-3xl font-bold tracking-tight text-navy-900">{solicitud.radicado}</p>
      </div>

      <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-left text-sm text-sky-900">
        <p className="flex items-center gap-2 font-semibold"><Mail size={15} /> Revise su correo</p>
        <p className="mt-1">
          Enviamos una confirmación a <strong>{solicitud.correo}</strong> con este radicado y adjunto el resumen de
          su solicitud. Guárdelo: lo necesitará para consultar el estado de su solicitud o para eliminarla si fue un
          error.
        </p>
      </div>

      <div className="text-left text-sm text-slate-600">
        <p className="font-semibold text-navy-900">¿Qué sigue?</p>
        <p className="mt-1">
          La Facultad de {solicitud.facultadReferencial || '—'} revisará su solicitud y sus documentos. Puede
          consultar el avance en cualquier momento desde "Consultar mi solicitud", con su número de documento.
        </p>
      </div>

      <button type="button" className="btn-secondary mx-auto px-6" onClick={onNuevaSolicitud}>
        Volver al inicio
      </button>
    </div>
  );
}
