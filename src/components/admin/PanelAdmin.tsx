/**
 * PanelAdmin.tsx
 * Cascarón del panel administrativo tras iniciar sesión: listado (E.2) o
 * expediente abierto (E.3). El engranaje de permisos y "Cerrar sesión" viven
 * en la franja fija de arriba (junto a la casita, ver App.tsx) — aquí no se
 * repite ninguno de los dos.
 */

import { CalendarDays } from 'lucide-react';
import { useAdminPanel } from '../../hooks/useAdminPanel';
import { ListadoSolicitudes } from './ListadoSolicitudes';
import { ExpedienteDetalle } from './ExpedienteDetalle';
import { formatearFechaLarga } from '../publico/InicioScreen';
import type { AuthSession } from '../../services/authService';
import type { ConfiguracionTitulacion } from '../../types';

export function PanelAdmin({ session, config }: { session: AuthSession; config: ConfiguracionTitulacion }) {
  const panel = useAdminPanel(session);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      {panel.idAbierto && panel.expediente ? (
        <ExpedienteDetalle
          solicitud={panel.expediente}
          rol={session.rol}
          correo={session.correo}
          onVolver={panel.cerrar}
          onActualizado={panel.setExpediente}
        />
      ) : (
        <>
          <div>
            <h2 className="text-lg font-semibold text-navy-900">Solicitudes de titulación</h2>
            {session.rol === 'jefe_programa' && (
              <p className="text-xs text-slate-500">
                {session.facultades.map((f) => `Facultad de ${f}`).join(', ')}
              </p>
            )}
            {session.rol === 'jefe_programa' && config.fechaTentativaGrado && (
              <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-gold-700">
                <CalendarDays size={13} />
                Fecha tentativa de grado: {formatearFechaLarga(config.fechaTentativaGrado)}
              </p>
            )}
          </div>
          {panel.cargando ? (
            <p className="text-sm text-slate-500">Cargando…</p>
          ) : (
            <ListadoSolicitudes
              solicitudes={panel.solicitudes}
              rol={session.rol}
              correo={session.correo}
              onAbrir={panel.abrir}
              onCambiado={panel.recargarListado}
            />
          )}
        </>
      )}
    </div>
  );
}
