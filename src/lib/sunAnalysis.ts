import { activeConfig, buildings } from '../config/active';
import { ensembleBounds } from './buildings';
import { neighborBuildingsFor } from './geometry';
import { formatMonthDay, type MonthDay } from './solar';
import { buildingDayLight, createSunModel, daySunSamples, summarizeLight, type DaySun, type SunModel, type SunSite, type SunSummary } from './sunExposure';
import { computeUnitViewPose, type UnitViewPose } from './unitView';
import type { SolarConfig } from '../types';

/**
 * El análisis de sol del desarrollo activo: arma una sola vez el modelo (volúmenes que tapan el sol y
 * muros de cada unidad) y recuerda el resultado por edificio y fecha, así mover la hora del día no
 * recalcula nada y cambiar de unidad dentro de un edificio tampoco.
 */

/** El análisis no existe sin `config.solar` (y sin modelo 3D, que es de donde sale el contexto urbano). */
export const solarConfig: SolarConfig | undefined = activeConfig.context ? activeConfig.solar : undefined;

let model: SunModel | null = null;

function getModel(): SunModel {
  if (model) return model;
  const context = activeConfig.context;
  const neighbors = context ? neighborBuildingsFor(ensembleBounds(buildings), context.street.side, context.neighborBuildings) : [];
  model = createSunModel(buildings, neighbors);
  return model;
}

interface DayAnalysis {
  day: DaySun;
  /** Código de unidad → muestras del día con sol directo. */
  light: Map<string, Uint8Array>;
}

/** Pocas fechas a la vez: el control recorre el año y cada una pesa unos cuantos KB. */
const CACHE_LIMIT = 24;
const cache = new Map<string, DayAnalysis>();

function analyse(solar: SolarConfig, buildingId: string, date: MonthDay): DayAnalysis {
  const key = `${buildingId}|${formatMonthDay(date)}`;
  const cached = cache.get(key);
  if (cached) {
    // Se vuelve a insertar para que lo más usado sea lo último en salir.
    cache.delete(key);
    cache.set(key, cached);
    return cached;
  }
  const day = daySunSamples(solar, date);
  const analysis: DayAnalysis = { day, light: buildingDayLight(getModel(), buildingId, day) };
  cache.set(key, analysis);
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return analysis;
}

/** El resumen de sol de cada unidad de un edificio en una fecha: código → horas, tarde, franja del día. */
export function buildingSunSummaries(buildingId: string, date: MonthDay): Map<string, SunSummary> {
  if (!solarConfig) return new Map();
  const { day, light } = analyse(solarConfig, buildingId, date);
  const site: Pick<SunSite, 'afternoonFromHour' | 'afternoonMinHours'> = solarConfig;
  return new Map([...light].map(([code, lit]) => [code, summarizeLight(lit, day, site)]));
}

/**
 * La pose de la cámara para ver desde una unidad (ojos dentro de la unidad, mirando hacia afuera), o `null` si el
 * desarrollo no configura `unitView` o la unidad no tiene muros exteriores. Usa el mismo modelo que el análisis de sol:
 * la vista sale de ver qué tan abierto da cada muro contra el conjunto y los vecinos.
 */
export function unitViewPoseFor(buildingId: string, code: string): UnitViewPose | null {
  const config = activeConfig.unitView;
  if (!config) return null;
  const sunModel = getModel();
  const probe = sunModel.probes.get(buildingId)?.find((candidate) => candidate.code === code);
  if (!probe) return null;
  return computeUnitViewPose(probe, sunModel.occluders, config, activeConfig.solar?.northAngleDeg ?? 0);
}
