import { create } from 'zustand';
import { activeConfig } from '../config/active';
import { availableCurrencies, type Currency } from '../lib/currency';
import { readJson, writeJson } from '../lib/storage';
import { LANGUAGES, LOCALE_TAGS, detectLanguage, type Language } from '../i18n/translate';

interface LocaleState {
  language: Language;
  currency: Currency;
  setLanguage: (language: Language) => void;
  setCurrency: (currency: Currency) => void;
}

/** Idiomas que el desarrollo ofrece (los de su config que tienen archivo de traducción); sin config, solo español. */
export const offeredLanguages: Language[] = activeConfig.i18n?.languages.filter((language) => LANGUAGES.includes(language)) ?? ['es'];
export const defaultLanguage: Language = activeConfig.i18n?.defaultLanguage ?? 'es';
/** Monedas que el desarrollo ofrece. */
export const offeredCurrencies: Currency[] = availableCurrencies(activeConfig.currency);

const STORAGE_KEY = `locale:${activeConfig.slug}`;

interface StoredLocale {
  language?: string;
  currency?: string;
}

function readStored(): StoredLocale {
  const value = readJson('local', STORAGE_KEY);
  return typeof value === 'object' && value !== null ? (value as StoredLocale) : {};
}

const stored = readStored();
const initialLanguage = detectLanguage(
  offeredLanguages,
  defaultLanguage,
  stored.language,
  typeof navigator === 'undefined' ? [] : (navigator.languages?.length ? navigator.languages : [navigator.language]),
);
const initialCurrency: Currency = offeredCurrencies.find((currency) => currency === stored.currency) ?? 'MXN';

/** Que `<html lang>` diga el idioma que se ve: lo leen lectores de pantalla, el traductor del navegador y la ortografía. */
function applyDocumentLanguage(language: Language) {
  if (typeof document !== 'undefined') document.documentElement.lang = LOCALE_TAGS[language];
}
applyDocumentLanguage(initialLanguage);

function persist(language: Language, currency: Currency) {
  writeJson('local', STORAGE_KEY, { language, currency });
}

/**
 * Idioma y moneda de la interfaz. El idioma inicial es el de la persona si ya eligió uno, si no el del navegador (si el
 * desarrollo lo ofrece) y si no el idioma por omisión de la config; la moneda inicial es siempre pesos. Se recuerdan en
 * este dispositivo.
 */
export const useLocaleStore = create<LocaleState>((set, get) => ({
  language: initialLanguage,
  currency: initialCurrency,
  setLanguage: (language) => {
    if (!offeredLanguages.includes(language)) return;
    applyDocumentLanguage(language);
    persist(language, get().currency);
    set({ language });
  },
  setCurrency: (currency) => {
    if (!offeredCurrencies.includes(currency)) return;
    persist(get().language, currency);
    set({ currency });
  },
}));
