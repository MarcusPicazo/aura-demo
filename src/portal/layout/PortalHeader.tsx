import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalStore } from '../store/portalStore';
import { formatCurrency, formatRelativeExpiry } from '../lib/format';
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
      <GlobalSearch user={user} placeholder={searchPlaceholder} />
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
          <NotificationsBell user={user} />
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

function GlobalSearch({ user, placeholder }: { user: PortalUser; placeholder: string }) {
  const navigate = useNavigate();
  const units = usePortalStore((state) => state.units);
  const prospectos = usePortalStore((state) => state.prospectos);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const scopedProspectos = user.role === 'admin' ? prospectos : prospectos.filter((p) => p.advisorId === user.id);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return { units: [], prospectos: [] };
    return {
      units: units.filter((unit) => unit.code.toLowerCase().includes(term) || unit.typeLabel.toLowerCase().includes(term)).slice(0, 5),
      prospectos: scopedProspectos.filter((p) => p.name.toLowerCase().includes(term) || p.phone.includes(term)).slice(0, 5),
    };
  }, [query, units, scopedProspectos]);

  const hasResults = results.units.length > 0 || results.prospectos.length > 0;

  function goToUnit(code: string) {
    navigate(`/portal/inventario/${code}`);
    setQuery('');
    setOpen(false);
  }

  function goToProspectos() {
    navigate('/portal/prospectos');
    setQuery('');
    setOpen(false);
  }

  return (
    <div className="relative flex max-w-xl flex-1 items-center gap-6">
      <div className="relative w-full">
        <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant" />
        <input
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="w-full rounded-lg bg-surface-container-low py-2.5 pl-11 pr-14 font-ui text-body-md text-on-surface placeholder:text-on-surface-variant focus:bg-surface-container-lowest focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <kbd className="absolute right-4 top-1/2 hidden -translate-y-1/2 rounded bg-surface-container-lowest px-2 py-0.5 text-label-sm font-ui text-on-surface-variant shadow-sm lg:block">
          ⌘K
        </kbd>
      </div>

      {open && query.trim() && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-xl bg-surface-container-lowest p-2 shadow-[0_20px_40px_-8px_rgba(37,37,37,0.18)]">
          {!hasResults && <p className="p-3 text-center font-ui text-body-sm text-on-surface-variant">Sin resultados para "{query}".</p>}
          {results.units.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <span className="px-2 py-1 text-label-sm font-ui uppercase tracking-wider text-on-surface-variant">Unidades</span>
              {results.units.map((unit) => (
                <button
                  key={unit.id}
                  type="button"
                  onMouseDown={() => goToUnit(unit.code)}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-left font-ui text-body-sm text-on-surface transition-colors hover:bg-surface-container-low"
                >
                  <span className="font-semibold">Depto {unit.code}</span>
                  <span className="text-on-surface-variant">{formatCurrency(unit.price)}</span>
                </button>
              ))}
            </div>
          )}
          {results.prospectos.length > 0 && (
            <div className="mt-1 flex flex-col gap-0.5">
              <span className="px-2 py-1 text-label-sm font-ui uppercase tracking-wider text-on-surface-variant">Prospectos</span>
              {results.prospectos.map((prospecto) => (
                <button
                  key={prospecto.id}
                  type="button"
                  onMouseDown={goToProspectos}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-left font-ui text-body-sm text-on-surface transition-colors hover:bg-surface-container-low"
                >
                  <span className="font-semibold">{prospecto.name}</span>
                  <span className="text-on-surface-variant">{prospecto.phone}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationsBell({ user }: { user: PortalUser }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const approvals = usePortalStore((state) => state.approvals);
  const holds = usePortalStore((state) => state.holds);

  const pendingApprovals = approvals.filter((approval) => approval.status === 'pendiente');
  const myExpiring = holds.filter(
    (hold) => hold.advisorId === user.id && (hold.status === 'vigente' || hold.status === 'por_vencer'),
  );

  const items =
    user.role === 'admin'
      ? pendingApprovals.map((approval) => ({
          id: approval.id,
          title: `Depto ${approval.unitCode} · ${approval.kind === 'venta' ? 'Confirmación de venta' : approval.kind === 'cancelacion' ? 'Cancelación' : 'Prórroga'}`,
          subtitle: approval.buyerName,
          onClick: () => navigate('/portal/operaciones'),
        }))
      : myExpiring.map((hold) => ({
          id: hold.id,
          title: `Depto ${hold.unitCode} · vence en ${formatRelativeExpiry(hold.expiresAt)}`,
          subtitle: `Folio #${hold.folio}`,
          onClick: () => navigate('/portal/mis-apartados'),
        }));

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Notificaciones y solicitudes pendientes"
        onClick={() => setOpen((value) => !value)}
        className="relative rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
      >
        <Icon name="notifications" className="text-[22px]" />
        {items.length > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-secondary" />}
      </button>

      {open && (
        <>
          <button type="button" aria-label="Cerrar notificaciones" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl bg-surface-container-lowest shadow-[0_20px_40px_-8px_rgba(37,37,37,0.18)]">
            <div className="border-b border-surface-container-high px-4 py-3">
              <span className="font-ui text-title-md text-primary">
                {user.role === 'admin' ? 'Solicitudes pendientes' : 'Apartados por vencer'}
              </span>
            </div>
            <div className="max-h-72 overflow-y-auto p-2">
              {items.length === 0 && <p className="p-3 text-center font-ui text-body-sm text-on-surface-variant">Nada pendiente por ahora.</p>}
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    item.onClick();
                    setOpen(false);
                  }}
                  className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface-container-low"
                >
                  <span className="font-ui text-body-sm font-semibold text-on-surface">{item.title}</span>
                  <span className="font-ui text-label-sm text-on-surface-variant">{item.subtitle}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
