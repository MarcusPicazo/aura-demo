import { applyUpdate } from '../lib/pwa';
import { useI18n } from '../i18n/useI18n';
import { usePwaStore } from '../store/pwaStore';

/**
 * Avisos de la app instalable, siempre pequeños y de paso: el avance de lo que se guarda para usar sin conexión (con su barra),
 * "listo para usar sin conexión" y "hay una versión nueva" con su botón. Nunca tapan la escena: caen bajo las pestañas.
 */
export function PwaToast() {
  const { t } = useI18n();
  const precache = usePwaStore((state) => state.precache);
  const readyFlash = usePwaStore((state) => state.readyFlash);
  const updateReady = usePwaStore((state) => state.updateReady);

  const saving = precache !== null && !precache.completed && precache.total > 0;
  if (!saving && !readyFlash && !updateReady) return null;
  const percent = precache && precache.total > 0 ? Math.round((precache.done / precache.total) * 100) : 0;

  return (
    <div className="pointer-events-none fixed left-1/2 top-[7.25rem] z-30 flex -translate-x-1/2 flex-col items-center gap-2 px-4">
      {updateReady && (
        <div role="status" className="pointer-events-auto flex items-center gap-3 rounded-full bg-neutral-900/90 py-1.5 pl-4 pr-1.5 text-xs text-white shadow-lg backdrop-blur">
          {t('offline.updateReady')}
          <button type="button" onClick={() => applyUpdate()} className="rounded-full bg-white px-3 py-1 font-medium text-neutral-900">
            {t('offline.update')}
          </button>
        </div>
      )}
      {saving && (
        <div role="status" className="w-56 rounded-2xl bg-neutral-900/80 px-4 py-2 text-xs text-white shadow-lg backdrop-blur">
          <p>{t('offline.saving', { percent })}</p>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/20" aria-hidden="true">
            <div className="h-full rounded-full bg-[var(--brand-accent)] transition-[width] duration-300" style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}
      {!saving && readyFlash && (
        <p role="status" className="rounded-full bg-neutral-900/80 px-4 py-1.5 text-xs text-white shadow-lg backdrop-blur">
          {t('offline.ready')}
        </p>
      )}
    </div>
  );
}
