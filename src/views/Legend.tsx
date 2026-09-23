import { STATUS_COLORS, STATUS_LABELS } from '../lib/status';
import type { Unit, UnitStatus } from '../types';

const LEGEND_STATUSES: UnitStatus[] = ['available', 'reserved', 'sold'];

interface LegendProps {
  units: Unit[];
  loadError?: string | null;
}

/** SPEC §4.1: leyenda de estados y contador ("18 de 46 disponibles"). */
export function Legend({ units, loadError }: LegendProps) {
  const availableCount = units.filter((unit) => unit.status === 'available').length;

  return (
    <div className="pointer-events-auto rounded-xl bg-[var(--brand-background)]/95 p-3 text-sm shadow-lg backdrop-blur">
      <ul className="space-y-1">
        {LEGEND_STATUSES.map((status) => (
          <li key={status} className="flex items-center gap-2 text-neutral-700">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] }} />
            {STATUS_LABELS[status]}
          </li>
        ))}
      </ul>
      <p className={`mt-2 border-t border-neutral-200 pt-2 text-xs ${loadError ? 'text-red-600' : 'text-neutral-500'}`}>
        {loadError ? 'No se pudieron cargar' : units.length > 0 ? `${availableCount} de ${units.length} disponibles` : 'Cargando unidades…'}
      </p>
    </div>
  );
}
