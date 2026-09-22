import type { Unit } from '../types';

/** SPEC §4.1: filtros de recámaras, rango de precio, y "solo disponibles". */
export interface UnitFilters {
  bedrooms: number | null;
  priceMin: number | null;
  priceMax: number | null;
  onlyAvailable: boolean;
}

export const DEFAULT_FILTERS: UnitFilters = {
  bedrooms: null,
  priceMin: null,
  priceMax: null,
  onlyAvailable: false,
};

/** `null`/`false` en cualquier campo significa "sin restricción" en ese campo. */
export function unitMatchesFilters(unit: Unit, filters: UnitFilters): boolean {
  if (filters.bedrooms !== null && unit.bedrooms !== filters.bedrooms) return false;
  if (filters.priceMin !== null && unit.price < filters.priceMin) return false;
  if (filters.priceMax !== null && unit.price > filters.priceMax) return false;
  if (filters.onlyAvailable && unit.status !== 'available') return false;
  return true;
}
