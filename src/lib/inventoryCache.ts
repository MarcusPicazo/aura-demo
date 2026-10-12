import { readJson, writeJson } from './storage';
import type { Unit, UnitStatus } from '../types';

/**
 * El último inventario que se pudo bajar, guardado en este dispositivo: si la red falla (o tarda demasiado) se muestra eso, con
 * el aviso de cuándo se sincronizó. Vive en `localStorage` (son unas decenas de unidades) y se valida al leerlo: lo que no
 * tenga la forma esperada se descarta, nunca se confía en él.
 */
export interface InventorySnapshot {
  /** Cuándo se guardó, en milisegundos desde 1970. */
  savedAt: number;
  developmentId: string;
  units: Unit[];
}

const STATUSES: readonly UnitStatus[] = ['available', 'reserved', 'sold'];

const isUnit = (value: unknown): value is Unit => {
  if (typeof value !== 'object' || value === null) return false;
  const unit = value as Record<string, unknown>;
  return (
    typeof unit.id === 'string' &&
    typeof unit.buildingId === 'string' &&
    typeof unit.code === 'string' &&
    typeof unit.type === 'string' &&
    typeof unit.orientation === 'string' &&
    ['floor', 'bedrooms', 'bathrooms', 'm2', 'price'].every((key) => typeof unit[key] === 'number' && Number.isFinite(unit[key])) &&
    STATUSES.includes(unit.status as UnitStatus)
  );
};

/** Valida lo que se leyó del almacenamiento; `null` si no es un inventario completo y reciente de forma. */
export function parseSnapshot(value: unknown): InventorySnapshot | null {
  if (typeof value !== 'object' || value === null) return null;
  const snapshot = value as Record<string, unknown>;
  if (typeof snapshot.savedAt !== 'number' || !Number.isFinite(snapshot.savedAt) || typeof snapshot.developmentId !== 'string') return null;
  if (!Array.isArray(snapshot.units) || snapshot.units.length === 0 || !snapshot.units.every(isUnit)) return null;
  return { savedAt: snapshot.savedAt, developmentId: snapshot.developmentId, units: snapshot.units };
}

const storageKey = (slug: string) => `inventory:${slug}`;

export function readInventorySnapshot(slug: string): InventorySnapshot | null {
  return parseSnapshot(readJson('local', storageKey(slug)));
}

export function writeInventorySnapshot(slug: string, snapshot: InventorySnapshot): void {
  writeJson('local', storageKey(slug), snapshot);
}

/** Cuánto hace de `savedAt`, para el aviso: { unit, count } con la unidad más grande que quepa (minutos, horas o días). */
export function ageOf(savedAt: number, now: number): { unit: 'moment' | 'minutes' | 'hours' | 'days'; count: number } {
  const minutes = Math.floor(Math.max(0, now - savedAt) / 60_000);
  if (minutes < 1) return { unit: 'moment', count: 0 };
  if (minutes < 60) return { unit: 'minutes', count: minutes };
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return { unit: 'hours', count: hours };
  return { unit: 'days', count: Math.floor(hours / 24) };
}
