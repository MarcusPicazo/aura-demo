-- Conjuntos: un desarrollo puede tener varios edificios (torres, casa club, amenidades).
-- Cada unidad pertenece a uno de ellos (`building_id` = `buildings[].id` del config del cliente).
--
-- Los códigos de unidad ya no son únicos por desarrollo sino por edificio: dos torres pueden
-- tener, cada una, su departamento 101.
--
-- Las filas que ya existen quedan en el edificio por omisión ('principal', el id del edificio
-- de un desarrollo de una sola torre). La app las asigna al edificio de origen del conjunto
-- mientras tanto, y `supabase/seed.sql` (scripts/seed.ts) las mueve de forma definitiva.
--
-- Idempotente: se puede volver a correr sin error.
-- Pégalo en el SQL Editor del dashboard de Supabase (Database → SQL Editor → New query).

alter table units add column if not exists building_id text not null default 'principal';

alter table units drop constraint if exists units_development_id_code_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'units_development_building_code_key'
  ) then
    alter table units
      add constraint units_development_building_code_key unique (development_id, building_id, code);
  end if;
end $$;

create index if not exists units_development_building_idx on units (development_id, building_id);

-- RLS: sin cambios. Las políticas de `units` filtran por desarrollo publicado, no por edificio.
-- Realtime: sin cambios. `units` ya está en la publicación y las actualizaciones traen la fila
-- completa, incluido `building_id`.
