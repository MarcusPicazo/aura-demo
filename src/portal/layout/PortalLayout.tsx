import { useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { usePortalStore } from '../store/portalStore';
import { PortalSidebar } from './PortalSidebar';
import { PortalHeader } from './PortalHeader';
import { PortalBottomNav } from './PortalBottomNav';
import { Icon } from '../components/Icon';
import '../portal-theme.css';

/** Shell de rutas autenticadas: si no hay sesión mock, manda a /portal/login.
 *  Header y acciones rápidas cambian según el rol (admin vs asesor), igual que en el
 *  export de Stitch — dos experiencias, un solo layout. */
export function PortalLayout() {
  const currentUser = usePortalStore((state) => state.currentUser);
  const logout = usePortalStore((state) => state.logout);
  const units = usePortalStore((state) => state.units);
  const approvals = usePortalStore((state) => state.approvals);
  const team = usePortalStore((state) => state.team);
  const location = useLocation();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  if (!currentUser) {
    return <Navigate to="/portal/login" replace />;
  }

  const availableCount = units.filter((unit) => unit.status === 'available').length;
  const pendingApprovalsCount = approvals.filter((approval) => approval.status === 'pendiente').length;

  const primaryAction =
    currentUser.role === 'admin'
      ? { label: 'Nueva operación', icon: 'add_circle', onClick: () => navigate('/portal/operaciones') }
      : { label: 'Registrar prospecto', icon: 'person_add', onClick: () => navigate('/portal/prospectos') };

  const secondaryAction =
    currentUser.role === 'admin'
      ? { label: 'Invitar asesor', icon: 'person_add', onClick: () => navigate('/portal/equipo') }
      : undefined;

  return (
    <div className="portal-root min-h-screen">
      <PortalSidebar
        user={currentUser}
        availableCount={availableCount}
        pendingApprovalsCount={pendingApprovalsCount}
        teamCount={team.length}
        onOpenUserMenu={() => setUserMenuOpen((open) => !open)}
      />

      {userMenuOpen && (
        <>
          <button
            type="button"
            aria-label="Cerrar menú"
            className="fixed inset-0 z-[55] cursor-default"
            onClick={() => setUserMenuOpen(false)}
          />
          <div className="fixed right-4 top-16 z-[56] w-56 rounded-lg bg-surface-container-lowest p-1.5 shadow-[0_20px_40px_-8px_rgba(37,37,37,0.18)] lg:bottom-20 lg:left-4 lg:right-auto lg:top-auto">
            <button
              type="button"
              onClick={() => {
                setUserMenuOpen(false);
                logout();
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left font-ui text-body-sm text-on-surface transition-colors hover:bg-surface-container-high"
            >
              <Icon name="logout" className="text-[18px] text-on-surface-variant" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </>
      )}

      <PortalHeader
        user={currentUser}
        searchPlaceholder={
          currentUser.role === 'admin'
            ? 'Buscar por departamento, asesor, folio o cliente...'
            : 'Buscar departamento, cliente o folio...'
        }
        primaryAction={primaryAction}
        secondaryAction={secondaryAction}
        onOpenUserMenu={() => setUserMenuOpen((open) => !open)}
      />

      <main className="min-h-screen w-full bg-surface pb-24 pt-16 lg:pb-10 lg:pl-72 lg:pt-20">
        <div key={location.pathname} className="animate-portal-page w-full px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>

      <PortalBottomNav user={currentUser} />
    </div>
  );
}
