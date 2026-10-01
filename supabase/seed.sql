-- Generado por scripts/seed.ts — pega todo esto en el SQL Editor de Supabase.
-- Idempotente: se puede volver a correr sin duplicar filas (upsert por slug / código).

insert into developments (slug, name, published)
values ('aura', 'Torre Aura Del Valle', true)
on conflict (slug) do update set name = excluded.name, published = excluded.published;

insert into project_settings (development_id)
select id from developments where slug = 'aura'
on conflict (development_id) do nothing;

insert into units (development_id, code, floor, type, bedrooms, bathrooms, m2, price, orientation, status, parking_spots)
select d.id, v.code, v.floor, v.type, v.bedrooms, v.bathrooms, v.m2, v.price, v.orientation, v.status, v.parking_spots
from (values
  ('101', 1, 'A', 2, 2, 85, 5600000, 'Norponiente', 'sold', 1),
  ('102', 1, 'B', 1, 1, 62, 4300000, 'Nororiente', 'sold', 1),
  ('103', 1, 'C', 3, 2.5, 120, 7600000, 'Surponiente', 'sold', 2),
  ('104', 1, 'D', 2, 2, 92, 6000000, 'Suroriente', 'sold', 1),
  ('201', 2, 'A', 2, 2, 85, 5684000, 'Norponiente', 'sold', 1),
  ('202', 2, 'B', 1, 1, 62, 4365000, 'Nororiente', 'sold', 1),
  ('203', 2, 'C', 3, 2.5, 120, 7714000, 'Surponiente', 'sold', 2),
  ('204', 2, 'D', 2, 2, 92, 6090000, 'Suroriente', 'reserved', 1),
  ('301', 3, 'A', 2, 2, 85, 5768000, 'Norponiente', 'reserved', 1),
  ('302', 3, 'B', 1, 1, 62, 4429000, 'Nororiente', 'available', 1),
  ('303', 3, 'C', 3, 2.5, 120, 7828000, 'Surponiente', 'available', 2),
  ('304', 3, 'D', 2, 2, 92, 6180000, 'Suroriente', 'available', 1),
  ('401', 4, 'A', 2, 2, 85, 5852000, 'Norponiente', 'available', 1),
  ('402', 4, 'B', 1, 1, 62, 4494000, 'Nororiente', 'available', 1),
  ('403', 4, 'C', 3, 2.5, 120, 7942000, 'Surponiente', 'available', 2),
  ('404', 4, 'D', 2, 2, 92, 6270000, 'Suroriente', 'available', 1),
  ('501', 5, 'A', 2, 2, 85, 5936000, 'Norponiente', 'available', 1),
  ('502', 5, 'B', 1, 1, 62, 4558000, 'Nororiente', 'available', 1),
  ('503', 5, 'C', 3, 2.5, 120, 8056000, 'Surponiente', 'available', 2),
  ('504', 5, 'D', 2, 2, 92, 6360000, 'Suroriente', 'available', 1),
  ('601', 6, 'A', 2, 2, 85, 6020000, 'Norponiente', 'available', 1),
  ('602', 6, 'B', 1, 1, 62, 4623000, 'Nororiente', 'available', 1),
  ('603', 6, 'C', 3, 2.5, 120, 8170000, 'Surponiente', 'available', 2),
  ('604', 6, 'D', 2, 2, 92, 6450000, 'Suroriente', 'available', 1),
  ('701', 7, 'A', 2, 2, 85, 6104000, 'Norponiente', 'available', 1),
  ('702', 7, 'B', 1, 1, 62, 4687000, 'Nororiente', 'available', 1),
  ('703', 7, 'C', 3, 2.5, 120, 8284000, 'Surponiente', 'available', 2),
  ('704', 7, 'D', 2, 2, 92, 6540000, 'Suroriente', 'available', 1),
  ('801', 8, 'A', 2, 2, 85, 6188000, 'Norponiente', 'available', 1),
  ('802', 8, 'B', 1, 1, 62, 4752000, 'Nororiente', 'available', 1),
  ('803', 8, 'C', 3, 2.5, 120, 8398000, 'Surponiente', 'available', 2),
  ('804', 8, 'D', 2, 2, 92, 6630000, 'Suroriente', 'available', 1),
  ('901', 9, 'A', 2, 2, 85, 6272000, 'Norponiente', 'available', 1),
  ('902', 9, 'B', 1, 1, 62, 4816000, 'Nororiente', 'available', 1),
  ('903', 9, 'C', 3, 2.5, 120, 8512000, 'Surponiente', 'available', 2),
  ('904', 9, 'D', 2, 2, 92, 6720000, 'Suroriente', 'available', 1),
  ('1001', 10, 'A', 2, 2, 85, 6356000, 'Norponiente', 'reserved', 1),
  ('1002', 10, 'B', 1, 1, 62, 4881000, 'Nororiente', 'reserved', 1),
  ('1003', 10, 'C', 3, 2.5, 120, 8626000, 'Surponiente', 'reserved', 2),
  ('1004', 10, 'D', 2, 2, 92, 6810000, 'Suroriente', 'reserved', 1),
  ('1101', 11, 'A', 2, 2, 85, 6440000, 'Norponiente', 'sold', 1),
  ('1102', 11, 'B', 1, 1, 62, 4945000, 'Nororiente', 'sold', 1),
  ('1103', 11, 'C', 3, 2.5, 120, 8740000, 'Surponiente', 'sold', 2),
  ('1104', 11, 'D', 2, 2, 92, 6900000, 'Suroriente', 'sold', 1),
  ('1201', 12, 'PH', 3, 3.5, 165, 9400000, 'Doble orientación', 'sold', 2),
  ('1202', 12, 'PH', 3, 3.5, 180, 9800000, 'Doble orientación', 'available', 2)
) as v(code, floor, type, bedrooms, bathrooms, m2, price, orientation, status, parking_spots)
cross join (select id from developments where slug = 'aura') as d
on conflict (development_id, code) do update set
  floor = excluded.floor,
  type = excluded.type,
  bedrooms = excluded.bedrooms,
  bathrooms = excluded.bathrooms,
  m2 = excluded.m2,
  price = excluded.price,
  orientation = excluded.orientation,
  status = excluded.status,
  parking_spots = excluded.parking_spots;

-- Equipo de ventas de ejemplo (SPEC no lo cubre; son las mismas cuentas de prueba que
-- ya usabas en el portal). "invitado" hasta que cada quien se registre en /portal/login
-- con Supabase Auth usando ESTE MISMO correo — un trigger los liga automáticamente.
insert into team_members (development_id, name, initials, email, phone, role, role_label, status, permissions)
select d.id, 'Valeria Sotomayor', 'VS', 'valeria@aura.com.mx', '+52 55 1000 0001', 'admin', 'Admin Comercial', 'invitado', '{}'::text[]
from (select id from developments where slug = 'aura') as d
on conflict (development_id, email) do update set
  name = excluded.name,
  initials = excluded.initials,
  phone = excluded.phone,
  role = excluded.role,
  role_label = excluded.role_label,
  permissions = excluded.permissions;
-- Nota: "status" NO se sobreescribe en el conflicto a propósito — si ya se activó
-- por el trigger de vínculo con auth.users, correr el seed de nuevo no debe regresarlo
-- a 'invitado'.

insert into team_members (development_id, name, initials, email, phone, role, role_label, status, permissions)
select d.id, 'Rodrigo Mendoza', 'RM', 'rodrigo@aura.com.mx', '+52 55 4912 8830', 'asesor', 'Asesor Senior', 'invitado', array['ver_cartera_completa', 'exportar_reportes']::text[]
from (select id from developments where slug = 'aura') as d
on conflict (development_id, email) do update set
  name = excluded.name,
  initials = excluded.initials,
  phone = excluded.phone,
  role = excluded.role,
  role_label = excluded.role_label,
  permissions = excluded.permissions;
-- Nota: "status" NO se sobreescribe en el conflicto a propósito — si ya se activó
-- por el trigger de vínculo con auth.users, correr el seed de nuevo no debe regresarlo
-- a 'invitado'.

insert into team_members (development_id, name, initials, email, phone, role, role_label, status, permissions)
select d.id, 'Sofía Garza Cantú', 'SG', 'sofia.garza@aura.com.mx', '+52 81 2210 5544', 'asesor', 'Asesora', 'invitado', array['exportar_reportes']::text[]
from (select id from developments where slug = 'aura') as d
on conflict (development_id, email) do update set
  name = excluded.name,
  initials = excluded.initials,
  phone = excluded.phone,
  role = excluded.role,
  role_label = excluded.role_label,
  permissions = excluded.permissions;
-- Nota: "status" NO se sobreescribe en el conflicto a propósito — si ya se activó
-- por el trigger de vínculo con auth.users, correr el seed de nuevo no debe regresarlo
-- a 'invitado'.

insert into team_members (development_id, name, initials, email, phone, role, role_label, status, permissions)
select d.id, 'Javier Treviño', 'JT', 'javier.trevino@aura.com.mx', '+52 55 2233 4455', 'asesor', 'Asesor', 'invitado', '{}'::text[]
from (select id from developments where slug = 'aura') as d
on conflict (development_id, email) do update set
  name = excluded.name,
  initials = excluded.initials,
  phone = excluded.phone,
  role = excluded.role,
  role_label = excluded.role_label,
  permissions = excluded.permissions;
-- Nota: "status" NO se sobreescribe en el conflicto a propósito — si ya se activó
-- por el trigger de vínculo con auth.users, correr el seed de nuevo no debe regresarlo
-- a 'invitado'.

insert into team_members (development_id, name, initials, email, phone, role, role_label, status, permissions)
select d.id, 'Esteban Arteaga', 'EA', 'esteban.arteaga@aura.com.mx', '+52 55 6677 8899', 'asesor', 'Asesor', 'invitado', '{}'::text[]
from (select id from developments where slug = 'aura') as d
on conflict (development_id, email) do update set
  name = excluded.name,
  initials = excluded.initials,
  phone = excluded.phone,
  role = excluded.role,
  role_label = excluded.role_label,
  permissions = excluded.permissions;
-- Nota: "status" NO se sobreescribe en el conflicto a propósito — si ya se activó
-- por el trigger de vínculo con auth.users, correr el seed de nuevo no debe regresarlo
-- a 'invitado'.

insert into team_members (development_id, name, initials, email, phone, role, role_label, status, permissions)
select d.id, 'Mauricio Elizondo', 'ME', 'mauricio.elizondo@aura.com.mx', '+52 55 1122 9900', 'asesor', 'Asesor', 'invitado', array['exportar_reportes']::text[]
from (select id from developments where slug = 'aura') as d
on conflict (development_id, email) do update set
  name = excluded.name,
  initials = excluded.initials,
  phone = excluded.phone,
  role = excluded.role,
  role_label = excluded.role_label,
  permissions = excluded.permissions;
-- Nota: "status" NO se sobreescribe en el conflicto a propósito — si ya se activó
-- por el trigger de vínculo con auth.users, correr el seed de nuevo no debe regresarlo
-- a 'invitado'.
