import { useState } from 'react';
import { useFiltersStore } from '../store/filtersStore';
import { hasActiveFilters } from '../lib/filters';
import { formatPrice } from '../lib/pricing';
import type { Unit } from '../types';

interface FiltersProps {
  units: Unit[];
}

/** SPEC §4.1: filtros de recámaras, rango de precio y "solo disponibles". */
export function Filters({ units }: FiltersProps) {
  const [expanded, setExpanded] = useState(false);

  const bedrooms = useFiltersStore((state) => state.bedrooms);
  const priceMin = useFiltersStore((state) => state.priceMin);
  const priceMax = useFiltersStore((state) => state.priceMax);
  const onlyAvailable = useFiltersStore((state) => state.onlyAvailable);
  const setBedrooms = useFiltersStore((state) => state.setBedrooms);
  const setPriceRange = useFiltersStore((state) => state.setPriceRange);
  const setOnlyAvailable = useFiltersStore((state) => state.setOnlyAvailable);
  const reset = useFiltersStore((state) => state.reset);

  const bedroomOptions = Array.from(new Set(units.map((unit) => unit.bedrooms))).sort((a, b) => a - b);
  const prices = units.map((unit) => unit.price);
  const dataMin = prices.length > 0 ? Math.min(...prices) : 0;
  const dataMax = prices.length > 0 ? Math.max(...prices) : 0;

  const filtersActive = hasActiveFilters({ bedrooms, priceMin, priceMax, onlyAvailable });

  function parsePriceInput(value: string): number | null {
    return value === '' ? null : Number(value);
  }

  return (
    <div
      className={`pointer-events-auto ml-auto rounded-xl bg-[var(--brand-background)]/95 p-3 text-sm shadow-lg backdrop-blur ${expanded ? 'w-60' : ''}`}
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-3 font-medium text-neutral-900"
      >
        <span>Filtros{filtersActive ? ' •' : ''}</span>
        <span className="text-neutral-400">{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Recámaras</p>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setBedrooms(null)}
                className={`rounded-full border px-2 py-1 text-xs ${
                  bedrooms === null
                    ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white'
                    : 'border-neutral-300 text-neutral-700'
                }`}
              >
                Todas
              </button>
              {bedroomOptions.map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setBedrooms(bedrooms === count ? null : count)}
                  className={`rounded-full border px-2 py-1 text-xs ${
                    bedrooms === count
                      ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white'
                      : 'border-neutral-300 text-neutral-700'
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Precio</p>
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="numeric"
                placeholder={formatPrice(dataMin)}
                value={priceMin ?? ''}
                onChange={(event) => setPriceRange(parsePriceInput(event.target.value), priceMax)}
                className="w-full min-w-0 rounded-lg border border-neutral-300 px-2 py-1 text-xs"
              />
              <input
                type="number"
                inputMode="numeric"
                placeholder={formatPrice(dataMax)}
                value={priceMax ?? ''}
                onChange={(event) => setPriceRange(priceMin, parsePriceInput(event.target.value))}
                className="w-full min-w-0 rounded-lg border border-neutral-300 px-2 py-1 text-xs"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-neutral-700">
            <input
              type="checkbox"
              checked={onlyAvailable}
              onChange={(event) => setOnlyAvailable(event.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 accent-[var(--brand-primary)]"
            />
            Solo disponibles
          </label>

          {filtersActive && (
            <button type="button" onClick={reset} className="text-xs text-neutral-500 underline">
              Limpiar filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
}
