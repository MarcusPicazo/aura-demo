import { usePortalStore } from '../../store/portalStore';
import { Icon } from '../../components/Icon';

export function ConfiguracionAdmin() {
  const projectSettings = usePortalStore((state) => state.projectSettings);
  const updateProjectSettings = usePortalStore((state) => state.updateProjectSettings);
  const units = usePortalStore((state) => state.units);

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <div>
        <div className="mb-1 flex items-center gap-1.5 text-label-sm font-ui uppercase tracking-wider text-on-surface-variant">
          <span>Gestión Comercial</span>
          <Icon name="chevron_right" className="text-[14px]" />
          <span className="font-semibold text-secondary">Configuración</span>
        </div>
        <h1 className="font-serif text-headline-lg tracking-tight text-primary">Configuración de Proyecto</h1>
        <p className="mt-1 font-ui text-body-md text-on-surface-variant">
          Ajustes del portal para Torre Aura Del Valle — no modifican el motor 3D público, solo el comportamiento
          comercial dentro del panel.
        </p>
      </div>

      <div className="rounded-xl bg-surface-container-lowest p-6 shadow-sm">
        <span className="text-label-sm font-ui font-semibold uppercase tracking-wider text-on-surface-variant">
          Información general
        </span>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InfoTile label="Desarrollo" value="Torre Aura Del Valle" />
          <InfoTile label="Ubicación" value="Col. Del Valle, CDMX" />
          <InfoTile label="Unidades catalogadas" value={`${units.length}`} />
          <InfoTile label="Fase comercial" value="Preventa 2" />
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-xl bg-surface-container-lowest p-6 shadow-sm">
        <span className="text-label-sm font-ui font-semibold uppercase tracking-wider text-on-surface-variant">
          Comportamiento comercial
        </span>

        <SettingToggle
          icon="visibility"
          label="Mostrar precios exactos en el selector público"
          description="Si se apaga, el selector muestra rangos de precio en vez del monto exacto."
          checked={projectSettings.showExactPricesPublicly}
          onChange={(checked) => updateProjectSettings({ showExactPricesPublicly: checked })}
        />
        <SettingToggle
          icon="notifications_active"
          label="Notificar apartados por vencer"
          description="Avisa al equipo cuando un apartado esté a menos de 24 horas de expirar."
          checked={projectSettings.notifyExpiringHolds}
          onChange={(checked) => updateProjectSettings({ notifyExpiringHolds: checked })}
        />

        <div className="flex items-center justify-between rounded-lg bg-surface-container-low p-4">
          <div className="flex flex-col">
            <span className="font-ui text-body-md font-semibold text-on-surface">Vigencia por defecto de apartados nuevos</span>
            <span className="mt-0.5 font-ui text-body-sm text-on-surface-variant">Horas que se bloquea la unidad al crear un apartado.</span>
          </div>
          <select
            value={projectSettings.defaultHoldHours}
            onChange={(event) => updateProjectSettings({ defaultHoldHours: Number(event.target.value) })}
            className="rounded-lg bg-surface-container-lowest px-3 py-2 font-ui text-body-sm text-on-surface shadow-sm outline-none"
          >
            <option value={24}>24 horas</option>
            <option value={48}>48 horas</option>
            <option value={72}>72 horas</option>
          </select>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl bg-surface-container-low p-4">
        <Icon name="info" className="mt-0.5 text-[20px] text-secondary" />
        <p className="font-ui text-body-sm text-on-surface-variant">
          Los datos generales del desarrollo (nombre, marca, geometría de la torre) viven en{' '}
          <code className="rounded bg-surface-container-high px-1 py-0.5 text-[12px]">src/config/aura.json</code> y se
          cambian por archivo, no desde aquí — así un cliente nuevo se resuelve sin tocar código.
        </p>
      </div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-lg bg-surface-container-low p-3">
      <span className="text-label-sm font-ui uppercase tracking-wider text-on-surface-variant">{label}</span>
      <span className="mt-0.5 font-ui text-title-md text-on-surface">{value}</span>
    </div>
  );
}

function SettingToggle({
  icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg bg-surface-container-low p-4">
      <div className="flex items-start gap-3">
        <Icon name={icon} className="mt-0.5 text-[20px] text-secondary" />
        <div className="flex flex-col">
          <span className="font-ui text-body-md font-semibold text-on-surface">{label}</span>
          <span className="mt-0.5 font-ui text-body-sm text-on-surface-variant">{description}</span>
        </div>
      </div>
      <label className="relative inline-flex shrink-0 cursor-pointer items-center">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" />
        <div className="h-6 w-11 rounded-full bg-surface-container-high transition-colors peer-checked:bg-secondary" />
        <div className="absolute left-0.5 h-5 w-5 rounded-full bg-surface-container-lowest shadow transition-transform peer-checked:translate-x-5" />
      </label>
    </div>
  );
}
