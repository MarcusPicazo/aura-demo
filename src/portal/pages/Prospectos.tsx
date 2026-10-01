import { usePortalStore } from '../store/portalStore';
import { ProspectosAdmin } from './admin/ProspectosAdmin';
import { ProspectosAsesor } from './asesor/ProspectosAsesor';

export function Prospectos() {
  const role = usePortalStore((state) => state.currentUser!.role);
  return role === 'admin' ? <ProspectosAdmin /> : <ProspectosAsesor />;
}
