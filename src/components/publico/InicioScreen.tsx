/**
 * InicioScreen.tsx
 * D.1 — pantalla de inicio con TRES opciones para el estudiante:
 *  - "Iniciar solicitud de grado por ceremonia": solo disponible si hay una
 *    fecha tentativa de ceremonia vigente (ver vigenciaCeremonia).
 *  - "Iniciar solicitud de grado por ventanilla": siempre disponible,
 *    trámite individual sin depender de ninguna ceremonia.
 *  - "Consultar mi solicitud": estado y radicado actual.
 * El ingreso administrativo (Jefe de Programa, Secretaría Académica, acceso
 * total) NO vive aquí — esta vista es solo para el estudiante; el panel
 * administrativo se entra únicamente desde el Portal (incrustada, vía el
 * engranaje del Portal).
 */

import { AlertCircle, FileSearch, GraduationCap, SendHorizonal } from 'lucide-react';
import { INSTITUCION } from '../../data/brand';
import type { ViaRadicacion } from '../../types';

interface Props {
  onIniciar: (via: ViaRadicacion) => void;
  onConsultar: () => void;
  /** null = la ventana general de radicación sigue abierta. */
  avisoCierre?: string | null;
  /** Resultado de vigenciaCeremonia() — controla la opción "por ceremonia". */
  ceremonia: { vigente: boolean; motivo: 'sin-ceremonia-vigente' | 'despues-de-cierre' | null };
}

export function formatearFechaLarga(iso: string): string {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return new Date(anio, mes - 1, dia).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function InicioScreen({ onIniciar, onConsultar, avisoCierre, ceremonia }: Props) {
  // La ventanilla es individual y siempre está disponible — solo se
  // deshabilita si Secretaría Académica cerró TODA la radicación (avisoCierre).
  const ventanillaDeshabilitada = Boolean(avisoCierre);
  const ceremoniaDeshabilitada = ventanillaDeshabilitada || !ceremonia.vigente;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 text-center">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-700">{INSTITUCION.dependencia}</p>
        <h1 className="mt-1 text-3xl font-semibold text-navy-900">Portal de Solicitud de Titulación</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
          Radique su solicitud de titulación, adjunte sus documentos y haga seguimiento al trámite, todo en un solo lugar.
        </p>
      </div>

      {avisoCierre && (
        <div className="mx-auto flex max-w-xl items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900">
          <AlertCircle size={17} className="mt-0.5 shrink-0" />
          <span>{avisoCierre}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => onIniciar('Ceremonia')}
          disabled={ceremoniaDeshabilitada}
          className="card group flex flex-col items-center gap-3 p-6 text-center transition hover:border-navy-300 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:shadow-none"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-navy-800 text-white transition group-hover:bg-navy-700">
            <GraduationCap size={22} />
          </span>
          <span className="text-sm font-semibold text-navy-900">Iniciar solicitud de grado por ceremonia</span>
          {ceremoniaDeshabilitada ? (
            <span className="text-xs font-medium text-slate-400">No hay grados disponibles en este momento</span>
          ) : (
            <span className="text-xs text-slate-500">Su solicitud entra al lote de la próxima ceremonia de grado.</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onIniciar('Ventanilla')}
          disabled={ventanillaDeshabilitada}
          className="card group flex flex-col items-center gap-3 p-6 text-center transition hover:border-navy-300 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:shadow-none"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-navy-800 text-white transition group-hover:bg-navy-700">
            <SendHorizonal size={22} />
          </span>
          <span className="text-sm font-semibold text-navy-900">Iniciar solicitud de grado por ventanilla</span>
          <span className="text-xs text-slate-500">Trámite individual, disponible en cualquier momento.</span>
        </button>

        <button
          type="button"
          onClick={onConsultar}
          className="card group flex flex-col items-center gap-3 p-6 text-center transition hover:border-navy-300 hover:shadow-lg"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-navy-100 text-navy-800 transition group-hover:bg-navy-200">
            <FileSearch size={22} />
          </span>
          <span className="text-sm font-semibold text-navy-900">Consultar mi solicitud</span>
          <span className="text-xs text-slate-500">Vea el estado de su trámite con su número de documento.</span>
        </button>
      </div>
    </div>
  );
}
