import { useEffect, useRef } from 'react';
import { floorStatus } from '../../lib/render';
import { STATUS_COLORS } from '../../lib/status';
import { useI18n } from '../../i18n/useI18n';
import type { Unit } from '../../types';

interface FloorSelectorProps {
  floors: number[];
  activeFloor: number;
  units: Unit[];
  onSelect: (floor: number) => void;
}

/**
 * Selector lateral de piso de las vistas de planta. El piso más alto va arriba (como el
 * edificio) y cada botón lleva un punto con el estado agregado del piso (disponible si queda
 * alguna unidad disponible), para elegir sin abrir cada planta.
 */
export function FloorSelector({ floors, activeFloor, units, onSelect }: FloorSelectorProps) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const { t } = useI18n();

  // Con muchos pisos la lista hace scroll; el activo debe quedar a la vista aunque se llegue por URL.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeFloor]);

  return (
    <nav
      aria-label={t('renderNav.selectFloor')}
      className="fixed left-3 top-1/2 z-10 flex max-h-[calc(100dvh-14rem)] -translate-y-1/2 flex-col gap-0.5 overflow-y-auto rounded-full bg-[var(--brand-background)]/95 p-1 shadow-lg backdrop-blur [scrollbar-width:none]"
    >
      {[...floors]
        .sort((a, b) => b - a)
        .map((floor) => {
          const active = floor === activeFloor;
          const status = floorStatus(units, floor);
          return (
            <button
              key={floor}
              ref={active ? activeRef : undefined}
              type="button"
              onClick={() => onSelect(floor)}
              aria-label={t('renderNav.floor', { floor })}
              aria-current={active ? 'true' : undefined}
              className={`relative h-8 w-8 shrink-0 rounded-full text-sm font-medium transition-colors ${
                active ? 'bg-[var(--brand-primary)] text-white' : 'text-neutral-700 hover:bg-neutral-200/70'
              }`}
            >
              {floor}
              {status && (
                <span
                  className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full ring-1 ring-white"
                  style={{ backgroundColor: STATUS_COLORS[status] }}
                />
              )}
            </button>
          );
        })}
    </nav>
  );
}
