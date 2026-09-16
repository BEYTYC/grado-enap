/**
 * PasoDatos.tsx
 * D.2 paso 1 — Tus datos. Nombres/apellidos/lugar se auto-capitalizan al
 * salir del campo; el documento se formatea en vivo con puntos de miles
 * (mínimo 5 dígitos); el teléfono exige mínimo 7 dígitos; el correo exige un
 * "@".
 */

import { useState } from 'react';
import { CIUDADES_SUGERIDAS } from '../../data/ciudades';
import { capitalizarLugar, capitalizarPalabras, formatearMilesDocumento } from '../../services/reglasNegocio';
import { TIPOS_DOCUMENTO_IDENTIDAD } from '../../types';
import type { DatosPersonalesFormulario } from '../../services/solicitudService';

interface Props {
  valor: DatosPersonalesFormulario;
  onChange: (siguiente: DatosPersonalesFormulario) => void;
  onContinuar: () => void;
}

function soloDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

export function PasoDatos({ valor, onChange, onContinuar }: Props) {
  const [tocado, setTocado] = useState<Record<string, boolean>>({});

  const identificacionDigitos = soloDigitos(valor.identificacion);
  const telefonoDigitos = soloDigitos(valor.telefono);

  const errores = {
    nombres: valor.nombres.trim().length === 0 ? 'Ingrese sus nombres.' : null,
    apellidos: valor.apellidos.trim().length === 0 ? 'Ingrese sus apellidos.' : null,
    identificacion:
      identificacionDigitos.length < 5 ? 'El número de documento debe tener al menos 5 dígitos.' : null,
    lugarExpedicion: valor.lugarExpedicion.trim().length === 0 ? 'Indique el lugar de expedición.' : null,
    correo: !valor.correo.includes('@') ? 'Ingrese un correo válido.' : null,
    telefono: telefonoDigitos.length < 7 ? 'El teléfono debe tener al menos 7 dígitos.' : null,
  };
  const valido = Object.values(errores).every((e) => e === null);

  const marcar = (campo: string) => setTocado((t) => ({ ...t, [campo]: true }));
  const mostrarError = (campo: keyof typeof errores) => tocado[campo] && errores[campo];

  const capitalizarAlSalir = (campo: 'nombres' | 'apellidos' | 'lugarExpedicion') => {
    const formatear = campo === 'lugarExpedicion' ? capitalizarLugar : capitalizarPalabras;
    onChange({ ...valor, [campo]: formatear(valor[campo]) });
    marcar(campo);
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <header className="text-center">
        <h2 className="text-xl font-semibold text-navy-900">Tus datos</h2>
        <p className="mt-1 text-sm text-slate-500">Diligencie su información personal tal como aparece en su documento.</p>
      </header>

      <section className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="nombres">Nombres</label>
          <input
            id="nombres"
            className="field"
            value={valor.nombres}
            onChange={(e) => onChange({ ...valor, nombres: e.target.value })}
            onBlur={() => capitalizarAlSalir('nombres')}
          />
          {mostrarError('nombres') && <p className="mt-1 text-xs text-rose-600">{errores.nombres}</p>}
        </div>

        <div>
          <label className="label" htmlFor="apellidos">Apellidos</label>
          <input
            id="apellidos"
            className="field"
            value={valor.apellidos}
            onChange={(e) => onChange({ ...valor, apellidos: e.target.value })}
            onBlur={() => capitalizarAlSalir('apellidos')}
          />
          {mostrarError('apellidos') && <p className="mt-1 text-xs text-rose-600">{errores.apellidos}</p>}
        </div>

        <div>
          <label className="label" htmlFor="tipoDocumento">Tipo de documento</label>
          <select
            id="tipoDocumento"
            className="field"
            value={valor.tipoDocumento}
            onChange={(e) => onChange({ ...valor, tipoDocumento: e.target.value as DatosPersonalesFormulario['tipoDocumento'] })}
          >
            {TIPOS_DOCUMENTO_IDENTIDAD.map((tipo) => (
              <option key={tipo} value={tipo}>{tipo}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="identificacion">Número de documento</label>
          <input
            id="identificacion"
            className="field font-mono"
            inputMode="numeric"
            value={formatearMilesDocumento(valor.identificacion)}
            onChange={(e) => onChange({ ...valor, identificacion: soloDigitos(e.target.value) })}
            onBlur={() => marcar('identificacion')}
          />
          {mostrarError('identificacion') && <p className="mt-1 text-xs text-rose-600">{errores.identificacion}</p>}
        </div>

        <div>
          <label className="label" htmlFor="lugarExpedicion">Lugar de expedición</label>
          <input
            id="lugarExpedicion"
            className="field"
            list="ciudades-sugeridas"
            value={valor.lugarExpedicion}
            onChange={(e) => onChange({ ...valor, lugarExpedicion: e.target.value })}
            onBlur={() => capitalizarAlSalir('lugarExpedicion')}
          />
          <datalist id="ciudades-sugeridas">
            {CIUDADES_SUGERIDAS.map((ciudad) => (
              <option key={ciudad} value={ciudad} />
            ))}
          </datalist>
          {mostrarError('lugarExpedicion') && <p className="mt-1 text-xs text-rose-600">{errores.lugarExpedicion}</p>}
        </div>

        <div />

        <div>
          <label className="label" htmlFor="correo">Correo electrónico</label>
          <input
            id="correo"
            type="email"
            className="field"
            value={valor.correo}
            onChange={(e) => onChange({ ...valor, correo: e.target.value })}
            onBlur={() => marcar('correo')}
          />
          {mostrarError('correo') && <p className="mt-1 text-xs text-rose-600">{errores.correo}</p>}
        </div>

        <div>
          <label className="label" htmlFor="telefono">Teléfono</label>
          <input
            id="telefono"
            className="field"
            inputMode="tel"
            value={valor.telefono}
            onChange={(e) => onChange({ ...valor, telefono: e.target.value })}
            onBlur={() => marcar('telefono')}
          />
          {mostrarError('telefono') && <p className="mt-1 text-xs text-rose-600">{errores.telefono}</p>}
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          className="btn-primary px-6 py-2.5"
          disabled={!valido}
          onClick={() => {
            setTocado({ nombres: true, apellidos: true, identificacion: true, lugarExpedicion: true, correo: true, telefono: true });
            if (valido) onContinuar();
          }}
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
