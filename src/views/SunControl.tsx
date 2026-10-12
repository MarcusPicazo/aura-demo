import { useMemo, useState } from 'react';
import {
  DAYS_IN_YEAR,
  compassKey,
  dayOfYear,
  formatClock,
  formatMonthDayLong,
  monthDayFromDayOfYear,
  parseMonthDay,
  solarPosition,
  sunriseSunset,
} from '../lib/solar';
import { SUN_MAP_COLORS } from '../lib/sunMap';
import { useSunStore } from '../store/sunStore';
import { useI18n } from '../i18n/useI18n';
import type { SolarConfig } from '../types';

interface SunControlProps {
  solar: SolarConfig;
  /** El mapa de sol de tarde pinta las unidades de un edificio: en el masterplan no hay unidades que pintar. */
  allowAfternoonMap: boolean;
}

/** Paso del control de hora, en horas (cuarto de hora). */
const HOUR_STEP = 0.25;

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" />
    </svg>
  );
}

/**
 * Asoleamiento: enciende el sol real de la escena y deja mover la hora del día y la fecha del año (con atajos a los
 * solsticios y al equinoccio). Mover la hora cambia al instante la luz y la sombra de cada fachada; "sol de tarde"
 * pinta en el edificio las unidades que reciben sol después de `afternoonFromHour`. Todo sale de `config.solar`.
 */
export function SunControl({ solar, allowAfternoonMap }: SunControlProps) {
  const { t, text, language, locale } = useI18n();
  const enabled = useSunStore((state) => state.enabled);
  const date = useSunStore((state) => state.date);
  const hour = useSunStore((state) => state.hour);
  const afternoonMap = useSunStore((state) => state.afternoonMap);
  const setEnabled = useSunStore((state) => state.setEnabled);
  const setDate = useSunStore((state) => state.setDate);
  const setHour = useSunStore((state) => state.setHour);
  const setAfternoonMap = useSunStore((state) => state.setAfternoonMap);

  // Con el sol encendido el panel se puede plegar (sigue encendido) para ver la escena completa en una pantalla chica.
  const [expanded, setExpanded] = useState(true);

  const position = useMemo(() => solarPosition(solar, date, hour), [solar, date, hour]);
  const daylight = useMemo(() => sunriseSunset(solar, date, 0), [solar, date]);
  const aboveHorizon = position.elevationDeg > 0;
  const [firstHour, lastHour] = solar.hourRange;

  return (
    <div className="pointer-events-auto flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => {
          if (!enabled) {
            setEnabled(true);
            setExpanded(true);
          } else {
            setExpanded(!expanded);
          }
        }}
        aria-pressed={enabled}
        aria-expanded={enabled ? expanded : undefined}
        className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium shadow-lg backdrop-blur sm:px-3 sm:py-2 sm:text-sm ${
          enabled ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--brand-background)]/95 text-neutral-900'
        }`}
      >
        <SunIcon />
        {t('sun.button')}
        {enabled && !expanded && <span className="font-normal tabular-nums">· {formatClock(hour, language)}</span>}
      </button>

      {enabled && expanded && (
        <div className="w-[min(19rem,calc(100vw-2rem))] space-y-3 rounded-xl bg-[var(--brand-background)]/95 p-3 text-xs text-neutral-800 shadow-lg backdrop-blur sm:text-sm">
          <div>
            <label htmlFor="sun-hour" className="flex items-baseline justify-between font-medium">
              <span>{t('sun.hour')}</span>
              <span className="tabular-nums">{formatClock(hour, language)}</span>
            </label>
            <input
              id="sun-hour"
              type="range"
              min={firstHour}
              max={lastHour}
              step={HOUR_STEP}
              value={hour}
              onChange={(event) => setHour(Number(event.target.value))}
              className="mt-1 h-6 w-full accent-[var(--brand-primary)]"
            />
          </div>

          <div>
            <label htmlFor="sun-date" className="flex items-baseline justify-between font-medium">
              <span>{t('sun.date')}</span>
              <span>{formatMonthDayLong(date, locale)}</span>
            </label>
            <input
              id="sun-date"
              type="range"
              min={0}
              max={DAYS_IN_YEAR - 1}
              step={1}
              value={dayOfYear(date)}
              onChange={(event) => setDate(monthDayFromDayOfYear(Number(event.target.value)))}
              className="mt-1 h-6 w-full accent-[var(--brand-primary)]"
            />
            <div className="mt-1 flex flex-wrap gap-1.5">
              {solar.presets.map((preset) => {
                const presetDate = parseMonthDay(preset.date);
                if (!presetDate) return null;
                const active = presetDate.month === date.month && presetDate.day === date.day;
                return (
                  <button
                    key={preset.date}
                    type="button"
                    onClick={() => setDate(presetDate)}
                    aria-pressed={active}
                    className={`rounded-full border px-2 py-0.5 text-[11px] sm:text-xs ${
                      active ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white' : 'border-neutral-300 text-neutral-700'
                    }`}
                  >
                    {text(preset.label)}
                  </button>
                );
              })}
            </div>
          </div>

          <p className="border-t border-neutral-200 pt-2 text-[11px] text-neutral-600 sm:text-xs">
            {aboveHorizon
              ? t('sun.position', { elevation: Math.round(position.elevationDeg), direction: t(`compass.${compassKey(position.azimuthDeg)}`) })
              : t('sun.belowHorizon')}
            {daylight && ` ${t('sun.daylight', { sunrise: formatClock(daylight.sunrise, language), sunset: formatClock(daylight.sunset, language) })}`}
          </p>

          {allowAfternoonMap && (
            <div className="border-t border-neutral-200 pt-2">
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  checked={afternoonMap}
                  onChange={(event) => setAfternoonMap(event.target.checked)}
                  className="mt-0.5 accent-[var(--brand-primary)]"
                />
                <span className="font-medium">{t('sun.afternoonMap')}</span>
              </label>
              {afternoonMap && (
                <ul className="mt-1.5 space-y-1 text-[11px] text-neutral-600 sm:text-xs">
                  <li className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: SUN_MAP_COLORS.afternoon }} />
                    {t('sun.legendAfternoon', { hours: solar.afternoonMinHours, from: formatClock(solar.afternoonFromHour, language) })}
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: SUN_MAP_COLORS.none }} />
                    {t('sun.legendNone')}
                  </li>
                </ul>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setEnabled(false)}
            className="w-full border-t border-neutral-200 pt-2 text-left text-[11px] text-neutral-500 underline-offset-2 hover:underline sm:text-xs"
          >
            {t('sun.off')}
          </button>
        </div>
      )}
    </div>
  );
}
