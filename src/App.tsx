/**
 * App.tsx
 * Dos formas de abrir esta misma aplicación:
 *
 *  - Parte 1 (público): enlace propio, fuera del Portal, con su propio
 *    membrete — es de cara al estudiante, sin necesidad de cuenta. Aquí NO
 *    existe la opción de «Ingreso administrativo»: esa vista es solo para el
 *    panel incrustado en el Portal (ver más abajo).
 *  - Parte 2 (panel administrativo): incrustada DENTRO del Portal de
 *    Transformación Digital, exactamente con el mismo contrato que el
 *    Registro de Cursos de Extensión (`?embedded=1`). Incrustada, esta app
 *    NO pinta su propio membrete ni pie — el Portal ya pone la franja navy
 *    arriba y abajo; aquí solo va el contenido de adentro. Por eso, en modo
 *    incrustado se entra directo al panel (inicio/formulario/consultar son
 *    pantallas del enlace público, no del panel interno).
 */

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Home, LogOut, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import { LoginScreenAdmin } from './components/admin/LoginScreenAdmin';
import { PanelAdmin } from './components/admin/PanelAdmin';
import { PanelPermisos } from './components/admin/PanelPermisos';
import { cargarConfig } from './services/configService';
import { solicitudesAbiertas, vigenciaCeremonia } from './services/reglasNegocio';
import type { ConfiguracionTitulacion } from './types';
import { useAuthAdmin } from './hooks/useAuthAdmin';
import { Confirmacion } from './components/publico/Confirmacion';
import { ConsultarSolicitud } from './components/publico/ConsultarSolicitud';
import { InicioScreen, formatearFechaLarga } from './components/publico/InicioScreen';
import { PasoDatos } from './components/publico/PasoDatos';
import { PasoDocumentos } from './components/publico/PasoDocumentos';
import { PasoPrograma } from './components/publico/PasoPrograma';
import { PasoResumen } from './components/publico/PasoResumen';
import { PasoStepper } from './components/publico/PasoStepper';
import { MarcaDeAgua } from './components/Escudo';
import { usePublicSolicitud } from './hooks/usePublicSolicitud';

type Vista = 'inicio' | 'formulario' | 'consultar';

/**
 * Panel administrativo incrustado en el Portal. La franja fija de arriba
 * lleva, de izquierda a derecha: la casita (vuelve al Portal — siempre
 * visible), el engranaje de permisos (solo acceso total, con sesión
 * iniciada) y «Cerrar sesión» (solo con sesión iniciada). Nunca una fila
 * aparte debajo: los tres viven juntos, a la derecha del todo.
 */
function EmbeddedAdmin({
  auth,
  volverAlPortal,
}: {
  auth: ReturnType<typeof useAuthAdmin>;
  volverAlPortal: () => void;
}) {
  const [verPermisos, setVerPermisos] = useState(false);
  const [config, setConfig] = useState<ConfiguracionTitulacion>(() => cargarConfig());

  // El engranaje del Portal siempre debe llevar al ingreso administrativo de
  // este módulo — mismo contrato en todos los módulos incrustados. Aquí, si
  // ya se estaba en el panel de permisos, simplemente se vuelve al panel.
  useEffect(() => {
    const w = window as unknown as { irAIngresoAdmin?: () => void };
    w.irAIngresoAdmin = () => setVerPermisos(false);
    const onMessage = (event: MessageEvent) => {
      if (event.data === 'irAIngresoAdmin') setVerPermisos(false);
    };
    window.addEventListener('message', onMessage);
    return () => {
      delete w.irAIngresoAdmin;
      window.removeEventListener('message', onMessage);
    };
  }, []);

  // Secretaría Académica también entra aquí — es quien define la ventana de
  // radicación (abre/cierra) — pero ve solo esa sección; el resto (correos
  // autorizados por facultad, acceso total, modo pruebas) sigue siendo solo
  // de la Jefe de Estadística (acceso total).
  const puedeVerPermisos =
    auth.isAuthenticated && (auth.session?.rol === 'acceso_total' || auth.session?.rol === 'secretaria');

  return (
    <div className="w-full">
      {/* Fija arriba a la derecha — igual que Registro de Cursos de
          Extensión: debe permanecer visible aunque el listado o el
          expediente tengan scroll debajo. El espaciador de abajo reserva su
          alto para que el contenido no empiece tapado por esta franja. */}
      <div className="fixed right-3 top-3 z-40 flex items-center gap-2">
        {/* El engranaje ya se ve aquí incluso antes de iniciar sesión (junto
            a la casita) — solo abre el panel de permisos cuando quien entró
            es de acceso total; si no, no hace nada (la pantalla de ingreso
            ya está a la vista). */}
        {!verPermisos && (
          <button
            type="button"
            onClick={() => {
              if (puedeVerPermisos) setVerPermisos(true);
            }}
            className="icon-btn-embed"
            title={puedeVerPermisos ? 'Permisos' : 'Permisos (inicie sesión como Secretaría Académica o acceso total)'}
          >
            <Settings size={17} />
          </button>
        )}
        {auth.isAuthenticated && (
          <button
            type="button"
            onClick={() => {
              setVerPermisos(false);
              auth.cerrarSesion();
            }}
            className="icon-btn-embed"
            title="Cerrar sesión"
          >
            <LogOut size={17} />
          </button>
        )}
        <button type="button" onClick={volverAlPortal} className="icon-btn-embed" title="Volver al Portal">
          <Home size={17} />
        </button>
      </div>
      <div className="h-9" aria-hidden />

      {!auth.isAuthenticated && (
        <LoginScreenAdmin
          etapa={auth.etapa}
          correoPendiente={auth.correoPendiente}
          codigoRespaldo={auth.codigoRespaldo}
          enviandoCodigo={auth.enviandoCodigo}
          error={auth.error}
          onSolicitarCodigo={auth.solicitarCodigo}
          onVerificarCodigo={auth.verificarCodigo}
          onReenviarCodigo={auth.reenviarCodigo}
          onCambiarCorreo={auth.cambiarCorreo}
        />
      )}

      {auth.isAuthenticated && auth.session && verPermisos && (
        <PanelPermisos
          config={config}
          onConfig={setConfig}
          onVolver={() => setVerPermisos(false)}
          rol={auth.session.rol}
        />
      )}

      {auth.isAuthenticated && auth.session && !verPermisos && (
        <PanelAdmin session={auth.session} config={config} />
      )}
    </div>
  );
}

export default function App() {
  const embedded = new URLSearchParams(window.location.search).get('embedded') === '1';
  const [vista, setVista] = useState<Vista>('inicio');
  const wizard = usePublicSolicitud();
  const auth = useAuthAdmin();

  // Ventana de radicación que define Secretaría Académica (config service):
  // se calcula una sola vez al abrir la página pública — si Secretaría la
  // cambia mientras un estudiante ya tiene la página abierta, se aplica en
  // la próxima carga, no a media sesión.
  const [avisoCierre] = useState<string | null>(() => {
    if (embedded) return null;
    const config = cargarConfig();
    const { abiertas, motivo } = solicitudesAbiertas(config.fechaAperturaSolicitudes, config.fechaCierreSolicitudes);
    if (abiertas) return null;
    if (motivo === 'antes-de-apertura') {
      return `Las solicitudes de titulación abren el ${formatearFechaLarga(config.fechaAperturaSolicitudes!)}.`;
    }
    return `El plazo para radicar solicitudes de titulación cerró el ${formatearFechaLarga(config.fechaCierreSolicitudes!)}.`;
  });

  // Vigencia de la vía "Ceremonia" (requerimiento 3.1 del Portal): solo
  // habilitada cuando Secretaría Académica definió una fecha tentativa de
  // ceremonia Y la ventana general de radicación sigue abierta — ver
  // vigenciaCeremonia() en reglasNegocio.ts.
  const [ceremonia] = useState<ReturnType<typeof vigenciaCeremonia>>(() => {
    if (embedded) return { vigente: false, motivo: 'sin-fecha-tentativa' };
    return vigenciaCeremonia(cargarConfig());
  });

  // Incrustada, esta app no pinta su propio fondo: el Portal ya pone su
  // marca de agua detrás — el mismo patrón que usa Registro.
  useEffect(() => {
    if (!embedded) return;
    const html = document.documentElement;
    const { body } = document;
    const prevHtml = html.style.background;
    const prevBody = body.style.background;
    html.style.background = 'transparent';
    body.style.background = 'transparent';
    return () => {
      html.style.background = prevHtml;
      body.style.background = prevBody;
    };
  }, [embedded]);

  const volverAlInicio = () => {
    wizard.reiniciar();
    setVista('inicio');
  };

  // Volver al Inicio DEL PORTAL (no de esta app) cuando está incrustada —
  // mismo contrato que Registro: llamada directa si es mismo origen,
  // postMessage como respaldo.
  const volverAlPortal = () => {
    try {
      const portal = window.parent as unknown as { volverAlPortal?: () => void };
      if (window.parent !== window && typeof portal.volverAlPortal === 'function') {
        portal.volverAlPortal();
        return;
      }
      window.parent.postMessage('volverAlInicio', '*');
    } catch {
      // Corriendo fuera del Portal: no hay a dónde volver.
    }
  };

  if (embedded) {
    // Este módulo, a diferencia de los demás (Registro), no lleva un botón
    // de «Reiniciar» propio: la casita de aquí ya vuelve al Portal, y dentro
    // del panel administrativo «Cerrar sesión» cumple ese papel.
    return <EmbeddedAdmin auth={auth} volverAlPortal={volverAlPortal} />;
  }

  return (
    // Sin membrete ni pie: esta pantalla va suelta dentro de un iframe en
    // otro sitio, que ya trae su propia cabecera institucional — pintar otra
    // aquí duplicaría la identidad visual. Solo queda, bien discreto arriba
    // a la derecha, el crédito de autoría, y —si hace falta volver al
    // inicio del asistente— una flecha suelta arriba a la izquierda.
    <div className="isolate flex min-h-[100dvh] flex-col">
      <MarcaDeAgua />

      <div className="flex shrink-0 items-center justify-between px-4 pt-3">
        {vista !== 'inicio' ? (
          <button
            type="button"
            onClick={volverAlInicio}
            className="inline-flex items-center gap-1.5 rounded-full border border-navy-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-navy-700 shadow-sm backdrop-blur transition hover:bg-white"
          >
            <ArrowLeft size={13} /> Inicio
          </button>
        ) : (
          <span />
        )}
        <p className="text-[10px] font-medium text-slate-400">Desarrollado por PD Beyty P. Camargo M.</p>
      </div>

      {/* Alineado arriba (items-start), NO centrado verticalmente: con un
          formulario de varios pasos, centrar verticalmente hace que el
          contenido "salte" de posición entre pasos cortos y largos, y en
          pantallas chicas corta el encabezado del paso contra el borde
          superior. Con margen superior fijo (pt-8) y flujo natural, el
          contenido siempre arranca en el mismo lugar y la página scrollea
          normal cuando el paso es más largo que la ventana. */}
      <main className="flex flex-1 items-start justify-center px-4 pb-10 pt-8 sm:pt-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={vista === 'formulario' ? `formulario-${wizard.paso}-${Boolean(wizard.solicitudRadicada)}` : vista}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="w-full"
          >
            {vista === 'inicio' && (
              <InicioScreen
                onIniciar={(via) => { wizard.reiniciar(via); setVista('formulario'); }}
                onConsultar={() => setVista('consultar')}
                avisoCierre={avisoCierre}
                ceremonia={ceremonia}
              />
            )}

            {vista === 'consultar' && <ConsultarSolicitud onVolver={volverAlInicio} />}

            {vista === 'formulario' && wizard.solicitudRadicada && (
              <Confirmacion solicitud={wizard.solicitudRadicada} onNuevaSolicitud={volverAlInicio} />
            )}

            {vista === 'formulario' && !wizard.solicitudRadicada && (
              <div className="space-y-8">
                <PasoStepper paso={wizard.paso} />

                {wizard.paso === 1 && (
                  <PasoDatos
                    valor={wizard.datosPersonales}
                    onChange={wizard.setDatosPersonales}
                    onContinuar={() => wizard.setPaso(2)}
                  />
                )}

                {wizard.paso === 2 && (
                  <PasoPrograma
                    programa={wizard.programa}
                    opcionGrado={wizard.opcionGrado}
                    nivel={wizard.nivel}
                    nombreDiplomado={wizard.nombreDiplomado}
                    onProgramaChange={wizard.seleccionarPrograma}
                    onOpcionGradoChange={wizard.setOpcionGrado}
                    onNombreDiplomadoChange={wizard.setNombreDiplomado}
                    onContinuar={() => wizard.setPaso(3)}
                    onVolver={() => wizard.setPaso(1)}
                  />
                )}

                {wizard.paso === 3 && (
                  <PasoDocumentos
                    requeridos={wizard.documentosRequeridos}
                    documentos={wizard.documentos}
                    onArchivo={wizard.actualizarArchivo}
                    onContinuar={() => wizard.setPaso(4)}
                    onVolver={() => wizard.setPaso(2)}
                    onReiniciar={volverAlInicio}
                  />
                )}

                {wizard.paso === 4 && (
                  <PasoResumen
                    datosPersonales={wizard.datosPersonales}
                    programa={wizard.programa}
                    opcionGrado={wizard.opcionGrado}
                    nombreDiplomado={wizard.nombreDiplomado}
                    documentosRequeridos={wizard.documentosRequeridos}
                    documentos={wizard.documentos}
                    autorizacion={wizard.autorizacion}
                    onAutorizacionChange={wizard.setAutorizacion}
                    radicando={wizard.radicando}
                    error={wizard.errorRadicacion}
                    onRadicar={wizard.radicar}
                    onVolver={() => wizard.setPaso(3)}
                  />
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
