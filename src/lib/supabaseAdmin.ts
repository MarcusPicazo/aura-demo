import { createClient } from '@supabase/supabase-js';
import { supabaseAnonKey, supabaseUrl } from './env';
import type { Unit } from '../types';

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
