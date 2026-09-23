import { create } from 'zustand';
import { DEFAULT_FILTERS, type UnitFilters } from '../lib/filters';

interface FiltersState extends UnitFilters {
  setBedrooms: (bedrooms: number | null) => void;
  setPriceRange: (priceMin: number | null, priceMax: number | null) => void;
  setOnlyAvailable: (onlyAvailable: boolean) => void;
  reset: () => void;
  /** Toggle manual de "ver disponibilidad": tinta la torre por estado aunque no haya filtros activos. */
  showAvailability: boolean;
  toggleShowAvailability: () => void;
}

/** Filtros globales del selector: los lee el motor (para la transparencia) y los escriben los controles de `Filters`. */
export const useFiltersStore = create<FiltersState>((set) => ({
  ...DEFAULT_FILTERS,
  setBedrooms: (bedrooms) => set({ bedrooms }),
  setPriceRange: (priceMin, priceMax) => set({ priceMin, priceMax }),
  setOnlyAvailable: (onlyAvailable) => set({ onlyAvailable }),
  reset: () => set(DEFAULT_FILTERS),
  showAvailability: false,
  toggleShowAvailability: () => set((state) => ({ showAvailability: !state.showAvailability })),
}));
