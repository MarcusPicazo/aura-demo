import { createClient } from '@supabase/supabase-js';
import { supabaseAnonKey, supabaseUrl } from './env';
import type { Lead, LeadOrigin, Unit } from '../types';

/**
 * Cliente completo (con Auth) para /admin. Deliberadamente en su propio archivo: solo
 * lo importan Login/AdminPage/UnitsTable, que ya están detrás de `React.lazy()` en
 * App.tsx, así que Auth/Storage/Functions (~450 KB sin minificar) nunca llegan al bundle
 * inicial del selector público. Ver `src/lib/supabase.ts` para el cliente ligero.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey);

/** SPEC §4.1: el admin edita estado y/o precio. RLS exige un usuario autenticado. */
export async function updateUnit(unitId: string, changes: Partial<Pick<Unit, 'status' | 'price'>>): Promise<void> {
  const { error } = await supabaseAdmin.from('units').update(changes).eq('id', unitId);
  if (error) throw error;
}

interface LeadRow {
  id: string;
  created_at: string;
  name: string | null;
  phone: string | null;
  origin: LeadOrigin;
  consent_at: string | null;
  units: { code: string } | null;
}

/** Pestaña Leads del admin: RLS solo deja leer `leads` a usuarios autenticados. */
export async function fetchLeads(developmentId: string): Promise<Lead[]> {
  const { data, error } = await supabaseAdmin
    .from('leads')
    .select('id, created_at, name, phone, origin, consent_at, units(code)')
    .eq('development_id', developmentId)
    .order('created_at', { ascending: false })
    .returns<LeadRow[]>();

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    unitCode: row.units?.code ?? null,
    name: row.name,
    phone: row.phone,
    origin: row.origin,
    consentAt: row.consent_at,
  }));
}
