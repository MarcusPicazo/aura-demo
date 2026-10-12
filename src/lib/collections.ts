/**
 * Listas de unidades que el usuario arma en su navegador (favoritos y comparador): funciones puras sobre las
 * claves de unidad (`UnitIdentity.param`: `edificio:código` en un conjunto, el código solo en una torre).
 */

/** Cuántas unidades se pueden comparar a la vez. */
export const MAX_COMPARE = 3;
/** Tope de favoritos, también para una lista que llega por link (no debe poder inflar la memoria ni el link). */
export const MAX_FAVORITES = 50;
/** Nombre del parámetro de URL con que viaja una lista de favoritos compartida. */
export const FAVORITES_PARAM = 'favoritos';

/** Lo que puede contener una clave: letras, números y `. _ : -`. Cualquier otra cosa no es una clave de unidad. */
const KEY_PATTERN = /^[A-Za-z0-9._:-]{1,80}$/;

export type ToggleResult = 'added' | 'removed' | 'full';

/** Agrega la clave si no está, la quita si ya está, o no hace nada si la lista ya llegó a `max`. */
export function toggleKey(keys: readonly string[], key: string, max: number): { keys: string[]; result: ToggleResult } {
  if (keys.includes(key)) return { keys: keys.filter((candidate) => candidate !== key), result: 'removed' };
  if (keys.length >= max) return { keys: [...keys], result: 'full' };
  return { keys: [...keys, key], result: 'added' };
}

/** Une listas sin repetir claves y sin pasar de `max`; las que ya estaban conservan su lugar. */
export function mergeKeys(current: readonly string[], incoming: readonly string[], max: number): string[] {
  const merged = [...current];
  for (const key of incoming) {
    if (merged.length >= max) break;
    if (!merged.includes(key)) merged.push(key);
  }
  return merged;
}

/** Lo que se guardó antes (o lo que alguien escribió a mano en el almacenamiento): solo claves válidas, sin repetir. */
export function sanitizeKeys(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const keys: string[] = [];
  for (const item of value) {
    if (typeof item === 'string' && KEY_PATTERN.test(item) && !keys.includes(item)) keys.push(item);
    if (keys.length >= max) break;
  }
  return keys;
}

/** `torre-aura:604,torre-aura:1101` → las claves. Todo lo que no parezca una clave se ignora: el valor viene de un link. */
export function parseKeyList(raw: string | null | undefined, max = MAX_FAVORITES): string[] {
  if (!raw) return [];
  return sanitizeKeys(raw.split(',').map((part) => part.trim()), max);
}

function encodeKey(key: string): string {
  // Los dos puntos van sin escapar: el link queda legible y sigue siendo una URL válida.
  return encodeURIComponent(key).replace(/%3A/gi, ':');
}

/** Link que abre la lista de favoritos de alguien más: `<origen><ruta>?favoritos=a:1,b:2`. */
export function buildFavoritesLink(origin: string, basePath: string, keys: readonly string[]): string {
  return `${origin}${basePath}?${FAVORITES_PARAM}=${keys.map(encodeKey).join(',')}`;
}
