/**
 * PasoStepper.tsx
 * Indicador de los 4 pasos del formulario público (D.2).
 */

const NOMBRES_PASO = ['Tus datos', 'Tu programa', 'Tus documentos', 'Resumen y autorización'];

export function PasoStepper({ paso }: { paso: 1 | 2 | 3 | 4 }) {
  return (
    <ol className="mx-auto flex w-full max-w-2xl items-center justify-between gap-2">
      {NOMBRES_PASO.map((nombre, index) => {
        const numero = index + 1;
        const activo = numero === paso;
        const completado = numero < paso;
        return (
          <li key={nombre} className="flex flex-1 flex-col items-center gap-1.5 text-center">
            <span
              className={[
                'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition',
                completado
                  ? 'bg-navy-800 text-white'
                  : activo
                    ? 'bg-gold-400 text-navy-950 ring-4 ring-gold-200'
                    : 'bg-slate-200 text-slate-500',
              ].join(' ')}
            >
              {numero}
            </span>
            <span className={['text-[11px] font-medium', activo ? 'text-navy-900' : 'text-slate-500'].join(' ')}>
              {nombre}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
