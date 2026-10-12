import { useRef, useState } from 'react';
import { useI18n } from '../i18n/useI18n';

interface InteriorGalleryProps {
  images: string[];
}

/**
 * Galería de renders interiores con swipe nativo (scroll-snap, sin librería nueva —
 * funciona con touch en iOS/Android sin JS extra). Si una imagen no existe todavía
 * (`onError`), se oculta sola en vez de dejar un hueco roto.
 */
export function InteriorGallery({ images }: InteriorGalleryProps) {
  const { t } = useI18n();
  const [failedIndexes, setFailedIndexes] = useState<Set<number>>(new Set());
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const visibleCount = images.length - failedIndexes.size;
  if (visibleCount === 0) return null;

  function markFailed(index: number) {
    setFailedIndexes((current) => new Set(current).add(index));
  }

  function scrollToVisibleIndex(visibleIndex: number) {
    const slide = scrollRef.current?.children[visibleIndex] as HTMLElement | undefined;
    slide?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  function handleScroll() {
    const container = scrollRef.current;
    if (!container || container.clientWidth === 0) return;
    setActiveIndex(Math.round(container.scrollLeft / container.clientWidth));
  }

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-neutral-700">{t('interiors.title')}</p>
        <p className="text-xs text-neutral-500">{t('common.illustrativeImages')}</p>
      </div>
      <div ref={scrollRef} onScroll={handleScroll} className="flex snap-x snap-mandatory gap-2 overflow-x-auto rounded-lg">
        {images.map((src, index) =>
          failedIndexes.has(index) ? null : (
            <img
              key={src}
              src={src}
              alt={t('interiors.alt', { n: index + 1 })}
              onError={() => markFailed(index)}
              className="h-48 w-full shrink-0 snap-center rounded-lg object-cover"
            />
          ),
        )}
      </div>

      {visibleCount > 1 && (
        <div className="mt-1 flex justify-center">
          {Array.from({ length: visibleCount }, (_, index) => (
            <button
              key={index}
              type="button"
              aria-label={t('interiors.view', { n: index + 1 })}
              aria-current={index === activeIndex ? 'true' : undefined}
              onClick={() => scrollToVisibleIndex(index)}
              className="flex h-6 w-6 items-center justify-center"
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full transition-colors duration-200 motion-reduce:transition-none ${
                  index === activeIndex ? 'bg-neutral-900' : 'bg-neutral-300'
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
