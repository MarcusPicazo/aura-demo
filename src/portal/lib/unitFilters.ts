import type { PortalUnit, UnitStatus } from '../types';

export interface UnitFilters {
  search: string;
  floorRange: 'all' | '1-4' | '5-8' | '9-12';
  bedrooms: 'all' | 1 | 2 | 3;
  status: 'all' | UnitStatus;
  onlyAvailable: boolean;
}

export const DEFAULT_UNIT_FILTERS: UnitFilters = {
  search: '',
  floorRange: 'all',
  bedrooms: 'all',
  status: 'all',
  onlyAvailable: false,
};

function matchesFloorRange(floor: number, range: UnitFilters['floorRange']): boolean {
  if (range === 'all') return true;
  if (range === '1-4') return floor >= 1 && floor <= 4;
  if (range === '5-8') return floor >= 5 && floor <= 8;
  return floor >= 9;
}

export function applyUnitFilters(units: PortalUnit[], filters: UnitFilters): PortalUnit[] {
  const term = filters.search.trim().toLowerCase();
  return units.filter((unit) => {
    if (filters.onlyAvailable && unit.status !== 'available') return false;
    if (filters.status !== 'all' && unit.status !== filters.status) return false;
    if (filters.bedrooms !== 'all' && unit.bedrooms !== filters.bedrooms) return false;
    if (!matchesFloorRange(unit.floor, filters.floorRange)) return false;
    if (!term) return true;
    return (
      unit.code.toLowerCase().includes(term) ||
      unit.typeLabel.toLowerCase().includes(term) ||
      unit.tower.toLowerCase().includes(term)
    );
  });
}
