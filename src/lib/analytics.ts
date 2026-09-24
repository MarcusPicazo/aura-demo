import { rest } from './supabase';
import type { AnalyticsEvent, AnalyticsEventType, Lead } from '../types';

interface TrackEventInput {
  developmentId: string;
  type: AnalyticsEventType;
  unitId?: string | null;
  /** Contexto libre por tipo de evento (p. ej. los filtros activos en `filter_used`). */
  metadata?: Record<string, unknown>;
}

/**
 * Analítica ligera (se vende como reporte mensual, ver /admin → Analítica): un insert por
 * evento a la tabla `events`. Deliberadamente "fire and forget" (no se espera ni se
 * propaga el error al que llama) — la experiencia del prospecto nunca debe depender de
 * que esto funcione; si falla (sin conexión, RLS, lo que sea) solo se registra en consola,
 * igual que ya hace `createLead` para el lead de "Me interesa".
 */
export function trackEvent({ developmentId, type, unitId, metadata }: TrackEventInput): void {
  rest
    .from('events')
    .insert({ development_id: developmentId, unit_id: unitId ?? null, type, metadata: metadata ?? null })
    .then(({ error }) => {
      if (error) console.error(`No se pudo registrar el evento "${type}":`, error);
    });
}

export interface TopViewedUnit {
  unitCode: string;
  views: number;
}

/**
 * Reporte "10 unidades más vistas" (/admin → Analítica): cuenta eventos `unit_view` por
 * código de unidad a partir de los eventos ya traídos por `fetchEvents` (agregación del
 * lado del cliente, no SQL — a esta escala, unos cuantos cientos de filas, es más simple
 * que mantener una vista/RPC en Supabase solo para esto). Función pura: sin este archivo
 * no sabe nada de Supabase más que `trackEvent`, esto solo procesa datos ya en memoria.
 */
export function topViewedUnits(events: AnalyticsEvent[], limit = 10): TopViewedUnit[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    if (event.type !== 'unit_view' || !event.unitCode) continue;
    counts.set(event.unitCode, (counts.get(event.unitCode) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([unitCode, views]) => ({ unitCode, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, limit);
}

export interface WeeklyLeadCount {
  /** Lunes de esa semana, ISO (YYYY-MM-DD) — clave estable para ordenar y mostrar. */
  weekStart: string;
  count: number;
}

/** Lunes (00:00 hora local) de la semana ISO que contiene `date` — semana de lunes a
 *  domingo, no domingo a sábado. */
function mondayOf(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay(); // 0 domingo .. 6 sábado
  const diffToMonday = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diffToMonday);
  result.setHours(0, 0, 0, 0);
  return result;
}

/** Reporte "leads por semana" (/admin → Analítica): agrupa leads de la semana más antigua
 *  a la más reciente. Igual que `topViewedUnits`, función pura sobre datos ya traídos. */
export function leadsPerWeek(leads: Lead[]): WeeklyLeadCount[] {
  const counts = new Map<string, number>();
  for (const lead of leads) {
    const weekStart = mondayOf(new Date(lead.createdAt)).toISOString().slice(0, 10);
    counts.set(weekStart, (counts.get(weekStart) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([weekStart, count]) => ({ weekStart, count }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}
