import { useCompareStore } from '../store/compareStore';
import { useFavoritesStore } from '../store/favoritesStore';
import { CompareIcon, HeartIcon } from './CollectionIcons';
import { useI18n } from '../i18n/useI18n';
import { LocaleControl } from './LocaleControl';

/**
 * Accesos fijos a los favoritos, el comparador y el selector de idioma y moneda, junto al botón del asesor (abajo a la izquierda). El comparador
 * solo aparece cuando hay algo marcado. Cada uno lleva un globo con su cantidad.
 */
interface CollectionDockProps {
  /** Hay modelo 3D e inventario cargado: se puede iniciar la presentación. */
  canPresent: boolean;
  onPresent: () => void;
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
    </svg>
  );
}

export function CollectionDock({ canPresent, onPresent }: CollectionDockProps) {
  const { t } = useI18n();
  const favoriteCount = useFavoritesStore((state) => state.keys.length);
  const openFavorites = useFavoritesStore((state) => state.openPanel);
  const compareCount = useCompareStore((state) => state.keys.length);
  const openCompare = useCompareStore((state) => state.openCompare);

  return (
    <div className="pointer-events-none fixed bottom-4 left-[4.25rem] z-20 flex items-center gap-2">
      <button
        type="button"
        onClick={openFavorites}
        aria-label={t('dock.favorites', { count: favoriteCount })}
        className="pointer-events-auto relative flex h-11 w-11 items-center justify-center rounded-full bg-[var(--brand-background)] text-neutral-800 shadow-lg"
      >
        <HeartIcon className="h-5 w-5" filled={favoriteCount > 0} />
        {favoriteCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-medium text-white">
            {favoriteCount}
          </span>
        )}
      </button>
      {compareCount > 0 && (
        <button
          type="button"
          onClick={openCompare}
          aria-label={t('dock.compare', { count: compareCount })}
          className="pointer-events-auto relative flex h-11 w-11 items-center justify-center rounded-full bg-[var(--brand-background)] text-neutral-800 shadow-lg"
        >
          <CompareIcon className="h-5 w-5" />
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--brand-primary)] px-1 text-[11px] font-medium text-white">
            {compareCount}
          </span>
        </button>
      )}
      <LocaleControl />
      {canPresent && (
        <button
          type="button"
          onClick={onPresent}
          aria-label={t('tour.startAria')}
          className="pointer-events-auto flex h-11 w-11 items-center justify-center gap-1.5 rounded-full bg-[var(--brand-primary)] text-xs font-semibold text-white shadow-lg sm:w-auto sm:px-3.5"
        >
          <PlayIcon />
          <span className="hidden sm:inline">{t('tour.start')}</span>
        </button>
      )}
    </div>
  );
}
