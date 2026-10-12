import { esText } from '../i18n/localized';
import { useEffect, useState } from 'react';
import { fetchDevelopmentUnits } from '../lib/supabase';
import { updateUnit } from '../lib/supabaseAdmin';
import { STATUS_LABELS } from '../lib/status';
import { assignBuildings } from '../lib/buildings';
import { activeConfig as auraConfig, buildings, unitIdentity } from '../config/active';
import type { Unit, UnitStatus } from '../types';

const buildingNames = new Map(buildings.map((building) => [building.id, esText(building.name)]));
const buildingOrder = new Map(buildings.map((building, index) => [building.id, index]));
const STATUS_OPTIONS: UnitStatus[] = ['available', 'reserved', 'sold'];

interface PriceCellProps {
  price: number;
  onSave: (price: number) => Promise<void>;
}

// `key={price}` en el caller remonta esta celda cuando el precio cambia por fuera
// (guardado, Realtime), así el estado local siempre arranca sincronizado sin useEffect.
function PriceCell({ price, onSave }: PriceCellProps) {
  const [value, setValue] = useState(String(price));
  const [saving, setSaving] = useState(false);

  const parsed = Number(value);
  const isValid = value !== '' && !Number.isNaN(parsed) && parsed > 0;
  const isDirty = isValid && parsed !== price;

  async function handleSave() {
    if (!isDirty) return;
    setSaving(true);
    await onSave(parsed);
    setSaving(false);
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="w-28 rounded border border-neutral-300 px-2 py-1 text-sm"
      />
      {isDirty && (
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="text-xs font-medium text-neutral-900 underline disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      )}
    </div>
  );
}

/** SPEC §4.1: tabla de unidades del admin, con selector de estado y precio editable. */
export function UnitsTable() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDevelopmentUnits(auraConfig.slug)
      .then((result) => setUnits(assignBuildings(result.units, buildings, unitIdentity.defaultBuildingId)))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'No se pudieron cargar las unidades.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleStatusChange(unit: Unit, status: UnitStatus) {
    const previousStatus = unit.status;
    setUnits((current) => current.map((u) => (u.id === unit.id ? { ...u, status } : u)));
    try {
      await updateUnit(unit.id, { status });
    } catch (err) {
      console.error('No se pudo actualizar el estado:', err);
      setUnits((current) => current.map((u) => (u.id === unit.id ? { ...u, status: previousStatus } : u)));
    }
  }

  async function handlePriceSave(unit: Unit, price: number) {
    try {
      await updateUnit(unit.id, { price });
      setUnits((current) => current.map((u) => (u.id === unit.id ? { ...u, price } : u)));
    } catch (err) {
      console.error('No se pudo actualizar el precio:', err);
    }
  }

  if (loading) return <p className="p-6 text-sm text-neutral-500">Cargando unidades…</p>;
  if (error) return <p className="p-6 text-sm text-red-600">{error}</p>;

  // Por edificio (en el orden del config) y, dentro de cada uno, por código.
  const sortedUnits = [...units].sort(
    (a, b) =>
      (buildingOrder.get(a.buildingId) ?? 0) - (buildingOrder.get(b.buildingId) ?? 0) || Number(a.code) - Number(b.code),
  );

  return (
    <div className="overflow-x-auto p-6">
      <table className="min-w-full divide-y divide-neutral-200 text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-neutral-500">
            {unitIdentity.multi && <th className="py-2 pr-4">Edificio</th>}
            <th className="py-2 pr-4">Código</th>
            <th className="py-2 pr-4">Piso</th>
            <th className="py-2 pr-4">Tipo</th>
            <th className="py-2 pr-4">Estado</th>
            <th className="py-2 pr-4">Precio</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {sortedUnits.map((unit) => (
            <tr key={unit.id}>
              {unitIdentity.multi && <td className="py-2 pr-4 text-neutral-600">{buildingNames.get(unit.buildingId) ?? unit.buildingId}</td>}
              <td className="py-2 pr-4 font-medium text-neutral-900">{unit.code}</td>
              <td className="py-2 pr-4 text-neutral-600">{unit.floor}</td>
              <td className="py-2 pr-4 text-neutral-600">{unit.type}</td>
              <td className="py-2 pr-4">
                <select
                  value={unit.status}
                  onChange={(event) => handleStatusChange(unit, event.target.value as UnitStatus)}
                  className="rounded border border-neutral-300 px-2 py-1 text-sm"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-2 pr-4">
                <PriceCell key={unit.price} price={unit.price} onSave={(price) => handlePriceSave(unit, price)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
