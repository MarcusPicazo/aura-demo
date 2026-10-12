import { usePresence } from '../lib/usePresence';
import type { TourCaptionId } from '../lib/tour';
import { useI18n } from '../i18n/useI18n';
import { useTourStore } from '../store/tourStore';

export interface TourCaptionText {
  title: string;
  subtitle?: string;
}

interface TourOverlayProps {
  texts: Record<TourCaptionId, TourCaptionText>;
}

/**
 * Lo que se ve durante la presentación: el rótulo del momento (aparece y desaparece con un fundido), una barra fina de
 * avance y la pista de que tocar la pantalla detiene el recorrido. No captura toques: cualquier toque llega a la ventana,
 * que es lo que detiene el recorrido.
 */
export function TourOverlay({ texts }: TourOverlayProps) {
  const { t } = useI18n();
  const caption = useTourStore((state) => state.caption);
  const progress = useTourStore((state) => state.progress);
  // `usePresence` retiene el último rótulo mientras se desvanece.
  const { rendered, visible } = usePresence(caption, 700);
  const text = rendered ? texts[rendered] : null;

  return (
    <div className="pointer-events-none fixed inset-0 z-30" aria-live="polite">
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/55 to-transparent" aria-hidden="true" />

      <div className="absolute inset-x-0 bottom-14 flex justify-center px-6 sm:bottom-20">
        {text && (
          <div className={`max-w-3xl text-center text-white transition-[opacity,transform] duration-700 ease-elegant motion-reduce:transition-none ${visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'}`}>
            <p className="font-serif text-3xl leading-tight drop-shadow-lg sm:text-5xl">{text.title}</p>
            {text.subtitle && <p className="mt-2 text-base text-white/90 drop-shadow sm:text-xl">{text.subtitle}</p>}
          </div>
        )}
      </div>

      <p className="absolute right-4 top-4 rounded-full bg-black/45 px-3 py-1.5 text-xs text-white/90 backdrop-blur sm:text-sm">{t('tour.stopHint')}</p>

      <div className="absolute inset-x-0 bottom-0 h-1 bg-white/15" aria-hidden="true">
        <div className="h-full bg-[var(--brand-accent)]" style={{ width: `${Math.round(progress * 1000) / 10}%` }} />
      </div>
    </div>
  );
}
