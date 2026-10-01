import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePortalStore } from '../../store/portalStore';
import { Icon } from '../../components/Icon';
import { StatusChip } from '../../components/StatusChip';
import { Pagination } from '../../components/Pagination';
import { PriceEditModal } from '../../components/PriceEditModal';
import { formatCurrency } from '../../lib/format';
import { applyUnitFilters, DEFAULT_UNIT_FILTERS, type UnitFilters } from '../../lib/unitFilters';
import type { PortalUnit, UnitStatus } from '../../types';

const PAGE_SIZE = 8;

const METRIC_META: { status: 'total' | UnitStatus; label: string; dotClass: string }[] = [
  { status: 'total', label: 'Unidades Totales', dotClass: '' },
  { status: 'available', label: 'Disponibles', dotClass: 'bg-surface-tint' },
  { status: 'reserved', label: 'Apartadas', dotClass: 'bg-secondary' },
  { status: 'sold', label: 'Vendidas / Firma', dotClass: 'bg-primary' },
  { status: 'blocked', label: 'Bloqueadas', dotClass: 'bg-error' },
];

export function InventarioAdmin() {
  const units = usePortalStore((state) => state.units);
  const [filters, setFilters] = useState<UnitFilters>(DEFAULT_UNIT_FILTERS);
  const [page, setPage] = useState(1);
  const [editingCode, setEditingCode] = useState<string | null>(null);

  const filtered = useMemo(() => applyUnitFilters(units, filters), [units, filters]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageUnits = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const editingUnit = editingCode ? units.find((unit) => unit.code === editingCode) ?? null : null;

  function updateFilters(patch: Partial<UnitFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }

  const total = units.length;
  const countFor = (status: UnitStatus) => units.filter((unit) => unit.status === status).length;

  return (
    <div className="flex w-full flex-col">
      <div className="mb-6 flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-label-sm font-ui uppercase tracking-widest text-on-surface-variant">
              <span>AURA Architecture &amp; Development</span>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-secondary" />
              <span>Torre Aura Del Valle</span>
            </div>
            <h1 className="font-serif text-headline-lg font-medium tracking-tight text-primary">
              Inventario y Control de Precios
            </h1>
            <p className="mt-1 font-ui text-body-md text-on-surface-variant">
              Matriz comercial con control de bloqueo transaccional, vigencia de precios y auditoría de disponibilidad
              en vivo.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start md:self-auto">
            <div className="flex items-center gap-1.5 rounded-lg bg-surface-container px-4 py-2 shadow-sm">
              <Icon name="verified_user" className="text-[18px] text-secondary" />
              <span className="font-ui text-label-sm text-on-surface">Modo Administrador Autorizado</span>
            </div>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-lg bg-surface-container-lowest px-4 py-2 font-ui text-label-md text-primary shadow-sm transition-colors hover:bg-surface-container-high active:scale-[0.97]"
            >
              <Icon name="file_download" className="text-[18px]" />
              <span>Descargar Matriz</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {METRIC_META.map((meta) => {
            const count = meta.status === 'total' ? total : countFor(meta.status);
            const pct = ((count / total) * 100).toFixed(1);
            return (
              <div
                key={meta.status}
                className={`flex flex-col justify-between rounded-xl bg-surface-container-lowest p-4 shadow-sm ${meta.status === 'blocked' ? 'col-span-2 lg:col-span-1' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-label-sm font-ui uppercase tracking-wider text-on-surface-variant">{meta.label}</span>
                  {meta.status === 'total' ? (
                    <Icon name="domain" className="text-[18px] text-on-surface-variant" />
                  ) : (
                    <span className={`h-2.5 w-2.5 rounded-full ${meta.dotClass}`} />
                  )}
                </div>
                <div className="mt-2">
                  <span className="font-serif text-headline-lg leading-none text-primary">{count}</span>
                  <span className="ml-1.5 font-ui text-label-sm text-on-surface-variant">
                    {meta.status === 'total' ? `${units[0]?.floor ?? 12} niveles` : `${pct}%`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-6 rounded-xl bg-surface-container-lowest p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="relative w-72">
              <Icon name="filter_alt" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant" />
              <input
                type="text"
                value={filters.search}
                onChange={(event) => updateFilters({ search: event.target.value })}
                placeholder="Filtrar por depto, nivel o tipo..."
                className="w-full rounded-lg bg-surface-container-low py-2 pl-9 pr-3 font-ui text-body-sm text-on-surface placeholder:text-on-surface-variant focus:bg-surface-container-lowest focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <select
              value={filters.floorRange}
              onChange={(event) => updateFilters({ floorRange: event.target.value as UnitFilters['floorRange'] })}
              className="cursor-pointer rounded-lg bg-surface-container-low px-3 py-2 font-ui text-body-sm text-on-surface focus:outline-none"
            >
              <option value="all">Todos los pisos (1 al 12)</option>
              <option value="1-4">Piso 1 - 4</option>
              <option value="5-8">Piso 5 - 8</option>
              <option value="9-12">Piso 9 - 12 (Penthouse)</option>
            </select>
            <select
              value={filters.bedrooms}
              onChange={(event) =>
                updateFilters({ bedrooms: event.target.value === 'all' ? 'all' : (Number(event.target.value) as 1 | 2 | 3) })
              }
              className="cursor-pointer rounded-lg bg-surface-container-low px-3 py-2 font-ui text-body-sm text-on-surface focus:outline-none"
            >
              <option value="all">Tipologías (Todas)</option>
              <option value="1">1 Recámara</option>
              <option value="2">2 Recámaras</option>
              <option value="3">3 Recámaras</option>
            </select>
            <select
              value={filters.status}
              onChange={(event) => updateFilters({ status: event.target.value as UnitFilters['status'] })}
              className="cursor-pointer rounded-lg bg-surface-container-low px-3 py-2 font-ui text-body-sm text-on-surface focus:outline-none"
            >
              <option value="all">Todos los estados</option>
              <option value="available">Solo disponibles</option>
              <option value="reserved">Apartados vigentes</option>
              <option value="sold">Vendidas</option>
              <option value="blocked">Bloqueados</option>
            </select>
          </div>
          <div className="flex items-center justify-between gap-4 lg:justify-end">
            <label className="flex cursor-pointer select-none items-center gap-2">
              <input
                type="checkbox"
                checked={filters.onlyAvailable}
                onChange={(event) => updateFilters({ onlyAvailable: event.target.checked })}
                className="h-4 w-4 rounded accent-primary"
              />
              <span className="font-ui text-label-sm text-on-surface-variant">Solo disponibles</span>
            </label>
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between rounded-lg bg-surface-container-low px-4 py-2.5 text-on-surface-variant">
        <div className="flex items-center gap-2">
          <Icon name="shield" className="text-[18px] text-secondary" />
          <span className="font-ui text-body-sm">
            <strong>Protocolo de salvaguarda:</strong> las modificaciones de estado y precio requieren confirmación
            explícita. Ningún cambio se propaga sin validación.
          </span>
        </div>
        <span className="text-label-sm font-ui uppercase tracking-wider text-on-surface-variant">Fase Preventa 2</span>
      </div>

      <div className="mb-10 overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container font-ui text-label-sm uppercase tracking-wider text-on-surface-variant">
                <th className="px-4 py-3 font-semibold">Unidad / Tipo</th>
                <th className="px-4 py-3 font-semibold">Nivel</th>
                <th className="px-4 py-3 font-semibold">Superficie</th>
                <th className="px-4 py-3 font-semibold">Distribución</th>
                <th className="px-4 py-3 font-semibold">Precio de Lista</th>
                <th className="px-4 py-3 font-semibold">Precio / m²</th>
                <th className="px-4 py-3 font-semibold">Estado Actual</th>
                <th className="px-4 py-3 text-right font-semibold">Acciones Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low font-ui text-body-sm text-on-surface">
              {pageUnits.map((unit) => (
                <AdminUnitRow key={unit.id} unit={unit} onEditPrice={() => setEditingCode(unit.code)} />
              ))}
              {pageUnits.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center font-ui text-body-sm text-on-surface-variant">
                    Ninguna unidad coincide con los filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between bg-surface-container-low px-4 py-3">
          <span className="font-ui text-label-sm text-on-surface-variant">
            Mostrando {pageUnits.length} de {filtered.length} departamentos registrados
          </span>
          <Pagination page={page} pageCount={pageCount} onChange={setPage} />
        </div>
      </div>

      {editingUnit && <PriceEditModal unit={editingUnit} onClose={() => setEditingCode(null)} />}
    </div>
  );
}

function AdminUnitRow({ unit, onEditPrice }: { unit: PortalUnit; onEditPrice: () => void }) {
  const toggleUnitBlock = usePortalStore((state) => state.toggleUnitBlock);
  const pricePerM2 = unit.m2 > 0 ? Math.round(unit.price / unit.m2) : 0;

  return (
    <tr className={`transition-colors hover:bg-surface-container-low/50 ${unit.status === 'reserved' ? 'bg-secondary-container/20' : ''}`}>
      <td className="px-4 py-3.5">
        <Link to={`/portal/inventario/${unit.code}`} className="flex items-center gap-2">
          {unit.status === 'reserved' && <span className="inline-block h-2 w-2 rounded-full bg-secondary" />}
          <div>
            <span className="font-ui text-title-md font-bold text-primary">Depto {unit.code}</span>
            <span className="block font-ui text-label-sm text-on-surface-variant">{unit.typeLabel}</span>
          </div>
        </Link>
      </td>
      <td className="px-4 py-3.5">Piso {unit.floor}</td>
      <td className="px-4 py-3.5">{unit.m2.toFixed(2)} m²</td>
      <td className="px-4 py-3.5">
        <span className="text-on-surface">
          {unit.bedrooms} Rec · {unit.bathrooms} Baños
        </span>
        {unit.terraceM2 > 0 && <span className="block font-ui text-label-sm text-on-surface-variant">Terraza {unit.terraceM2} m²</span>}
      </td>
      <td className="px-4 py-3.5 font-semibold text-primary">
        {formatCurrency(unit.price)} <span className="font-ui text-label-sm text-on-surface-variant">MXN</span>
      </td>
      <td className="px-4 py-3.5 text-on-surface-variant">{formatCurrency(pricePerM2)} / m²</td>
      <td className="px-4 py-3.5">
        <StatusChip status={unit.status} label={unit.statusNote} />
      </td>
      <td className="px-4 py-3.5 text-right">
        <div className="inline-flex items-center justify-end gap-1">
          <button
            type="button"
            title="Modificar precio de lista"
            onClick={onEditPrice}
            className="rounded-lg bg-primary p-1.5 text-on-primary shadow-sm transition-colors hover:bg-primary-container"
          >
            <Icon name="price_change" className="text-[18px]" />
          </button>
          {unit.status !== 'sold' && (
            <button
              type="button"
              title={unit.status === 'blocked' ? 'Desbloquear unidad' : 'Bloquear / Retener'}
              onClick={() => toggleUnitBlock(unit.code)}
              className="rounded-lg bg-surface-container p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
            >
              <Icon name={unit.status === 'blocked' ? 'lock_reset' : 'lock'} className="text-[18px]" />
            </button>
          )}
          <Link
            to={`/portal/inventario/${unit.code}`}
            title="Historial y bitácora"
            className="rounded-lg bg-surface-container p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
          >
            <Icon name="history" className="text-[18px]" />
          </Link>
        </div>
      </td>
    </tr>
  );
}
