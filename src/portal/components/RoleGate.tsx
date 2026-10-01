import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePortalStore } from '../store/portalStore';
import type { PortalRole } from '../types';

interface RoleGateProps {
  allow: PortalRole[];
  children: ReactNode;
}

/** Bloquea una ruta del portal por rol. Sin esto, un asesor que escribiera
 *  /portal/equipo (o cualquier otra ruta solo-admin) directo en la URL la veía
 *  completa aunque el menú no se la mostrara — el sidebar ocultaba el link, pero
 *  nada protegía la ruta en sí. */
export function RoleGate({ allow, children }: RoleGateProps) {
  const role = usePortalStore((state) => state.currentUser?.role);
  if (!role || !allow.includes(role)) {
    return <Navigate to="/portal/resumen" replace />;
  }
  return <>{children}</>;
}
