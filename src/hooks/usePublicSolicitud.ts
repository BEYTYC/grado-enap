/**
 * usePublicSolicitud.ts
 * Estado del formulario público de 4 pasos (D.2). Vive fuera de las
 * pantallas para que "Reiniciar solicitud" (D.2 paso 3) sea una sola
 * función y no una lista de setState dispersos.
 */

import { useCallback, useMemo, useState } from 'react';
import { enviarConfirmacionRadicacion } from '../services/correoService';
import { documentosDelEstudiante } from '../services/reglasNegocio';
import { bytesABase64 } from '../services/autorizacionDatosService';
import { radicarSolicitud, type DatosPersonalesFormulario } from '../services/solicitudService';
import { buscarPrograma } from '../data/programas';
import type { DocumentoId, OpcionGrado, Solicitud, TipoDocumentoIdentidad, ViaRadicacion } from '../types';

export type PasoFormulario = 1 | 2 | 3 | 4;

export interface EstadoDocumento {
  id: DocumentoId;
  archivo: File | null;
  estado: 'pendiente' | 'subiendo' | 'cargado' | 'error';
  error?: string;
}

function datosPersonalesVacios(): DatosPersonalesFormulario {
  return {
    nombres: '',
    apellidos: '',
    tipoDocumento: 'Cédula de Ciudadanía',
    identificacion: '',
    lugarExpedicion: '',
    correo: '',
    telefono: '',
  };
}

export function usePublicSolicitud() {
  const [paso, setPaso] = useState<PasoFormulario>(1);
  const [datosPersonales, setDatosPersonales] = useState<DatosPersonalesFormulario>(datosPersonalesVacios);
  const [programa, setPrograma] = useState('');
  const [opcionGrado, setOpcionGrado] = useState<OpcionGrado | ''>('');
  const [nombreDiplomado, setNombreDiplomado] = useState('');
  const [documentos, setDocumentos] = useState<EstadoDocumento[]>([]);
  const [autorizacion, setAutorizacion] = useState(false);
  const [radicando, setRadicando] = useState(false);
  const [errorRadicacion, setErrorRadicacion] = useState<string | null>(null);
  const [solicitudRadicada, setSolicitudRadicada] = useState<Solicitud | null>(null);
  const [viaRadicacion, setViaRadicacion] = useState<ViaRadicacion>('Ventanilla');

  const nivel = useMemo(() => buscarPrograma(programa)?.nivel ?? null, [programa]);

  const documentosRequeridos = useMemo(() => {
    if (!nivel || !opcionGrado) return [];
    return documentosDelEstudiante({ nivel, opcionGrado, distincion: '' });
  }, [nivel, opcionGrado]);

  const seleccionarPrograma = useCallback((siguientePrograma: string) => {
    setPrograma(siguientePrograma);
    setOpcionGrado('');
    setNombreDiplomado('');
  }, []);

  const actualizarArchivo = useCallback((id: DocumentoId, archivo: File | null, error?: string) => {
    setDocumentos((actual) => {
      const sinEste = actual.filter((d) => d.id !== id);
      if (!archivo && !error) return sinEste;
      return [
        ...sinEste,
        { id, archivo, estado: error ? 'error' : archivo ? 'cargado' : 'pendiente', error },
      ];
    });
  }, []);

  const todosCargados = useMemo(() => {
    if (!documentosRequeridos.length) return false;
    return documentosRequeridos.every((doc) =>
      documentos.some((d) => d.id === doc.id && d.estado === 'cargado'),
    );
  }, [documentosRequeridos, documentos]);

  const reiniciar = useCallback((via: ViaRadicacion = 'Ventanilla') => {
    setPaso(1);
    setDatosPersonales(datosPersonalesVacios());
    setPrograma('');
    setOpcionGrado('');
    setNombreDiplomado('');
    setDocumentos([]);
    setAutorizacion(false);
    setErrorRadicacion(null);
    setSolicitudRadicada(null);
    setViaRadicacion(via);
  }, []);

  const radicar = useCallback(async () => {
    if (!nivel || !opcionGrado) return;
    setRadicando(true);
    setErrorRadicacion(null);
    try {
      const archivos = documentos
        .filter((d): d is EstadoDocumento & { archivo: File } => d.estado === 'cargado' && Boolean(d.archivo))
        .map((d) => ({ id: d.id, archivo: d.archivo }));
      const { solicitud, autorizacionPdfBytes } = await radicarSolicitud({
        datosPersonales,
        datosPrograma: {
          programa,
          opcionGrado,
          nombreDiplomado: opcionGrado === 'Diplomado' ? nombreDiplomado.trim() : '',
        },
        documentos: archivos,
        viaRadicacion,
      });
      setSolicitudRadicada(solicitud);
      setPaso(4);
      // No bloquea ni se le avisa al estudiante si falla: la radicación ya
      // quedó hecha (con su radicado, visible en pantalla) sea cual sea el
      // resultado del correo — ver correoService.ts. El PDF de Autorización
      // de Datos ya generado en radicarSolicitud se manda de una vez como
      // adjunto, en base64 (requerimiento 4 del Portal).
      void enviarConfirmacionRadicacion(solicitud, bytesABase64(autorizacionPdfBytes));
    } catch (caught) {
      setErrorRadicacion(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setRadicando(false);
    }
  }, [nivel, opcionGrado, documentos, datosPersonales, programa, nombreDiplomado, viaRadicacion]);

  return {
    paso,
    setPaso,
    datosPersonales,
    setDatosPersonales,
    programa,
    opcionGrado,
    nivel,
    seleccionarPrograma,
    setOpcionGrado,
    nombreDiplomado,
    setNombreDiplomado,
    documentos,
    documentosRequeridos,
    actualizarArchivo,
    todosCargados,
    autorizacion,
    setAutorizacion,
    radicando,
    errorRadicacion,
    solicitudRadicada,
    radicar,
    reiniciar,
  };
}

export type TipoDocIdentidadOption = TipoDocumentoIdentidad;
