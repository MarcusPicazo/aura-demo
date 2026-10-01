import type { PortalRole } from '../types';

export interface PortalNavItem {
  path: string;
  label: string;
  icon: string;
  /** Texto de contexto fijo al lado del ítem (no es un contador dinámico). */
  staticHint?: string;
}

export const ADMIN_NAV: PortalNavItem[] = [
  { path: '/portal/resumen', label: 'Resumen', icon: 'space_dashboard' },
  { path: '/portal/inventario', label: 'Inventario', icon: 'apartment' },
  { path: '/portal/operaciones', label: 'Operaciones', icon: 'assignment_turned_in' },
  { path: '/portal/prospectos', label: 'Prospectos', icon: 'group_work' },
  { path: '/portal/equipo', label: 'Equipo', icon: 'badge' },
  { path: '/portal/historial', label: 'Historial', icon: 'history_edu' },
  { path: '/portal/configuracion', label: 'Configuración', icon: 'tune' },
];

export const ASESOR_NAV: PortalNavItem[] = [
  { path: '/portal/resumen', label: 'Resumen', icon: 'dashboard' },
  { path: '/portal/inventario', label: 'Inventario', icon: 'apartment' },
  { path: '/portal/mis-apartados', label: 'Mis apartados', icon: 'bookmark' },
  { path: '/portal/prospectos', label: 'Prospectos', icon: 'group' },
];

export function navForRole(role: PortalRole): PortalNavItem[] {
  return role === 'admin' ? ADMIN_NAV : ASESOR_NAV;
}
