import { useI18n } from '../i18n/useI18n';

interface BuildingInfoCardProps {
  name: string;
  description?: string;
  /** Una línea sobre qué es (p. ej. "Casa club"). */
  kindLabel: string;
  visible: boolean;
}

/**
 * Tarjeta de un edificio sin unidades a la venta (casa club, amenidades): al entrar, la cámara
 * lo encuadra igual que a una torre, pero no hay selector de unidades — esto dice qué es.
 */
export function BuildingInfoCard({ name, description, kindLabel, visible }: BuildingInfoCardProps) {
  const { t } = useI18n();
  return (
    <div
      className={`pointer-events-auto fixed bottom-[4.5rem] left-4 right-4 z-20 sm:bottom-4 rounded-2xl border-t-4 border-[var(--brand-accent)] bg-white p-4 shadow-2xl transition-[opacity,transform] duration-300 ease-elegant motion-reduce:transition-none sm:left-1/2 sm:right-auto sm:w-96 sm:-translate-x-1/2 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{kindLabel}</p>
      <h2 className="font-serif text-xl text-neutral-900">{name}</h2>
      {description && <p className="mt-1 text-sm text-neutral-600">{description}</p>}
      <p className="mt-2 text-xs text-neutral-500">{t('buildingInfo.noUnits')}</p>
    </div>
  );
}
