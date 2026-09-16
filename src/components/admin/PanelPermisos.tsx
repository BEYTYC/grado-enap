/**
 * PanelPermisos.tsx
 * Pantalla de administración de permisos (A.2 / A.4 / A.5): quién puede
 * entrar como Jefe de Programa (por facultad), quién es Secretaría
 * Académica, quién tiene acceso total y el interruptor de "modo pruebas".
 *
 * Solo la Jefe de Estadística (acceso total) puede llegar aquí — el botón
 * que abre esta pantalla (el engranaje del panel) solo se muestra para ese
 * rol. La Jefe de Estadística siempre queda con acceso total sin importar
 * lo que se edite aquí (ver ACCESO_TOTAL_PERMANENTE en configService.ts).
 */

import { useState } from 'react';
import { ArrowLeft, CalendarDays, Mail, Plus, ShieldCheck, Trash2 } from 'lucide-react';

import { FACULTADES } from '../../data/facultades';
import {
  agregarCorreoAFacultad,
  establecerAccesoTotal,
  establecerApiBaseUrl,
  establecerCorreoSecretaria,
  establecerFechaTentativaGrado,
  establecerFechasDeApertura,
  establecerModoPruebas,
  quitarCorreoDeFacultad,
} from '../../services/configService';
import { correoCompleto } from '../../services/reglasNegocio';
import type { ConfiguracionTitulacion, RolTitulacion } from '../../types';

interface PanelPermisosProps {
  config: ConfiguracionTitulacion;
  onConfig: (config: ConfiguracionTitulacion) => void;
  onVolver: () => void;
  /** Secretaría Académica solo ve/edita la apertura de solicitudes; el resto
   *  (correos autorizados, acceso total, modo pruebas) es solo de acceso total. */
  rol: RolTitulacion;
}

export function PanelPermisos({ config, onConfig, onVolver, rol }: PanelPermisosProps) {
  const [mensaje, setMensaje] = useState<string | null>(null);
  const esAccesoTotal = rol === 'acceso_total';

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onVolver}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-navy-700 transition hover:bg-navy-50"
        >
          <ArrowLeft size={16} /> Volver al listado
        </button>
      </div>

      <header>
        <h2 className="text-lg font-semibold text-navy-900">{esAccesoTotal ? 'Permisos del portal' : 'Apertura de solicitudes de grado'}</h2>
        <p className="mt-1 text-sm text-slate-600">
          {esAccesoTotal
            ? 'Correos autorizados para entrar como Jefe de Programa (por facultad), Secretaría Académica o con acceso total a todas las facultades.'
            : 'Defina cuándo pueden los estudiantes radicar su solicitud de titulación.'}
        </p>
      </header>

      {mensaje && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-800">
          {mensaje}
        </div>
      )}

      {esAccesoTotal && (
        <section className="card space-y-3 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-navy-900">
            <ShieldCheck size={16} className="text-gold-600" />
            Acceso total (todas las facultades)
          </h3>
          <p className="text-[13px] text-slate-600">
            jestadisticaplen siempre tiene acceso total y no se puede quitar. Aquí se puede dar ese
            mismo nivel a otros correos, si hace falta — los demás sí se pueden retirar.
          </p>
          <ListaCorreos
            correos={config.correosAccesoTotal}
            permanentes={['jestadisticaplen']}
            onAgregar={(correo) => onConfig(establecerAccesoTotal(config, [...config.correosAccesoTotal, correo]))}
            onQuitar={(correo) =>
              onConfig(
                establecerAccesoTotal(
                  config,
                  config.correosAccesoTotal.filter((c) => c !== correo),
                ),
              )
            }
          />
        </section>
      )}

      <section className="card space-y-3 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-navy-900">
          <CalendarDays size={16} className="text-gold-600" />
          Apertura de solicitudes de grado
        </h3>
        <p className="text-[13px] text-slate-600">
          Fechas en las que Secretaría Académica habilita a los estudiantes para radicar. Deje una
          fecha en blanco para no exigirla (por ejemplo, sin fecha de cierre = queda abierto de
          forma indefinida).
        </p>
        <FechasApertura
          apertura={config.fechaAperturaSolicitudes}
          cierre={config.fechaCierreSolicitudes}
          onGuardar={(apertura, cierre) => onConfig(establecerFechasDeApertura(config, apertura, cierre))}
        />
        <div className="border-t border-slate-100 pt-3">
          <FechaTentativaGrado
            fecha={config.fechaTentativaGrado}
            onGuardar={(fecha) => onConfig(establecerFechaTentativaGrado(config, fecha))}
          />
        </div>
      </section>

      {esAccesoTotal && (
        <section className="card space-y-3 p-4">
          <h3 className="text-sm font-semibold text-navy-900">Secretaría Académica</h3>
          <p className="text-[13px] text-slate-600">
            Un único correo con este rol; ve y firma en representación de todas las facultades.
          </p>
          <CorreoUnico
            correo={config.correoSecretaria}
            onCambiar={(correo) => onConfig(establecerCorreoSecretaria(config, correo))}
          />
        </section>
      )}

      {esAccesoTotal && (
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-navy-900">Jefes de Programa por facultad</h3>
          {FACULTADES.map((facultad) => (
            <div key={facultad.nombre} className="card space-y-3 p-4">
              <h4 className="text-sm font-semibold text-navy-800">{facultad.nombre}</h4>
              <ListaCorreos
                correos={config.correosPorFacultad[facultad.nombre] ?? []}
                onAgregar={(correo) => {
                  const resultado = agregarCorreoAFacultad(config, facultad.nombre, correo);
                  if (!resultado.ok) {
                    setMensaje(resultado.mensaje ?? 'No se pudo agregar el correo.');
                    return;
                  }
                  setMensaje(null);
                  onConfig(resultado.config);
                }}
                onQuitar={(correo) => {
                  const resultado = quitarCorreoDeFacultad(config, facultad.nombre, correo);
                  if (!resultado.ok) {
                    setMensaje(resultado.mensaje ?? 'No se pudo quitar el correo.');
                    return;
                  }
                  setMensaje(null);
                  onConfig(resultado.config);
                }}
              />
            </div>
          ))}
        </section>
      )}

      {esAccesoTotal && (
        <section className="card space-y-3 p-4">
          <h3 className="text-sm font-semibold text-navy-900">Modo pruebas</h3>
          <p className="text-[13px] text-slate-600">
            Los correos aquí listados entran sin código de verificación (solo para pruebas
            internas). Debe quedar vacío en producción.
          </p>
          <ListaCorreos
            correos={config.correosModoPruebas}
            permanentes={['prueba']}
            onAgregar={(correo) => onConfig(establecerModoPruebas(config, [...config.correosModoPruebas, correo]))}
            onQuitar={(correo) =>
              onConfig(
                establecerModoPruebas(
                  config,
                  config.correosModoPruebas.filter((c) => c !== correo),
                ),
              )
            }
          />
          {config.correosModoPruebas.length > 0 && (
            <p className="text-[12px] font-medium text-amber-700">
              Atención: hay correos en modo pruebas. Vacíe esta lista antes de producción.
            </p>
          )}
        </section>
      )}

      {esAccesoTotal && (
        <section className="card space-y-3 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-navy-900">
            <Mail size={16} className="text-gold-600" />
            Envío de correo
          </h3>
          <p className="text-[13px] text-slate-600">
            Solo hace falta tocar esto si esta app corre incrustada en OTRO dominio (por ejemplo,
            dentro del Portal). En ese caso, ponga aquí el dominio propio de este proyecto en
            Vercel — sin esto, el correo (código de acceso y confirmación de radicación) intenta
            salir por el dominio equivocado y nunca llega.
          </p>
          <UrlFuncionesCorreo
            url={config.apiBaseUrl}
            onGuardar={(url) => onConfig(establecerApiBaseUrl(config, url))}
          />
        </section>
      )}
    </div>
  );
}

function ListaCorreos({
  correos,
  permanentes = [],
  onAgregar,
  onQuitar,
}: {
  correos: string[];
  permanentes?: string[];
  onAgregar: (correo: string) => void;
  onQuitar: (correo: string) => void;
}) {
  const [nuevo, setNuevo] = useState('');

  return (
    <div className="space-y-2">
      <ul className="space-y-1.5">
        {correos.map((correo) => {
          const esPermanente = permanentes.includes(correo);
          return (
            <li
              key={correo}
              className="flex items-center justify-between gap-2 rounded-lg bg-navy-50 px-3 py-1.5 text-sm text-navy-900"
            >
              <span className="truncate">{correoCompleto(correo)}</span>
              {esPermanente ? (
                <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-gold-700">
                  Fijo
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onQuitar(correo)}
                  title="Quitar este correo"
                  className="shrink-0 rounded-md p-1 text-rose-600 transition hover:bg-rose-100"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          );
        })}
        {correos.length === 0 && (
          <li className="text-[13px] italic text-slate-500">Sin correos autorizados todavía.</li>
        )}
      </ul>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={nuevo}
          onChange={(event) => setNuevo(event.target.value)}
          placeholder="usuario (sin @enap.edu.co)"
          className="field flex-1 py-1.5 text-sm"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && nuevo.trim()) {
              onAgregar(nuevo.trim());
              setNuevo('');
            }
          }}
        />
        <button
          type="button"
          onClick={() => {
            if (!nuevo.trim()) return;
            onAgregar(nuevo.trim());
            setNuevo('');
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-navy-300 bg-white px-2.5 py-1.5 text-xs font-medium text-navy-800 transition hover:bg-navy-50"
        >
          <Plus size={14} /> Agregar
        </button>
      </div>
    </div>
  );
}

function FechasApertura({
  apertura,
  cierre,
  onGuardar,
}: {
  apertura: string | null;
  cierre: string | null;
  onGuardar: (apertura: string | null, cierre: string | null) => void;
}) {
  const [valorApertura, setValorApertura] = useState(apertura ?? '');
  const [valorCierre, setValorCierre] = useState(cierre ?? '');
  const cambiado = valorApertura !== (apertura ?? '') || valorCierre !== (cierre ?? '');

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Abre</label>
          <input
            type="date"
            className="field"
            value={valorApertura}
            onChange={(event) => setValorApertura(event.target.value)}
          />
        </div>
        <div>
          <label className="label">Cierra (opcional)</label>
          <input
            type="date"
            className="field"
            value={valorCierre}
            onChange={(event) => setValorCierre(event.target.value)}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn-primary !px-3 !py-1.5 text-xs"
          disabled={!cambiado}
          onClick={() => onGuardar(valorApertura || null, valorCierre || null)}
        >
          Guardar fechas
        </button>
        {!apertura && !cierre && (
          <span className="text-[12px] text-slate-500">Sin fechas: las solicitudes están siempre abiertas.</span>
        )}
      </div>
    </div>
  );
}

function FechaTentativaGrado({
  fecha,
  onGuardar,
}: {
  fecha: string | null;
  onGuardar: (fecha: string | null) => void;
}) {
  const [valor, setValor] = useState(fecha ?? '');
  const cambiado = valor !== (fecha ?? '');

  return (
    <div className="space-y-2">
      <label className="label">Fecha tentativa de grado</label>
      <p className="text-[13px] text-slate-600">
        Se muestra a cada Jefe de Programa junto al listado de su facultad, sin importar con qué
        correo haya iniciado sesión.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          className="field w-auto"
          value={valor}
          onChange={(event) => setValor(event.target.value)}
        />
        <button
          type="button"
          className="btn-primary !px-3 !py-1.5 text-xs"
          disabled={!cambiado}
          onClick={() => onGuardar(valor || null)}
        >
          Guardar fecha
        </button>
        {!fecha && <span className="text-[12px] text-slate-500">Sin fecha tentativa definida todavía.</span>}
      </div>
    </div>
  );
}

function UrlFuncionesCorreo({
  url,
  onGuardar,
}: {
  url: string | null;
  onGuardar: (url: string | null) => void;
}) {
  const [valor, setValor] = useState(url ?? '');
  const cambiado = valor.trim() !== (url ?? '');

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="url"
          value={valor}
          onChange={(event) => setValor(event.target.value)}
          placeholder="https://titulacion-grados-alumno.vercel.app"
          className="field flex-1 py-1.5 text-sm"
        />
        <button
          type="button"
          className="btn-primary !px-3 !py-1.5 text-xs"
          disabled={!cambiado}
          onClick={() => onGuardar(valor || null)}
        >
          Guardar
        </button>
      </div>
      {!url && <span className="text-[12px] text-slate-500">Sin configurar: usa rutas relativas (funciona si esta app abre en su propio dominio).</span>}
    </div>
  );
}

function CorreoUnico({ correo, onCambiar }: { correo: string; onCambiar: (correo: string) => void }) {
  const [valor, setValor] = useState(correo);

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={valor}
        onChange={(event) => setValor(event.target.value)}
        placeholder="usuario (sin @enap.edu.co)"
        className="field flex-1 py-1.5 text-sm"
      />
      <button
        type="button"
        onClick={() => onCambiar(valor.trim())}
        disabled={!valor.trim() || valor.trim() === correo}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-navy-300 bg-white px-2.5 py-1.5 text-xs font-medium text-navy-800 transition hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Guardar
      </button>
    </div>
  );
}
