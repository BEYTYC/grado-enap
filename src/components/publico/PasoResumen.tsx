/**
 * PasoResumen.tsx
 * D.2 paso 4 — Resumen y autorización. Tabla resumen de todo lo capturado +
 * checkbox obligatorio (nunca premarcado) de autorización de tratamiento de
 * datos, con el texto legal exacto. "Radicar solicitud" queda deshabilitado
 * hasta marcar el checkbox.
 */

import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { formatearMilesDocumento } from '../../services/reglasNegocio';
import { TEXTO_AUTORIZACION_DATOS, type DatosPersonalesFormulario } from '../../services/solicitudService';
import type { DocumentoDef, OpcionGrado } from '../../types';
import type { EstadoDocumento } from '../../hooks/usePublicSolicitud';

interface Props {
  datosPersonales: DatosPersonalesFormulario;
  programa: string;
  opcionGrado: OpcionGrado | '';
  nombreDiplomado: string;
  documentosRequeridos: DocumentoDef[];
  documentos: EstadoDocumento[];
  autorizacion: boolean;
  onAutorizacionChange: (valor: boolean) => void;
  radicando: boolean;
  error: string | null;
  onRadicar: () => void;
  onVolver: () => void;
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-navy-900">{value}</dd>
    </div>
  );
}

export function PasoResumen({
  datosPersonales,
  programa,
  opcionGrado,
  nombreDiplomado,
  documentosRequeridos,
  documentos,
  autorizacion,
  onAutorizacionChange,
  radicando,
  error,
  onRadicar,
  onVolver,
}: Props) {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <header className="text-center">
        <h2 className="text-xl font-semibold text-navy-900">Resumen y autorización</h2>
        <p className="mt-1 text-sm text-slate-500">Revise que todo esté correcto antes de radicar.</p>
      </header>

      <section className="card p-5">
        <h3 className="mb-3 text-sm font-semibold text-navy-900">Sus datos</h3>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Dato label="Nombres" value={datosPersonales.nombres} />
          <Dato label="Apellidos" value={datosPersonales.apellidos} />
          <Dato label="Tipo de documento" value={datosPersonales.tipoDocumento} />
          <Dato label="Identificación" value={formatearMilesDocumento(datosPersonales.identificacion)} />
          <Dato label="Lugar de expedición" value={datosPersonales.lugarExpedicion} />
          <Dato label="Correo" value={datosPersonales.correo} />
          <Dato label="Teléfono" value={datosPersonales.telefono} />
          <Dato label="Programa" value={programa} />
          <Dato label="Opción de grado" value={opcionGrado || '—'} />
          {opcionGrado === 'Diplomado' && <Dato label="Nombre del diplomado" value={nombreDiplomado || '—'} />}
        </dl>
      </section>

      <section className="card p-5">
        <h3 className="mb-3 text-sm font-semibold text-navy-900">Documentos adjuntos</h3>
        <ul className="space-y-1.5 text-sm">
          {documentosRequeridos.map((doc) => {
            const cargado = documentos.find((d) => d.id === doc.id && d.estado === 'cargado');
            return (
              <li key={doc.id} className="flex items-center justify-between gap-3">
                <span className="text-navy-800">{doc.nombre}</span>
                <span className="truncate text-xs text-slate-500">{cargado?.archivo?.name}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card space-y-3 p-5">
        <h3 className="text-sm font-semibold text-navy-900">Autorización de tratamiento de datos</h3>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-navy-700 focus:ring-navy-500"
            checked={autorizacion}
            onChange={(e) => onAutorizacionChange(e.target.checked)}
          />
          <span>{TEXTO_AUTORIZACION_DATOS}</span>
        </label>
        <p className="text-xs text-slate-500">
          Al radicar, se genera automáticamente un PDF con este texto y sus datos, y se le envía adjunto
          a su correo junto con la confirmación de radicado.
        </p>
      </section>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <AlertCircle size={17} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button type="button" className="btn-secondary px-5" onClick={onVolver} disabled={radicando}>Volver</button>
        <button
          type="button"
          className="btn-success gap-3 rounded-full px-7 py-3 text-base font-semibold shadow-lg"
          disabled={!autorizacion || radicando}
          onClick={onRadicar}
        >
          {radicando ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
          Radicar solicitud
        </button>
      </div>
    </div>
  );
}
