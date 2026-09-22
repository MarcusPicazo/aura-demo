-- SPEC §6: Realtime activado en units (para el momento 3: el admin marca una unidad
-- vendida y cambia de color en todas las pantallas abiertas al instante).
alter publication supabase_realtime add table units;
