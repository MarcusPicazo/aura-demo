import { useRef, useState } from 'react';

interface InteriorGalleryProps {
  images: string[];
}

/**
 * Galería de renders interiores con swipe nativo (scroll-snap, sin librería nueva —
 * funciona con touch en iOS/Android sin JS extra). Si una imagen no existe todavía
 * (`onError`), se oculta sola en vez de dejar un hueco roto.
 */
export function InteriorGallery({ images }: InteriorGalleryProps) {
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
        <p className="text-sm font-medium text-neutral-700">Renders interiores</p>
        <p className="text-xs text-neutral-400">Imágenes conceptuales ilustrativas</p>
      </div>
      <div ref={scrollRef} onScroll={handleScroll} className="flex snap-x snap-mandatory gap-2 overflow-x-auto rounded-lg">
        {images.map((src, index) =>
          failedIndexes.has(index) ? null : (
            <img
              key={src}
              src={src}
              alt={`Render interior ${index + 1}`}
              onError={() => markFailed(index)}
              className="h-48 w-full shrink-0 snap-center rounded-lg object-cover"
            />
          ),
        )}
      </div>

      {visibleCount > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {Array.from({ length: visibleCount }, (_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Ver imagen ${index + 1}`}
              onClick={() => scrollToVisibleIndex(index)}
              className={`h-1.5 w-1.5 rounded-full transition-colors duration-200 motion-reduce:transition-none ${
                index === activeIndex ? 'bg-neutral-900' : 'bg-neutral-300'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
