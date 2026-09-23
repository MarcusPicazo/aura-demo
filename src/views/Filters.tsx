import { useState } from 'react';
import { useFiltersStore } from '../store/filtersStore';
import { hasActiveFilters } from '../lib/filters';
import { formatPrice } from '../lib/pricing';
import { useEscapeKey } from '../lib/useEscapeKey';
import { usePresence } from '../lib/usePresence';
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

  // 300ms con la curva compartida (`ease-elegant`) — antes 250ms/ease-out, se sentía un
  // poco mecánico al llegar a su posición final.
  const { rendered: expandedContent, visible: expandedVisible } = usePresence(expanded ? true : null, 300);
  useEscapeKey(() => setExpanded(false), expanded);

  // El ancho se ataba antes a `expanded` (crudo): al cerrar, la caja se encogía de golpe
  // en el mismo instante en que el contenido TODAVÍA se estaba desvaneciendo adentro —
  // se veía el texto recortado/brincando un frame antes de desaparecer. Atado a
  // `expandedContent` (el valor retenido de `usePresence`), la caja se queda ancha
  // mientras el contenido sigue montado animando su salida, y solo se encoge después.
  // El ancho ahora también transiciona (antes saltaba de golpe): con `overflow-hidden` +
  // `transition-[width]`, la caja crece/encoge en el mismo tiempo que el contenido se
  // desvanece, en vez de aparecer ya del ancho final de un salto.
  return (
    <div
      className={`pointer-events-auto ml-auto overflow-hidden rounded-xl bg-[var(--brand-background)]/95 p-3 text-sm shadow-lg backdrop-blur transition-[width] duration-300 ease-elegant motion-reduce:transition-none ${
        expandedContent ? 'w-60' : 'w-auto'
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-3 font-medium text-neutral-900"
      >
        <span>Filtros{filtersActive ? ' •' : ''}</span>
        <span className="text-neutral-400">{expanded ? '−' : '+'}</span>
      </button>

      {expandedContent && (
        <div
          className={`mt-3 space-y-3 transition-[opacity,transform] duration-300 ease-elegant delay-75 motion-reduce:transition-none motion-reduce:delay-0 ${
            expandedVisible ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'
          }`}
        >
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
