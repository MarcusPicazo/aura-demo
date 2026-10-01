import { NavLink } from 'react-router-dom';
import type { PortalUser } from '../types';
import { navForRole } from './navConfig';
import { Icon } from '../components/Icon';

interface PortalSidebarProps {
  user: PortalUser;
  availableCount: number;
  pendingApprovalsCount: number;
  teamCount: number;
  onOpenUserMenu: () => void;
}

export function PortalSidebar({ user, availableCount, pendingApprovalsCount, teamCount, onOpenUserMenu }: PortalSidebarProps) {
  const items = navForRole(user.role);

  return (
    <aside className="fixed left-0 top-0 z-50 hidden h-full w-72 flex-col justify-between bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)] select-none lg:flex">
      <div className="flex flex-col">
        <div className="flex h-20 items-center gap-2 px-6">
          <img src="/portal/emblem.svg" alt="" className="h-8 w-8 shrink-0" />
          <div className="flex flex-col leading-none">
            <span className="font-serif text-headline-sm tracking-tight text-primary">AURA</span>
            <span className="mt-1 text-label-sm font-ui uppercase tracking-widest text-secondary">{user.roleLabel}</span>
          </div>
        </div>

        <div className="px-4 py-2">
          <div className="rounded-lg bg-surface-container-low p-2">
            <div className="flex items-center justify-between">
              <div className="flex min-w-0 flex-col pr-1">
                <span className="text-label-sm font-ui uppercase tracking-wider text-on-surface-variant">Proyecto activo</span>
                <div className="mt-0.5 flex items-center gap-1">
                  <span className="truncate text-body-md font-ui font-semibold text-on-surface">Torre Aura Del Valle</span>
                  <Icon name="unfold_more" className="shrink-0 text-[18px] text-on-surface-variant" />
                </div>
              </div>
              <div className="flex h-7 shrink-0 items-center justify-center rounded bg-surface-container-lowest px-1">
                <span className="text-label-sm font-ui font-semibold text-secondary">{availableCount} Disp.</span>
              </div>
            </div>
          </div>
        </div>

        <nav className="mt-2 flex flex-col gap-1 px-4">
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `group flex items-center justify-between rounded-lg px-4 py-2 font-ui text-body-md transition-all ${
                  isActive
                    ? 'bg-primary font-semibold text-on-primary shadow-[0_2px_8px_rgba(37,37,37,0.08)]'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`
              }
            >
              <span className="flex items-center gap-2">
                <Icon name={item.icon} className="text-[20px]" />
                <span>{item.label}</span>
              </span>
              {item.path === '/portal/operaciones' && pendingApprovalsCount > 0 && (
                <span className="rounded-full bg-secondary-container px-2 py-0.5 text-label-sm font-ui font-semibold text-on-secondary-container">
                  {pendingApprovalsCount} pend.
                </span>
              )}
              {item.path === '/portal/equipo' && (
                <span className="text-label-sm font-ui text-on-surface-variant">{teamCount} asesores</span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="flex flex-col gap-2 bg-surface-container-lowest p-4">
        <a
          href="/aura"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between rounded-lg bg-surface-container-low px-4 py-2 text-secondary transition-colors hover:bg-surface-container-high hover:text-on-surface"
        >
          <span className="flex items-center gap-1">
            <Icon name="open_in_new" className="text-[18px]" />
            <span className="text-label-md font-ui font-medium">Abrir selector público</span>
          </span>
          <Icon name="chevron_right" className="text-[16px]" />
        </a>
        <div className="flex items-center justify-between rounded-lg bg-surface-container-low p-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary">
              <span className="text-body-sm font-ui font-bold text-on-primary">{user.initials}</span>
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-body-md font-ui font-semibold text-on-surface">{user.name}</span>
              <span className="truncate text-label-sm font-ui text-on-surface-variant">{user.roleLabel}</span>
            </div>
          </div>
          <button
            type="button"
            aria-label="Menú de usuario"
            onClick={onOpenUserMenu}
            className="rounded p-1 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
          >
            <Icon name="more_vert" className="text-[20px]" />
          </button>
        </div>
      </div>
    </aside>
  );
}
