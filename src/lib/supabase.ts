import { PostgrestClient } from '@supabase/postgrest-js';
import { RealtimeClient } from '@supabase/realtime-js';
import { supabaseAnonKey, supabaseUrl } from './env';
import type { LeadOrigin, Unit, UnitStatus } from '../types';

/**
 * Cliente ligero para el selector público: solo Postgrest + Realtime, sin Auth/Storage/
 * Functions. `@supabase/supabase-js` completo construye los cinco siempre (aunque nunca
 * uses `.auth` o `.storage`), y Auth por sí solo pesa ~300 KB — nada de eso lo necesita
 * un prospecto viendo la torre. El cliente completo (con Auth) vive en
 * `src/lib/supabaseAdmin.ts`, que solo importa el código ya diferido de /admin.
 * Este es el patrón "standalone import" que la propia documentación de Supabase
 * recomienda para apps sensibles al tamaño del bundle.
 */
const restUrl = new URL('rest/v1', supabaseUrl).href;
const realtimeUrl = new URL('realtime/v1', supabaseUrl);
realtimeUrl.protocol = realtimeUrl.protocol.replace('http', 'ws');

const authHeaders = {
  apikey: supabaseAnonKey,
  Authorization: `Bearer ${supabaseAnonKey}`,
};

// Exportado: `lib/analytics.ts` lo reutiliza para insertar eventos — mismo cliente ligero,
// sin duplicar la configuración de URL/headers.
export const rest = new PostgrestClient(restUrl, { headers: authHeaders });

const realtime = new RealtimeClient(realtimeUrl.href, {
  params: { apikey: supabaseAnonKey },
});
realtime.connect();

interface DevelopmentUnitsRow {
  id: string;
  units: Unit[];
}

export interface DevelopmentUnitsResult {
  developmentId: string;
  units: Unit[];
}

/**
 * Trae el desarrollo publicado (por slug) y sus unidades en un solo round trip.
 * RLS exige `developments.published = true`; si el desarrollo no existe o no está
 * publicado, Supabase simplemente no devuelve la fila (no es un error de RLS).
 */
export async function fetchDevelopmentUnits(slug: string): Promise<DevelopmentUnitsResult> {
  const { data, error } = await rest
    .from('developments')
    .select('id, units(id, code, floor, type, bedrooms, bathrooms, m2, price, orientation, status)')
    .eq('slug', slug)
    .single<DevelopmentUnitsRow>();

  if (error) throw error;
  if (!data) throw new Error(`No se encontró el desarrollo "${slug}" (¿existe y está publicado?).`);

  return { developmentId: data.id, units: data.units };
}

interface CreateLeadInput {
  developmentId: string;
  unitId: string;
  name?: string | null;
  phone?: string | null;
  origin: LeadOrigin;
  /** ISO 8601; solo el formulario de contacto lo manda (su casilla de consentimiento es
   *  obligatoria) — "Me interesa" no recolecta datos personales, así que no aplica. */
  consentAt?: string;
}

/** SPEC §2/§4.1: el lead se guarda al presionar "Me interesa", o desde el formulario opcional. */
export async function createLead(input: CreateLeadInput): Promise<void> {
  const { error } = await rest.from('leads').insert({
    development_id: input.developmentId,
    unit_id: input.unitId,
    name: input.name || null,
    phone: input.phone || null,
    origin: input.origin,
    consent_at: input.consentAt ?? null,
  });

  if (error) throw error;
}

interface UnitsRealtimeRow {
  id: string;
  code: string;
  floor: number;
  type: string;
  bedrooms: number;
  bathrooms: number | string;
  m2: number | string;
  price: number | string;
  orientation: string | null;
  status: UnitStatus;
}

/** `numeric` de Postgres puede llegar como string por WAL/Realtime; se normaliza a número. */
function toUnit(row: UnitsRealtimeRow): Unit {
  return {
    id: row.id,
    code: row.code,
    floor: row.floor,
    type: row.type,
    bedrooms: row.bedrooms,
    bathrooms: Number(row.bathrooms),
    m2: Number(row.m2),
    price: Number(row.price),
    orientation: row.orientation ?? '',
    status: row.status,
  };
}

/**
 * SPEC §2 (momento 3): cuando el admin cambia una unidad, el selector se entera al
 * instante sin recargar. Devuelve una función para cancelar la suscripción.
 */
export function subscribeToUnitChanges(developmentId: string, onChange: (unit: Unit) => void): () => void {
  const channel = realtime
    .channel(`units-changes-${developmentId}`)
    .on<UnitsRealtimeRow>(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'units', filter: `development_id=eq.${developmentId}` },
      (payload) => {
        if (payload.eventType === 'UPDATE') onChange(toUnit(payload.new));
      },
    )
    .subscribe();

  return () => {
    void realtime.removeChannel(channel);
  };
}
