import type { Lead, LeadOrigin } from '../types';

export const LEAD_ORIGIN_LABELS: Record<LeadOrigin, string> = {
  whatsapp: 'WhatsApp ("Me interesa")',
  form: 'Formulario de contacto',
};

const dateTimeFormatter = new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' });

export function formatLeadDate(isoDate: string): string {
  return dateTimeFormatter.format(new Date(isoDate));
}

function csvEscape(value: string): string {
  // Regla estándar de CSV: si el campo trae coma, comilla o salto de línea, va entre
  // comillas y las comillas internas se duplican.
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

const CSV_HEADER = ['Fecha', 'Unidad', 'Nombre', 'Teléfono', 'Origen'];

/** CSV para exportar desde /admin/leads — mismas columnas que la tabla en pantalla. */
export function buildLeadsCsv(leads: Lead[]): string {
  const rows = leads.map((lead) => [
    formatLeadDate(lead.createdAt),
    lead.unitCode ?? '',
    lead.name ?? '',
    lead.phone ?? '',
    LEAD_ORIGIN_LABELS[lead.origin],
  ]);
  return [CSV_HEADER, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n');
}
