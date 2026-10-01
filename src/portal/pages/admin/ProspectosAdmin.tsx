import { useMemo, useState } from 'react';
import { usePortalStore, unitByCode, teamMemberById } from '../../store/portalStore';
import { Icon } from '../../components/Icon';
import { NewProspectoModal } from '../../components/NewProspectoModal';
import { STAGE_META, STAGE_ORDER } from '../../lib/prospectoStage';
import { formatCurrency } from '../../lib/format';
import type { Prospecto } from '../../types';

type FilterKey = 'todos' | 'sin_asignar' | Prospecto['stage'];

export function ProspectosAdmin() {
  const prospectos = usePortalStore((state) => state.prospectos);
  const team = usePortalStore((state) => state.team);
  const assignProspecto = usePortalStore((state) => state.assignProspecto);

  const [filter, setFilter] = useState<FilterKey>('todos');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const asesores = team.filter((member) => member.role === 'asesor');

  const filtered = useMemo(() => {
    return prospectos.filter((p) => {
      if (filter === 'sin_asignar' && p.advisorId) return false;
      if (filter !== 'todos' && filter !== 'sin_asignar' && p.stage !== filter) return false;
      if (!search.trim()) return true;
      const term = search.trim().toLowerCase();
      return p.name.toLowerCase().includes(term) || p.phone.includes(term) || p.interestedUnitCodes.some((code) => code.includes(term));
    });
  }, [prospectos, filter, search]);

  const selected = filtered.find((p) => p.id === selectedId) ?? null;
  const unassignedCount = prospectos.filter((p) => !p.advisorId).length;

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-label-sm font-ui uppercase tracking-wider text-on-surface-variant">
            <span>Gestión Comercial</span>
            <Icon name="chevron_right" className="text-[14px]" />
            <span className="font-semibold text-secondary">Cartera de Prospectos</span>
          </div>
          <h1 className="font-serif text-headline-lg tracking-tight text-primary">Cartera de Prospectos</h1>
          <p className="mt-1 font-ui text-body-md text-on-surface-variant">
            Vista consolidada de todos los interesados en Torre Aura Del Valle, con su asesor y etapa comercial.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 self-start rounded-lg bg-primary px-4 py-2 font-ui text-label-md text-on-primary shadow-md transition-all hover:bg-primary-container active:scale-[0.97] md:self-auto"
        >
          <Icon name="add" className="text-[18px]" />
          <span>Registrar prospecto</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <FilterPill active={filter === 'todos'} label="Todos" count={prospectos.length} onClick={() => setFilter('todos')} />
        <FilterPill active={filter === 'sin_asignar'} label="Sin asignar" count={unassignedCount} onClick={() => setFilter('sin_asignar')} />
        {STAGE_ORDER.map((stage) => (
          <FilterPill
            key={stage}
            active={filter === stage}
            label={STAGE_META[stage].label}
            count={prospectos.filter((p) => p.stage === stage).length}
            onClick={() => setFilter(stage)}
          />
        ))}
      </div>

      <div className="flex items-center gap-2 rounded-xl bg-surface-container-lowest p-3 shadow-sm">
        <Icon name="filter_list" className="text-[20px] text-on-surface-variant" />
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nombre, teléfono o unidad de interés..."
          className="w-full bg-transparent font-ui text-body-sm text-on-surface outline-none placeholder:text-on-surface-variant"
        />
        <span className="whitespace-nowrap px-2 font-ui text-label-sm text-on-surface-variant">
          {filtered.length} de {prospectos.length}
        </span>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm xl:col-span-7">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-low font-ui text-label-sm uppercase tracking-wider text-on-surface-variant">
                  <th className="px-4 py-3">Prospecto</th>
                  <th className="px-4 py-3">Interés</th>
                  <th className="px-4 py-3">Asesor</th>
                  <th className="px-4 py-3 text-center">Etapa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low font-ui text-body-sm">
                {filtered.map((prospecto) => {
                  const meta = STAGE_META[prospecto.stage];
                  const advisor = teamMemberById(team, prospecto.advisorId);
                  const isSelected = selected?.id === prospecto.id;
                  return (
                    <tr
                      key={prospecto.id}
                      onClick={() => setSelectedId(prospecto.id)}
                      className={`cursor-pointer transition-colors ${isSelected ? 'bg-surface-container-low/80' : 'hover:bg-surface-container-low'}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container-high font-ui text-label-sm font-bold text-on-surface">
                            {prospecto.initials}
                          </div>
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate font-semibold text-on-surface">{prospecto.name}</span>
                            <span className="truncate text-label-sm font-ui text-on-surface-variant">{prospecto.origin}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        {prospecto.interestedUnitCodes.length > 0 ? `Depto ${prospecto.interestedUnitCodes.join(', ')}` : '—'}
                      </td>
                      <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                        <select
                          value={prospecto.advisorId}
                          onChange={(event) => assignProspecto(prospecto.id, event.target.value)}
                          className="cursor-pointer rounded-lg bg-surface-container-low px-2 py-1 font-ui text-label-sm text-on-surface outline-none"
                        >
                          <option value="">Sin asignar</option>
                          {asesores.map((advisor) => (
                            <option key={advisor.id} value={advisor.id}>
                              {advisor.name}
                            </option>
                          ))}
                        </select>
                        {!advisor && <span className="ml-1 text-[11px] text-secondary">nuevo</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-label-sm font-ui font-semibold ${meta.className}`}>
                          {meta.icon && <Icon name={meta.icon} className="text-[13px]" />}
                          {meta.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center font-ui text-body-sm text-on-surface-variant">
                      Sin resultados para este filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="sticky top-24 xl:col-span-5">
          {selected ? (
            <AdminProspectoDetail prospecto={selected} />
          ) : (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-2 rounded-xl bg-surface-container-lowest p-10 text-center shadow-sm">
              <Icon name="person_search" className="text-[32px] text-on-surface-variant" />
              <p className="font-ui text-body-sm text-on-surface-variant">Selecciona un prospecto de la lista.</p>
            </div>
          )}
        </aside>
      </div>

      {modalOpen && <NewProspectoModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}

function FilterPill({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 font-ui text-label-sm transition-all ${
        active ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
      }`}
    >
      <span>{label}</span>
      <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-white/20' : 'opacity-70'}`}>{count}</span>
    </button>
  );
}

function AdminProspectoDetail({ prospecto }: { prospecto: Prospecto }) {
  const units = usePortalStore((state) => state.units);
  const team = usePortalStore((state) => state.team);
  const logProspectoNote = usePortalStore((state) => state.logProspectoNote);
  const [noteValue, setNoteValue] = useState('');

  const advisor = teamMemberById(team, prospecto.advisorId);
  const unit = prospecto.interestedUnitCodes[0] ? unitByCode(units, prospecto.interestedUnitCodes[0]) : undefined;

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-surface-container-lowest p-6 shadow-md">
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary font-serif text-headline-sm text-on-primary shadow-inner">
          {prospecto.initials}
        </div>
        <div className="flex flex-col">
          <h2 className="font-serif text-headline-sm tracking-tight text-primary">{prospecto.name}</h2>
          <span className="font-ui text-body-sm text-on-surface-variant">
            {prospecto.phone} · {prospecto.email || 'sin correo'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-lg bg-surface-container-low p-3 font-ui text-body-sm">
        <div className="flex flex-col">
          <span className="text-[11px] uppercase tracking-wider text-on-surface-variant">Asesor</span>
          <span className="mt-0.5 font-semibold text-on-surface">{advisor?.name ?? 'Sin asignar'}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] uppercase tracking-wider text-on-surface-variant">Origen</span>
          <span className="mt-0.5 text-on-surface">{prospecto.origin}</span>
        </div>
      </div>

      {unit && (
        <div className="flex flex-col gap-2 rounded-xl bg-surface-container-low p-4">
          <div className="flex items-center justify-between">
            <span className="font-serif text-headline-sm text-primary">Depto {unit.code}</span>
            <span className="font-ui text-currency-display text-primary">{formatCurrency(unit.price)}</span>
          </div>
          <span className="font-ui text-body-sm text-on-surface-variant">
            Nivel {unit.floor} · {unit.m2.toFixed(2)} m² · {unit.orientation}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-label-sm font-ui font-semibold uppercase tracking-wider text-on-surface-variant">Bitácora</span>
        <div className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
          {prospecto.timeline.map((entry) => (
            <div key={entry.id} className="flex gap-2 rounded-lg bg-surface-container-low p-2">
              <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-secondary" />
              <div className="flex w-full flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-ui text-[13px] font-semibold text-on-surface">{entry.label}</span>
                  <span className="font-ui text-[11px] text-on-surface-variant">{entry.at}</span>
                </div>
                <p className="font-ui text-body-sm text-on-surface-variant">{entry.detail}</p>
                <span className="mt-0.5 text-[11px] font-medium text-secondary">Registrado por {entry.by}</span>
              </div>
            </div>
          ))}
          {prospecto.timeline.length === 0 && <p className="font-ui text-body-sm text-on-surface-variant">Sin registros todavía.</p>}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={noteValue}
            onChange={(event) => setNoteValue(event.target.value)}
            placeholder="Agregar nota de supervisión..."
            className="flex-1 rounded-lg bg-surface-container-low p-2 font-ui text-body-sm text-on-surface outline-none placeholder:text-on-surface-variant"
          />
          <button
            type="button"
            onClick={() => {
              if (!noteValue.trim()) return;
              logProspectoNote(prospecto.id, 'Nota de supervisión', noteValue.trim());
              setNoteValue('');
            }}
            className="rounded-lg bg-primary px-3 py-2 font-ui text-label-sm text-on-primary transition-all hover:bg-primary-container"
          >
            <Icon name="send" className="text-[16px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
