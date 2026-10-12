import type { SunSummary } from './sunExposure';

/**
 * Mapa de sol del edificio: qué unidades reciben sol de tarde. Son convenciones del visor (como los colores
 * de estado en `status.ts`), no de la marca del cliente; el motor solo recibe el color de cada unidad.
 */
export type SunBucket = 'afternoon' | 'none';

export const SUN_MAP_COLORS: Record<SunBucket, string> = {
  afternoon: '#f0742e',
  none: '#7f93a8',
};

/** Color de cada unidad por código: naranja si recibe sol de tarde, gris azulado si no. */
export function afternoonTints(summaries: ReadonlyMap<string, SunSummary>): Map<string, string> {
  return new Map([...summaries].map(([code, summary]) => [code, SUN_MAP_COLORS[summary.afternoon ? 'afternoon' : 'none']]));
}
