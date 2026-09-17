/**
 * PasoDocumentos.tsx
 * D.2 paso 3 — Tus documentos. Lista dinámica según nivel/opción (solo los
 * documentos que le corresponden al estudiante, tabla C). Carga por
 * arrastrar-soltar o selección, solo PDF, máximo 15 MB. El botón de
 * continuar solo se habilita cuando todos están "Cargado".
 */

import { AlertCircle, CheckCircle2, FileText, RotateCcw, UploadCloud, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { LIMITE_TAMANO_DOCUMENTO_BYTES } from '../../data/documentos';
import type { DocumentoDef, DocumentoId } from '../../types';
import type { EstadoDocumento } from '../../hooks/usePublicSolicitud';

interface Props {
  requeridos: DocumentoDef[];
  documentos: EstadoDocumento[];
  onArchivo: (id: DocumentoId, archivo: File | null, error?: string) => void;
  onContinuar: () => void;
  onVolver: () => void;
  onReiniciar: () => void;
}

const EXTENSIONES_IMAGEN = ['.jpg', '.jpeg', '.png'];

function validar(archivo: File, tipoArchivo: 'pdf' | 'imagen'): string | undefined {
  const nombre = archivo.name.toLowerCase();
  if (tipoArchivo === 'imagen') {
    const esImagen = archivo.type.startsWith('image/') || EXTENSIONES_IMAGEN.some((ext) => nombre.endsWith(ext));
    if (!esImagen) return 'Solo se aceptan fotografías en JPG o PNG.';
  } else if (archivo.type !== 'application/pdf' && !nombre.endsWith('.pdf')) {
    return 'Solo se aceptan archivos PDF.';
  }
  if (archivo.size > LIMITE_TAMANO_DOCUMENTO_BYTES) {
    return 'El archivo supera el límite de 15 MB.';
  }
  return undefined;
}

function FilaDocumento({
  doc,
  estado,
  onArchivo,
}: {
  doc: DocumentoDef;
  estado: EstadoDocumento | undefined;
  onArchivo: (archivo: File | null, error?: string) => void;
}) {
  const [arrastrando, setArrastrando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const tipoArchivo = doc.tipoArchivo ?? 'pdf';

  const manejarArchivo = (archivo: File | undefined | null) => {
    if (!archivo) return;
    const error = validar(archivo, tipoArchivo);
    if (error) {
      onArchivo(null, error);
      return;
    }
    onArchivo(archivo);
  };

  const cargado = estado?.estado === 'cargado';
  const error = estado?.estado === 'error';

  return (
    <div
      className={[
        'flex items-center gap-3 rounded-lg border-2 border-dashed p-3 transition',
        cargado ? 'border-emerald-300 bg-emerald-50' : error ? 'border-rose-300 bg-rose-50' : arrastrando ? 'border-navy-400 bg-navy-50' : 'border-slate-200 bg-white',
      ].join(' ')}
      onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
      onDragLeave={() => setArrastrando(false)}
      onDrop={(e) => {
        e.preventDefault();
        setArrastrando(false);
        manejarArchivo(e.dataTransfer.files[0]);
      }}
    >
      <div className="shrink-0">
        {cargado ? (
          <CheckCircle2 size={22} className="text-emerald-600" />
        ) : error ? (
          <AlertCircle size={22} className="text-rose-600" />
        ) : (
          <FileText size={22} className="text-slate-400" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-navy-900">{doc.nombre}</p>
        {estado?.archivo ? (
          <p className="truncate text-xs text-slate-500">{estado.archivo.name}</p>
        ) : tipoArchivo === 'imagen' ? (
          <p className="text-xs text-slate-400">Arrastre la foto (JPG o PNG) aquí o haga clic para elegirla · máx. 15 MB</p>
        ) : (
          <p className="text-xs text-slate-400">Arrastre el PDF aquí o haga clic para elegirlo · máx. 15 MB</p>
        )}
        {error && <p className="mt-0.5 text-xs text-rose-600">{estado?.error}</p>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={tipoArchivo === 'imagen' ? 'image/jpeg,image/png' : 'application/pdf'}
        className="hidden"
        onChange={(e) => manejarArchivo(e.target.files?.[0])}
      />

      {cargado ? (
        <button
          type="button"
          className="btn-ghost shrink-0 !px-2 !py-1"
          title="Quitar y volver a cargar"
          onClick={() => onArchivo(null)}
        >
          <X size={16} />
        </button>
      ) : (
        <button
          type="button"
          className="btn-secondary shrink-0 !px-3 !py-1.5 text-xs"
          onClick={() => inputRef.current?.click()}
        >
          <UploadCloud size={14} /> Elegir
        </button>
      )}
    </div>
  );
}

export function PasoDocumentos({ requeridos, documentos, onArchivo, onContinuar, onVolver, onReiniciar }: Props) {
  const [confirmandoReinicio, setConfirmandoReinicio] = useState(false);
  const todosCargados =
    requeridos.length > 0 && requeridos.every((doc) => documentos.some((d) => d.id === doc.id && d.estado === 'cargado'));

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <header className="text-center">
        <h2 className="text-xl font-semibold text-navy-900">Tus documentos</h2>
        <p className="mt-1 text-sm text-slate-500">Cargue cada documento en formato PDF. Todos son obligatorios para continuar.</p>
      </header>

      <section className="card space-y-2.5 p-5">
        {requeridos.map((doc) => (
          <FilaDocumento
            key={doc.id}
            doc={doc}
            estado={documentos.find((d) => d.id === doc.id)}
            onArchivo={(archivo, error) => onArchivo(doc.id, archivo, error)}
          />
        ))}
      </section>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button type="button" className="btn-secondary px-5" onClick={onVolver}>Volver</button>
          {confirmandoReinicio ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">¿Borrar todo y empezar de nuevo?</span>
              <button type="button" className="btn-ghost !px-2 !py-1 text-rose-600" onClick={onReiniciar}>Sí, reiniciar</button>
              <button type="button" className="btn-ghost !px-2 !py-1" onClick={() => setConfirmandoReinicio(false)}>Cancelar</button>
            </div>
          ) : (
            <button type="button" className="btn-ghost !px-3 !py-2 text-xs" onClick={() => setConfirmandoReinicio(true)}>
              <RotateCcw size={13} /> Reiniciar solicitud
            </button>
          )}
        </div>
        <button type="button" className="btn-primary px-6 py-2.5" disabled={!todosCargados} onClick={onContinuar}>
          Continuar
        </button>
      </div>
    </div>
  );
}
