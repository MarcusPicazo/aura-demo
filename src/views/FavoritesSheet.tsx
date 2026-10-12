import { useState } from 'react';
import { Link } from 'react-router-dom';
import { unitIdentity } from '../config/active';
import { MAX_COMPARE, buildFavoritesLink } from '../lib/collections';
import { STATUS_COLORS } from '../lib/status';
import { useI18n } from '../i18n/useI18n';
import { CurrencyNote } from './CurrencyNote';
import { homePath, unitLabel, unitLink } from '../lib/unitDetails';
import { useCompareStore } from '../store/compareStore';
import { useFavoritesStore } from '../store/favoritesStore';
import { CompareIcon, HeartIcon, ShareIcon } from './CollectionIcons';
import { Sheet } from './Sheet';
import type { Unit } from '../types';

interface FavoritesSheetProps {
  units: Unit[];
  developmentName: string;
}

/**
 * Favoritos: las unidades que la persona guardó en este navegador (sin cuenta ni servidor) y un link para compartir la
 * lista. Quien abre ese link ve la lista de la otra persona y puede sumarla a la suya. Los datos de cada unidad (precio,
 * estado) salen del inventario en vivo; solo las claves viven en el dispositivo.
 */
export function FavoritesSheet({ units, developmentName }: FavoritesSheetProps) {
  const i18n = useI18n();
  const { t } = i18n;
  const panelOpen = useFavoritesStore((state) => state.panelOpen);
  const closePanel = useFavoritesStore((state) => state.closePanel);
  const keys = useFavoritesStore((state) => state.keys);
  const sharedKeys = useFavoritesStore((state) => state.sharedKeys);
  const toggleFavorite = useFavoritesStore((state) => state.toggle);
  const remove = useFavoritesStore((state) => state.remove);
  const addMany = useFavoritesStore((state) => state.addMany);
  const clear = useFavoritesStore((state) => state.clear);
  const dismissShared = useFavoritesStore((state) => state.dismissShared);

  const compareKeys = useCompareStore((state) => state.keys);
  const toggleCompare = useCompareStore((state) => state.toggle);
  const openCompare = useCompareStore((state) => state.openCompare);

  const [feedback, setFeedback] = useState<string | null>(null);

  const viewingShared = sharedKeys !== null;
  const list = sharedKeys ?? keys;
  const loading = units.length === 0 && list.length > 0;

  function flash(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(null), 2500);
  }

  async function handleShareList() {
    const link = buildFavoritesLink(window.location.origin, homePath(), keys);
    const title = t('favorites.shareTitle', { name: developmentName });
    // En celular, el menú de compartir del sistema; donde no existe (escritorio), se copia el link.
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text: t('favorites.shareText', { title, count: keys.length }), url: link });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      flash(t('unit.linkCopied'));
    } catch (error) {
      console.error('No se pudo copiar el link de favoritos:', error);
      flash(t('favorites.copyFailed'));
    }
  }

  function handleToggleCompare(unit: Unit) {
    if (toggleCompare(unitIdentity.param(unit)) === 'full') flash(t('unit.compareFull', { max: MAX_COMPARE }));
  }

  return (
    <Sheet open={panelOpen} onClose={closePanel} title={viewingShared ? t('favorites.sharedTitle') : t('favorites.title')}>
      {viewingShared && (
        <div className="mb-3 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700">
          <p>
            {t('favorites.sharedIntro', { count: sharedKeys.length, name: developmentName })}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                addMany(sharedKeys);
                dismissShared();
                flash(t('favorites.savedNotice'));
              }}
              className="rounded-full bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-medium text-white"
            >
              {t('favorites.saveShared')}
            </button>
            <button type="button" onClick={dismissShared} className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700">
              {t('favorites.viewMine', { count: keys.length })}
            </button>
          </div>
        </div>
      )}

      {loading && <p className="py-8 text-center text-sm text-neutral-500">{t('common.loadingUnits')}</p>}
      {!loading && list.length === 0 && (
        <p className="py-8 text-center text-sm text-neutral-500">
          {t('favorites.empty')}
        </p>
      )}

      <ul className="divide-y divide-neutral-100">
        {!loading &&
          list.map((key) => {
            const unit = unitIdentity.find(units, key);
            const saved = keys.includes(key);
            if (!unit) {
              return (
                <li key={key} className="flex items-center justify-between gap-3 py-3 text-sm text-neutral-400">
                  <span>{t('favorites.gone', { unit: key.replace(':', ' · ') })}</span>
                  {!viewingShared && (
                    <button type="button" onClick={() => remove(key)} className="text-xs underline">
                      {t('favorites.removeShort')}
                    </button>
                  )}
                </li>
              );
            }
            const comparing = compareKeys.includes(key);
            return (
              <li key={key} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-serif text-lg leading-tight text-neutral-900">{unitLabel(i18n, unit)}</p>
                    <p className="text-xs text-neutral-500">
                      {t('favorites.summary', { type: unit.type, m2: unit.m2, bedrooms: unit.bedrooms, bathrooms: unit.bathrooms, floor: unit.floor })}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-neutral-800">
                      <span className="font-semibold">{i18n.money(unit.price)}</span>
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[unit.status] }} />
                      <span className="text-xs text-neutral-500">{i18n.status(unit.status)}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleFavorite(key)}
                      aria-pressed={saved}
                      aria-label={saved ? t('favorites.unsaveAria', { code: unit.code }) : t('favorites.saveAria', { code: unit.code })}
                      className={`flex h-9 w-9 items-center justify-center rounded-full ${saved ? 'text-rose-600' : 'text-neutral-400 hover:text-neutral-700'}`}
                    >
                      <HeartIcon className="h-5 w-5" filled={saved} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleCompare(unit)}
                      aria-pressed={comparing}
                      aria-label={comparing ? t('favorites.uncompareAria', { code: unit.code }) : t('favorites.compareAria', { code: unit.code })}
                      className={`flex h-9 w-9 items-center justify-center rounded-full ${comparing ? 'bg-[var(--brand-primary)] text-white' : 'text-neutral-400 hover:text-neutral-700'}`}
                    >
                      <CompareIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                <Link to={unitLink(unit)} onClick={closePanel} className="mt-1 inline-block text-xs font-medium text-[var(--brand-primary)] underline underline-offset-2">
                  {t('favorites.viewUnit')}
                </Link>
              </li>
            );
          })}
      </ul>

      <CurrencyNote className="mt-3 text-xs text-neutral-500" />

      {feedback && (
        <p role="status" className="mt-3 rounded-lg bg-neutral-900 px-3 py-2 text-center text-xs text-white">
          {feedback}
        </p>
      )}

      {!viewingShared && keys.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-neutral-100 pt-4">
          <button
            type="button"
            onClick={handleShareList}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-primary)] py-2.5 text-sm font-medium text-white"
          >
            <ShareIcon className="h-4 w-4" />
            {t('favorites.share')}
          </button>
          {compareKeys.length > 0 && (
            <button
              type="button"
              onClick={() => {
                closePanel();
                openCompare();
              }}
              className="w-full rounded-full border border-[var(--brand-primary)] py-2 text-sm font-medium text-[var(--brand-primary)]"
            >
              {t('favorites.viewComparison', { count: compareKeys.length })}
            </button>
          )}
          <button type="button" onClick={clear} className="block w-full text-center text-xs text-neutral-500 underline underline-offset-2">
            {t('favorites.clear')}
          </button>
        </div>
      )}
    </Sheet>
  );
}
