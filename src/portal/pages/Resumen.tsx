import { usePortalStore } from '../store/portalStore';
import { ResumenComercial } from './admin/ResumenComercial';
import { ResumenAsesor } from './asesor/ResumenAsesor';

/** PortalLayout ya garantiza que hay sesión antes de montar esta ruta. */
export function Resumen() {
  const role = usePortalStore((state) => state.currentUser!.role);
  return role === 'admin' ? <ResumenComercial /> : <ResumenAsesor />;
}
