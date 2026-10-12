import { activeConfig, buildings, unitIdentity } from '../config/active';
import { findUnitPolygon } from './geometry';
import { availableModes, usableRenderOf } from './modes';
import { calculatePaymentPlan } from './pricing';
import { RENDER_BASE_PATH, locateUnit, renderPath, unitMediaKey } from './render';
import type { I18n } from '../i18n/useI18n';
import type { ResolvedBuilding } from './buildings';
import type { FloorPlanConfig, Point, Unit } from '../types';

export interface UnitDetails {
  unit: Unit;
  building: ResolvedBuilding | undefined;
  /** Nombre del edificio; solo en un conjunto, donde el código solo no basta para ubicar la unidad. */
  buildingName: string | undefined;
  /** Contorno de la unidad en su planta y el plano que lo acompaña, para dibujarlo. */
  polygon: Point[] | undefined;
  floorPlan: FloorPlanConfig | undefined;
  /** Precio por metro cuadrado, redondeado a pesos. */
  pricePerM2: number;
  /** Mensualidad durante la obra con el enganche indicado, y cuántas son. */
  monthlyPayment: number;
  monthsCount: number;
}

/**
 * Todo lo que el comparador, los favoritos y la cotización necesitan saber de una unidad además de sus datos de
 * inventario: su edificio, su plano y sus números derivados. La mensualidad usa el esquema de pagos del desarrollo
 * con `downPaymentPercent` (por omisión, el enganche inicial de la config).
 */
export function describeUnit(i18n: I18n, unit: Unit, downPaymentPercent: number = activeConfig.paymentPlan.downPaymentPercent): UnitDetails {
  const building = buildings.find((candidate) => candidate.id === unit.buildingId);
  const planKey = unitMediaKey(unit, activeConfig.floorPlans);
  const plan = activeConfig.paymentPlan;
  const schedule = calculatePaymentPlan(unit.price, downPaymentPercent, plan.balanceAtDeliveryPercent, plan.constructionMonths);
  return {
    unit,
    building,
    buildingName: unitIdentity.multi && building ? i18n.text(building.name) : undefined,
    polygon: building ? findUnitPolygon(building.geometry, unit) : undefined,
    floorPlan: planKey ? activeConfig.floorPlans[planKey] : undefined,
    pricePerM2: unit.m2 > 0 ? Math.round(unit.price / unit.m2) : 0,
    monthlyPayment: schedule.monthlyPayment,
    monthsCount: schedule.monthsCount,
  };
}

/** "Torre Aura · 604" en un conjunto; "604" con una sola torre. */
export function unitLabel(i18n: I18n, unit: Unit): string {
  const building = unitIdentity.multi ? buildings.find((candidate) => candidate.id === unit.buildingId) : undefined;
  return building ? `${i18n.text(building.name)} · ${unit.code}` : unit.code;
}

/** Dónde se abre la unidad: su ruta en el selector 3D o, sin modelo 3D, en el modo render. */
export function unitLink(unit: Unit): string {
  const modes = availableModes(activeConfig);
  if (modes.tower3d) return unitIdentity.path(unit);
  const render = usableRenderOf(activeConfig);
  if (!render) return '/aura/proyecto';
  return renderPath(locateUnit(render, unit, unitIdentity.param(unit)));
}

/** A dónde cae quien abre el sitio: el selector 3D, o el render, o la página del proyecto según lo que el desarrollo ofrezca. */
export function homePath(): string {
  const modes = availableModes(activeConfig);
  return modes.tower3d ? '/aura' : modes.render ? RENDER_BASE_PATH : '/aura/proyecto';
}
