/**
 * DocumentoAdminFila.tsx
 * E.3 — una fila de documento en el panel: ver (se abre en otra pestaña, no
 * se descarga), cargar por arrastrar-y-soltar o por selección (el Jefe de
 * Programa puede cargar cualquiera, incluso los del estudiante), y avalar
 * solo si lo subió el estudiante (B.5 — los de la facultad se dan por
 * avalados al cargarlos, sin checkbox).
 */

import { CheckCircle2, Eye, UploadCloud } from 'lucide-react';
import { useRef, useState } from 'react';
import { obtenerArchivoDocumento } from '../../services/solicitudService';
import type { DocumentoCargado, DocumentoDef } from '../../types';

interface Props {
  def: DocumentoDef;
  cargado: DocumentoCargado | undefined;
  onCargar: (archivo: File) => void;
  onAlternarAval: (avalado: boolean) => void;
}

export function DocumentoAdminFila({ def, cargado, onCargar, onAlternarAval }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);

  const ver = async () => {
    if (!cargado) return;
    const archivo = await obtenerArchivoDocumento(cargado.blobId);
    if (!archivo) return;
    const url = URL.createObjectURL(archivo.blob);
    // Sin `download`: el navegador abre el PDF en su propio visor, en vez de
    // forzar la descarga del archivo.
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const requiereAval = def.etapa === 'estudiante';

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
      onDragLeave={() => setArrastrando(false)}
      onDrop={(e) => {
        e.preventDefault();
        setArrastrando(false);
        const archivo = e.dataTransfer.files?.[0];
        if (archivo) onCargar(archivo);
      }}
      className={[
        'flex items-center gap-3 rounded-lg border p-3 transition',
        arrastrando ? 'border-navy-400 border-dashed bg-navy-50' : 'border-slate-200 bg-white',
      ].join(' ')}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-navy-900">
          {def.orden}. {def.nombre}
        </p>
        <p className="text-xs text-slate-500">
          {cargado ? cargado.nombreArchivo : 'Sin cargar — arrastre el PDF aquí o use «Cargar»'} · sube: {def.etapa === 'estudiante' ? 'estudiante' : 'facultad'}
        </p>
      </div>

      {requiereAval && cargado && (
        <label className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-600">
          <input
            type="checkbox"
            checked={cargado.avalado}
            onChange={(e) => onAlternarAval(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          {cargado.avalado ? <span className="flex items-center gap-1 text-emerald-700"><CheckCircle2 size={13} /> Avalado</span> : 'Avalar'}
        </label>
      )}
      {!requiereAval && cargado && (
        <span className="flex shrink-0 items-center gap-1 text-xs text-emerald-700"><CheckCircle2 size={13} /> Avalado</span>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onCargar(f); e.target.value = ''; }}
      />

      {cargado && (
        <button type="button" className="btn-ghost shrink-0 !px-2 !py-1" title="Ver documento" onClick={ver}>
          <Eye size={15} />
        </button>
      )}
      <button
        type="button"
        className="btn-secondary shrink-0 !px-2.5 !py-1.5 text-xs"
        onClick={() => inputRef.current?.click()}
      >
        <UploadCloud size={13} /> {cargado ? 'Reemplazar' : 'Cargar'}
      </button>
    </div>
  );
}
