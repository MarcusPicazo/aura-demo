import { useMemo } from 'react';
import { activeConfig } from '../config/active';
import { formatMoney, type Currency } from '../lib/currency';
import { useLocaleStore } from '../store/localeStore';
import { localize, type LocalizedText } from './localized';
import { LOCALE_TAGS, translate, type Language, type Translate } from './translate';
import type { UnitStatus } from '../types';

/**
 * Todo lo que una vista necesita para mostrarse en el idioma y la moneda elegidos: textos de la interfaz, textos de la
 * config del cliente, precios y fechas. Un solo objeto por (idioma, moneda): se pasa por parámetro a las funciones
 * puras de `lib/` en lugar de que cada una lea el estado global.
 */
export interface I18n {
  language: Language;
  /** Etiqueta BCP 47 del idioma (`es-MX`), para `Intl`. */
  locale: string;
  currency: Currency;
  /** Hay un tipo de cambio configurado y se está viendo en dólares: los precios son referencia, no el precio oficial. */
  isReferential: boolean;
  /** Pesos por dólar de la config (0 si no hay), y su fecha. */
  usdRate: number;
  rateDate: string | null;
  /** El tipo de cambio y su fecha ya escritos para mostrar ("18.50", "1 de octubre de 2026"); vacíos sin tipo de cambio. */
  rateText: string;
  rateDateText: string;
  t: Translate;
  /** Un texto de la config del cliente, en el idioma elegido. */
  text: (value: LocalizedText | undefined) => string;
  /** Un precio en pesos (el oficial) escrito en la moneda elegida y con el formato del idioma. */
  money: (amountMxn: number) => string;
  /** Un precio en pesos siempre en pesos, aunque se esté viendo en dólares (el oficial). */
  moneyMxn: (amountMxn: number) => string;
  status: (status: UnitStatus) => string;
  /** La orientación de una unidad (viene de la base de datos en español) en el idioma elegido. */
  orientation: (value: string) => string;
  /** "marzo de 2028" / "March 2028" a partir de una fecha ISO. */
  monthYear: (isoDate: string) => string;
  /** "11 de octubre de 2026" / "October 11, 2026". */
  dateLong: (date: Date) => string;
}

/** Sin acentos ni espacios y en minúsculas: "Doble orientación" → "dobleorientacion", la clave de `orientation.*`. */
function orientationKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

const defaultLanguage: Language = activeConfig.i18n?.defaultLanguage ?? 'es';
const usdRate = activeConfig.currency?.usdRate ?? 0;
const rateDate = activeConfig.currency?.asOf ?? null;

export function createI18n(language: Language, currency: Currency): I18n {
  const locale = LOCALE_TAGS[language];
  const t: Translate = (key, params) => translate(language, key, params);
  const effectiveCurrency: Currency = currency === 'USD' && usdRate > 0 ? 'USD' : 'MXN';
  const dateOnly = (isoDate: string) => {
    const [year, month, day] = isoDate.split('-').map(Number);
    return new Date(year, month - 1, day || 1);
  };
  return {
    language,
    locale,
    currency: effectiveCurrency,
    isReferential: effectiveCurrency === 'USD',
    usdRate,
    rateDate,
    rateText: usdRate > 0 ? new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(usdRate) : '',
    rateDateText: rateDate ? new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(dateOnly(rateDate)) : '',
    t,
    text: (value) => localize(value, language, defaultLanguage),
    money: (amountMxn) => formatMoney(amountMxn, effectiveCurrency, usdRate, locale),
    moneyMxn: (amountMxn) => formatMoney(amountMxn, 'MXN', usdRate, locale),
    status: (status) => t(`status.${status}`),
    orientation: (value) => {
      const key = `orientation.${orientationKey(value)}`;
      const translated = translate(language, key as Parameters<Translate>[0]);
      // `translate` devuelve la clave cuando no hay texto: una orientación nueva se muestra tal cual viene.
      return translated === key ? value : translated;
    },
    monthYear: (isoDate) => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(dateOnly(isoDate)),
    dateLong: (date) => new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(date),
  };
}

/** El `I18n` del idioma y la moneda actuales; la vista se repinta cuando cambian. */
export function useI18n(): I18n {
  const language = useLocaleStore((state) => state.language);
  const currency = useLocaleStore((state) => state.currency);
  return useMemo(() => createI18n(language, currency), [language, currency]);
}

/** Lo mismo para código que no es un componente (un manejador de clic que arma un PDF o un mensaje): lee el estado ahora. */
export function getI18n(): I18n {
  const { language, currency } = useLocaleStore.getState();
  return createI18n(language, currency);
}
