import { Logo } from './Logo';

interface LoadingScreenProps {
  visible: boolean;
  logo: string;
  name: string;
  tagline: string;
}

/**
 * Pantalla de carga: se ve mientras la cámara hace su animación de entrada (SPEC §2,
 * momento 1) y se desvanece sola al terminar — `visible` es `!introDone` en quien la usa.
 * Logo, nombre y frase del proyecto vienen de la config, nunca fijos aquí.
 */
export function LoadingScreen({ visible, logo, name, tagline }: LoadingScreenProps) {
  return (
    <div
      className={`pointer-events-none fixed inset-0 z-[15] flex flex-col items-center justify-center gap-3 bg-[var(--brand-background)] transition-opacity duration-700 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <Logo src={logo} name={name} className="h-9 w-auto" />
      <p className="font-serif text-lg text-[var(--brand-primary)]">{name}</p>
      <p className="text-sm italic text-neutral-500">{tagline}</p>

      {/* Indicador de carga: no medimos progreso real (la pantalla dura lo que tarda la
          animación de entrada de cámara, un tiempo fijo), así que es indeterminado —
          delgado y en el acento de marca, para que se sienta parte del sitio y no un
          spinner genérico de navegador. */}
      <div className="mt-2 h-[3px] w-40 overflow-hidden rounded-full bg-[var(--brand-primary)]/15">
        <div className="animate-loading-bar h-full w-1/3 rounded-full bg-[var(--brand-accent)]" />
      </div>
    </div>
  );
}
