import en from './locales/en.json';
import es from './locales/es.json';

/** Idiomas con archivo de traducción. Agregar uno: su `locales/<código>.json` y una entrada en cada tabla de abajo. */
export type Language = 'es' | 'en';
export const LANGUAGES: readonly Language[] = ['es', 'en'];

/** Cómo se llama cada idioma en su propio idioma (así se ve igual sin importar en cuál esté la interfaz). */
export const LANGUAGE_NAMES: Record<Language, string> = { es: 'Español', en: 'English' };
/** Etiqueta BCP 47 para `Intl` (formato de números y fechas) y para `<html lang>`. */
export const LOCALE_TAGS: Record<Language, string> = { es: 'es-MX', en: 'en-US' };

type Messages = typeof es;

/** Las rutas a cada texto de `es.json`: `"unit.save"`. Las formas plurales (`x_one`, `x_other`) se piden por su base (`"x"`). */
type LeafKeys<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : LeafKeys<T[K], `${Prefix}${K}.`>;
}[keyof T & string];
type PluralBase<K extends string> = K extends `${infer Base}_${'zero' | 'one' | 'two' | 'few' | 'many' | 'other'}` ? Base : K;
export type TranslationKey = PluralBase<LeafKeys<Messages>>;

export type TranslateParams = Record<string, string | number>;
export type Translate = (key: TranslationKey, params?: TranslateParams) => string;

const DICTIONARIES: Record<Language, unknown> = { es, en };

function lookup(dictionary: unknown, path: string): string | undefined {
  let node: unknown = dictionary;
  for (const part of path.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/** `Hola {name}` + `{ name: 'Ana' }` → `Hola Ana`. Un marcador sin valor se deja tal cual, para que el error se vea. */
export function interpolate(message: string, params?: TranslateParams): string {
  if (!params) return message;
  return message.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

const pluralRules = new Map<Language, Intl.PluralRules>();

function pluralCategory(language: Language, count: number): string {
  let rules = pluralRules.get(language);
  if (!rules) {
    rules = new Intl.PluralRules(LOCALE_TAGS[language]);
    pluralRules.set(language, rules);
  }
  return rules.select(count);
}

/**
 * El texto de la interfaz en `language`. Con `count` en los parámetros elige la forma plural (`_one`, `_other`…) según
 * las reglas del idioma. Si falta la traducción cae al español y, si tampoco está, devuelve la clave: nunca queda vacío.
 */
export function translate(language: Language, key: TranslationKey, params?: TranslateParams): string {
  const dictionaries = [DICTIONARIES[language], DICTIONARIES.es];
  for (const dictionary of dictionaries) {
    if (typeof params?.count === 'number') {
      const plural = lookup(dictionary, `${key}_${pluralCategory(language, params.count)}`) ?? lookup(dictionary, `${key}_other`);
      if (plural !== undefined) return interpolate(plural, params);
    }
    const message = lookup(dictionary, key);
    if (message !== undefined) return interpolate(message, params);
  }
  return key;
}

/**
 * El idioma con que abre la interfaz: el que la persona eligió antes si el cliente lo ofrece; si no, el primero de los
 * idiomas del navegador (en su orden de preferencia, comparando solo el código principal: `es-AR` → `es`) que el
 * cliente ofrezca; si ninguno, el idioma por omisión del cliente.
 */
export function detectLanguage(
  available: readonly Language[],
  fallback: Language,
  stored: string | null | undefined,
  browserLanguages: readonly string[],
): Language {
  const offered = (code: string | null | undefined): Language | null =>
    available.find((language) => language === code?.toLowerCase().split('-')[0]) ?? null;
  const remembered = offered(stored);
  if (remembered) return remembered;
  for (const code of browserLanguages) {
    const match = offered(code);
    if (match) return match;
  }
  return available.includes(fallback) ? fallback : (available[0] ?? 'es');
}
