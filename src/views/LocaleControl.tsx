import { useEffect, useRef, useState } from 'react';
import { useEscapeKey } from '../lib/useEscapeKey';
import { useI18n } from '../i18n/useI18n';
import { LANGUAGE_NAMES } from '../i18n/translate';
import { offeredCurrencies, offeredLanguages, useLocaleStore } from '../store/localeStore';
import { CurrencyNote } from './CurrencyNote';
import { presentationSettings } from '../lib/presentation';
import { useKioskStore } from '../store/kioskStore';
import { usePwaStore } from '../store/pwaStore';
import { promptInstall } from '../lib/pwa';
import { enterShowroom } from './useKioskSession';

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.3 2.4 3.5 5.3 3.5 8.5s-1.2 6.1-3.5 8.5c-2.3-2.4-3.5-5.3-3.5-8.5s1.2-6.1 3.5-8.5Z" />
    </svg>
  );
}

interface SegmentedProps<T extends string> {
  label: string;
  options: readonly { value: T; text: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** Selector de opciones excluyentes con botones grandes (también cómodo para una pantalla táctil). */
function Segmented<T extends string>({ label, options, value, onChange }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label}>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <div className="flex gap-1 rounded-full bg-neutral-100 p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={option.value === value}
            className={`min-h-9 flex-1 rounded-full px-3 text-sm font-medium transition-colors ${
              option.value === value ? 'bg-[var(--brand-primary)] text-white shadow' : 'text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            {option.text}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Selector visible de idioma y moneda: una píldora con lo que se está usando ("ES · MXN") que abre las opciones. Solo
 * muestra los grupos que el desarrollo ofrece (`config.i18n`, `config.currency`) y no aparece si no hay nada que elegir.
 * Cambiar de moneda a dólares avisa que los precios son referenciales.
 */
export function LocaleControl() {
  const { t, language, currency } = useI18n();
  const setLanguage = useLocaleStore((state) => state.setLanguage);
  const setCurrency = useLocaleStore((state) => state.setCurrency);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEscapeKey(() => setOpen(false), open);
  // Tocar fuera cierra el cuadro.
  useEffect(() => {
    if (!open) return undefined;
    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  const kiosk = useKioskStore((state) => state.kiosk);
  const installable = usePwaStore((state) => state.installable);
  const canPickLanguage = offeredLanguages.length > 1;
  const canPickCurrency = offeredCurrencies.length > 1;
  // El showroom se activa desde aquí (personal de la sala); ya dentro, el visitante no lo ve para no salirse sin querer.
  const canEnterShowroom = !kiosk;
  if (!canPickLanguage && !canPickCurrency && !canEnterShowroom && !installable) return null;

  const summary = [canPickLanguage ? language.toUpperCase() : null, canPickCurrency ? currency : null].filter(Boolean).join(' · ') || t('locale.button');

  return (
    <div ref={rootRef} className="pointer-events-auto relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t('locale.button')}
        className="flex h-11 items-center gap-1.5 rounded-full bg-[var(--brand-background)] px-3.5 text-xs font-semibold text-neutral-800 shadow-lg"
      >
        <GlobeIcon />
        {summary}
      </button>

      {open && (
        <div role="dialog" aria-label={t('locale.button')} className="absolute bottom-full left-0 mb-2 w-[min(18rem,calc(100vw-2rem))] space-y-3 rounded-2xl bg-white p-3 shadow-2xl">
          {canPickLanguage && (
            <Segmented
              label={t('locale.language')}
              options={offeredLanguages.map((value) => ({ value, text: LANGUAGE_NAMES[value] }))}
              value={language}
              onChange={setLanguage}
            />
          )}
          {canPickCurrency && (
            <Segmented
              label={t('locale.currency')}
              options={offeredCurrencies.map((value) => ({ value, text: value }))}
              value={currency}
              onChange={setCurrency}
            />
          )}
          <CurrencyNote className="text-[11px] leading-snug text-neutral-500" />
          {installable && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void promptInstall();
              }}
              className="min-h-9 w-full rounded-full border border-neutral-300 px-3 text-sm font-medium text-neutral-800"
            >
              {t('offline.install')}
            </button>
          )}
          {canEnterShowroom && (
            <div className="border-t border-neutral-100 pt-3">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  enterShowroom();
                }}
                className="min-h-9 w-full rounded-full border border-[var(--brand-primary)] px-3 text-sm font-medium text-[var(--brand-primary)]"
              >
                {t('kiosk.enter')}
              </button>
              <p className="mt-1.5 text-[11px] leading-snug text-neutral-500">{t('kiosk.hint', { seconds: presentationSettings().idleSeconds })}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
