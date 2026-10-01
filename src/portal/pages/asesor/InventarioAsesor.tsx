import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePortalStore } from '../../store/portalStore';
import { Icon } from '../../components/Icon';
import { StatusChip } from '../../components/StatusChip';
import { Pagination } from '../../components/Pagination';
import { formatCurrency } from '../../lib/format';
import { applyUnitFilters, DEFAULT_UNIT_FILTERS, type UnitFilters } from '../../lib/unitFilters';

const PAGE_SIZE = 8;

export function InventarioAsesor() {
  const units = usePortalStore((state) => state.units);
  const [filters, setFilters] = useState<UnitFilters>(DEFAULT_UNIT_FILTERS);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => applyUnitFilters(units, filters), [units, filters]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageUnits = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function updateFilters(patch: Partial<UnitFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }

  const available = units.filter((u) => u.status === 'available').length;
  const reserved = units.filter((u) => u.status === 'reserved').length;
  const sold = units.filter((u) => u.status === 'sold').length;
  const blocked = units.filter((u) => u.status === 'blocked').length;

  return (
    <div className="flex w-full flex-col">
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <h1 className="font-serif text-headline-lg tracking-tight text-primary">Inventario de unidades</h1>
            <p className="mt-1 font-ui text-body-md text-on-surface-variant">
              Torre Aura Del Valle · Consulta en tiempo real de disponibilidad, especificaciones arquitectónicas y
              listas oficiales de precio vigentes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill label="Todas" value={units.length} />
            <Pill label="Disponibles" value={available} tone="secondary" />
            <Pill label="Apartadas" value={reserved} />
            <Pill label="Vendidas" value={sold} />
            <Pill label="Bloqueadas" value={blocked} />
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-4 rounded-xl bg-surface-container-lowest p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
          <div className="relative md:col-span-5">
            <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant" />
            <input
              type="text"
              value={filters.search}
              onChange={(event) => updateFilters({ search: event.target.value })}
              placeholder="Buscar por número de depto (ej. 804, 301)..."
              className="w-full rounded-lg bg-surface-container-low py-2.5 pl-10 pr-3 font-ui text-body-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <select
            value={filters.floorRange}
            onChange={(event) => updateFilters({ floorRange: event.target.value as UnitFilters['floorRange'] })}
            className="cursor-pointer rounded-lg bg-surface-container-low px-3.5 py-2.5 font-ui text-body-sm text-on-surface outline-none md:col-span-3"
          >
            <option value="all">Todos los pisos</option>
            <option value="1-4">Piso 1-4</option>
            <option value="5-8">Piso 5-8</option>
            <option value="9-12">Penthouses</option>
          </select>
          <div className="flex items-center rounded-lg bg-surface-container-low p-1 md:col-span-4">
            {(['all', 1, 2, 3] as const).map((value) => (
              <button
                key={String(value)}
                type="button"
                onClick={() => updateFilters({ bedrooms: value })}
                className={`flex-1 rounded-md py-1.5 text-center font-ui text-label-sm transition-colors ${
                  filters.bedrooms === value ? 'bg-surface-container-lowest font-semibold text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {value === 'all' ? 'Todas' : `${value} Rec`}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-start justify-between gap-2 pt-1 sm:flex-row sm:items-center">
          <label className="inline-flex cursor-pointer select-none items-center gap-2.5">
            <input
              type="checkbox"
              checked={filters.onlyAvailable}
              onChange={(event) => updateFilters({ onlyAvailable: event.target.checked })}
              className="h-4 w-4 rounded accent-secondary"
            />
            <span className="font-ui text-label-md font-medium text-on-surface">Solo unidades disponibles</span>
          </label>
          <div className="flex items-center gap-1.5 font-ui text-label-sm text-on-surface-variant">
            <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
            <span>
              Mostrando <strong className="font-semibold text-on-surface">{filtered.length}</strong> departamentos
            </span>
          </div>
        </div>
      </div>

      <div className="mb-10 overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low font-ui text-label-sm uppercase tracking-wider text-on-surface-variant">
                <th className="px-4 py-3">Departamento</th>
                <th className="px-3 py-3">Nivel</th>
                <th className="px-4 py-3">Tipología &amp; Distribución</th>
                <th className="px-3 py-3 text-right">Superficie</th>
                <th className="px-4 py-3 text-right">Precio Lista (MXN)</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-right">Acciones Rápidas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container font-ui text-body-md text-on-surface">
              {pageUnits.map((unit) => (
                <tr key={unit.id} className={`transition-colors hover:bg-surface-container/60 ${unit.status === 'available' ? 'bg-secondary-container/10' : ''}`}>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className={`h-6 w-1.5 rounded-full ${unit.status === 'available' ? 'bg-secondary' : 'bg-transparent'}`} />
                      <div>
                        <span className="font-ui text-title-md font-bold text-primary">Depto {unit.code}</span>
                        <span className="block font-ui text-label-sm text-on-surface-variant">{unit.tower}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3.5 font-ui text-label-md text-on-surface-variant">Piso {unit.floor}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-col">
                      <span className="font-ui text-label-md font-semibold text-on-surface">{unit.typeLabel}</span>
                      <span className="font-ui text-label-sm text-on-surface-variant">
                        {unit.bathrooms} Baños · {unit.parkingSpots} Estac.
                        {unit.terraceM2 > 0 ? ` · Terraza ${unit.terraceM2} m²` : ''}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-right font-medium text-on-surface">{unit.m2.toFixed(2)} m²</td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="font-ui text-currency-display text-primary">{formatCurrency(unit.price)}</span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <StatusChip status={unit.status} />
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={`/portal/inventario/${unit.code}`}
                        className="rounded-lg bg-surface-container-lowest px-3 py-1.5 font-ui text-label-sm font-semibold text-on-surface shadow-sm transition-colors hover:bg-surface-container"
                      >
                        Ver ficha
                      </Link>
                      {unit.status === 'available' && (
                        <Link
                          to={`/portal/inventario/${unit.code}?apartar=1`}
                          className="flex items-center gap-1 rounded-lg bg-primary px-3.5 py-1.5 font-ui text-label-md font-semibold text-on-primary shadow-sm transition-all hover:bg-primary-container active:scale-[0.97]"
                        >
                          <Icon name="bookmark_add" className="text-[16px]" />
                          <span>Apartar</span>
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {pageUnits.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center font-ui text-body-sm text-on-surface-variant">
                    Ninguna unidad coincide con los filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between bg-surface-container-low px-4 py-3">
          <span className="font-ui text-label-sm text-on-surface-variant">
            Mostrando {pageUnits.length} de {filtered.length} unidades
          </span>
          <Pagination page={page} pageCount={pageCount} onChange={setPage} />
        </div>
      </div>
    </div>
  );
}

function Pill({ label, value, tone }: { label: string; value: number; tone?: 'secondary' }) {
  return (
    <div className="flex items-center gap-2 rounded-full bg-surface-container-high px-3 py-1.5 font-ui text-label-md text-on-surface shadow-sm">
      {tone === 'secondary' && <span className="h-2 w-2 rounded-full bg-secondary" />}
      <span className="text-on-surface-variant">{label}:</span>
      <span className={`font-bold ${tone === 'secondary' ? 'text-secondary' : ''}`}>{value}</span>
    </div>
  );
}
