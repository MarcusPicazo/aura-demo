/**
 * Modelo de datos del portal comercial. Vive separado de `src/types.ts` (el motor 3D)
 * a propósito: son dos dominios distintos (config de torre vs. operación de ventas) y
 * el portal tiene su propio ciclo de vida — hoy con datos de ejemplo en Zustand, más
 * adelante contra tablas nuevas de Supabase, sin que ninguno de los dos lados tenga que
 * conocer al otro.
 */

export type PortalRole = 'admin' | 'asesor';

export interface PortalUser {
  id: string;
  name: string;
  role: PortalRole;
  roleLabel: string;
  email: string;
  initials: string;
}

export type UnitStatus = 'available' | 'reserved' | 'sold' | 'blocked';

export interface PortalUnit {
  id: string;
  code: string;
  floor: number;
  tower: string;
  typeLabel: string;
  bedrooms: number;
  bathrooms: number;
  m2: number;
  terraceM2: number;
  price: number;
  orientation: string;
  parkingSpots: number;
  status: UnitStatus;
  statusNote?: string;
  /** Presente solo cuando status es 'reserved'. */
  holdId?: string;
}

export type HoldStatus = 'vigente' | 'por_vencer' | 'vencido' | 'cancelado' | 'convertido';

export interface Hold {
  id: string;
  folio: string;
  unitCode: string;
  prospectoId: string;
  advisorId: string;
  amount: number;
  createdAt: string;
  expiresAt: string;
  status: HoldStatus;
  notes?: string;
}

export type ProspectoStage = 'nuevo' | 'contactado' | 'cita' | 'seguimiento' | 'cerrado' | 'perdido';

export interface ProspectoTimelineEntry {
  id: string;
  label: string;
  detail: string;
  at: string;
  by: string;
}

export interface Prospecto {
  id: string;
  name: string;
  initials: string;
  phone: string;
  email: string;
  origin: string;
  stage: ProspectoStage;
  advisorId: string;
  interestedUnitCodes: string[];
  nextActionLabel?: string;
  nextActionAt?: string;
  createdAt: string;
  timeline: ProspectoTimelineEntry[];
}

export type ApprovalKind = 'venta' | 'cancelacion' | 'prorroga';
export type ApprovalStatus = 'pendiente' | 'aprobada' | 'rechazada';

export interface Approval {
  id: string;
  folio: string;
  kind: ApprovalKind;
  unitCode: string;
  advisorId: string;
  buyerName: string;
  amount: number;
  createdAt: string;
  status: ApprovalStatus;
  detail: string;
}

/** Qué puede hacer cada vendedor dentro del portal — ver §"Equipo y permisos" del
 *  pedido original. Un admin siempre tiene todo; esto solo aplica de forma explícita
 *  a miembros con role 'asesor'. */
export type TeamPermissionKey = 'editar_precios' | 'aprobar_operaciones' | 'ver_cartera_completa' | 'exportar_reportes';

export const TEAM_PERMISSION_LABELS: Record<TeamPermissionKey, string> = {
  editar_precios: 'Modificar precios de lista',
  aprobar_operaciones: 'Aprobar ventas y cancelaciones',
  ver_cartera_completa: 'Ver cartera completa del equipo',
  exportar_reportes: 'Descargar reportes y matrices',
};

export interface TeamMember {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone: string;
  role: PortalRole;
  roleLabel: string;
  status: 'activo' | 'invitado';
  unitsSold: number;
  activeHolds: number;
  conversionRate: number;
  permissions: TeamPermissionKey[];
}

export interface AuditLogEntry {
  id: string;
  at: string;
  actorName: string;
  actionLabel: string;
  detail: string;
  icon: string;
}

/** Ajustes del portal para este desarrollo — distintos de `src/config/aura.json`: esto
 *  es comportamiento del panel de ventas (vigencias, notificaciones), no del motor 3D. */
export interface ProjectSettings {
  showExactPricesPublicly: boolean;
  notifyExpiringHolds: boolean;
  defaultHoldHours: number;
}
