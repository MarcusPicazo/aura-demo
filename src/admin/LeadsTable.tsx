import { useEffect, useMemo, useState } from 'react';
import { fetchDevelopmentUnits } from '../lib/supabase';
import { fetchLeads } from '../lib/supabaseAdmin';
import { buildLeadsCsv, formatLeadDate, LEAD_ORIGIN_LABELS } from '../lib/leads';
import auraConfigJson from '../config/aura.json';
import type { DevelopmentConfig, Lead, LeadOrigin } from '../types';

const auraConfig = auraConfigJson as unknown as DevelopmentConfig;

type OriginFilter = 'all' | LeadOrigin;
const ORIGIN_FILTERS: OriginFilter[] = ['all', 'whatsapp', 'form'];

function matchesSearch(lead: Lead, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return [lead.name, lead.phone, lead.unitCode].some((field) => field?.toLowerCase().includes(needle));
}

function downloadCsv(csv: string, filename: string): void {
  // BOM al inicio: sin él, Excel abre acentos (é, ó...) como caracteres sueltos en vez de UTF-8.
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Pestaña Leads del admin: fecha, unidad, nombre, teléfono y origen de cada lead
 *  (SPEC §2/§4.1), con filtro por origen, buscador y exportación a CSV. Protegida por
 *  autenticación (ruta anidada en `/admin`, detrás de `Login`) y por RLS (`fetchLeads`
 *  solo puede leer `leads` con una sesión autenticada). */
export function LeadsTable() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [originFilter, setOriginFilter] = useState<OriginFilter>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchDevelopmentUnits(auraConfig.slug)
      .then((result) => fetchLeads(result.developmentId))
      .then(setLeads)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'No se pudieron cargar los leads.'))
      .finally(() => setLoading(false));
  }, []);

  const filteredLeads = useMemo(
    () =>
      leads.filter((lead) => (originFilter === 'all' || lead.origin === originFilter) && matchesSearch(lead, search)),
    [leads, originFilter, search],
  );

  function handleExportCsv() {
    const csv = buildLeadsCsv(filteredLeads);
    downloadCsv(csv, `leads-${auraConfig.slug}-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  if (loading) return <p className="p-6 text-sm text-neutral-500">Cargando leads…</p>;
  if (error) return <p className="p-6 text-sm text-red-600">{error}</p>;

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={originFilter}
          onChange={(event) => setOriginFilter(event.target.value as OriginFilter)}
          className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
        >
          {ORIGIN_FILTERS.map((filter) => (
            <option key={filter} value={filter}>
              {filter === 'all' ? 'Todos los orígenes' : LEAD_ORIGIN_LABELS[filter]}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nombre, teléfono o unidad"
          className="min-w-64 flex-1 rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={filteredLeads.length === 0}
          className="rounded-full bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Exportar CSV
        </button>
      </div>

      <p className="mt-3 text-xs text-neutral-500">
        {filteredLeads.length} de {leads.length} leads
      </p>

      <div className="mt-2 overflow-x-auto">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-neutral-500">
              <th className="py-2 pr-4">Fecha</th>
              <th className="py-2 pr-4">Unidad</th>
              <th className="py-2 pr-4">Nombre</th>
              <th className="py-2 pr-4">Teléfono</th>
              <th className="py-2 pr-4">Origen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filteredLeads.map((lead) => (
              <tr key={lead.id}>
                <td className="py-2 pr-4 text-neutral-600">{formatLeadDate(lead.createdAt)}</td>
                <td className="py-2 pr-4 font-medium text-neutral-900">{lead.unitCode ?? '—'}</td>
                <td className="py-2 pr-4 text-neutral-600">{lead.name ?? '—'}</td>
                <td className="py-2 pr-4 text-neutral-600">{lead.phone ?? '—'}</td>
                <td className="py-2 pr-4 text-neutral-600">{LEAD_ORIGIN_LABELS[lead.origin]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredLeads.length === 0 && <p className="py-6 text-center text-sm text-neutral-500">Sin leads que coincidan.</p>}
      </div>
    </div>
  );
}
