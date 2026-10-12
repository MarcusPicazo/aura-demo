import { activeConfig } from '../config/active';
import type { Unit } from '../types';

export const DEFAULT_TOUR_SECONDS = 45;
export const DEFAULT_IDLE_SECONDS = 120;
export const DEFAULT_SUN_SWEEP: [number, number] = [7, 18];

/** Duración del recorrido y reposo del showroom, de `config.presentation` con sus valores por omisión. */
export function presentationSettings(): { tourSeconds: number; idleSeconds: number; sunSweepHours: [number, number] } {
  const config = activeConfig.presentation;
  return {
    tourSeconds: config?.tourSeconds && config.tourSeconds > 0 ? config.tourSeconds : DEFAULT_TOUR_SECONDS,
    idleSeconds: config?.idleSeconds && config.idleSeconds > 0 ? config.idleSeconds : DEFAULT_IDLE_SECONDS,
    sunSweepHours: config?.sunSweepHours ?? DEFAULT_SUN_SWEEP,
  };
}

/**
 * La unidad que visita el recorrido: la de `featuredUnit` si existe en el inventario, y si no la disponible de piso más alto
 * que tenga vista (`hasView`), con el código como desempate para que el resultado sea estable. `null` si no hay ninguna.
 */
export function pickFeaturedUnit(
  units: readonly Unit[],
  param: (unit: Unit) => string,
  hasView: (unit: Unit) => boolean,
  featured: string | undefined = activeConfig.presentation?.featuredUnit,
): Unit | null {
  const eligible = units.filter(hasView);
  const wanted = featured ? eligible.find((unit) => param(unit) === featured || unit.code === featured) : undefined;
  if (wanted) return wanted;
  const pool = eligible.filter((unit) => unit.status === 'available');
  const candidates = pool.length > 0 ? pool : eligible;
  return [...candidates].sort((a, b) => b.floor - a.floor || a.code.localeCompare(b.code))[0] ?? null;
}

/** ¿Pasó el tiempo de reposo? `lastActivity` y `now` en milisegundos. */
export function idleElapsed(lastActivity: number, now: number, idleSeconds: number): boolean {
  return now - lastActivity >= idleSeconds * 1000;
}
