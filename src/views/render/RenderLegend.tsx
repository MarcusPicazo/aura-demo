import { STATUS_COLORS } from '../../lib/status';
import { useI18n } from '../../i18n/useI18n';
import { OfflineNotice } from '../OfflineNotice';
import type { Unit, UnitStatus } from '../../types';

const LEGEND_STATUSES: UnitStatus[] = ['available', 'reserved', 'sold'];

interface RenderLegendProps {
  units: Unit[];
  loadError: string | null;
}

/**
 * Leyenda de estados y contador en una barra inferior. Es horizontal (no la tarjeta vertical
 * del selector 3D) porque aquí la imagen es el protagonista y una tarjeta en una esquina
 * taparía parte de ella, sobre todo en celular. Deja libre el botón de contacto a la izquierda.
 */
export function RenderLegend({ units, loadError }: RenderLegendProps) {
  const { t, status: statusLabel } = useI18n();
  const availableCount = units.filter((unit) => unit.status === 'available').length;

  return (
    <div className="pointer-events-none fixed bottom-[4.5rem] left-4 right-4 z-10 sm:bottom-4 sm:left-[17.5rem] flex flex-col items-center gap-1">
      <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 rounded-2xl bg-[var(--brand-background)]/95 px-3 py-1.5 text-xs text-neutral-700 shadow-lg backdrop-blur">
        {LEGEND_STATUSES.map((status) => (
          <span key={status} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] }} />
            {statusLabel(status)}
          </span>
        ))}
        <span className={`border-l border-neutral-300 pl-3 ${loadError ? 'text-red-600' : 'text-neutral-500'}`}>
          {loadError
            ? t('legend.loadError')
            : units.length > 0
              ? t('legend.count', { available: availableCount, total: units.length })
              : t('common.loadingUnits')}
        </span>
      </div>
      <OfflineNotice className="rounded-full bg-[var(--brand-background)]/95 px-2.5 py-0.5 text-[11px] text-amber-700 shadow" />
      <p className="text-[10px] text-neutral-500">{t('common.illustrativeImages')}</p>
    </div>
  );
}
