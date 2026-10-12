import type { CurrencyConfig } from '../types';

/**
 * Monedas en que se pueden ver los precios. El precio oficial de toda unidad es en pesos (MXN, como se guarda en
 * Supabase); el USD es solo una conversión referencial con el tipo de cambio de `config.currency`.
 */
export type Currency = 'MXN' | 'USD';
export const CURRENCIES: readonly Currency[] = ['MXN', 'USD'];

/** `rate` es cuántos pesos vale un dólar (por ejemplo 18.5). */
export function convertFromMxn(amountMxn: number, currency: Currency, rate: number): number {
  if (currency === 'MXN') return amountMxn;
  return amountMxn / rate;
}

/** Lo contrario: una cantidad escrita en `currency` (un filtro de precio) a pesos, el precio oficial. */
export function convertToMxn(amount: number, currency: Currency, rate: number): number {
  if (currency === 'MXN') return amount;
  return amount * rate;
}

const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(locale: string, currency: Currency): Intl.NumberFormat {
  const key = `${locale}|${currency}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 });
    formatters.set(key, formatter);
  }
  return formatter;
}

/**
 * Un monto en pesos escrito en `currency` y con el formato del idioma: `$6,450,000` (es-MX), `MX$6,450,000` (en-US),
 * `US$ 358,333` o `$358,333` en dólares según el idioma. El dólar se redondea al entero: es una referencia.
 */
export function formatMoney(amountMxn: number, currency: Currency, rate: number, locale: string): string {
  return formatterFor(locale, currency).format(Math.round(convertFromMxn(amountMxn, currency, rate)));
}

/** Las monedas que el desarrollo ofrece: sin `config.currency` solo pesos. */
export function availableCurrencies(config: CurrencyConfig | undefined): Currency[] {
  return config && config.usdRate > 0 ? [...CURRENCIES] : ['MXN'];
}
