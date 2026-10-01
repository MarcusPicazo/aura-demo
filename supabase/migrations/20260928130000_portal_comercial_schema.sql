-- Esquema para el portal comercial (src/portal/): panel privado de ventas y
-- administración. Hasta ahora el portal corría sobre datos de ejemplo en memoria
-- (Zustand); esta migración agrega lo que falta para que lea y escriba contra el mismo
-- Supabase que ya usa el selector público, cumpliendo el "momento 3" de SPEC §2 de
-- verdad: un cambio del admin se refleja al instante en cualquier pantalla abierta,
-- incluida la torre 3D pública.
--
-- Reutiliza `leads` como la entidad "prospecto" del CRM (un WhatsApp/formulario del
-- selector público y un prospecto que un asesor da seguimiento son la misma fila en
-- distintas etapas de su vida) en vez de duplicar el concepto en una tabla aparte.

-- ============================================================================
-- 1. `units`: nuevas columnas que el portal necesita mostrar/editar, y el estado
--    "blocked" (unidad retenida por dirección, no comercializable) que el selector
--    público nunca usa pero el panel de inventario sí.
-- ============================================================================
alter table units
  add column parking_spots int not null default 1,
  add column terrace_m2 numeric not null default 0,
  add column status_note text;

alter table units drop constraint if exists units_status_check;
alter table units add constraint units_status_check
  check (status in ('available', 'reserved', 'sold', 'blocked'));

-- ============================================================================
-- 2. `team_members`: el equipo de ventas (admin/asesor) y sus permisos. No existía
--    ningún concepto de rol hasta ahora — el /admin sencillo trataba "autenticado" y
--    "admin" como sinónimos (SPEC §6: "para la demo basta con autenticado"). El portal
--    sí distingue admin de asesor, y qué puede hacer cada asesor.
-- ============================================================================
create table team_members (
  id uuid primary key default gen_random_uuid(),
  development_id uuid references developments(id) on delete cascade,
  user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  initials text not null,
  email text not null,
  phone text,
  role text not null check (role in ('admin', 'asesor')),
  role_label text not null,
  status text not null default 'invitado' check (status in ('activo', 'invitado')),
  -- Claves libres a propósito (no un enum): así el portal agrega un permiso nuevo sin
  -- otra migración. Las etiquetas visibles viven en TEAM_PERMISSION_LABELS (código),
  -- no aquí.
  permissions text[] not null default '{}',
  created_at timestamptz default now(),
  unique (development_id, email)
);

-- Alta de un asesor: el admin registra el correo antes de que exista la cuenta
-- (status 'invitado', user_id null). Cubre el caso en que la cuenta de Auth se cree
-- DESPUÉS — ver el trigger simétrico más abajo para cuando se crea ANTES.
create or replace function link_team_member_to_existing_auth_user()
returns trigger as $$
begin
  if new.user_id is null then
    select id into new.user_id from auth.users where email = new.email limit 1;
    if new.user_id is not null then
      new.status := 'activo';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger team_members_link_existing_auth_user
  before insert on team_members
  for each row execute function link_team_member_to_existing_auth_user();

-- Caso simétrico: el asesor invitado se registra (signup normal de Supabase Auth) con
-- el mismo correo que el admin ya había dado de alta — liga esa cuenta nueva al
-- registro existente y lo pasa a 'activo'. Sin esto, el "invitado" se quedaría sin
-- acceso aunque ya tenga cuenta.
create or replace function link_team_member_on_signup()
returns trigger as $$
begin
  update team_members
  set user_id = new.id, status = 'activo'
  where email = new.email and user_id is null;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created_link_team_member
  after insert on auth.users
  for each row execute function link_team_member_on_signup();

-- Funciones de apoyo para RLS: consultan team_members por auth.uid() una sola vez,
-- para no repetir el mismo subselect en cada política.
create or replace function current_team_member_id()
returns uuid as $$
  select id from team_members where user_id = auth.uid() limit 1;
$$ language sql stable security definer set search_path = public;

create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from team_members where user_id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer set search_path = public;

create or replace function has_permission(perm text)
returns boolean as $$
  select exists (
    select 1 from team_members
    where user_id = auth.uid() and (role = 'admin' or perm = any(permissions))
  );
$$ language sql stable security definer set search_path = public;

-- Vista de métricas por asesor (vendidas, apartados activos, % conversión): calculada
-- al vuelo desde units/holds/leads en vez de guardar contadores que se puedan
-- desincronizar del dato real.
create view team_member_stats as
select
  tm.id as team_member_id,
  coalesce(sold.count, 0) as units_sold,
  coalesce(active.count, 0) as active_holds,
  case
    when coalesce(total_leads.count, 0) = 0 then 0
    else round(100.0 * coalesce(advancing.count, 0) / total_leads.count)
  end as conversion_rate
from team_members tm
left join lateral (
  select count(*) from holds h where h.advisor_id = tm.id and h.status = 'convertido'
) as sold(count) on true
left join lateral (
  select count(*) from holds h where h.advisor_id = tm.id and h.status in ('vigente', 'por_vencer')
) as active(count) on true
left join lateral (
  select count(*) from leads l where l.advisor_id = tm.id
) as total_leads(count) on true
left join lateral (
  select count(*) from leads l where l.advisor_id = tm.id and l.stage in ('cita', 'seguimiento', 'cerrado')
) as advancing(count) on true;

alter table team_members enable row level security;

create policy "Autenticados leen el equipo"
  on team_members for select
  to authenticated
  using (true);

create policy "Solo admin invita o edita miembros del equipo"
  on team_members for insert
  to authenticated
  with check (is_admin());

create policy "Solo admin actualiza miembros del equipo"
  on team_members for update
  to authenticated
  using (is_admin())
  with check (is_admin());

-- ============================================================================
-- 3. `leads` pasa a ser también el "prospecto" del CRM: etapa del embudo y asesor
--    asignado. `advisor_id` nace nulo (un lead del selector público no tiene asesor
--    hasta que alguien del equipo lo toma).
-- ============================================================================
alter table leads
  add column stage text not null default 'nuevo'
    check (stage in ('nuevo', 'contactado', 'cita', 'seguimiento', 'cerrado', 'perdido')),
  add column advisor_id uuid references team_members(id);

-- Reemplaza la política de lectura original (cualquier autenticado veía todos los
-- leads) por una que respeta la cartera de cada asesor, salvo que sea admin o tenga
-- el permiso explícito de ver la cartera completa.
drop policy if exists "Autenticados leen leads" on leads;

create policy "Cada asesor ve su cartera; admin y permiso ven todo"
  on leads for select
  to authenticated
  using (
    is_admin()
    or has_permission('ver_cartera_completa')
    or advisor_id = current_team_member_id()
  );

create policy "Cada asesor actualiza su cartera; admin y permiso actualizan todo"
  on leads for update
  to authenticated
  using (
    is_admin()
    or has_permission('ver_cartera_completa')
    or advisor_id = current_team_member_id()
  )
  with check (
    is_admin()
    or has_permission('ver_cartera_completa')
    or advisor_id = current_team_member_id()
  );

-- Bitácora de seguimiento por prospecto (llamadas, notas, visitas).
create table lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  label text not null,
  detail text not null,
  created_by uuid references team_members(id),
  created_at timestamptz default now()
);

alter table lead_notes enable row level security;

create policy "Ve notas de prospectos que puede ver"
  on lead_notes for select
  to authenticated
  using (
    is_admin()
    or has_permission('ver_cartera_completa')
    or exists (
      select 1 from leads
      where leads.id = lead_notes.lead_id and leads.advisor_id = current_team_member_id()
    )
  );

create policy "Autenticados registran notas"
  on lead_notes for insert
  to authenticated
  with check (true);

-- ============================================================================
-- 4. `holds`: apartados formales (depósito + vigencia), distintos de un lead simple.
--    Visibles para todo el equipo (saber qué está apartado es información operativa
--    compartida), pero cada quien crea/edita solo lo suyo salvo que sea admin.
-- ============================================================================
create table holds (
  id uuid primary key default gen_random_uuid(),
  development_id uuid references developments(id) on delete cascade,
  unit_id uuid references units(id) on delete cascade,
  lead_id uuid references leads(id),
  advisor_id uuid references team_members(id),
  folio text not null unique,
  amount numeric not null,
  created_at timestamptz default now(),
  expires_at timestamptz not null,
  status text not null default 'vigente'
    check (status in ('vigente', 'por_vencer', 'vencido', 'cancelado', 'convertido')),
  notes text
);

alter table holds enable row level security;

create policy "Autenticados leen holds"
  on holds for select to authenticated using (true);

create policy "Autenticados crean holds"
  on holds for insert to authenticated with check (true);

create policy "El dueño del hold o admin lo actualiza"
  on holds for update
  to authenticated
  using (is_admin() or advisor_id = current_team_member_id())
  with check (is_admin() or advisor_id = current_team_member_id());

-- ============================================================================
-- 5. `approvals`: bandeja de Operaciones (venta/cancelación/prórroga). Solo admin —
--    o un asesor con el permiso explícito 'aprobar_operaciones' — puede resolverlas;
--    cualquier asesor autenticado puede crear la solicitud desde su propio apartado.
-- ============================================================================
create table approvals (
  id uuid primary key default gen_random_uuid(),
  development_id uuid references developments(id) on delete cascade,
  folio text not null unique,
  kind text not null check (kind in ('venta', 'cancelacion', 'prorroga')),
  unit_id uuid references units(id),
  hold_id uuid references holds(id),
  advisor_id uuid references team_members(id),
  buyer_name text,
  amount numeric not null default 0,
  status text not null default 'pendiente' check (status in ('pendiente', 'aprobada', 'rechazada')),
  detail text,
  created_at timestamptz default now(),
  resolved_at timestamptz,
  resolved_by uuid references team_members(id),
  resolution_note text
);

alter table approvals enable row level security;

create policy "Autenticados leen approvals"
  on approvals for select to authenticated using (true);

create policy "Autenticados crean approvals"
  on approvals for insert to authenticated with check (true);

create policy "Solo admin o permiso resuelve approvals"
  on approvals for update
  to authenticated
  using (is_admin() or has_permission('aprobar_operaciones'))
  with check (is_admin() or has_permission('aprobar_operaciones'));

-- ============================================================================
-- 6. `audit_log`: bitácora inmutable de auditoría (precio, bloqueos, aprobaciones,
--    equipo). Solo insert/select — nada la actualiza ni la borra desde el portal.
-- ============================================================================
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  development_id uuid references developments(id) on delete cascade,
  actor_id uuid references team_members(id),
  actor_name text not null,
  action_label text not null,
  detail text not null,
  icon text not null default 'history',
  created_at timestamptz default now()
);

alter table audit_log enable row level security;

create policy "Autenticados leen audit_log"
  on audit_log for select to authenticated using (true);

create policy "Autenticados insertan audit_log"
  on audit_log for insert to authenticated with check (true);

-- ============================================================================
-- 7. `project_settings`: comportamiento del portal (no del motor 3D — eso sigue
--    viviendo en src/config/aura.json). Fila única por desarrollo; solo admin edita,
--    pero el selector público también la lee (show_exact_prices_publicly).
-- ============================================================================
create table project_settings (
  development_id uuid primary key references developments(id) on delete cascade,
  show_exact_prices_publicly boolean not null default true,
  notify_expiring_holds boolean not null default true,
  default_hold_hours int not null default 72
);

alter table project_settings enable row level security;

create policy "Lectura pública de settings de developments publicados"
  on project_settings for select
  to anon, authenticated
  using (
    exists (
      select 1 from developments
      where developments.id = project_settings.development_id and developments.published = true
    )
  );

create policy "Solo admin escribe settings"
  on project_settings for all
  to authenticated
  using (is_admin())
  with check (is_admin());

-- ============================================================================
-- 8. Realtime: sin esto, dos pestañas del portal (o el portal y el selector público)
--    no se enteran de los cambios de la otra hasta recargar — justo lo que SPEC §2
--    momento 3 pide evitar.
-- ============================================================================
alter publication supabase_realtime add table team_members;
alter publication supabase_realtime add table leads;
alter publication supabase_realtime add table lead_notes;
alter publication supabase_realtime add table holds;
alter publication supabase_realtime add table approvals;
alter publication supabase_realtime add table audit_log;
