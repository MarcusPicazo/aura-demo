import { create } from 'zustand';
import {
  MOCK_APPROVALS,
  MOCK_AUDIT_LOG,
  MOCK_HOLDS,
  MOCK_PROSPECTOS,
  MOCK_TEAM,
  MOCK_UNITS,
  PORTAL_USERS,
} from '../data/mockData';
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
  units: PortalUnit[];
  holds: Hold[];
  approvals: Approval[];
  prospectos: Prospecto[];
  team: TeamMember[];
  auditLog: AuditLogEntry[];
  projectSettings: ProjectSettings;

  /** Mock de autenticación: cualquier correo `@aura.com.mx` conocido entra; el rol
   *  (admin/asesor) lo trae el usuario, no un selector aparte — así se prueba cada
   *  vista con su navegación real. Devuelve el usuario si el correo es válido. */
  login: (email: string) => PortalUser | null;
  logout: () => void;

  resolveApproval: (id: string, decision: 'aprobada' | 'rechazada', note?: string) => void;
  assignProspecto: (id: string, advisorId: string) => void;

  updateUnitPrice: (code: string, newPrice: number, reason: string, notes?: string) => void;
  toggleUnitBlock: (code: string) => void;
  createHold: (input: CreateHoldInput) => Hold;
  addProspecto: (input: NewProspectoInput) => Prospecto;
  requestSaleApproval: (holdId: string) => Approval | null;
  requestCancellation: (holdId: string, reason: string) => Approval | null;
  updateProspectoStage: (id: string, stage: ProspectoStage) => void;
  logProspectoNote: (id: string, label: string, detail: string) => void;

  updateTeamPermissions: (id: string, permissions: TeamPermissionKey[]) => void;
  toggleTeamMemberStatus: (id: string) => void;
  inviteTeamMember: (input: InviteTeamMemberInput) => TeamMember;
  updateProjectSettings: (patch: Partial<ProjectSettings>) => void;
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

export const usePortalStore = create<PortalState>((set, get) => ({
  currentUser: null,
  units: MOCK_UNITS,
  holds: MOCK_HOLDS,
  approvals: MOCK_APPROVALS,
  prospectos: MOCK_PROSPECTOS,
  team: MOCK_TEAM,
  auditLog: MOCK_AUDIT_LOG,
  projectSettings: DEFAULT_PROJECT_SETTINGS,

  login: (email) => {
    const normalized = email.trim().toLowerCase();
    const user = PORTAL_USERS.find((candidate) => candidate.email.toLowerCase() === normalized);
    if (user) set({ currentUser: user });
    return user ?? null;
  },

  logout: () => set({ currentUser: null }),

  resolveApproval: (id, decision, note) => {
    const { approvals, units, holds, currentUser } = get();
    const approval = approvals.find((candidate) => candidate.id === id);
    if (!approval) return;

    let nextUnits = units;
    let nextHolds = holds;

    if (decision === 'aprobada') {
      const relatedHold = holds.find((hold) => hold.unitCode === approval.unitCode && hold.status !== 'convertido' && hold.status !== 'cancelado');

      if (approval.kind === 'venta') {
        nextUnits = units.map((unit) => (unit.code === approval.unitCode ? { ...unit, status: 'sold', holdId: undefined, statusNote: undefined } : unit));
        if (relatedHold) nextHolds = holds.map((hold) => (hold.id === relatedHold.id ? { ...hold, status: 'convertido' } : hold));
      } else if (approval.kind === 'cancelacion') {
        nextUnits = units.map((unit) => (unit.code === approval.unitCode ? { ...unit, status: 'available', holdId: undefined, statusNote: undefined } : unit));
        if (relatedHold) nextHolds = holds.map((hold) => (hold.id === relatedHold.id ? { ...hold, status: 'cancelado' } : hold));
      } else if (approval.kind === 'prorroga' && relatedHold) {
        nextHolds = holds.map((hold) =>
          hold.id === relatedHold.id ? { ...hold, status: 'vigente', expiresAt: new Date(Date.now() + 24 * 3600_000).toISOString() } : hold,
        );
      }
    }

    const actionLabel = decision === 'aprobada' ? 'Operación aprobada' : 'Operación rechazada';
    const kindLabel = approval.kind === 'venta' ? 'venta' : approval.kind === 'cancelacion' ? 'cancelación' : 'prórroga';

    set({
      units: nextUnits,
      holds: nextHolds,
      approvals: approvals.map((candidate) => (candidate.id === id ? { ...candidate, status: decision } : candidate)),
      auditLog: [
        {
          id: `log-${Date.now()}`,
          at: 'Justo ahora',
          actorName: currentUser?.name ?? 'Sistema',
          actionLabel,
          detail: `${decision === 'aprobada' ? 'Aprobó' : 'Rechazó'} la solicitud de ${kindLabel} del Depto ${approval.unitCode} (folio ${approval.folio}).${note ? ` Nota: ${note}` : ''}`,
          icon: decision === 'aprobada' ? 'check_circle' : 'cancel',
        },
        ...get().auditLog,
      ],
    });
  },

  assignProspecto: (id, advisorId) => {
    set({
      prospectos: get().prospectos.map((prospecto) => (prospecto.id === id ? { ...prospecto, advisorId } : prospecto)),
    });
  },

  updateUnitPrice: (code, newPrice, reason, notes) => {
    const actor = get().currentUser;
    set({
      units: get().units.map((unit) => (unit.code === code ? { ...unit, price: newPrice } : unit)),
      auditLog: [
        {
          id: `log-${Date.now()}`,
          at: 'Justo ahora',
          actorName: actor?.name ?? 'Sistema',
          actionLabel: 'Precio actualizado',
          detail: `Modificó el precio de lista del Depto ${code} a ${new Intl.NumberFormat('es-MX').format(newPrice)} MXN. Motivo: ${reason}.${notes ? ` Nota: ${notes}` : ''}`,
          icon: 'price_change',
        },
        ...get().auditLog,
      ],
    });
  },

  toggleUnitBlock: (code) => {
    const actor = get().currentUser;
    const unit = get().units.find((candidate) => candidate.code === code);
    if (!unit || unit.status === 'sold') return;
    const nextStatus = unit.status === 'blocked' ? 'available' : 'blocked';
    set({
      units: get().units.map((candidate) =>
        candidate.code === code
          ? {
              ...candidate,
              status: nextStatus,
              statusNote: nextStatus === 'blocked' ? 'Bloqueada (Dirección)' : undefined,
            }
          : candidate,
      ),
      auditLog: [
        {
          id: `log-${Date.now()}`,
          at: 'Justo ahora',
          actorName: actor?.name ?? 'Sistema',
          actionLabel: nextStatus === 'blocked' ? 'Bloqueo administrativo' : 'Unidad reactivada',
          detail:
            nextStatus === 'blocked'
              ? `Pausó comercialización del Depto ${code}.`
              : `Reactivó el Depto ${code} para el catálogo público.`,
          icon: nextStatus === 'blocked' ? 'lock' : 'lock_open',
        },
        ...get().auditLog,
      ],
    });
  },

  createHold: (input) => {
    const { units, holds, currentUser } = get();
    const nextNumber = 1100 + holds.length + 1;
    const folio = `AP-${nextNumber}`;
    const hold: Hold = {
      id: `hold-${Date.now()}`,
      folio,
      unitCode: input.unitCode,
      prospectoId: input.prospectoId,
      advisorId: input.advisorId,
      amount: input.amount,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + input.holdHours * 3600_000).toISOString(),
      status: 'vigente',
      notes: input.notes,
    };

    set({
      holds: [hold, ...holds],
      units: units.map((unit) =>
        unit.code === input.unitCode
          ? { ...unit, status: 'reserved', holdId: folio, statusNote: `Apartado (#${folio})` }
          : unit,
      ),
      auditLog: [
        {
          id: `log-${Date.now()}`,
          at: 'Justo ahora',
          actorName: currentUser?.name ?? 'Sistema',
          actionLabel: 'Apartado registrado',
          detail: `Registró apartado formal para el Depto ${input.unitCode} (${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(input.amount)}).`,
          icon: 'payments',
        },
        ...get().auditLog,
      ],
    });

    return hold;
  },

  addProspecto: (input) => {
    const initials = input.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join('');

    const prospecto: Prospecto = {
      id: `prospecto-${Date.now()}`,
      name: input.name,
      initials: initials || '??',
      phone: input.phone,
      email: input.email ?? '',
      origin: input.origin,
      stage: 'nuevo',
      advisorId: input.advisorId,
      interestedUnitCodes: input.interestedUnitCodes ?? [],
      createdAt: new Date().toISOString(),
      timeline: [],
    };

    set({ prospectos: [prospecto, ...get().prospectos] });
    return prospecto;
  },

  requestSaleApproval: (holdId) => {
    const { holds, units, approvals, prospectos, currentUser } = get();
    const hold = holds.find((candidate) => candidate.id === holdId);
    if (!hold) return null;

    const alreadyPending = approvals.find(
      (approval) => approval.unitCode === hold.unitCode && approval.kind === 'venta' && approval.status === 'pendiente',
    );
    if (alreadyPending) return alreadyPending;

    const unit = unitByCode(units, hold.unitCode);
    const prospecto = prospectos.find((candidate) => candidate.id === hold.prospectoId);
    const approval: Approval = {
      id: `approval-${Date.now()}`,
      folio: `SOL-${new Date().getFullYear()}-${(90 + approvals.length).toString().padStart(3, '0')}`,
      kind: 'venta',
      unitCode: hold.unitCode,
      advisorId: hold.advisorId,
      buyerName: prospecto?.name ?? 'Prospecto sin identificar',
      amount: unit?.price ?? 0,
      createdAt: new Date().toISOString(),
      status: 'pendiente',
      detail: `Solicitud de confirmación de venta definitiva enviada por ${currentUser?.name ?? 'el asesor'} para el Depto ${hold.unitCode}.`,
    };

    set({ approvals: [approval, ...approvals] });
    return approval;
  },

  requestCancellation: (holdId, reason) => {
    const { holds, approvals, prospectos, currentUser } = get();
    const hold = holds.find((candidate) => candidate.id === holdId);
    if (!hold) return null;

    const alreadyPending = approvals.find(
      (approval) => approval.unitCode === hold.unitCode && approval.kind === 'cancelacion' && approval.status === 'pendiente',
    );
    if (alreadyPending) return alreadyPending;

    const prospecto = prospectos.find((candidate) => candidate.id === hold.prospectoId);
    const approval: Approval = {
      id: `approval-${Date.now()}`,
      folio: `SOL-${new Date().getFullYear()}-${(90 + approvals.length).toString().padStart(3, '0')}`,
      kind: 'cancelacion',
      unitCode: hold.unitCode,
      advisorId: hold.advisorId,
      buyerName: prospecto?.name ?? 'Prospecto sin identificar',
      amount: hold.amount,
      createdAt: new Date().toISOString(),
      status: 'pendiente',
      detail: `Motivo: ${reason} · Libera unidad al catálogo. Solicitado por ${currentUser?.name ?? 'el asesor'}.`,
    };

    set({ approvals: [approval, ...approvals] });
    return approval;
  },

  updateProspectoStage: (id, stage) => {
    set({
      prospectos: get().prospectos.map((prospecto) => (prospecto.id === id ? { ...prospecto, stage } : prospecto)),
    });
  },

  logProspectoNote: (id, label, detail) => {
    const actor = get().currentUser;
    set({
      prospectos: get().prospectos.map((prospecto) =>
        prospecto.id === id
          ? {
              ...prospecto,
              timeline: [
                { id: `t-${Date.now()}`, label, detail, at: 'Justo ahora', by: actor?.name ?? 'Sistema' },
                ...prospecto.timeline,
              ],
            }
          : prospecto,
      ),
    });
  },

  updateTeamPermissions: (id, permissions) => {
    const actor = get().currentUser;
    const member = get().team.find((candidate) => candidate.id === id);
    set({
      team: get().team.map((candidate) => (candidate.id === id ? { ...candidate, permissions } : candidate)),
      auditLog: [
        {
          id: `log-${Date.now()}`,
          at: 'Justo ahora',
          actorName: actor?.name ?? 'Sistema',
          actionLabel: 'Permisos actualizados',
          detail: `Actualizó los permisos de ${member?.name ?? 'un asesor'}.`,
          icon: 'admin_panel_settings',
        },
        ...get().auditLog,
      ],
    });
  },

  toggleTeamMemberStatus: (id) => {
    set({
      team: get().team.map((candidate) =>
        candidate.id === id ? { ...candidate, status: candidate.status === 'activo' ? 'invitado' : 'activo' } : candidate,
      ),
    });
  },

  inviteTeamMember: (input) => {
    const actor = get().currentUser;
    const initials = input.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join('');

    const member: TeamMember = {
      id: `asesor-${Date.now()}`,
      name: input.name,
      initials: initials || '??',
      email: input.email,
      phone: input.phone,
      role: 'asesor',
      roleLabel: input.roleLabel,
      status: 'invitado',
      unitsSold: 0,
      activeHolds: 0,
      conversionRate: 0,
      permissions: [],
    };

    set({
      team: [...get().team, member],
      auditLog: [
        {
          id: `log-${Date.now()}`,
          at: 'Justo ahora',
          actorName: actor?.name ?? 'Sistema',
          actionLabel: 'Asesor invitado',
          detail: `Invitó a ${member.name} (${member.email}) como nuevo asesor.`,
          icon: 'person_add',
        },
        ...get().auditLog,
      ],
    });

    return member;
  },

  updateProjectSettings: (patch) => {
    set({ projectSettings: { ...get().projectSettings, ...patch } });
  },
}));

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
