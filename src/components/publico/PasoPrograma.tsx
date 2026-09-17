/**
 * PasoPrograma.tsx
 * D.2 paso 2 — Tu programa. El nivel nunca lo elige el usuario: se deduce
 * del programa (A.1), y la lista de opciones de grado se llena según ese
 * nivel deducido (2 opciones si es Pregrado, 6 si es Posgrado — A.3).
 */

import { useEffect, useState } from 'react';
import { OPCIONES_GRADO_POR_NIVEL } from '../../data/opcionesGrado';
import { PROGRAMAS } from '../../data/programas';
import { listarNombresDiplomados } from '../../services/solicitudService';
import type { OpcionGrado } from '../../types';

interface Props {
  programa: string;
  opcionGrado: OpcionGrado | '';
  nivel: 'Pregrado' | 'Posgrado' | null;
  nombreDiplomado: string;
  onProgramaChange: (programa: string) => void;
  onOpcionGradoChange: (opcion: OpcionGrado | '') => void;
  onNombreDiplomadoChange: (nombre: string) => void;
  onContinuar: () => void;
  onVolver: () => void;
}

export function PasoPrograma({
  programa,
  opcionGrado,
  nivel,
  nombreDiplomado,
  onProgramaChange,
  onOpcionGradoChange,
  onNombreDiplomadoChange,
  onContinuar,
  onVolver,
}: Props) {
  const opciones = nivel ? OPCIONES_GRADO_POR_NIVEL[nivel] : [];
  const esDiplomado = opcionGrado === 'Diplomado';
  const valido = Boolean(programa) && Boolean(opcionGrado) && (!esDiplomado || nombreDiplomado.trim().length > 0);

  const [sugerencias, setSugerencias] = useState<string[]>([]);
  useEffect(() => {
    if (!esDiplomado) return;
    let vigente = true;
    void listarNombresDiplomados().then((nombres) => {
      if (vigente) setSugerencias(nombres);
    });
    return () => {
      vigente = false;
    };
  }, [esDiplomado]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <header className="text-center">
        <h2 className="text-xl font-semibold text-navy-900">Tu programa</h2>
        <p className="mt-1 text-sm text-slate-500">Seleccione el programa que está cursando o del que se va a titular.</p>
      </header>

      <section className="card space-y-4 p-5">
        <div>
          <label className="label" htmlFor="programa">Programa académico</label>
          <select
            id="programa"
            className="field"
            value={programa}
            onChange={(e) => onProgramaChange(e.target.value)}
          >
            <option value="">Seleccione un programa…</option>
            {PROGRAMAS.map((p) => (
              <option key={p.nombre} value={p.nombre}>{p.nombre}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="opcionGrado">Opción de grado</label>
          <select
            id="opcionGrado"
            className="field"
            value={opcionGrado}
            disabled={!nivel}
            onChange={(e) => onOpcionGradoChange(e.target.value as OpcionGrado)}
          >
            <option value="">{nivel ? 'Seleccione una opción…' : 'Elija primero un programa'}</option>
            {opciones.map((op) => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>
        </div>

        {esDiplomado && (
          <div>
            <label className="label" htmlFor="nombreDiplomado">Nombre del diplomado</label>
            <input
              id="nombreDiplomado"
              className="field"
              list="diplomados-sugeridos"
              value={nombreDiplomado}
              onChange={(e) => onNombreDiplomadoChange(e.target.value)}
              placeholder="Escriba el nombre exacto del diplomado"
            />
            <datalist id="diplomados-sugeridos">
              {sugerencias.map((nombre) => (
                <option key={nombre} value={nombre} />
              ))}
            </datalist>
          </div>
        )}
      </section>

      <div className="flex justify-between">
        <button type="button" className="btn-secondary px-5" onClick={onVolver}>Volver</button>
        <button type="button" className="btn-primary px-6 py-2.5" disabled={!valido} onClick={onContinuar}>
          Continuar
        </button>
      </div>
    </div>
  );
}
