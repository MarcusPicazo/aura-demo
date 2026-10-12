// ¿Qué migraciones de `supabase/migrations/` ya están aplicadas en la base real? Revisión de SOLO LECTURA con la llave pública
// (la misma que usa el sitio): pide 0 filas de cada tabla o columna que las migraciones agregan. No escribe nada ni imprime
// la llave. Úsalo antes de publicar y después de correr las migraciones en el SQL Editor del dashboard de Supabase.
//
// Uso (desde la raíz del repo):  node scripts/check-db.cjs
const fs = require('fs');
const path = require('path');

const env = fs.readFileSync(path.resolve('.env.local'), 'utf8');
const read = (name) => (env.match(new RegExp(`^${name}=(.*)$`, 'm')) || [])[1]?.trim();
const url = read('VITE_SUPABASE_URL');
const key = read('VITE_SUPABASE_ANON_KEY');
if (!url || !key) {
  console.error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env.local');
  process.exit(1);
}

// [migración, qué agrega, consulta de 0 filas, quién la necesita]
const CHECKS = [
  ['20260921180000_init_schema', 'developments, units, leads', 'units?select=id&limit=0', 'sitio'],
  ['20260923060000_add_lead_consent_and_origin', 'leads.origin y consent_at (sin esto NO se guardan los leads)', 'leads?select=origin,consent_at&limit=0', 'sitio'],
  ['20260924120000_add_events_table', 'tabla events (analítica)', 'events?select=id&limit=0', 'sitio'],
  ['20261005120000_add_units_building', 'units.building_id (conjuntos)', 'units?select=building_id&limit=0', 'sitio'],
  ['20260928130000_portal_comercial_schema', 'portal: team_members, holds, approvals…', 'team_members?select=id&limit=0', 'portal'],
];

(async () => {
  let missingForSite = 0;
  for (const [migration, adds, query, needed] of CHECKS) {
    const response = await fetch(`${url}/rest/v1/${query}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    const body = response.ok ? null : await response.json().catch(() => ({}));
    // 200 = existe; 401/403 o 42501 = existe pero la política no deja leer; 400 (columna) o 404 (tabla) = falta.
    const exists = response.ok || response.status === 401 || response.status === 403 || body?.code === '42501';
    if (!exists && needed === 'sitio') missingForSite += 1;
    console.log(`${exists ? 'OK    ' : needed === 'sitio' ? 'FALTA ' : 'falta '} ${migration}  —  ${adds}  [${needed}]`);
  }
  if (missingForSite > 0) {
    console.log('\nFaltan migraciones que el sitio público necesita: córrelas, en este orden, en Supabase → SQL Editor → New query.');
    process.exitCode = 1;
  } else {
    console.log('\nLa base tiene todo lo que necesita el sitio público.');
  }
})();
