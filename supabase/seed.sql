-- Generado por scripts/seed.ts — pega todo esto en el SQL Editor de Supabase.
-- Idempotente: se puede volver a correr sin duplicar filas (upsert por slug / código).

insert into developments (slug, name, published)
values ('aura', 'Torre Aura Del Valle', true)
on conflict (slug) do update set name = excluded.name, published = excluded.published;

insert into units (development_id, code, floor, type, bedrooms, bathrooms, m2, price, orientation, status)
select d.id, v.code, v.floor, v.type, v.bedrooms, v.bathrooms, v.m2, v.price, v.orientation, v.status
from (values
  ('101', 1, 'A', 2, 2, 85, 5600000, 'Norponiente', 'sold'),
  ('102', 1, 'B', 1, 1, 62, 4300000, 'Nororiente', 'sold'),
  ('103', 1, 'C', 3, 2.5, 120, 7600000, 'Surponiente', 'sold'),
  ('104', 1, 'D', 2, 2, 92, 6000000, 'Suroriente', 'sold'),
  ('201', 2, 'A', 2, 2, 85, 5684000, 'Norponiente', 'sold'),
  ('202', 2, 'B', 1, 1, 62, 4365000, 'Nororiente', 'sold'),
  ('203', 2, 'C', 3, 2.5, 120, 7714000, 'Surponiente', 'sold'),
  ('204', 2, 'D', 2, 2, 92, 6090000, 'Suroriente', 'reserved'),
  ('301', 3, 'A', 2, 2, 85, 5768000, 'Norponiente', 'reserved'),
  ('302', 3, 'B', 1, 1, 62, 4429000, 'Nororiente', 'available'),
  ('303', 3, 'C', 3, 2.5, 120, 7828000, 'Surponiente', 'available'),
  ('304', 3, 'D', 2, 2, 92, 6180000, 'Suroriente', 'available'),
  ('401', 4, 'A', 2, 2, 85, 5852000, 'Norponiente', 'available'),
  ('402', 4, 'B', 1, 1, 62, 4494000, 'Nororiente', 'available'),
  ('403', 4, 'C', 3, 2.5, 120, 7942000, 'Surponiente', 'available'),
  ('404', 4, 'D', 2, 2, 92, 6270000, 'Suroriente', 'available'),
  ('501', 5, 'A', 2, 2, 85, 5936000, 'Norponiente', 'available'),
  ('502', 5, 'B', 1, 1, 62, 4558000, 'Nororiente', 'available'),
  ('503', 5, 'C', 3, 2.5, 120, 8056000, 'Surponiente', 'available'),
  ('504', 5, 'D', 2, 2, 92, 6360000, 'Suroriente', 'available'),
  ('601', 6, 'A', 2, 2, 85, 6020000, 'Norponiente', 'available'),
  ('602', 6, 'B', 1, 1, 62, 4623000, 'Nororiente', 'available'),
  ('603', 6, 'C', 3, 2.5, 120, 8170000, 'Surponiente', 'available'),
  ('604', 6, 'D', 2, 2, 92, 6450000, 'Suroriente', 'available'),
  ('701', 7, 'A', 2, 2, 85, 6104000, 'Norponiente', 'available'),
  ('702', 7, 'B', 1, 1, 62, 4687000, 'Nororiente', 'available'),
  ('703', 7, 'C', 3, 2.5, 120, 8284000, 'Surponiente', 'available'),
  ('704', 7, 'D', 2, 2, 92, 6540000, 'Suroriente', 'available'),
  ('801', 8, 'A', 2, 2, 85, 6188000, 'Norponiente', 'available'),
  ('802', 8, 'B', 1, 1, 62, 4752000, 'Nororiente', 'available'),
  ('803', 8, 'C', 3, 2.5, 120, 8398000, 'Surponiente', 'available'),
  ('804', 8, 'D', 2, 2, 92, 6630000, 'Suroriente', 'available'),
  ('901', 9, 'A', 2, 2, 85, 6272000, 'Norponiente', 'available'),
  ('902', 9, 'B', 1, 1, 62, 4816000, 'Nororiente', 'available'),
  ('903', 9, 'C', 3, 2.5, 120, 8512000, 'Surponiente', 'available'),
  ('904', 9, 'D', 2, 2, 92, 6720000, 'Suroriente', 'available'),
  ('1001', 10, 'A', 2, 2, 85, 6356000, 'Norponiente', 'reserved'),
  ('1002', 10, 'B', 1, 1, 62, 4881000, 'Nororiente', 'reserved'),
  ('1003', 10, 'C', 3, 2.5, 120, 8626000, 'Surponiente', 'reserved'),
  ('1004', 10, 'D', 2, 2, 92, 6810000, 'Suroriente', 'reserved'),
  ('1101', 11, 'A', 2, 2, 85, 6440000, 'Norponiente', 'sold'),
  ('1102', 11, 'B', 1, 1, 62, 4945000, 'Nororiente', 'sold'),
  ('1103', 11, 'C', 3, 2.5, 120, 8740000, 'Surponiente', 'sold'),
  ('1104', 11, 'D', 2, 2, 92, 6900000, 'Suroriente', 'sold'),
  ('1201', 12, 'PH', 3, 3.5, 165, 9400000, 'Doble orientación', 'sold'),
  ('1202', 12, 'PH', 3, 3.5, 180, 9800000, 'Doble orientación', 'available')
) as v(code, floor, type, bedrooms, bathrooms, m2, price, orientation, status)
cross join (select id from developments where slug = 'aura') as d
on conflict (development_id, code) do update set
  floor = excluded.floor,
  type = excluded.type,
  bedrooms = excluded.bedrooms,
  bathrooms = excluded.bathrooms,
  m2 = excluded.m2,
  price = excluded.price,
  orientation = excluded.orientation,
  status = excluded.status;
