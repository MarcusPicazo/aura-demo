import { Logo } from './Logo';

interface LoadingScreenProps {
  visible: boolean;
  logo: string;
  name: string;
  tagline: string;
  /** Avance real de la carga, de 0 a 1: el inventario, el código del edificio, la escena y la animación de entrada. */
  progress: number;
  /** Qué se está esperando ahora ("Cargando el inventario…"). */
  step: string;
}

/**
 * Pantalla de carga: se ve mientras la escena se prepara y la cámara hace su animación de entrada (SPEC §2, momento 1) y
 * se desvanece sola al terminar — `visible` es `!introDone` en quien la usa. Logo, nombre y frase del proyecto vienen
 * de la config, nunca fijos aquí. La barra es determinada: refleja lo que de verdad ya cargó (no un tiempo inventado) y dice
 * qué falta; continúa sin salto la pantalla de arranque que pinta el `index.html` antes de que baje el JavaScript.
 */
export function LoadingScreen({ visible, logo, name, tagline, progress, step }: LoadingScreenProps) {
  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <div
      className={`pointer-events-none fixed inset-0 z-[15] flex flex-col items-center justify-center gap-3 bg-[var(--brand-background)] transition-opacity duration-700 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <Logo src={logo} name={name} className="h-9 w-auto" />
      <p className="font-serif text-lg text-[var(--brand-primary)]">{name}</p>
      <p className="text-sm italic text-neutral-500">{tagline}</p>

      <div className="mt-2 w-44" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={step}>
        <div className="h-[3px] overflow-hidden rounded-full bg-[var(--brand-primary)]/15">
          <div className="h-full rounded-full bg-[var(--brand-accent)] transition-[width] duration-300 ease-out motion-reduce:transition-none" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-1.5 flex justify-between text-[11px] text-neutral-500">
          <span>{step}</span>
          <span className="tabular-nums">{percent}%</span>
        </p>
      </div>
    </div>
  );
}
