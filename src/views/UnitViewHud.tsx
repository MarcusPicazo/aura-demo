import { azimuthOfVector, compassKey } from '../lib/solar';
import { useI18n } from '../i18n/useI18n';
import { useLookStore } from '../store/lookStore';

interface UnitViewBackButtonProps {
  onBack: () => void;
}

/** Regreso de la vista desde la unidad a la vista exterior del edificio. */
export function UnitViewBackButton({ onBack }: UnitViewBackButtonProps) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onBack}
      className="pointer-events-auto flex min-h-10 items-center gap-1.5 rounded-xl bg-[var(--brand-background)]/95 px-3 py-1.5 text-xs font-medium text-neutral-900 shadow-lg backdrop-blur sm:text-sm"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" />
      </svg>
      {t('unitView.back')}
    </button>
  );
}

interface UnitViewStatusProps {
  floor: number;
  code: string;
  /** Nombre del edificio; solo en un conjunto. */
  buildingName?: string;
  /** Hacia dónde queda el norte en el plano (`solar.northAngleDeg`); sin él no hay rumbo que decir. */
  northAngleDeg: number | null;
}

/** Dónde se está y hacia qué rumbo se mira, con una brújula que gira al mirar alrededor. */
export function UnitViewStatus({ floor, code, buildingName, northAngleDeg }: UnitViewStatusProps) {
  const { t } = useI18n();
  const yaw = useLookStore((state) => state.yaw);
  const heading = northAngleDeg === null ? null : azimuthOfVector(-Math.sin(yaw), -Math.cos(yaw), northAngleDeg);

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-20 z-10 flex flex-col items-center gap-2">
      <div className="flex items-center gap-3 rounded-full bg-neutral-900/70 py-2 pl-4 pr-4 text-white shadow-lg backdrop-blur">
        {heading !== null && (
          <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden="true">
            <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeOpacity={0.45} />
            {/* La flecha apunta al norte: gira al revés que la cámara. */}
            <g transform={`rotate(${-heading} 16 16)`}>
              <path d="M16 4l4 11h-8z" fill="#f0a35e" />
              <path d="M16 28l-4-11h8z" fill="currentColor" fillOpacity={0.5} />
            </g>
          </svg>
        )}
        <div className="text-left leading-tight">
          <p className="text-xs font-medium sm:text-sm">
            {buildingName ? `${buildingName} · ` : ''}
            {t('unitView.where', { floor, code })}
          </p>
          {heading !== null && (
            <p className="text-[11px] text-white/80 sm:text-xs">
              {t('unitView.looking', { direction: t(`compass.${compassKey(heading)}`), degrees: Math.round(heading) })}
            </p>
          )}
        </div>
      </div>
      <p className="rounded-full bg-neutral-900/55 px-3 py-1 text-[11px] text-white/90 backdrop-blur sm:text-xs">{t('unitView.hint')}</p>
    </div>
  );
}
