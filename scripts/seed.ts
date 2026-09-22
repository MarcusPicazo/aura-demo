/**
 * Genera el SQL de seed para las 46 unidades de un desarrollo (SPEC §6), con la
 * lógica de precios y estados de SPEC §3, y lo escribe en supabase/seed.sql.
 *
 * No se conecta a Supabase ni necesita credenciales: solo genera texto SQL, para
 * pegarlo tal cual en el SQL Editor del dashboard. Es idempotente (upsert), así que
 * se puede volver a correr y pegar sin duplicar filas.
 *
 * Uso: npx tsx scripts/seed.ts
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { calculatePrice } from '../src/lib/pricing.ts';
import { deriveRegularUnitCode } from '../src/lib/geometry.ts';
import auraConfigJson from '../src/config/aura.json' with { type: 'json' };
import type { DevelopmentConfig, UnitStatus } from '../src/types.ts';

const config = auraConfigJson as unknown as DevelopmentConfig;

interface SeedUnit {
  code: string;
  floor: number;
  type: string;
  bedrooms: number;
  bathrooms: number;
  m2: number;
  price: number;
  orientation: string;
  status: UnitStatus;
}

/**
 * De 46 unidades totales: ~60% disponible, ~25% vendido, ~15% apartado (SPEC §3).
 * Los 2 penthouses son un caso aparte (uno vendido, uno disponible, más abajo), así
 * que estos conteos aplican a las 44 unidades regulares (pisos 1..levels-1).
 */
const REGULAR_SOLD_COUNT = 11;
const REGULAR_RESERVED_COUNT = 6;

interface RegularSlot {
  code: string;
  floor: number;
  type: string;
  orderInFloor: number;
}

/**
 * Determinista (no aleatoria): a mayor distancia del piso central, mayor prioridad
 * de "vendido", para lograr "pisos bajos y altos más vendidos" (SPEC §3). Empates se
 * resuelven por piso y luego por orden dentro del piso (A,B,C,D).
 */
function assignRegularStatuses(slots: RegularSlot[], regularFloors: number): Map<string, UnitStatus> {
  const centerFloor = (1 + regularFloors) / 2;

  const ordered = [...slots].sort((a, b) => {
    const distanceA = Math.abs(a.floor - centerFloor);
    const distanceB = Math.abs(b.floor - centerFloor);
    if (distanceA !== distanceB) return distanceB - distanceA;
    if (a.floor !== b.floor) return a.floor - b.floor;
    return a.orderInFloor - b.orderInFloor;
  });

  const statuses = new Map<string, UnitStatus>();
  ordered.forEach((slot, index) => {
    let status: UnitStatus;
    if (index < REGULAR_SOLD_COUNT) status = 'sold';
    else if (index < REGULAR_SOLD_COUNT + REGULAR_RESERVED_COUNT) status = 'reserved';
    else status = 'available';
    statuses.set(slot.code, status);
  });

  return statuses;
}

function generateSeedUnits(config: DevelopmentConfig): SeedUnit[] {
  const { geometry, unitTypes, penthouseUnitTypes } = config;
  const regularFloors = geometry.levels - 1;

  const regularSlots: RegularSlot[] = [];
  const regularUnits = new Map<string, Omit<SeedUnit, 'status'>>();

  for (let floor = 1; floor <= regularFloors; floor += 1) {
    geometry.plate.forEach((unit, orderInFloor) => {
      const spec = unitTypes[unit.type];
      const code = deriveRegularUnitCode(floor, orderInFloor);
      regularSlots.push({ code, floor, type: unit.type, orderInFloor });
      regularUnits.set(code, {
        code,
        floor,
        type: unit.type,
        bedrooms: spec.bedrooms,
        bathrooms: spec.bathrooms,
        m2: spec.m2,
        orientation: spec.orientation,
        price: calculatePrice(spec.priceBase, floor),
      });
    });
  }

  const regularStatuses = assignRegularStatuses(regularSlots, regularFloors);

  const units: SeedUnit[] = regularSlots.map((slot) => ({
    ...regularUnits.get(slot.code)!,
    status: regularStatuses.get(slot.code)!,
  }));

  // Penthouses: caso especial de SPEC §3 ("uno vendido y uno disponible"), y su
  // precio ya es el precio final (no aplica el multiplicador por piso).
  const penthouseFloor = geometry.levels;
  const penthouseStatuses: UnitStatus[] = ['sold', 'available'];
  geometry.penthousePlate.forEach((unit, index) => {
    const spec = penthouseUnitTypes[unit.code];
    units.push({
      code: unit.code,
      floor: penthouseFloor,
      type: unit.type,
      bedrooms: spec.bedrooms,
      bathrooms: spec.bathrooms,
      m2: spec.m2,
      orientation: spec.orientation,
      price: spec.priceBase,
      status: penthouseStatuses[index] ?? 'available',
    });
  });

  return units;
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function unitRowSql(unit: SeedUnit): string {
  return `  (${sqlString(unit.code)}, ${unit.floor}, ${sqlString(unit.type)}, ${unit.bedrooms}, ${unit.bathrooms}, ${unit.m2}, ${unit.price}, ${sqlString(unit.orientation)}, ${sqlString(unit.status)})`;
}

function buildSeedSql(config: DevelopmentConfig, units: SeedUnit[]): string {
  return `-- Generado por scripts/seed.ts — pega todo esto en el SQL Editor de Supabase.
-- Idempotente: se puede volver a correr sin duplicar filas (upsert por slug / código).

insert into developments (slug, name, published)
values (${sqlString(config.slug)}, ${sqlString(config.name)}, true)
on conflict (slug) do update set name = excluded.name, published = excluded.published;

insert into units (development_id, code, floor, type, bedrooms, bathrooms, m2, price, orientation, status)
select d.id, v.code, v.floor, v.type, v.bedrooms, v.bathrooms, v.m2, v.price, v.orientation, v.status
from (values
${units.map(unitRowSql).join(',\n')}
) as v(code, floor, type, bedrooms, bathrooms, m2, price, orientation, status)
cross join (select id from developments where slug = ${sqlString(config.slug)}) as d
on conflict (development_id, code) do update set
  floor = excluded.floor,
  type = excluded.type,
  bedrooms = excluded.bedrooms,
  bathrooms = excluded.bathrooms,
  m2 = excluded.m2,
  price = excluded.price,
  orientation = excluded.orientation,
  status = excluded.status;
`;
}

const units = generateSeedUnits(config);
const sql = buildSeedSql(config, units);

const outPath = path.resolve(import.meta.dirname, '../supabase/seed.sql');
writeFileSync(outPath, sql, 'utf-8');

console.log(sql);
console.log(`-- (${units.length} unidades escritas en ${outPath})`);
