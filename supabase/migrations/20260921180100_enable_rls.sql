-- SPEC §6 — RLS:
-- lectura pública de developments y units cuando published = true;
-- update de units solo para autenticados;
-- insert público en leads; lectura de leads solo autenticados.

alter table developments enable row level security;
alter table units enable row level security;
alter table leads enable row level security;

create policy "Lectura pública de developments publicados"
  on developments for select
  to anon, authenticated
  using (published = true);

create policy "Lectura pública de units de developments publicados"
  on units for select
  to anon, authenticated
  using (
    exists (
      select 1 from developments
      where developments.id = units.development_id
        and developments.published = true
    )
  );

create policy "Autenticados actualizan units"
  on units for update
  to authenticated
  using ((select auth.role()) = 'authenticated')
  with check ((select auth.role()) = 'authenticated');

create policy "Insert público de leads"
  on leads for insert
  to anon, authenticated
  with check (true);

create policy "Autenticados leen leads"
  on leads for select
  to authenticated
  using ((select auth.role()) = 'authenticated');
