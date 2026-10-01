import type { PortalUser } from '../types';
import { Icon } from '../components/Icon';

interface PortalHeaderProps {
  user: PortalUser;
  searchPlaceholder: string;
  primaryAction: { label: string; icon: string; onClick: () => void };
  secondaryAction?: { label: string; icon: string; onClick: () => void };
  onOpenUserMenu: () => void;
}

export function PortalHeader({ user, searchPlaceholder, primaryAction, secondaryAction, onOpenUserMenu }: PortalHeaderProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between gap-3 bg-surface-container-lowest/90 px-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl sm:px-6 lg:left-72 lg:h-20 lg:px-8">
      <img src="/portal/emblem.svg" alt="AURA" className="h-7 w-7 shrink-0 lg:hidden" />
      <div className="flex max-w-xl flex-1 items-center gap-6">
        <div className="relative w-full">
          <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            className="w-full rounded-lg bg-surface-container-low py-2.5 pl-11 pr-14 font-ui text-body-md text-on-surface placeholder:text-on-surface-variant focus:bg-surface-container-lowest focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <kbd className="absolute right-4 top-1/2 hidden -translate-y-1/2 rounded bg-surface-container-lowest px-2 py-0.5 text-label-sm font-ui text-on-surface-variant shadow-sm lg:block">
            ⌘K
          </kbd>
        </div>
      </div>
      <div className="flex items-center gap-3 lg:gap-6">
        {user.role === 'admin' && (
          <>
            <div className="hidden items-center gap-1 rounded-full bg-surface-container-low px-2 py-1.5 text-on-surface-variant lg:flex">
              <span className="h-2 w-2 animate-pulse rounded-full bg-secondary" />
              <span className="text-label-sm font-ui font-medium">Inventario en vivo</span>
            </div>
            <div className="hidden h-6 w-px bg-surface-container-high lg:block" />
          </>
        )}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            aria-label="Notificaciones y solicitudes pendientes"
            className="relative rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
          >
            <Icon name="notifications" className="text-[22px]" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-secondary" />
          </button>
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              aria-label={secondaryAction.label}
              className="flex items-center gap-1.5 rounded-lg bg-surface-container-lowest px-2.5 py-2 font-ui text-label-md text-primary shadow-[0_1px_4px_rgba(0,0,0,0.04)] transition-all hover:bg-surface-container-high hover:text-on-surface active:scale-[0.97] sm:px-4"
            >
              <Icon name={secondaryAction.icon} className="text-[18px]" />
              <span className="hidden sm:inline">{secondaryAction.label}</span>
            </button>
          )}
          <button
            type="button"
            onClick={primaryAction.onClick}
            aria-label={primaryAction.label}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-2 font-ui text-label-md font-medium text-on-primary shadow-sm transition-all hover:bg-primary-container active:scale-[0.97] sm:px-4"
          >
            <Icon name={primaryAction.icon} className="text-[18px]" />
            <span className="hidden sm:inline">{primaryAction.label}</span>
          </button>
          <button
            type="button"
            onClick={onOpenUserMenu}
            aria-label="Menú de usuario"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary lg:hidden"
          >
            <span className="font-ui text-label-sm font-bold text-on-primary">{user.initials}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
