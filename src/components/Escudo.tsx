/**
 * Escudo.tsx
 * Escudo institucional — misma pieza visual que el resto de módulos.
 */

import escudoBlanco from '../assets/escudo-blanco.png';
import escudoMarcaDeAgua from '../assets/escudo-marca-agua.png';
import escudoWmPortal from '../assets/escudo-wm-portal.png';
import escudoOscuro from '../assets/escudo-sobre-oscuro.png';
import escudoColor from '../assets/escudo.png';
import { INSTITUCION } from '../data/brand';

type Variante = 'color' | 'blanco' | 'sobre-oscuro';

const FUENTES: Record<Variante, string> = {
  color: escudoColor,
  blanco: escudoBlanco,
  'sobre-oscuro': escudoOscuro,
};

const HALO =
  'drop-shadow(0 0 1.5px rgba(255,255,255,.95))' +
  ' drop-shadow(0 0 4px rgba(255,255,255,.7))' +
  ' drop-shadow(0 0 8px rgba(255,255,255,.35))';

interface EscudoProps {
  height?: number;
  variant?: Variante;
  className?: string;
}

export function Escudo({ height = 56, variant = 'color', className = '' }: EscudoProps) {
  return (
    <img
      src={FUENTES[variant]}
      alt={`Escudo de la ${INSTITUCION.nombre}`}
      className={`w-auto object-contain ${className}`}
      style={{ height, filter: variant === 'sobre-oscuro' ? HALO : undefined }}
    />
  );
}

export function MarcaDeAgua() {
  // Ojo: un z-index negativo en un elemento `fixed` pinta DETRÁS del propio
  // color de fondo del body/html (el "canvas" del navegador) si cuelga
  // directo de él, dejándolo invisible pase lo que pase con la opacidad. El
  // componente que la usa debe darle a su contenedor raíz la clase
  // `isolate` (nuevo contexto de apilamiento) para que este -z-10 quede por
  // detrás del contenido normal en vez de por detrás del canvas.
  //
  // Misma pieza e igual tratamiento que la pantalla de inicio del Proyecto
  // de Transformación Digital (`.watermark img` en portal_template.html):
  // el mismo archivo de fondo (`escudo-wm-portal.png`, no
  // `escudo-marca-agua.png` — esa versión tiene más contraste/tinta y se ve
  // más marcada aunque la opacidad sea la misma) con opacidad muy baja +
  // escala de grises + oscurecido.
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 flex items-center justify-center overflow-hidden"
    >
      <img
        src={escudoWmPortal}
        alt=""
        className="max-w-none"
        style={{ width: 'min(60vw, 660px)', height: 'auto', opacity: 0.045, filter: 'grayscale(1) brightness(.5)' }}
      />
    </div>
  );
}

export function SelloDeAgua({ opacity = 0.07, height = 320 }: { opacity?: number; height?: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <img src={escudoMarcaDeAgua} alt="" style={{ height, opacity }} className="max-w-none" />
    </div>
  );
}
