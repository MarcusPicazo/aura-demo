import { supabaseAdmin } from '../../lib/supabaseAdmin';

/**
 * El portal reutiliza el MISMO cliente autenticado que ya usa /admin
 * (`src/lib/supabaseAdmin.ts`) en vez de crear uno propio: dos instancias de
 * `createClient()` con Auth en la misma pestaña compiten por la misma sesión guardada
 * en localStorage ("Multiple GoTrueClient instances" — Supabase lo marca como error de
 * uso, no una advertencia cosmética). Un solo cliente, una sola sesión real.
 */
export { supabaseAdmin };

/** Slug del desarrollo activo (src/config/aura.json). El portal es de este cliente en
 *  particular — igual que /admin ya asume `aura` al importar el config directamente. */
export const DEVELOPMENT_SLUG = 'aura';

/**
 * Otra sesión está agregando soporte para múltiples edificios por desarrollo
 * (`supabase/migrations/20261005120000_add_units_building.sql`, `units.building_id`,
 * `src/lib/buildings.ts`). `src/config/aura.json` ya declara el conjunto completo:
 * "torre-aura" (la torre de este portal), "torre-jacaranda" y "casa-club" (no vendible).
 *
 * El portal administra solo "torre-aura" por ahora — el código de unidad (`code`) deja
 * de ser único por desarrollo y pasa a serlo por (desarrollo, edificio); extender el
 * portal a Torre Jacaranda también significa agregar esa dimensión a cada pantalla que
 * hoy busca una unidad solo por código (inventario, ficha, apartados...), no solo
 * cambiar esta constante. Queda como su propia tarea cuando haga falta.
 */
export const BUILDING_ID = 'torre-aura';

let cachedDevelopmentId: string | null = null;

/** El id del desarrollo no cambia en la vida de la pestaña — se resuelve una sola vez
 *  y se reutiliza, en vez de una consulta extra por cada acción del store. */
export async function getDevelopmentId(): Promise<string> {
  if (cachedDevelopmentId) return cachedDevelopmentId;

  const { data, error } = await supabaseAdmin.from('developments').select('id').eq('slug', DEVELOPMENT_SLUG).single();
  if (error) throw error;
  if (!data) throw new Error(`No se encontró el desarrollo "${DEVELOPMENT_SLUG}".`);

  cachedDevelopmentId = data.id;
  return data.id;
}
