import type { SolarConfig } from '../types';

/**
 * Posición solar para un lugar, una fecha y una hora local — sin librerías: las fórmulas de la hoja de
 * cálculo solar de NOAA (Meeus), con error de centésimas de grado, de sobra para decidir hacia dónde
 * cae una sombra. Todo son funciones puras; el motor y las vistas solo reciben números.
 */

/** Año de referencia: la posición del sol cambia menos de 0.3° de un año a otro, y fijarlo da resultados repetibles. */
const REFERENCE_YEAR = 2026;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

export interface MonthDay {
  month: number;
  day: number;
}

/** `"06-21"` → `{ month: 6, day: 21 }`; `null` si no tiene esa forma o no es una fecha del calendario. */
export function parseMonthDay(value: string): MonthDay | null {
  const match = /^(\d{1,2})-(\d{1,2})$/.exec(value.trim());
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const daysInMonth = new Date(Date.UTC(REFERENCE_YEAR, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth) return null;
  return { month, day };
}

export function formatMonthDay({ month, day }: MonthDay): string {
  return `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Días del año de referencia (no bisiesto): el control de fecha recorre 0 … DAYS_IN_YEAR − 1. */
export const DAYS_IN_YEAR = 365;

/** Posición de la fecha en el año, desde 0 (1 de enero). */
export function dayOfYear({ month, day }: MonthDay): number {
  return Math.round((Date.UTC(REFERENCE_YEAR, month - 1, day) - Date.UTC(REFERENCE_YEAR, 0, 1)) / 86400000);
}

/** Inversa de `dayOfYear`. */
export function monthDayFromDayOfYear(index: number): MonthDay {
  const date = new Date(Date.UTC(REFERENCE_YEAR, 0, 1 + Math.min(DAYS_IN_YEAR - 1, Math.max(0, Math.round(index)))));
  return { month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

/** Día juliano a las 0 h UT de la fecha (año de referencia), más `utcHours` horas. */
function julianDay({ month, day }: MonthDay, utcHours: number): number {
  return Date.UTC(REFERENCE_YEAR, month - 1, day) / 86400000 + 2440587.5 + utcHours / 24;
}

export interface SunPosition {
  /** Grados desde el norte verdadero, en sentido horario (90 = este, 180 = sur, 270 = oeste). */
  azimuthDeg: number;
  /** Grados sobre el horizonte; negativo = bajo el horizonte. */
  elevationDeg: number;
}

type Site = Pick<SolarConfig, 'latitude' | 'longitude' | 'utcOffsetHours'>;

/** Posición del sol a una hora local decimal (16.5 = 4:30 pm) de una fecha del año. */
export function solarPosition(site: Site, date: MonthDay, localHour: number): SunPosition {
  const julianCentury = (julianDay(date, localHour - site.utcOffsetHours) - 2451545) / 36525;

  const meanLongitude = (280.46646 + julianCentury * (36000.76983 + julianCentury * 0.0003032)) % 360;
  const meanAnomaly = 357.52911 + julianCentury * (35999.05029 - 0.0001537 * julianCentury);
  const eccentricity = 0.016708634 - julianCentury * (0.000042037 + 0.0000001267 * julianCentury);

  const anomalyRad = toRadians(meanAnomaly);
  const equationOfCenter =
    Math.sin(anomalyRad) * (1.914602 - julianCentury * (0.004817 + 0.000014 * julianCentury)) +
    Math.sin(2 * anomalyRad) * (0.019993 - 0.000101 * julianCentury) +
    Math.sin(3 * anomalyRad) * 0.000289;
  const trueLongitude = meanLongitude + equationOfCenter;
  const apparentLongitude = trueLongitude - 0.00569 - 0.00478 * Math.sin(toRadians(125.04 - 1934.136 * julianCentury));

  const meanObliquity = 23 + (26 + (21.448 - julianCentury * (46.815 + julianCentury * (0.00059 - julianCentury * 0.001813))) / 60) / 60;
  const obliquity = meanObliquity + 0.00256 * Math.cos(toRadians(125.04 - 1934.136 * julianCentury));
  const declination = Math.asin(Math.sin(toRadians(obliquity)) * Math.sin(toRadians(apparentLongitude)));

  const y = Math.tan(toRadians(obliquity) / 2) ** 2;
  const meanLongitudeRad = toRadians(meanLongitude);
  const equationOfTimeMinutes =
    4 *
    toDegrees(
      y * Math.sin(2 * meanLongitudeRad) -
        2 * eccentricity * Math.sin(anomalyRad) +
        4 * eccentricity * y * Math.sin(anomalyRad) * Math.cos(2 * meanLongitudeRad) -
        0.5 * y * y * Math.sin(4 * meanLongitudeRad) -
        1.25 * eccentricity * eccentricity * Math.sin(2 * anomalyRad),
    );

  // Hora solar verdadera (minutos del día) y ángulo horario (0 = mediodía solar, + por la tarde).
  const trueSolarMinutes = (((localHour * 60 + equationOfTimeMinutes + 4 * site.longitude - 60 * site.utcOffsetHours) % 1440) + 1440) % 1440;
  const hourAngle = trueSolarMinutes / 4 - 180;

  const latitudeRad = toRadians(site.latitude);
  const hourAngleRad = toRadians(hourAngle);
  const cosZenith = Math.sin(latitudeRad) * Math.sin(declination) + Math.cos(latitudeRad) * Math.cos(declination) * Math.cos(hourAngleRad);
  const zenith = Math.acos(Math.min(1, Math.max(-1, cosZenith)));

  const sinZenith = Math.sin(zenith);
  let azimuthDeg: number;
  if (sinZenith < 1e-9) {
    azimuthDeg = 180;
  } else {
    const cosAzimuth = (Math.sin(latitudeRad) * Math.cos(zenith) - Math.sin(declination)) / (Math.cos(latitudeRad) * sinZenith);
    const base = toDegrees(Math.acos(Math.min(1, Math.max(-1, cosAzimuth))));
    azimuthDeg = hourAngle > 0 ? (base + 180) % 360 : (540 - base) % 360;
  }

  return { azimuthDeg, elevationDeg: 90 - toDegrees(zenith) };
}

/**
 * Vector unitario hacia el sol en el mundo de la escena (x = este, y = arriba, z = sur cuando el norte
 * está "arriba" del plano). `northAngleDeg` gira el norte respecto de ese "arriba" (ver `SolarConfig`).
 */
export function sunVector(position: SunPosition, northAngleDeg: number): [number, number, number] {
  const angle = toRadians(position.azimuthDeg + northAngleDeg);
  const elevation = toRadians(position.elevationDeg);
  return [Math.cos(elevation) * Math.sin(angle), Math.sin(elevation), -Math.cos(elevation) * Math.cos(angle)];
}

/** Las 16 direcciones de la rosa de los vientos, de norte a nor-noroeste: son las claves de `compass.*` en los textos. */
export const COMPASS_KEYS = ['n', 'nne', 'ne', 'ene', 'e', 'ese', 'se', 'sse', 's', 'ssw', 'sw', 'wsw', 'w', 'wnw', 'nw', 'nnw'] as const;
export type CompassKey = (typeof COMPASS_KEYS)[number];

/** La dirección (de 16) más cercana a un azimut en grados desde el norte. */
export function compassKey(azimuthDeg: number): CompassKey {
  const index = Math.round((((azimuthDeg % 360) + 360) % 360) / 22.5) % 16;
  return COMPASS_KEYS[index];
}

/** Azimut (grados desde el norte) hacia el que apunta un vector horizontal (x, z) del mundo de la escena. */
export function azimuthOfVector(x: number, z: number, northAngleDeg: number): number {
  // Inverso de `sunVector`: el ángulo medido desde "arriba" (−z), menos cuánto está girado el norte.
  const fromUp = toDegrees(Math.atan2(x, -z));
  return (((fromUp - northAngleDeg) % 360) + 360) % 360;
}

/** Hora local decimal → "4:30 pm" ("4:30 PM" en inglés). */
export function formatClock(hour: number, language: string = 'es'): string {
  const totalMinutes = Math.round(hour * 60);
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const suffix = language === 'en' ? (hours24 >= 12 ? 'PM' : 'AM') : hours24 >= 12 ? 'pm' : 'am';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

/** `{ month: 6, day: 21 }` → "21 de junio" (es-MX) o "June 21" (en-US), según el `locale`. */
export function formatMonthDayLong({ month, day }: MonthDay, locale: string = 'es-MX'): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(new Date(REFERENCE_YEAR, month - 1, day));
}

// ─── Luz de la escena según la altura del sol ────────────────────────────────────────

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** 0 con el sol bajo el horizonte, 1 con el sol alto: cuánta luz directa llega (amanecer y atardecer, gradual). */
export function sunlightStrength(elevationDeg: number): number {
  return smoothstep(-1, 12, elevationDeg);
}

/** Cuánta luz ambiental queda: la del cielo no se apaga de golpe al ponerse el sol. */
export function skylightStrength(elevationDeg: number): number {
  return 0.16 + 0.84 * smoothstep(-8, 20, elevationDeg);
}

/** Color de la luz del sol: dorado cerca del horizonte, blanco cálido arriba (mezcla en el espacio sRGB, canal por canal). */
export function sunlightColor(elevationDeg: number): string {
  const t = smoothstep(2, 28, elevationDeg);
  const low = [255, 170, 110];
  const high = [255, 243, 224];
  const channel = (index: number) => Math.round(low[index] + (high[index] - low[index]) * t);
  return `#${[0, 1, 2].map((i) => channel(i).toString(16).padStart(2, '0')).join('')}`;
}

/** Salida y puesta del sol (horas locales decimales) al cruzar `minElevationDeg`; `null` si el sol no lo cruza ese día. */
export function sunriseSunset(site: Site, date: MonthDay, minElevationDeg = 0): { sunrise: number; sunset: number } | null {
  const step = 1 / 12;
  let sunrise: number | null = null;
  let sunset: number | null = null;
  let previous = solarPosition(site, date, 0).elevationDeg;
  for (let index = 1; index <= 24 * 12; index += 1) {
    const hour = index * step;
    const current = solarPosition(site, date, hour).elevationDeg;
    // Cruce entre dos muestras: se interpola linealmente dentro del paso.
    if (previous < minElevationDeg && current >= minElevationDeg && sunrise === null) {
      sunrise = hour - step + step * ((minElevationDeg - previous) / (current - previous));
    } else if (previous >= minElevationDeg && current < minElevationDeg && sunset === null) {
      sunset = hour - step + step * ((previous - minElevationDeg) / (previous - current));
    }
    previous = current;
  }
  return sunrise !== null && sunset !== null ? { sunrise, sunset } : null;
}
