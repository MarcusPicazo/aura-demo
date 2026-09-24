-- Analítica ligera (se vende como reporte mensual al cliente): vistas del selector,
-- unidades más vistas, filtros usados, clics en "Me interesa", leads enviados y visitas a
-- la sección de proyecto. Sin servicio externo (PostHog, etc.): el proyecto ya trae
-- Supabase, así que un insert por evento aquí no exige gestionar otra cuenta/API key
-- aparte, y el tablero de /admin puede leer los eventos con el mismo cliente autenticado
-- que ya usa leads/units — no hace falta un backend intermedio para no exponer una API key
-- de análisis en el bundle público.
create table events (
  id uuid primary key default gen_random_uuid(),
  development_id uuid references developments(id) on delete cascade,
  unit_id uuid references units(id),
  type text not null check (type in (
    'selector_view',
    'unit_view',
    'filter_used',
    'interest_click',
    'lead_submitted',
    'project_view'
  )),
  -- Contexto libre por tipo de evento (p. ej. los filtros activos en `filter_used`).
  -- Opcional: la mayoría de los tipos no lo necesitan.
  metadata jsonb,
  created_at timestamptz default now()
);

-- El tablero agrupa por desarrollo+tipo (para las 10 unidades más vistas) y por fecha
-- (para el conteo de leads/eventos por semana) — un índice para cada uno de esos accesos.
create index events_development_id_idx on events (development_id);
create index events_type_idx on events (type);
create index events_created_at_idx on events (created_at);

alter table events enable row level security;

-- Mismo criterio que `leads`: cualquiera (el selector público, sin sesión) puede insertar
-- un evento; solo un usuario autenticado (el admin) puede leerlos.
create policy "Insert público de events"
  on events for insert
  to anon, authenticated
  with check (true);

create policy "Autenticados leen events"
  on events for select
  to authenticated
  using ((select auth.role()) = 'authenticated');
