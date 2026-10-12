import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabaseAdmin, getDevelopmentId, BUILDING_ID } from '../lib/supabasePortal';
import {
  mapApproval,
  mapAuditLogEntry,
  mapHold,
  mapProspecto,
  mapTeamMember,
  mapUnit,
  type ApprovalRow,
  type AuditLogRow,
  type HoldRow,
  type LeadRow,
  type TeamMemberRow,
  type TeamMemberStatsRow,
  type UnitRow,
} from '../lib/mappers';
import type {
  Approval,
  AuditLogEntry,
  Hold,
  PortalUnit,
  PortalUser,
  Prospecto,
  ProspectoStage,
  ProjectSettings,
  TeamMember,
  TeamPermissionKey,
} from '../types';

const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  showExactPricesPublicly: true,
  notifyExpiringHolds: true,
  defaultHoldHours: 72,
};

interface PortalState {
  currentUser: PortalUser | null;
  /** True una vez que se revisó si ya había sesión de Supabase guardada — evita que
   *  PortalLayout mande a /portal/login por un instante antes de restaurarla. */
  authReady: boolean;
  /** True mientras se trae todo tras iniciar sesión — dashboards vacíos por 200-300ms
   *  en vez de mostrar "0 de todo" y corregirse solo. */
  loading: boolean;
  units: PortalUnit[];
  holds: Hold[];
  approvals: Approval[];
  prospectos: Prospecto[];
  team: TeamMember[];
  auditLog: AuditLogEntry[];
  projectSettings: ProjectSettings;

  login: (email: string, password: string) => Promise<{ user: PortalUser | null; error: string | null }>;
  logout: () => Promise<void>;

  resolveApproval: (id: string, decision: 'aprobada' | 'rechazada', note?: string) => Promise<void>;
  assignProspecto: (id: string, advisorId: string) => Promise<void>;

  updateUnitPrice: (code: string, newPrice: number, reason: string, notes?: string) => Promise<void>;
  toggleUnitBlock: (code: string) => Promise<void>;
  createHold: (input: CreateHoldInput) => Promise<Hold>;
  addProspecto: (input: NewProspectoInput) => Promise<Prospecto>;
  requestSaleApproval: (holdId: string) => Promise<Approval | null>;
  requestCancellation: (holdId: string, reason: string) => Promise<Approval | null>;
  updateProspectoStage: (id: string, stage: ProspectoStage) => Promise<void>;
  logProspectoNote: (id: string, label: string, detail: string) => Promise<void>;

  updateTeamPermissions: (id: string, permissions: TeamPermissionKey[]) => Promise<void>;
  toggleTeamMemberStatus: (id: string) => Promise<void>;
  inviteTeamMember: (input: InviteTeamMemberInput) => Promise<TeamMember>;
  updateProjectSettings: (patch: Partial<ProjectSettings>) => Promise<void>;
}

export interface InviteTeamMemberInput {
  name: string;
  email: string;
  phone: string;
  roleLabel: string;
}

export interface CreateHoldInput {
  unitCode: string;
  prospectoId: string;
  advisorId: string;
  amount: number;
  holdHours: number;
  notes?: string;
}

export interface NewProspectoInput {
  name: string;
  phone: string;
  email?: string;
  origin: string;
  advisorId: string;
  interestedUnitCodes?: string[];
}

// ---------------------------------------------------------------------------
// Canales de Realtime: viven fuera del estado reactivo a propósito (guardar un
// RealtimeChannel en Zustand dispararía un re-render cada vez que cambia). Un set
// simple de canales que se abren al entrar y se cierran al salir.
// ---------------------------------------------------------------------------
let realtimeChannels: RealtimeChannel[] = [];

function teardownRealtime() {
  realtimeChannels.forEach((channel) => void supabaseAdmin.removeChannel(channel));
  realtimeChannels = [];
}

const UNIT_COLUMNS = 'id, code, floor, type, bedrooms, bathrooms, m2, price, orientation, status, parking_spots, terrace_m2, status_note';

async function fetchUnits(developmentId: string): Promise<PortalUnit[]> {
  const [unitsResult, activeHoldsResult] = await Promise.all([
    supabaseAdmin
      .from('units')
      .select(UNIT_COLUMNS)
      .eq('development_id', developmentId)
      .eq('building_id', BUILDING_ID)
      .order('floor')
      .order('code')
      .returns<UnitRow[]>(),
    supabaseAdmin
      .from('holds')
      .select('unit_id, folio')
      .eq('development_id', developmentId)
      .in('status', ['vigente', 'por_vencer'])
      .returns<{ unit_id: string; folio: string }[]>(),
  ]);

  if (unitsResult.error) throw unitsResult.error;
  if (activeHoldsResult.error) throw activeHoldsResult.error;

  const holdFolioByUnitId = new Map((activeHoldsResult.data ?? []).map((row) => [row.unit_id, row.folio]));
  return (unitsResult.data ?? []).map((row) => mapUnit(row, holdFolioByUnitId));
}

async function fetchHolds(developmentId: string): Promise<Hold[]> {
  const { data, error } = await supabaseAdmin
    .from('holds')
    .select('id, unit_id, lead_id, advisor_id, folio, amount, created_at, expires_at, status, notes, units(code)')
    .eq('development_id', developmentId)
    .order('created_at', { ascending: false })
    .returns<HoldRow[]>();
  if (error) throw error;
  return (data ?? []).map(mapHold);
}

async function fetchApprovals(developmentId: string): Promise<Approval[]> {
  const { data, error } = await supabaseAdmin
    .from('approvals')
    .select('id, folio, kind, advisor_id, buyer_name, amount, status, detail, created_at, units(code)')
    .eq('development_id', developmentId)
    .order('created_at', { ascending: false })
    .returns<ApprovalRow[]>();
  if (error) throw error;
  return (data ?? []).map(mapApproval);
}

async function fetchProspectos(developmentId: string): Promise<Prospecto[]> {
  const { data, error } = await supabaseAdmin
    .from('leads')
    .select('id, name, phone, email, origin, stage, advisor_id, created_at, units(code), lead_notes(id, lead_id, label, detail, created_at, team_members(name))')
    .eq('development_id', developmentId)
    .order('created_at', { ascending: false })
    .returns<LeadRow[]>();
  if (error) throw error;
  return (data ?? []).map(mapProspecto);
}

async function fetchTeam(developmentId: string): Promise<TeamMember[]> {
  const [teamResult, statsResult] = await Promise.all([
    supabaseAdmin
      .from('team_members')
      .select('id, name, initials, email, phone, role, role_label, status, permissions')
      .eq('development_id', developmentId)
      .order('name')
      .returns<TeamMemberRow[]>(),
    supabaseAdmin.from('team_member_stats').select('team_member_id, units_sold, active_holds, conversion_rate').returns<TeamMemberStatsRow[]>(),
  ]);

  if (teamResult.error) throw teamResult.error;
  if (statsResult.error) throw statsResult.error;

  const statsById = new Map((statsResult.data ?? []).map((row) => [row.team_member_id, row]));
  return (teamResult.data ?? []).map((row) => mapTeamMember(row, statsById.get(row.id)));
}

async function fetchAuditLog(developmentId: string): Promise<AuditLogEntry[]> {
  const { data, error } = await supabaseAdmin
    .from('audit_log')
    .select('id, actor_name, action_label, detail, icon, created_at')
    .eq('development_id', developmentId)
    .order('created_at', { ascending: false })
    .limit(200)
    .returns<AuditLogRow[]>();
  if (error) throw error;
  return (data ?? []).map(mapAuditLogEntry);
}

async function fetchProjectSettings(developmentId: string): Promise<ProjectSettings> {
  const { data, error } = await supabaseAdmin
    .from('project_settings')
    .select('show_exact_prices_publicly, notify_expiring_holds, default_hold_hours')
    .eq('development_id', developmentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return DEFAULT_PROJECT_SETTINGS;
  return {
    showExactPricesPublicly: data.show_exact_prices_publicly,
    notifyExpiringHolds: data.notify_expiring_holds,
    defaultHoldHours: data.default_hold_hours,
  };
}

async function insertAuditLog(developmentId: string, actorId: string | undefined, actorName: string, actionLabel: string, detail: string, icon: string) {
  await supabaseAdmin.from('audit_log').insert({
    development_id: developmentId,
    actor_id: actorId ?? null,
    actor_name: actorName,
    action_label: actionLabel,
    detail,
    icon,
  });
}

function nextFolio(prefix: string, count: number): string {
  return `${prefix}-${(1100 + count + 1).toString()}`;
}

export const usePortalStore = create<PortalState>((set, get) => ({
  currentUser: null,
  authReady: false,
  loading: false,
  units: [],
  holds: [],
  approvals: [],
  prospectos: [],
  team: [],
  auditLog: [],
  projectSettings: DEFAULT_PROJECT_SETTINGS,

  login: async (email, password) => {
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return { user: null, error: 'Correo o contraseña incorrectos.' };
    }

    const { data: memberRow, error: memberError } = await supabaseAdmin
      .from('team_members')
      .select('id, name, initials, email, phone, role, role_label, status, permissions')
      .eq('user_id', data.user.id)
      .maybeSingle<TeamMemberRow>();

    if (memberError || !memberRow) {
      await supabaseAdmin.auth.signOut();
      return { user: null, error: 'Tu cuenta no tiene acceso al portal comercial. Pide que te den de alta en Equipo.' };
    }

    const user: PortalUser = {
      id: memberRow.id,
      name: memberRow.name,
      role: memberRow.role,
      roleLabel: memberRow.role_label,
      email: memberRow.email,
      initials: memberRow.initials,
    };

    set({ currentUser: user });
    await hydrate();
    return { user, error: null };
  },

  logout: async () => {
    teardownRealtime();
    await supabaseAdmin.auth.signOut();
    set({
      currentUser: null,
      units: [],
      holds: [],
      approvals: [],
      prospectos: [],
      team: [],
      auditLog: [],
      projectSettings: DEFAULT_PROJECT_SETTINGS,
    });
  },

  resolveApproval: async (id, decision, note) => {
    const { approvals, holds, currentUser } = get();
    const approval = approvals.find((candidate) => candidate.id === id);
    if (!approval || !currentUser) return;

    const developmentId = await getDevelopmentId();
    const relatedHold = holds.find(
      (hold) => hold.unitCode === approval.unitCode && hold.status !== 'convertido' && hold.status !== 'cancelado',
    );

    await supabaseAdmin
      .from('approvals')
      .update({ status: decision, resolved_at: new Date().toISOString(), resolution_note: note ?? null })
      .eq('id', id);

    if (decision === 'aprobada') {
      if (approval.kind === 'venta') {
        await supabaseAdmin
          .from('units')
          .update({ status: 'sold', status_note: null })
          .eq('development_id', developmentId)
          .eq('building_id', BUILDING_ID)
          .eq('code', approval.unitCode);
        if (relatedHold) await supabaseAdmin.from('holds').update({ status: 'convertido' }).eq('id', relatedHold.id);
      } else if (approval.kind === 'cancelacion') {
        await supabaseAdmin
          .from('units')
          .update({ status: 'available', status_note: null })
          .eq('development_id', developmentId)
          .eq('building_id', BUILDING_ID)
          .eq('code', approval.unitCode);
        if (relatedHold) await supabaseAdmin.from('holds').update({ status: 'cancelado' }).eq('id', relatedHold.id);
      } else if (approval.kind === 'prorroga' && relatedHold) {
        await supabaseAdmin
          .from('holds')
          .update({ status: 'vigente', expires_at: new Date(Date.now() + 24 * 3600_000).toISOString() })
          .eq('id', relatedHold.id);
      }
    }

    const kindLabel = approval.kind === 'venta' ? 'venta' : approval.kind === 'cancelacion' ? 'cancelación' : 'prórroga';
    await insertAuditLog(
      developmentId,
      currentUser.id,
      currentUser.name,
      decision === 'aprobada' ? 'Operación aprobada' : 'Operación rechazada',
      `${decision === 'aprobada' ? 'Aprobó' : 'Rechazó'} la solicitud de ${kindLabel} del Depto ${approval.unitCode} (folio ${approval.folio}).${note ? ` Nota: ${note}` : ''}`,
      decision === 'aprobada' ? 'check_circle' : 'cancel',
    );

    await Promise.all([refetch('units'), refetch('holds'), refetch('approvals'), refetch('auditLog')]);
  },

  assignProspecto: async (id, advisorId) => {
    const { error } = await supabaseAdmin.from('leads').update({ advisor_id: advisorId }).eq('id', id);
    if (error) throw error;
    await refetch('prospectos');
  },

  updateUnitPrice: async (code, newPrice, reason, notes) => {
    const { currentUser } = get();
    if (!currentUser) return;
    const developmentId = await getDevelopmentId();

    const { error } = await supabaseAdmin
      .from('units')
      .update({ price: newPrice })
      .eq('development_id', developmentId)
      .eq('building_id', BUILDING_ID)
      .eq('code', code);
    if (error) throw error;

    await insertAuditLog(
      developmentId,
      currentUser.id,
      currentUser.name,
      'Precio actualizado',
      `Modificó el precio de lista del Depto ${code} a ${new Intl.NumberFormat('es-MX').format(newPrice)} MXN. Motivo: ${reason}.${notes ? ` Nota: ${notes}` : ''}`,
      'price_change',
    );

    await Promise.all([refetch('units'), refetch('auditLog')]);
  },

  toggleUnitBlock: async (code) => {
    const { units, currentUser } = get();
    const unit = units.find((candidate) => candidate.code === code);
    if (!unit || unit.status === 'sold' || !currentUser) return;
    const developmentId = await getDevelopmentId();
    const nextStatus = unit.status === 'blocked' ? 'available' : 'blocked';

    const { error } = await supabaseAdmin
      .from('units')
      .update({ status: nextStatus, status_note: nextStatus === 'blocked' ? 'Bloqueada (Dirección)' : null })
      .eq('development_id', developmentId)
      .eq('building_id', BUILDING_ID)
      .eq('code', code);
    if (error) throw error;

    await insertAuditLog(
      developmentId,
      currentUser.id,
      currentUser.name,
      nextStatus === 'blocked' ? 'Bloqueo administrativo' : 'Unidad reactivada',
      nextStatus === 'blocked' ? `Pausó comercialización del Depto ${code}.` : `Reactivó el Depto ${code} para el catálogo público.`,
      nextStatus === 'blocked' ? 'lock' : 'lock_open',
    );

    await Promise.all([refetch('units'), refetch('auditLog')]);
  },

  createHold: async (input) => {
    const { units, holds, currentUser } = get();
    if (!currentUser) throw new Error('Sin sesión.');
    const developmentId = await getDevelopmentId();
    const unit = units.find((candidate) => candidate.code === input.unitCode);
    if (!unit) throw new Error(`No se encontró la unidad ${input.unitCode}.`);

    const folio = nextFolio('AP', holds.length);
    const expiresAt = new Date(Date.now() + input.holdHours * 3600_000).toISOString();

    const { data, error } = await supabaseAdmin
      .from('holds')
      .insert({
        development_id: developmentId,
        unit_id: unit.id,
        lead_id: input.prospectoId,
        advisor_id: input.advisorId,
        folio,
        amount: input.amount,
        expires_at: expiresAt,
        status: 'vigente',
        notes: input.notes ?? null,
      })
      .select('id, unit_id, lead_id, advisor_id, folio, amount, created_at, expires_at, status, notes, units(code)')
      .single<HoldRow>();
    if (error || !data) throw error ?? new Error('No se pudo crear el apartado.');

    await supabaseAdmin
      .from('units')
      .update({ status: 'reserved', status_note: `Apartado (#${folio})` })
      .eq('id', unit.id);

    await insertAuditLog(
      developmentId,
      currentUser.id,
      currentUser.name,
      'Apartado registrado',
      `Registró apartado formal para el Depto ${input.unitCode} (${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(input.amount)}).`,
      'payments',
    );

    await Promise.all([refetch('units'), refetch('holds'), refetch('auditLog')]);
    return mapHold(data);
  },

  addProspecto: async (input) => {
    const developmentId = await getDevelopmentId();
    const unitCode = input.interestedUnitCodes?.[0];
    const unit = unitCode ? get().units.find((candidate) => candidate.code === unitCode) : undefined;

    const { data, error } = await supabaseAdmin
      .from('leads')
      .insert({
        development_id: developmentId,
        unit_id: unit?.id ?? null,
        name: input.name,
        phone: input.phone,
        email: input.email ?? null,
        origin: 'form',
        advisor_id: input.advisorId || null,
      })
      .select('id, name, phone, email, origin, stage, advisor_id, created_at, units(code)')
      .single<LeadRow>();
    if (error || !data) throw error ?? new Error('No se pudo registrar el prospecto.');

    await refetch('prospectos');
    return mapProspecto(data);
  },

  requestSaleApproval: async (holdId) => {
    const { holds, units, approvals, currentUser } = get();
    const hold = holds.find((candidate) => candidate.id === holdId);
    if (!hold || !currentUser) return null;

    const alreadyPending = approvals.find(
      (approval) => approval.unitCode === hold.unitCode && approval.kind === 'venta' && approval.status === 'pendiente',
    );
    if (alreadyPending) return alreadyPending;

    const developmentId = await getDevelopmentId();
    const unit = units.find((candidate) => candidate.code === hold.unitCode);

    const { data, error } = await supabaseAdmin
      .from('approvals')
      .insert({
        development_id: developmentId,
        folio: nextFolio(`SOL-${new Date().getFullYear()}`, approvals.length + 90),
        kind: 'venta',
        unit_id: unit?.id ?? null,
        hold_id: hold.id,
        advisor_id: hold.advisorId,
        buyer_name: null,
        amount: unit?.price ?? 0,
        status: 'pendiente',
        detail: `Solicitud de confirmación de venta definitiva enviada por ${currentUser.name} para el Depto ${hold.unitCode}.`,
      })
      .select('id, folio, kind, advisor_id, buyer_name, amount, status, detail, created_at, units(code)')
      .single<ApprovalRow>();
    if (error || !data) throw error ?? new Error('No se pudo registrar la solicitud.');

    await refetch('approvals');
    return mapApproval(data);
  },

  requestCancellation: async (holdId, reason) => {
    const { holds, approvals, currentUser } = get();
    const hold = holds.find((candidate) => candidate.id === holdId);
    if (!hold || !currentUser) return null;

    const alreadyPending = approvals.find(
      (approval) => approval.unitCode === hold.unitCode && approval.kind === 'cancelacion' && approval.status === 'pendiente',
    );
    if (alreadyPending) return alreadyPending;

    const developmentId = await getDevelopmentId();
    const unit = get().units.find((candidate) => candidate.code === hold.unitCode);

    const { data, error } = await supabaseAdmin
      .from('approvals')
      .insert({
        development_id: developmentId,
        folio: nextFolio(`SOL-${new Date().getFullYear()}`, approvals.length + 90),
        kind: 'cancelacion',
        unit_id: unit?.id ?? null,
        hold_id: hold.id,
        advisor_id: hold.advisorId,
        buyer_name: null,
        amount: hold.amount,
        status: 'pendiente',
        detail: `Motivo: ${reason} · Libera unidad al catálogo. Solicitado por ${currentUser.name}.`,
      })
      .select('id, folio, kind, advisor_id, buyer_name, amount, status, detail, created_at, units(code)')
      .single<ApprovalRow>();
    if (error || !data) throw error ?? new Error('No se pudo registrar la solicitud.');

    await refetch('approvals');
    return mapApproval(data);
  },

  updateProspectoStage: async (id, stage) => {
    const { error } = await supabaseAdmin.from('leads').update({ stage }).eq('id', id);
    if (error) throw error;
    await refetch('prospectos');
  },

  logProspectoNote: async (id, label, detail) => {
    const { currentUser } = get();
    const { error } = await supabaseAdmin.from('lead_notes').insert({ lead_id: id, label, detail, created_by: currentUser?.id ?? null });
    if (error) throw error;
    await refetch('prospectos');
  },

  updateTeamPermissions: async (id, permissions) => {
    const { team, currentUser } = get();
    const member = team.find((candidate) => candidate.id === id);
    if (!currentUser) return;
    const developmentId = await getDevelopmentId();

    const { error } = await supabaseAdmin.from('team_members').update({ permissions }).eq('id', id);
    if (error) throw error;

    await insertAuditLog(developmentId, currentUser.id, currentUser.name, 'Permisos actualizados', `Actualizó los permisos de ${member?.name ?? 'un asesor'}.`, 'admin_panel_settings');
    await Promise.all([refetch('team'), refetch('auditLog')]);
  },

  toggleTeamMemberStatus: async (id) => {
    const { team } = get();
    const member = team.find((candidate) => candidate.id === id);
    if (!member) return;
    const nextStatus = member.status === 'activo' ? 'invitado' : 'activo';
    const { error } = await supabaseAdmin.from('team_members').update({ status: nextStatus }).eq('id', id);
    if (error) throw error;
    await refetch('team');
  },

  inviteTeamMember: async (input) => {
    const { currentUser } = get();
    if (!currentUser) throw new Error('Sin sesión.');
    const developmentId = await getDevelopmentId();
    const initials =
      input.name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]!.toUpperCase())
        .join('') || '??';

    const { data, error } = await supabaseAdmin
      .from('team_members')
      .insert({
        development_id: developmentId,
        name: input.name,
        initials,
        email: input.email,
        phone: input.phone,
        role: 'asesor',
        role_label: input.roleLabel,
        status: 'invitado',
        permissions: [],
      })
      .select('id, name, initials, email, phone, role, role_label, status, permissions')
      .single<TeamMemberRow>();
    if (error || !data) throw error ?? new Error('No se pudo invitar al asesor.');

    await insertAuditLog(developmentId, currentUser.id, currentUser.name, 'Asesor invitado', `Invitó a ${data.name} (${data.email}) como nuevo asesor.`, 'person_add');
    await Promise.all([refetch('team'), refetch('auditLog')]);
    return mapTeamMember(data, undefined);
  },

  updateProjectSettings: async (patch) => {
    const developmentId = await getDevelopmentId();
    const current = get().projectSettings;
    const next = { ...current, ...patch };

    const { error } = await supabaseAdmin.from('project_settings').upsert({
      development_id: developmentId,
      show_exact_prices_publicly: next.showExactPricesPublicly,
      notify_expiring_holds: next.notifyExpiringHolds,
      default_hold_hours: next.defaultHoldHours,
    });
    if (error) throw error;
    set({ projectSettings: next });
  },
}));

// ---------------------------------------------------------------------------
// Carga inicial + Realtime
// ---------------------------------------------------------------------------

type RefetchKey = 'units' | 'holds' | 'approvals' | 'prospectos' | 'team' | 'auditLog' | 'projectSettings';

async function refetch(key: RefetchKey) {
  const developmentId = await getDevelopmentId();
  switch (key) {
    case 'units':
      usePortalStore.setState({ units: await fetchUnits(developmentId) });
      return;
    case 'holds':
      usePortalStore.setState({ holds: await fetchHolds(developmentId) });
      return;
    case 'approvals':
      usePortalStore.setState({ approvals: await fetchApprovals(developmentId) });
      return;
    case 'prospectos':
      usePortalStore.setState({ prospectos: await fetchProspectos(developmentId) });
      return;
    case 'team':
      usePortalStore.setState({ team: await fetchTeam(developmentId) });
      return;
    case 'auditLog':
      usePortalStore.setState({ auditLog: await fetchAuditLog(developmentId) });
      return;
    case 'projectSettings':
      usePortalStore.setState({ projectSettings: await fetchProjectSettings(developmentId) });
      return;
  }
}

/** Trae todo y abre Realtime — se llama justo después de validar sesión (login o
 *  restauración). Un refetch completo por tabla ante cualquier cambio (insert/update/
 *  delete): para el tamaño de este portal es más simple y robusto que mezclar filas a
 *  mano fila por fila, y evita bugs de "se duplicó" o "se quedó viejo" por un merge mal
 *  hecho. */
async function hydrate() {
  usePortalStore.setState({ loading: true });
  try {
    const developmentId = await getDevelopmentId();
    const [units, holds, approvals, prospectos, team, auditLog, projectSettings] = await Promise.all([
      fetchUnits(developmentId),
      fetchHolds(developmentId),
      fetchApprovals(developmentId),
      fetchProspectos(developmentId),
      fetchTeam(developmentId),
      fetchAuditLog(developmentId),
      fetchProjectSettings(developmentId),
    ]);
    usePortalStore.setState({ units, holds, approvals, prospectos, team, auditLog, projectSettings });
    subscribeRealtime(developmentId);
  } finally {
    usePortalStore.setState({ loading: false });
  }
}

function subscribeRealtime(developmentId: string) {
  teardownRealtime();

  const tables: { table: string; key: RefetchKey }[] = [
    { table: 'units', key: 'units' },
    { table: 'holds', key: 'holds' },
    { table: 'approvals', key: 'approvals' },
    { table: 'leads', key: 'prospectos' },
    { table: 'lead_notes', key: 'prospectos' },
    { table: 'team_members', key: 'team' },
    { table: 'audit_log', key: 'auditLog' },
    { table: 'project_settings', key: 'projectSettings' },
  ];

  realtimeChannels = tables.map(({ table, key }) =>
    supabaseAdmin
      .channel(`portal-${table}-${developmentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => void refetch(key))
      .subscribe(),
  );
}

/** Al abrir el portal (primer import perezoso de este módulo), revisa si ya había una
 *  sesión de Supabase guardada — recarga la página sin perder el login. */
async function restoreSession() {
  const { data } = await supabaseAdmin.auth.getSession();
  const authUser = data.session?.user;

  if (authUser) {
    const { data: memberRow } = await supabaseAdmin
      .from('team_members')
      .select('id, name, initials, email, phone, role, role_label, status, permissions')
      .eq('user_id', authUser.id)
      .maybeSingle<TeamMemberRow>();

    if (memberRow) {
      usePortalStore.setState({
        currentUser: {
          id: memberRow.id,
          name: memberRow.name,
          role: memberRow.role,
          roleLabel: memberRow.role_label,
          email: memberRow.email,
          initials: memberRow.initials,
        },
      });
      await hydrate();
    }
  }

  usePortalStore.setState({ authReady: true });
}

void restoreSession();

export function unitByCode(units: PortalUnit[], code: string): PortalUnit | undefined {
  return units.find((unit) => unit.code === code);
}

export function teamMemberById(team: TeamMember[], id: string): TeamMember | undefined {
  return team.find((member) => member.id === id);
}

export function holdById(holds: Hold[], id: string): Hold | undefined {
  return holds.find((hold) => hold.id === id);
}

export function prospectoById(prospectos: Prospecto[], id: string): Prospecto | undefined {
  return prospectos.find((prospecto) => prospecto.id === id);
}
