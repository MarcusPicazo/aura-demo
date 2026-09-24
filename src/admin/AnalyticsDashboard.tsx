import { useEffect, useState } from 'react';
import { fetchDevelopmentUnits } from '../lib/supabase';
import { fetchEvents, fetchLeads } from '../lib/supabaseAdmin';
import { leadsPerWeek, topViewedUnits } from '../lib/analytics';
import auraConfigJson from '../config/aura.json';
import type { AnalyticsEvent, DevelopmentConfig, Lead } from '../types';

const auraConfig = auraConfigJson as unknown as DevelopmentConfig;

function formatWeekLabel(weekStartIso: string): string {
  const start = new Date(`${weekStartIso}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const format = (date: Date) => date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  return `${format(start)} – ${format(end)}`;
}

/**
 * Pestaña Analítica del admin: 10 unidades más vistas y leads por semana (se vende como
 * reporte mensual), a partir de los eventos que `lib/analytics.ts` registra en todo el
 * selector público. Protegida por autenticación y RLS igual que Unidades/Leads.
 */
export function AnalyticsDashboard() {
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDevelopmentUnits(auraConfig.slug)
      .then((result) => Promise.all([fetchEvents(result.developmentId), fetchLeads(result.developmentId)]))
      .then(([fetchedEvents, fetchedLeads]) => {
        setEvents(fetchedEvents);
        setLeads(fetchedLeads);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'No se pudo cargar la analítica.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="p-6 text-sm text-neutral-500">Cargando analítica…</p>;
  if (error) return <p className="p-6 text-sm text-red-600">{error}</p>;

  const topUnits = topViewedUnits(events, 10);
  const weeks = leadsPerWeek(leads);
  // Denominador de las barras: al menos 1, para no dividir entre 0 cuando todavía no hay datos.
  const maxUnitViews = Math.max(1, ...topUnits.map((unit) => unit.views));
  const maxWeekCount = Math.max(1, ...weeks.map((week) => week.count));

  return (
    <div className="grid gap-8 p-6 lg:grid-cols-2">
      <section>
        <h2 className="font-serif text-lg text-neutral-900">10 unidades más vistas</h2>
        <p className="mt-1 text-xs text-neutral-500">Veces que se abrió la ficha de cada unidad.</p>
        {topUnits.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-500">Todavía no hay vistas de unidad registradas.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {topUnits.map((unit, index) => (
              <li key={unit.unitCode} className="flex items-center gap-3 text-sm">
                <span className="w-5 text-right text-neutral-400">{index + 1}</span>
                <span className="w-14 font-medium text-neutral-900">{unit.unitCode}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                  <div className="h-full rounded-full bg-neutral-800" style={{ width: `${(unit.views / maxUnitViews) * 100}%` }} />
                </div>
                <span className="w-8 text-right text-neutral-500">{unit.views}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-serif text-lg text-neutral-900">Leads por semana</h2>
        <p className="mt-1 text-xs text-neutral-500">Semana de lunes a domingo.</p>
        {weeks.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-500">Todavía no hay leads registrados.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {weeks.map((week) => (
              <li key={week.weekStart} className="flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0 text-neutral-600">{formatWeekLabel(week.weekStart)}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                  <div className="h-full rounded-full bg-neutral-800" style={{ width: `${(week.count / maxWeekCount) * 100}%` }} />
                </div>
                <span className="w-8 text-right text-neutral-500">{week.count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
