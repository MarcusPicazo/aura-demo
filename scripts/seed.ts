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
  parkingSpots: number;
}

/** SPEC no define cajones de estacionamiento por tipo; regla simple y determinista
 *  para no dejar la columna en blanco: 1 cajón hasta 2 recámaras, 2 de ahí en adelante. */
function parkingSpotsFor(bedrooms: number): number {
  return bedrooms <= 2 ? 1 : 2;
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
        parkingSpots: parkingSpotsFor(spec.bedrooms),
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
      parkingSpots: parkingSpotsFor(spec.bedrooms),
    });
  });

  return units;
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function unitRowSql(unit: SeedUnit): string {
  return `  (${sqlString(unit.code)}, ${unit.floor}, ${sqlString(unit.type)}, ${unit.bedrooms}, ${unit.bathrooms}, ${unit.m2}, ${unit.price}, ${sqlString(unit.orientation)}, ${sqlString(unit.status)}, ${unit.parkingSpots})`;
}

interface SeedTeamMember {
  name: string;
  email: string;
  phone: string;
  role: 'admin' | 'asesor';
  roleLabel: string;
  status: 'activo' | 'invitado';
  permissions: string[];
}

/** Mismo equipo de ejemplo que ya se usaba en el portal con datos mock (Fases 1–5) —
 *  para que las cuentas de prueba que ya conoces (valeria@aura.com.mx, rodrigo@aura.com.mx)
 *  sigan funcionando una vez conectadas a Supabase de verdad. */
const TEAM: SeedTeamMember[] = [
  { name: 'Valeria Sotomayor', email: 'valeria@aura.com.mx', phone: '+52 55 1000 0001', role: 'admin', roleLabel: 'Admin Comercial', status: 'invitado', permissions: [] },
  { name: 'Rodrigo Mendoza', email: 'rodrigo@aura.com.mx', phone: '+52 55 4912 8830', role: 'asesor', roleLabel: 'Asesor Senior', status: 'invitado', permissions: ['ver_cartera_completa', 'exportar_reportes'] },
  { name: 'Sofía Garza Cantú', email: 'sofia.garza@aura.com.mx', phone: '+52 81 2210 5544', role: 'asesor', roleLabel: 'Asesora', status: 'invitado', permissions: ['exportar_reportes'] },
  { name: 'Javier Treviño', email: 'javier.trevino@aura.com.mx', phone: '+52 55 2233 4455', role: 'asesor', roleLabel: 'Asesor', status: 'invitado', permissions: [] },
  { name: 'Esteban Arteaga', email: 'esteban.arteaga@aura.com.mx', phone: '+52 55 6677 8899', role: 'asesor', roleLabel: 'Asesor', status: 'invitado', permissions: [] },
  { name: 'Mauricio Elizondo', email: 'mauricio.elizondo@aura.com.mx', phone: '+52 55 1122 9900', role: 'asesor', roleLabel: 'Asesor', status: 'invitado', permissions: ['exportar_reportes'] },
];

function initialsFor(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

function textArraySql(values: string[]): string {
  if (values.length === 0) return "'{}'::text[]";
  return `array[${values.map(sqlString).join(', ')}]::text[]`;
}

function teamMemberSql(config: DevelopmentConfig, member: SeedTeamMember): string {
  return `insert into team_members (development_id, name, initials, email, phone, role, role_label, status, permissions)
select d.id, ${sqlString(member.name)}, ${sqlString(initialsFor(member.name))}, ${sqlString(member.email)}, ${sqlString(member.phone)}, ${sqlString(member.role)}, ${sqlString(member.roleLabel)}, ${sqlString(member.status)}, ${textArraySql(member.permissions)}
from (select id from developments where slug = ${sqlString(config.slug)}) as d
on conflict (development_id, email) do update set
  name = excluded.name,
  initials = excluded.initials,
  phone = excluded.phone,
  role = excluded.role,
  role_label = excluded.role_label,
  permissions = excluded.permissions;
-- Nota: "status" NO se sobreescribe en el conflicto a propósito — si ya se activó
-- por el trigger de vínculo con auth.users, correr el seed de nuevo no debe regresarlo
-- a 'invitado'.`;
}

function buildSeedSql(config: DevelopmentConfig, units: SeedUnit[]): string {
  return `-- Generado por scripts/seed.ts — pega todo esto en el SQL Editor de Supabase.
-- Idempotente: se puede volver a correr sin duplicar filas (upsert por slug / código).

insert into developments (slug, name, published)
values (${sqlString(config.slug)}, ${sqlString(config.name)}, true)
on conflict (slug) do update set name = excluded.name, published = excluded.published;

insert into project_settings (development_id)
select id from developments where slug = ${sqlString(config.slug)}
on conflict (development_id) do nothing;

insert into units (development_id, code, floor, type, bedrooms, bathrooms, m2, price, orientation, status, parking_spots)
select d.id, v.code, v.floor, v.type, v.bedrooms, v.bathrooms, v.m2, v.price, v.orientation, v.status, v.parking_spots
from (values
${units.map(unitRowSql).join(',\n')}
) as v(code, floor, type, bedrooms, bathrooms, m2, price, orientation, status, parking_spots)
cross join (select id from developments where slug = ${sqlString(config.slug)}) as d
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
${TEAM.map((member) => teamMemberSql(config, member)).join('\n\n')}
`;
}

const units = generateSeedUnits(config);
const sql = buildSeedSql(config, units);

const outPath = path.resolve(import.meta.dirname, '../supabase/seed.sql');
writeFileSync(outPath, sql, 'utf-8');

console.log(sql);
console.log(`-- (${units.length} unidades escritas en ${outPath})`);
