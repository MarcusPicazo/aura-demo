-- SPEC §6: esquema base (developments, units, leads).
create extension if not exists pgcrypto;

create table developments (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  published boolean default false,
  created_at timestamptz default now()
);

create table units (
  id uuid primary key default gen_random_uuid(),
  development_id uuid references developments(id) on delete cascade,
  code text not null,
  floor int not null,
  type text not null,
  bedrooms int not null,
  bathrooms numeric not null,
  m2 numeric not null,
  price numeric not null,
  orientation text,
  status text not null check (status in ('available', 'reserved', 'sold')),
  updated_at timestamptz default now(),
  unique (development_id, code)
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  development_id uuid references developments(id) on delete cascade,
  unit_id uuid references units(id),
  name text,
  phone text,
  created_at timestamptz default now()
);

-- `updated_at` solo se llena al insertar (default now()); sin este trigger se quedaría
-- congelado tras un update, y el admin (Día 7) necesita que refleje el último cambio
-- de estado/precio.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger units_set_updated_at
  before update on units
  for each row
  execute function set_updated_at();
