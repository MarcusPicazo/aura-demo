/**
 * Fila de Supabase (snake_case) → tipo del dominio del portal (camelCase). Un mapper
 * por tabla, todos puros — nada de red aquí, eso vive en el store.
 */
import type {
  Approval,
  ApprovalKind,
  ApprovalStatus,
  AuditLogEntry,
  Hold,
  HoldStatus,
  PortalUnit,
  Prospecto,
  ProspectoStage,
  ProspectoTimelineEntry,
  TeamMember,
  TeamPermissionKey,
  UnitStatus,
} from '../types';

export interface UnitRow {
  id: string;
  code: string;
  floor: number;
  type: string;
  bedrooms: number;
  bathrooms: number;
  m2: number;
  price: number;
  orientation: string | null;
  status: UnitStatus;
  parking_spots: number;
  terrace_m2: number;
  status_note: string | null;
}

/** `type` (A/B/C/D/PH...) no trae un nombre largo guardado — se arma aquí mismo, igual
 *  para toda la app, en vez de que cada pantalla invente su propio formato. */
function typeLabelFor(type: string, bedrooms: number): string {
  return `Tipo ${type} · ${bedrooms} ${bedrooms === 1 ? 'Recámara' : 'Recámaras'}`;
}

export function mapUnit(row: UnitRow, holdFolioByUnitId: Map<string, string>): PortalUnit {
  return {
    id: row.id,
    code: row.code,
    floor: row.floor,
    typeLabel: typeLabelFor(row.type, row.bedrooms),
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    m2: Number(row.m2),
    terraceM2: Number(row.terrace_m2),
    price: Number(row.price),
    orientation: row.orientation ?? '',
    parkingSpots: row.parking_spots,
    status: row.status,
    statusNote: row.status_note ?? undefined,
    holdId: holdFolioByUnitId.get(row.id),
  };
}

export interface HoldRow {
  id: string;
  unit_id: string;
  lead_id: string;
  advisor_id: string;
  folio: string;
  amount: number;
  created_at: string;
  expires_at: string;
  status: HoldStatus;
  notes: string | null;
  units: { code: string } | null;
}

export function mapHold(row: HoldRow): Hold {
  return {
    id: row.id,
    folio: row.folio,
    unitCode: row.units?.code ?? '',
    prospectoId: row.lead_id,
    advisorId: row.advisor_id,
    amount: Number(row.amount),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    status: row.status,
    notes: row.notes ?? undefined,
  };
}

export interface LeadNoteRow {
  id: string;
  lead_id: string;
  label: string;
  detail: string;
  created_at: string;
  team_members: { name: string } | null;
}

export function mapProspectoTimelineEntry(row: LeadNoteRow): ProspectoTimelineEntry {
  return {
    id: row.id,
    label: row.label,
    detail: row.detail,
    at: new Date(row.created_at).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
    by: row.team_members?.name ?? 'Sistema',
  };
}

export interface LeadRow {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  origin: 'whatsapp' | 'form';
  stage: ProspectoStage;
  advisor_id: string | null;
  created_at: string;
  units: { code: string } | null;
  lead_notes?: LeadNoteRow[];
}

function initialsFor(name: string): string {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join('') || '??'
  );
}

/** `leads` es la misma tabla que usa el selector público (SPEC §6) — aquí hace de
 *  "prospecto" del CRM. `origin` ahí es solo 'whatsapp'/'form'; el portal muestra una
 *  etiqueta más editorial sin inventar una columna nueva para eso. */
function originLabel(origin: 'whatsapp' | 'form'): string {
  return origin === 'whatsapp' ? 'Selector web público (WhatsApp)' : 'Formulario del selector público';
}

export function mapProspecto(row: LeadRow): Prospecto {
  const name = row.name ?? 'Sin nombre';
  return {
    id: row.id,
    name,
    initials: initialsFor(name),
    phone: row.phone ?? '',
    email: row.email ?? '',
    origin: originLabel(row.origin),
    stage: row.stage,
    advisorId: row.advisor_id ?? '',
    interestedUnitCodes: row.units?.code ? [row.units.code] : [],
    createdAt: row.created_at,
    timeline: (row.lead_notes ?? [])
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map(mapProspectoTimelineEntry),
  };
}

export interface ApprovalRow {
  id: string;
  folio: string;
  kind: ApprovalKind;
  advisor_id: string;
  buyer_name: string | null;
  amount: number;
  status: ApprovalStatus;
  detail: string | null;
  created_at: string;
  units: { code: string } | null;
}

export function mapApproval(row: ApprovalRow): Approval {
  return {
    id: row.id,
    folio: row.folio,
    kind: row.kind,
    unitCode: row.units?.code ?? '',
    advisorId: row.advisor_id,
    buyerName: row.buyer_name ?? 'Sin identificar',
    amount: Number(row.amount),
    createdAt: row.created_at,
    status: row.status,
    detail: row.detail ?? '',
  };
}

export interface TeamMemberRow {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone: string | null;
  role: 'admin' | 'asesor';
  role_label: string;
  status: 'activo' | 'invitado';
  permissions: TeamPermissionKey[];
}

export interface TeamMemberStatsRow {
  team_member_id: string;
  units_sold: number;
  active_holds: number;
  conversion_rate: number;
}

export function mapTeamMember(row: TeamMemberRow, stats: TeamMemberStatsRow | undefined): TeamMember {
  return {
    id: row.id,
    name: row.name,
    initials: row.initials,
    email: row.email,
    phone: row.phone ?? '',
    role: row.role,
    roleLabel: row.role_label,
    status: row.status,
    unitsSold: stats?.units_sold ?? 0,
    activeHolds: stats?.active_holds ?? 0,
    conversionRate: stats?.conversion_rate ?? 0,
    permissions: row.permissions ?? [],
  };
}

export interface AuditLogRow {
  id: string;
  actor_name: string;
  action_label: string;
  detail: string;
  icon: string;
  created_at: string;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'Justo ahora';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

export function mapAuditLogEntry(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    at: relativeTime(row.created_at),
    actorName: row.actor_name,
    actionLabel: row.action_label,
    detail: row.detail,
    icon: row.icon,
  };
}
