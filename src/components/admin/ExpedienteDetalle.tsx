/**
 * ExpedienteDetalle.tsx
 * E.3 — pantalla del expediente para el Jefe de Programa (y consulta para
 * Secretaría / acceso total): documentos, avales, datos personales, campos
 * académicos con la insignia de Graduado de Honor en vivo, guardar parcial,
 * anular, y cerrar expediente.
 */

import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, ShieldCheck, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  alternarAval,
  cargarDocumento,
  cerrarExpediente,
  editarDatosPersonales,
  completarCamposDeLaFacultad,
  anularSolicitud,
} from '../../services/adminSolicitudService';
import {
  documentosAplicables,
  esGraduadoDeHonor,
  expedienteListoParaCerrar,
  facultadDesdePrograma,
  formatearMilesDocumento,
  textoEstadoParaRol,
  tituloDesdePrograma,
} from '../../services/reglasNegocio';
import { DISTINCIONES_POR_NIVEL } from '../../data/opcionesGrado';
import { TIPOS_DOCUMENTO_IDENTIDAD } from '../../types';
import type { RolTitulacion, Solicitud } from '../../types';
import { DocumentoAdminFila } from './DocumentoAdminFila';

interface Props {
  solicitud: Solicitud;
  rol: RolTitulacion;
  correo: string;
  onVolver: () => void;
  onActualizado: (siguiente: Solicitud) => void;
}

export function ExpedienteDetalle({ solicitud, rol, correo, onVolver, onActualizado }: Props) {
  const soloLectura = rol !== 'jefe_programa' && rol !== 'acceso_total';

  const [datos, setDatos] = useState({
    nombres: solicitud.nombres,
    apellidos: solicitud.apellidos,
    tipoDocumento: solicitud.tipoDocumento,
    identificacion: solicitud.identificacion,
    correo: solicitud.correo,
    telefono: solicitud.telefono,
    lugarExpedicion: solicitud.lugarExpedicion,
  });
  const [promedio, setPromedio] = useState(solicitud.promedioPonderado?.toString() ?? '');
  const [codigoEk, setCodigoEk] = useState(solicitud.codigoEk);
  const [distincion, setDistincion] = useState(solicitud.distincion);
  const [nombreTrabajo, setNombreTrabajo] = useState(solicitud.nombreTrabajoGrado);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [confirmandoAnular, setConfirmandoAnular] = useState(false);
  const [motivoAnular, setMotivoAnular] = useState('');

  useEffect(() => {
    setDatos({
      nombres: solicitud.nombres,
      apellidos: solicitud.apellidos,
      tipoDocumento: solicitud.tipoDocumento,
      identificacion: solicitud.identificacion,
      correo: solicitud.correo,
      telefono: solicitud.telefono,
      lugarExpedicion: solicitud.lugarExpedicion,
    });
    setPromedio(solicitud.promedioPonderado?.toString() ?? '');
    setCodigoEk(solicitud.codigoEk);
    setDistincion(solicitud.distincion);
    setNombreTrabajo(solicitud.nombreTrabajoGrado);
  }, [solicitud.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const promedioNumero = promedio.trim() === '' ? null : Number(promedio.replace(',', '.'));
  const honorEnVivo = esGraduadoDeHonor(promedioNumero, distincion);

  // Primero lo que ya cargó el estudiante al radicar, después lo que falta
  // completar (documentos de la facultad) — así el Jefe de Programa ve de
  // entrada lo que ya tiene resuelto y, debajo, lo pendiente por su parte.
  const documentos = [...documentosAplicables({
    nivel: solicitud.nivel,
    opcionGrado: solicitud.opcionGrado,
    distincion: solicitud.distincion,
  })].sort((a, b) => {
    if (a.etapa !== b.etapa) return a.etapa === 'estudiante' ? -1 : 1;
    return a.orden - b.orden;
  });

  const facultad = facultadDesdePrograma(solicitud.programa);
  const listo = expedienteListoParaCerrar({
    ...solicitud,
    codigoEk,
  });

  async function refrescar(siguiente: Solicitud) {
    onActualizado(siguiente);
  }

  const guardarCampos = async () => {
    setGuardando(true);
    setMensaje(null);
    try {
      let actual = solicitud;
      actual = await editarDatosPersonales(solicitud.id, datos, correo);
      actual = await completarCamposDeLaFacultad(
        solicitud.id,
        { promedioPonderado: promedioNumero, codigoEk, distincion, nombreTrabajoGrado: nombreTrabajo },
        correo,
      );
      await refrescar(actual);
      setMensaje('Expediente guardado.');
    } finally {
      setGuardando(false);
    }
  };

  const subirDocumento = async (documentoId: Parameters<typeof cargarDocumento>[1], archivo: File) => {
    const siguiente = await cargarDocumento(solicitud.id, documentoId, archivo, correo);
    await refrescar(siguiente);
  };

  const cambiarAval = async (documentoId: Parameters<typeof alternarAval>[1], avalado: boolean) => {
    const siguiente = await alternarAval(solicitud.id, documentoId, avalado, correo);
    await refrescar(siguiente);
  };

  const cerrar = async () => {
    setGuardando(true);
    setMensaje(null);
    try {
      // Se guardan primero los campos en edición para no cerrar con datos desactualizados.
      let actual = await editarDatosPersonales(solicitud.id, datos, correo);
      actual = await completarCamposDeLaFacultad(
        solicitud.id,
        { promedioPonderado: promedioNumero, codigoEk, distincion, nombreTrabajoGrado: nombreTrabajo },
        correo,
      );
      const resultado = await cerrarExpediente(solicitud.id, correo);
      if (!resultado.ok) {
        setMensaje(resultado.mensaje);
        await refrescar(actual);
        return;
      }
      await refrescar(resultado.solicitud);
      if (resultado.omitidos.length) {
        // Algo no entró al PDF final: se queda aquí para que el Jefe de
        // Programa lo vea, en vez de volver sola al listado.
        setMensaje(`Expediente cerrado. Se omitieron algunos archivos del PDF final: ${resultado.omitidos.join('; ')}`);
        return;
      }
      // Cerrado sin novedades: vuelve sola al listado — ahí queda con el
      // chulo verde de "Completada" (E.2), sin un paso extra para el Jefe de
      // Programa.
      onVolver();
    } finally {
      setGuardando(false);
    }
  };

  const anular = async () => {
    setGuardando(true);
    try {
      const siguiente = await anularSolicitud(solicitud.id, motivoAnular || undefined, correo);
      await refrescar(siguiente);
      onVolver();
    } finally {
      setGuardando(false);
    }
  };

  const esCompleta = solicitud.estado === 'completa';

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <button type="button" className="btn-ghost !px-2 !py-1.5 text-sm" onClick={onVolver}>
          <ArrowLeft size={15} /> Volver al listado
        </button>
        <span
          className={
            esCompleta
              ? 'chip gap-1 border border-emerald-200 bg-emerald-100 text-emerald-800'
              : 'chip bg-slate-100 text-slate-700'
          }
        >
          {esCompleta && <CheckCircle2 size={13} />}
          {textoEstadoParaRol(solicitud.estado, solicitud.facultadReferencial, rol)}
        </span>
      </div>

      <header className="card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-navy-900">{solicitud.apellidos} {solicitud.nombres}</h2>
            <p className="font-mono text-xs text-slate-500">Cédula {formatearMilesDocumento(solicitud.identificacion)}</p>
            <p className="text-sm text-slate-600">{solicitud.programa} · {solicitud.nivel} · Facultad de {facultad ?? '—'}</p>
            <p className="text-sm text-slate-600">Título académico: <strong className="text-navy-900">{tituloDesdePrograma(solicitud.programa)}</strong></p>
          </div>
          {honorEnVivo && (
            <span className="flex items-center gap-1.5 rounded-full border border-gold-400 bg-gold-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gold-700">
              <Star size={14} className="fill-gold-500 text-gold-500" /> Graduado de Honor
            </span>
          )}
        </div>
      </header>

      <section className="card space-y-3 p-5">
        <h3 className="text-sm font-semibold text-navy-900">Datos personales</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Nombres</label>
            <input className="field" disabled={soloLectura} value={datos.nombres} onChange={(e) => setDatos({ ...datos, nombres: e.target.value })} />
          </div>
          <div>
            <label className="label">Apellidos</label>
            <input className="field" disabled={soloLectura} value={datos.apellidos} onChange={(e) => setDatos({ ...datos, apellidos: e.target.value })} />
          </div>
          <div>
            <label className="label">Tipo de documento</label>
            <select className="field" disabled={soloLectura} value={datos.tipoDocumento} onChange={(e) => setDatos({ ...datos, tipoDocumento: e.target.value as typeof datos.tipoDocumento })}>
              {TIPOS_DOCUMENTO_IDENTIDAD.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Identificación</label>
            <input className="field font-mono" disabled={soloLectura} value={datos.identificacion} onChange={(e) => setDatos({ ...datos, identificacion: e.target.value.replace(/\D/g, '') })} />
          </div>
          <div>
            <label className="label">Correo</label>
            <input className="field" disabled={soloLectura} value={datos.correo} onChange={(e) => setDatos({ ...datos, correo: e.target.value })} />
          </div>
          <div>
            <label className="label">Teléfono</label>
            <input className="field" disabled={soloLectura} value={datos.telefono} onChange={(e) => setDatos({ ...datos, telefono: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Lugar de expedición</label>
            <input className="field" disabled={soloLectura} value={datos.lugarExpedicion} onChange={(e) => setDatos({ ...datos, lugarExpedicion: e.target.value })} />
          </div>
        </div>
        <p className="text-xs text-slate-400">El programa no se puede cambiar desde aquí: perdería el acceso a esta solicitud.</p>
      </section>

      <section className="card space-y-3 p-5">
        <h3 className="text-sm font-semibold text-navy-900">Campos que completa la facultad</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Promedio ponderado</label>
            <input className="field" disabled={soloLectura} inputMode="decimal" value={promedio} onChange={(e) => setPromedio(e.target.value)} placeholder="0.0 – 10.0" />
          </div>
          {solicitud.nivel === 'Pregrado' && (
            <div>
              <label className="label">Código EK</label>
              <input className="field font-mono uppercase" disabled={soloLectura} value={codigoEk} onChange={(e) => setCodigoEk(e.target.value)} />
            </div>
          )}
          <div>
            <label className="label">Distinción</label>
            <select className="field" disabled={soloLectura} value={distincion} onChange={(e) => setDistincion(e.target.value as typeof distincion)}>
              <option value="Ninguna">Ninguna</option>
              {DISTINCIONES_POR_NIVEL[solicitud.nivel].map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Nombre del trabajo / producto</label>
            <input className="field" disabled={soloLectura} value={nombreTrabajo} onChange={(e) => setNombreTrabajo(e.target.value)} />
          </div>
        </div>
      </section>

      <section className="card space-y-2.5 p-5">
        <h3 className="text-sm font-semibold text-navy-900">Documentos ({documentos.length})</h3>
        {documentos.map((def) => (
          <DocumentoAdminFila
            key={def.id}
            def={def}
            cargado={solicitud.documentos.find((d) => d.id === def.id)}
            onCargar={(archivo) => void subirDocumento(def.id, archivo)}
            onAlternarAval={(avalado) => void cambiarAval(def.id, avalado)}
          />
        ))}
      </section>

      {mensaje && (
        <div className="flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <AlertCircle size={17} className="mt-0.5 shrink-0" />
          <p>{mensaje}</p>
        </div>
      )}

      {!soloLectura && solicitud.estado !== 'completa' && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            {!confirmandoAnular ? (
              <button type="button" className="btn-ghost !px-3 !py-2 text-xs text-rose-600 hover:bg-rose-50" onClick={() => setConfirmandoAnular(true)}>
                Anular solicitud
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <input className="field w-56 text-xs" placeholder="Motivo (opcional)" value={motivoAnular} onChange={(e) => setMotivoAnular(e.target.value)} />
                <button type="button" className="btn-secondary !px-3 !py-1.5 text-xs text-rose-700" onClick={anular} disabled={guardando}>
                  Confirmar anulación
                </button>
                <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setConfirmandoAnular(false)}>Cancelar</button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button type="button" className="btn-secondary px-5" onClick={guardarCampos} disabled={guardando}>
              {guardando ? <Loader2 size={15} className="animate-spin" /> : null} Guardar expediente
            </button>
            <button
              type="button"
              className="btn-success gap-2 rounded-full px-6 py-2.5 text-sm font-semibold shadow-lg"
              disabled={!listo || guardando}
              title={listo ? 'Genera el PDF final y envía a Secretaría' : 'Faltan documentos, avales o el código EK'}
              onClick={cerrar}
            >
              {guardando ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              Radicar Solicitud / cerrar expediente
            </button>
          </div>
        </div>
      )}

      {solicitud.estado === 'completa' && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <CheckCircle2 size={17} /> Expediente cerrado. Ya no se puede editar desde aquí.
        </div>
      )}
    </div>
  );
}
