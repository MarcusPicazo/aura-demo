import { Html } from '@react-three/drei';
import { STATUS_COLORS } from '../lib/status';
import { useI18n } from '../i18n/useI18n';
import type { UnitStatus } from '../types';

export interface BuildingLabelItem {
  id: string;
  name: string;
  /** Dónde flota el rótulo en el mundo: sobre el centro de la azotea. */
  position: [number, number, number];
  /** Unidades disponibles y totales; null en un edificio sin unidades a la venta (casa club, amenidades). */
  availability: { available: number; total: number } | null;
  /** Estado que resume al edificio, para el punto de color. */
  status: UnitStatus | null;
  /** Texto de apoyo de un edificio sin unidades ("Casa club"). */
  caption?: string;
}

interface BuildingLabelsProps {
  items: BuildingLabelItem[];
  /** El inventario ya cargó: un edificio sin unidades dice que no tiene, en vez de "Cargando…". */
  inventoryLoaded: boolean;
  onSelect: (id: string) => void;
}

/**
 * Rótulo de cada edificio en el masterplan con su contador de disponibilidad ("18 de 46
 * disponibles"). Son elementos HTML anclados a un punto 3D (no texturas): se leen nítidos a
 * cualquier tamaño, el lector de pantalla los ve y tocar el rótulo entra al edificio igual
 * que tocar el volumen. Siguen a la cámara, así que se actualizan solos al orbitar.
 */
/** El subtítulo de un edificio sin ventas ("Casa club") solo se muestra si no repite lo que ya dice su nombre. */
function captionAddsInfo(item: BuildingLabelItem): boolean {
  return Boolean(item.caption) && !item.name.toLowerCase().includes((item.caption ?? "").toLowerCase());
}

export function BuildingLabels({ items, inventoryLoaded, onSelect }: BuildingLabelsProps) {
  const { t } = useI18n();
  return (
    <>
      {items.map((item) => (
        <Html key={item.id} position={item.position} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <button
            type="button"
            onClick={() => onSelect(item.id)}
            className="pointer-events-auto flex cursor-pointer flex-col items-center whitespace-nowrap rounded-xl bg-[var(--brand-background)]/95 px-2.5 py-1 text-center shadow-lg backdrop-blur transition-transform hover:scale-105 sm:px-3 sm:py-1.5"
          >
            <span className="font-serif text-[13px] leading-tight text-neutral-900 sm:text-sm">{item.name}</span>
            <span className="flex items-center gap-1.5 text-[11px] leading-tight text-neutral-600 sm:text-xs">
              {item.status && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: STATUS_COLORS[item.status] }} />}
              {item.availability
                ? item.availability.total > 0
                  ? t('legend.count', { available: item.availability.available, total: item.availability.total })
                  : inventoryLoaded
                    ? t('buildingLabels.noUnits')
                    : t('buildingLabels.loading')
                : null}
              {!item.availability && captionAddsInfo(item) && item.caption}
            </span>
          </button>
        </Html>
      ))}
    </>
  );
}
