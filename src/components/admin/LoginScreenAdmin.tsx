/**
 * LoginScreenAdmin.tsx
 * E.1 — puerta de acceso del panel administrativo. Mismo patrón visual y de
 * interacción que el resto de módulos del Proyecto de Transformación
 * Digital (correo institucional + código de un solo uso, con respaldo en
 * pantalla mientras no haya correo real conectado).
 */

import { AlertCircle, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

interface Props {
  etapa: 'correo' | 'codigo';
  correoPendiente: string | null;
  codigoRespaldo: string | null;
  /** `true` mientras se espera la respuesta del envío real de correo. */
  enviandoCodigo?: boolean;
  error: string | null;
  onSolicitarCodigo: (correo: string) => void;
  onVerificarCodigo: (codigo: string) => void;
  onReenviarCodigo: () => void;
  onCambiarCorreo: () => void;
}

export function LoginScreenAdmin({
  etapa,
  correoPendiente,
  codigoRespaldo,
  enviandoCodigo,
  error,
  onSolicitarCodigo,
  onVerificarCodigo,
  onReenviarCodigo,
  onCambiarCorreo,
}: Props) {
  const [correo, setCorreo] = useState('');
  const [codigo, setCodigo] = useState('');

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col">
      <header className="mb-6 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-navy-50 text-navy-700">
          <ShieldCheck size={24} />
        </span>
        <h2 className="mt-3 text-lg font-semibold text-navy-900">Ingreso administrativo</h2>
        <p className="mt-1 text-sm text-slate-600">
          Jefe de Programa, Secretaría Académica o acceso total: confirme su correo institucional autorizado.
        </p>
      </header>

      <div className="card px-6 py-6">
        {etapa === 'correo' && (
          <form
            onSubmit={(e) => { e.preventDefault(); onSolicitarCodigo(correo); }}
            className="flex flex-col gap-4"
          >
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-navy-900">Correo institucional</span>
              <div className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 focus-within:border-navy-500 focus-within:ring-2 focus-within:ring-navy-100">
                <Mail size={16} className="shrink-0 text-slate-400" />
                <input
                  type="text"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  placeholder="usuario@enap.edu.co"
                  autoFocus
                  className="w-full bg-transparent text-sm text-navy-900 outline-none placeholder:text-slate-400"
                />
              </div>
            </label>
            <button type="submit" className="btn-primary justify-center" disabled={!correo.trim()}>
              Enviar código
            </button>
          </form>
        )}

        {etapa === 'codigo' && (
          <form
            onSubmit={(e) => { e.preventDefault(); onVerificarCodigo(codigo); }}
            className="flex flex-col gap-4"
          >
            <p className="text-sm text-slate-600">
              Se envió un código de acceso a <strong className="text-navy-900">{correoPendiente}</strong>. Revise su
              bandeja de entrada.
            </p>

            {enviandoCodigo && !codigoRespaldo && (
              <p className="text-xs text-slate-500">Enviando código por correo…</p>
            )}

            {codigoRespaldo && (
              <div className="rounded-lg border border-gold-500/60 bg-gold-50 px-3 py-2.5 text-sm text-navy-900">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gold-700">
                  No se pudo enviar el correo — código de respaldo
                </p>
                <p className="mt-1">
                  Su código es <span className="font-mono text-base font-bold">{codigoRespaldo}</span>
                </p>
              </div>
            )}

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-navy-900">Código de acceso</span>
              <div className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 focus-within:border-navy-500 focus-within:ring-2 focus-within:ring-navy-100">
                <KeyRound size={16} className="shrink-0 text-slate-400" />
                <input
                  type="text"
                  inputMode="numeric"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="000000"
                  autoFocus
                  className="w-full bg-transparent text-sm tracking-[0.3em] text-navy-900 outline-none placeholder:tracking-normal placeholder:text-slate-400"
                />
              </div>
            </label>

            <button type="submit" className="btn-primary justify-center" disabled={!codigo.trim()}>
              Validar código
            </button>

            <div className="flex items-center justify-between text-xs text-slate-500">
              <button type="button" onClick={onCambiarCorreo} className="underline hover:text-navy-700">
                Cambiar correo
              </button>
              <button type="button" onClick={onReenviarCodigo} className="underline hover:text-navy-700">
                Reenviar código
              </button>
            </div>
          </form>
        )}

        {error && (
          <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
