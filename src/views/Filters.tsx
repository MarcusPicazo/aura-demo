import { useState } from 'react';
import { useFiltersStore } from '../store/filtersStore';
import { hasActiveFilters } from '../lib/filters';
import { formatPrice } from '../lib/pricing';
import { useDragToDismiss } from '../lib/useDragToDismiss';
import { useEscapeKey } from '../lib/useEscapeKey';
import { usePresence } from '../lib/usePresence';
import type { Unit } from '../types';

interface FiltersProps {
  units: Unit[];
}

/**
 * SPEC §4.1: filtros de recámaras, rango de precio y "solo disponibles".
 *
 * El botón nunca cambia de tamaño (antes el contenedor entero animaba su `width` de
 * `w-auto` a `w-60` al expandirse — eso fuerza relayout en cada cuadro de la transición,
 * justo lo que se siente como "tirón"). El contenido expandido es un panel APARTE, flotando
 * encima con `position: relative` en el botón como ancla: en escritorio cuelga del botón
 * (`sm:absolute`, con `sm:origin-top-right` para que crezca desde ahí), en móvil es una
 * hoja inferior con su propia pestaña de arrastre — mismo patrón que `UnitPanel`/
 * `ContactCard`. Solo transform/opacity se animan en los dos casos.
 */
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

  function close() {
    setExpanded(false);
  }

  // 280ms con la curva compartida (`ease-elegant`), dentro de los 250-320ms que se sienten
  // bien para un panel de este tamaño — ni instantáneo ni perezoso.
  const { rendered: expandedContent, visible: expandedVisible } = usePresence(expanded ? true : null, 280);
  useEscapeKey(close, expanded);
  const { dragging, dragY, handlePointerDown, handlePointerMove, handlePointerUp } = useDragToDismiss(close, expandedVisible);

  return (
    <div className="pointer-events-auto relative ml-auto">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex items-center gap-3 rounded-xl bg-[var(--brand-background)]/95 px-3 py-2 text-sm font-medium text-neutral-900 shadow-lg backdrop-blur"
      >
        <span>Filtros{filtersActive ? ' •' : ''}</span>
        <span className="text-neutral-400">{expanded ? '−' : '+'}</span>
      </button>

      {expandedContent && (
        <div
          // Móvil: hoja inferior fija a todo lo ancho, con pestaña de arrastre.
          // Escritorio (`sm:`): panel chico colgando del botón, sin ocupar la pantalla —
          // por eso `sm:absolute` en vez del `sm:fixed` que usan los paneles grandes
          // (ficha de unidad, asesor): este es un dropdown, no una hoja de contenido.
          className={`fixed inset-x-0 bottom-0 z-30 flex max-h-[70dvh] select-none flex-col overflow-hidden rounded-t-2xl border-t-4 border-[var(--brand-accent)] bg-white shadow-2xl transition-[opacity,transform] duration-[280ms] ease-elegant motion-reduce:transition-none sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:bottom-auto sm:mt-2 sm:max-h-none sm:w-64 sm:origin-top-right sm:select-auto sm:rounded-xl ${
            expandedVisible
              ? 'translate-y-0 opacity-100 sm:scale-100'
              : 'translate-y-full opacity-0 sm:translate-y-0 sm:scale-95'
          }`}
          style={dragging ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
        >
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="flex shrink-0 touch-none cursor-grab justify-center pb-1 pt-2.5 active:cursor-grabbing sm:hidden"
          >
            <span className="h-1.5 w-10 rounded-full bg-neutral-300" aria-hidden="true" />
            <span className="sr-only">Deslizar o tocar para cerrar</span>
          </div>

          <div
            className={`min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pb-5 pt-1 transition-opacity duration-[280ms] ease-elegant delay-75 motion-reduce:transition-none motion-reduce:delay-0 sm:p-3 ${
              expandedVisible ? 'opacity-100' : 'opacity-0'
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
        </div>
      )}
    </div>
  );
}
