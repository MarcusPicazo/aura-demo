import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import type { PortalUser } from '../types';
import { Icon } from '../components/Icon';
import { usePortalStore } from '../store/portalStore';

interface BottomNavItem {
  path: string;
  label: string;
  icon: string;
  badge?: number;
}

function primaryItemsForRole(user: PortalUser, pendingApprovalsCount: number, myHoldsCount: number): BottomNavItem[] {
  if (user.role === 'admin') {
    return [
      { path: '/portal/resumen', label: 'Inicio', icon: 'dashboard' },
      { path: '/portal/inventario', label: 'Inventario', icon: 'apartment' },
      { path: '/portal/operaciones', label: 'Operaciones', icon: 'assignment_turned_in', badge: pendingApprovalsCount },
      { path: '/portal/prospectos', label: 'Prospectos', icon: 'group_work' },
    ];
  }
  return [
    { path: '/portal/resumen', label: 'Inicio', icon: 'dashboard' },
    { path: '/portal/inventario', label: 'Inventario', icon: 'apartment' },
    { path: '/portal/mis-apartados', label: 'Apartados', icon: 'receipt_long', badge: myHoldsCount },
    { path: '/portal/prospectos', label: 'Prospectos', icon: 'groups' },
  ];
}

const ADMIN_MORE_ITEMS: BottomNavItem[] = [
  { path: '/portal/equipo', label: 'Equipo y permisos', icon: 'badge' },
  { path: '/portal/historial', label: 'Historial', icon: 'history_edu' },
  { path: '/portal/configuracion', label: 'Configuración', icon: 'tune' },
];

/** Barra inferior para pantallas angostas (< lg): el sidebar fijo de escritorio se
 *  oculta por completo ahí (ver PortalSidebar), así que en móvil la navegación vive
 *  aquí — mismo patrón que las pantallas móviles del export de Stitch. */
export function PortalBottomNav({ user }: { user: PortalUser }) {
  const logout = usePortalStore((state) => state.logout);
  const pendingApprovalsCount = usePortalStore((state) => state.approvals.filter((a) => a.status === 'pendiente').length);
  const myHoldsCount = usePortalStore(
    (state) => state.holds.filter((h) => h.advisorId === user.id && (h.status === 'vigente' || h.status === 'por_vencer')).length,
  );
  const [moreOpen, setMoreOpen] = useState(false);

  const items = primaryItemsForRole(user, pendingApprovalsCount, myHoldsCount);

  return (
    <>
      {user.role === 'admin' && moreOpen && (
        <>
          <button
            type="button"
            aria-label="Cerrar menú"
            className="fixed inset-0 z-[55] bg-primary/40 backdrop-blur-sm lg:hidden"
            onClick={() => setMoreOpen(false)}
          />
          <div className="fixed bottom-16 left-0 right-0 z-[56] rounded-t-2xl bg-surface-container-lowest p-2 pb-[env(safe-area-inset-bottom,0px)] shadow-2xl lg:hidden">
            {ADMIN_MORE_ITEMS.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 rounded-lg px-4 py-3 font-ui text-body-md text-on-surface transition-colors hover:bg-surface-container-high"
              >
                <Icon name={item.icon} className="text-[20px] text-on-surface-variant" />
                <span>{item.label}</span>
              </NavLink>
            ))}
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                logout();
              }}
              className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left font-ui text-body-md text-error transition-colors hover:bg-error-container/40"
            >
              <Icon name="logout" className="text-[20px]" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </>
      )}

      <nav
        className="fixed inset-x-0 bottom-0 z-50 flex h-16 items-center justify-around border-t border-surface-container-high bg-surface/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-xl lg:hidden"
        aria-label="Navegación principal"
      >
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `relative flex min-w-[64px] flex-col items-center justify-center gap-0.5 font-ui text-label-sm transition-colors ${
                isActive ? 'font-semibold text-primary' : 'text-on-surface-variant'
              }`
            }
          >
            <span className="relative">
              <Icon name={item.icon} className="text-[22px]" />
              {!!item.badge && item.badge > 0 && (
                <span className="absolute -right-2 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-on-secondary">
                  {item.badge}
                </span>
              )}
            </span>
            <span>{item.label}</span>
          </NavLink>
        ))}
        {user.role === 'admin' && (
          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            className="flex min-w-[64px] flex-col items-center justify-center gap-0.5 font-ui text-label-sm text-on-surface-variant"
          >
            <Icon name="more_horiz" className="text-[22px]" />
            <span>Más</span>
          </button>
        )}
      </nav>
    </>
  );
}
