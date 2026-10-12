import { formatClock } from '../lib/solar';
import type { SunSummary } from '../lib/sunExposure';
import { SUN_MAP_COLORS } from '../lib/sunMap';
import { useI18n } from '../i18n/useI18n';

export interface UnitSunInfo {
  summary: SunSummary;
  /** La fecha del análisis en palabras ("21 de junio"). */
  dateLabel: string;
  /** Horas del día que cubre la franja (las del control de hora). */
  hourRange: [number, number];
  afternoonFromHour: number;
  afternoonMinHours: number;
}

/** Una cifra de horas a la media hora ("7.5"), sin ceros inútiles. */
function roundedHours(hours: number): string {
  const rounded = Math.round(hours * 2) / 2;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * Horas de sol directo estimadas de una unidad en la fecha elegida, con una franja del día que muestra cuándo le entra
 * y si recibe sol de tarde. Es una estimación sobre el modelo 3D del conjunto y su entorno: no cuenta árboles, nubes ni
 * voladizos, y así se dice en la propia ficha.
 */
export function SunHoursIndicator({ info }: { info: UnitSunInfo }) {
  const { t, language } = useI18n();
  const formatHours = (hours: number) => t('sunHours.hours', { hours: roundedHours(hours) });
  const { summary, dateLabel, hourRange, afternoonFromHour, afternoonMinHours } = info;
  const firstHour = Math.floor(hourRange[0]);
  const lastHour = Math.ceil(hourRange[1]);
  const cells = Array.from({ length: Math.max(1, lastHour - firstHour) }, (_, index) => firstHour + index);

  return (
    <section className="mt-4 rounded-xl bg-neutral-100 p-3" aria-label={t('sunHours.aria')}>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{t('sunHours.title')}</p>
      <p className="mt-0.5 flex items-baseline gap-1.5">
        <span className="font-serif text-2xl text-neutral-900">{summary.directHours > 0 ? formatHours(summary.directHours) : t('sunHours.none')}</span>
        <span className="text-sm text-neutral-500">{t('sunHours.onDate', { date: dateLabel })}</span>
      </p>

      <div className="mt-2" role="img" aria-label={t('sunHours.strip', { from: formatClock(firstHour, language), to: formatClock(lastHour, language) })}>
        <div className="flex h-3 gap-px overflow-hidden rounded-sm bg-neutral-200">
          {cells.map((hour) => {
            const fraction = Math.max(0, Math.min(1, summary.hourly[hour] ?? 0));
            return (
              <span
                key={hour}
                className="flex-1"
                // Una hora con sol a medias se ve a medias; las horas sin sol dejan ver el fondo gris.
                style={fraction > 0 ? { backgroundColor: SUN_MAP_COLORS.afternoon, opacity: 0.35 + 0.65 * fraction } : undefined}
              />
            );
          })}
        </div>
        <div className="relative mt-0.5 h-3 text-[10px] text-neutral-500">
          <span className="absolute left-0">{formatClock(firstHour, language)}</span>
          {/* La marca de la tarde queda donde empieza la tarde en la franja, no al centro. */}
          <span className="absolute -translate-x-1/2" style={{ left: `${((afternoonFromHour - firstHour) / cells.length) * 100}%` }}>
            {formatClock(afternoonFromHour, language)}
          </span>
          <span className="absolute right-0">{formatClock(lastHour, language)}</span>
        </div>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-y-0.5 text-sm">
        <dt className="text-neutral-500">{t('sunHours.morning')}</dt>
        <dd className="text-right text-neutral-900">{summary.morningHours > 0 ? formatHours(summary.morningHours) : '—'}</dd>
        <dt className="text-neutral-500">{t('sunHours.afternoon', { from: formatClock(afternoonFromHour, language) })}</dt>
        <dd className="text-right text-neutral-900">{summary.afternoonHours > 0 ? formatHours(summary.afternoonHours) : '—'}</dd>
        <dt className="text-neutral-500">{t('sunHours.afternoonSun')}</dt>
        <dd className="text-right font-medium text-neutral-900">{summary.afternoon ? t('sunHours.yes') : t('sunHours.noLess', { hours: afternoonMinHours })}</dd>
      </dl>
      <p className="mt-2 text-[11px] leading-snug text-neutral-500">
        {t('sunHours.disclaimer')}
      </p>
    </section>
  );
}
