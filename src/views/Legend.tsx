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
    // Más compacta en móvil (`p-2`/`text-xs`/punto más chico): en una pantalla angosta,
    // el tamaño de escritorio le ganaba demasiado espacio a la vista de la torre.
    <div className="pointer-events-auto rounded-xl bg-[var(--brand-background)]/95 p-2 text-xs shadow-lg backdrop-blur sm:p-3 sm:text-sm">
      <ul className="space-y-0.5 sm:space-y-1">
        {LEGEND_STATUSES.map((status) => (
          <li key={status} className="flex items-center gap-1.5 text-neutral-700 sm:gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full sm:h-3 sm:w-3" style={{ backgroundColor: STATUS_COLORS[status] }} />
            {STATUS_LABELS[status]}
          </li>
        ))}
      </ul>
      <p className={`mt-1.5 border-t border-neutral-200 pt-1.5 text-[11px] sm:mt-2 sm:pt-2 sm:text-xs ${loadError ? 'text-red-600' : 'text-neutral-500'}`}>
        {loadError ? 'No se pudieron cargar' : units.length > 0 ? `${availableCount} de ${units.length} disponibles` : 'Cargando unidades…'}
      </p>
    </div>
  );
}
