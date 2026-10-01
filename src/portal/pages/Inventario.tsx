import { usePortalStore } from '../store/portalStore';
import { InventarioAdmin } from './admin/InventarioAdmin';
import { InventarioAsesor } from './asesor/InventarioAsesor';

export function Inventario() {
  const role = usePortalStore((state) => state.currentUser!.role);
  return role === 'admin' ? <InventarioAdmin /> : <InventarioAsesor />;
}
