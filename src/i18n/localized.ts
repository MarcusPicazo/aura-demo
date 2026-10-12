/**
 * Un texto de la config del cliente: una cadena (vale para todos los idiomas) o un objeto con una versión por idioma,
 * `{ "es": "Alberca", "en": "Pool" }`. Así un cliente que solo trabaja en español no cambia nada, y uno bilingüe
 * escribe cada texto en los dos idiomas dentro de la misma config.
 */
export type LocalizedText = string | Partial<Record<string, string>>;

/**
 * El texto en `language`; si no existe esa versión, el del idioma por omisión del cliente, y si tampoco, el primero
 * que haya. Pura (no depende de React ni de la config) para poder usarla también en el `vite.config.ts`.
 */
export function localize(text: LocalizedText | undefined, language: string, fallbackLanguage: string): string {
  if (text === undefined) return '';
  if (typeof text === 'string') return text;
  const exact = text[language];
  if (exact) return exact;
  const fallback = text[fallbackLanguage];
  if (fallback) return fallback;
  return Object.values(text).find((value): value is string => typeof value === 'string' && value.length > 0) ?? '';
}

/** El texto en español: el /admin y el portal son herramientas internas que se quedan en español. */
export const esText = (text: LocalizedText | undefined): string => localize(text, 'es', 'es');
