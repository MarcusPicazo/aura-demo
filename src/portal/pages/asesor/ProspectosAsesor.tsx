import { useMemo, useState, type FormEvent } from 'react';
import { usePortalStore, unitByCode } from '../../store/portalStore';
import { Icon } from '../../components/Icon';
import { NewProspectoModal } from '../../components/NewProspectoModal';
import { STAGE_META, STAGE_ORDER } from '../../lib/prospectoStage';
import { formatCurrency, formatRelativeExpiry } from '../../lib/format';
import type { Hold, Prospecto, ProspectoStage } from '../../types';

type FilterKey = 'todos' | ProspectoStage;

export function ProspectosAsesor() {
  const currentUser = usePortalStore((state) => state.currentUser)!;
  const prospectos = usePortalStore((state) => state.prospectos);
  const holds = usePortalStore((state) => state.holds);

  const mine = useMemo(() => prospectos.filter((p) => p.advisorId === currentUser.id), [prospectos, currentUser.id]);
  const [filter, setFilter] = useState<FilterKey>('todos');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(mine[0]?.id ?? null);
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = mine.filter((p) => {
    if (filter !== 'todos' && p.stage !== filter) return false;
    if (!search.trim()) return true;
    const term = search.trim().toLowerCase();
    return p.name.toLowerCase().includes(term) || p.phone.includes(term) || p.interestedUnitCodes.some((code) => code.includes(term));
  });

  const selected = filtered.find((p) => p.id === selectedId) ?? filtered[0] ?? null;
  const inProgress = mine.filter((p) => p.stage === 'cita' || p.stage === 'seguimiento').length;

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="flex flex-col">
          <div className="mb-1 flex items-center gap-1.5 text-label-sm font-ui uppercase tracking-wider text-on-surface-variant">
            <span>Gestión Comercial</span>
            <Icon name="chevron_right" className="text-[14px]" />
            <span className="font-semibold text-secondary">Torre Aura Del Valle</span>
          </div>
          <h1 className="font-serif text-headline-lg tracking-tight text-primary">Prospectos asignados</h1>
          <p className="mt-1 font-ui text-body-md text-on-surface-variant">Seguimiento comercial a clientes interesados en Torre Aura Del Valle</p>
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
        <FilterPill active={filter === 'todos'} label="Todos" count={mine.length} onClick={() => setFilter('todos')} />
        {STAGE_ORDER.map((stage) => (
          <FilterPill
            key={stage}
            active={filter === stage}
            label={STAGE_META[stage].label}
            count={mine.filter((p) => p.stage === stage).length}
            onClick={() => setFilter(stage)}
          />
        ))}
      </div>

      <div className="flex items-center justify-between gap-4 rounded-xl bg-surface-container-lowest p-3 shadow-sm">
        <div className="flex flex-1 items-center gap-2 px-2">
          <Icon name="filter_list" className="text-[20px] text-on-surface-variant" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, teléfono o unidad de interés..."
            className="w-full bg-transparent font-ui text-body-sm text-on-surface outline-none placeholder:text-on-surface-variant"
          />
        </div>
        <span className="whitespace-nowrap px-2 font-ui text-label-sm text-on-surface-variant">
          Mostrando {filtered.length} de {mine.length} prospectos
        </span>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-2 lg:col-span-7">
          {filtered.map((prospecto) => (
            <ProspectoCard key={prospecto.id} prospecto={prospecto} active={selected?.id === prospecto.id} onClick={() => setSelectedId(prospecto.id)} />
          ))}
          {filtered.length === 0 && (
            <p className="rounded-xl bg-surface-container-lowest p-10 text-center font-ui text-body-sm text-on-surface-variant shadow-sm">
              No hay prospectos con este filtro.
            </p>
          )}

          <div className="mt-2 flex items-center justify-between rounded-xl bg-surface-container-low p-4 text-on-surface-variant">
            <div className="flex items-center gap-2">
              <Icon name="verified" className="text-[24px] text-secondary" />
              <div className="flex flex-col">
                <span className="font-ui text-title-md text-on-surface">Tasa de conversión actual</span>
                <span className="font-ui text-body-sm">Prospectos con cita o en seguimiento activo</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-headline-sm text-primary">
                {inProgress} / {mine.length}
              </span>
              <span className="text-label-sm font-ui uppercase tracking-wider text-secondary">En proceso</span>
            </div>
          </div>
        </div>

        <aside className="sticky top-24 lg:col-span-5">
          {selected ? (
            <ProspectoDetail prospecto={selected} holds={holds} />
          ) : (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-2 rounded-xl bg-surface-container-lowest p-10 text-center shadow-sm">
              <Icon name="person_search" className="text-[32px] text-on-surface-variant" />
              <p className="font-ui text-body-sm text-on-surface-variant">Selecciona un prospecto para ver su ficha.</p>
            </div>
          )}
        </aside>
      </div>

      {modalOpen && <NewProspectoModal fixedAdvisorId={currentUser.id} onClose={() => setModalOpen(false)} />}
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

function ProspectoCard({ prospecto, active, onClick }: { prospecto: Prospecto; active: boolean; onClick: () => void }) {
  const units = usePortalStore((state) => state.units);
  const meta = STAGE_META[prospecto.stage];
  const primaryUnit = prospecto.interestedUnitCodes[0];
  const unit = primaryUnit ? unitByCode(units, primaryUnit) : undefined;

  return (
    <div
      onClick={onClick}
      className={`relative flex cursor-pointer items-center gap-3 overflow-hidden rounded-xl bg-surface-container-lowest p-4 shadow-sm transition-all hover:bg-surface-container-high ${active ? 'bg-primary/5' : ''}`}
    >
      <div className={`absolute bottom-0 left-0 top-0 ${active ? 'w-1.5 bg-secondary' : 'w-1 bg-transparent'}`} />
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-container text-title-md font-ui text-on-secondary-container">
        {prospecto.initials}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-ui text-title-md text-on-surface">{prospecto.name}</span>
        <span className="truncate font-ui text-body-sm text-on-surface-variant">
          {unit ? `Depto ${unit.code} · ${formatCurrency(unit.price)}` : prospecto.origin}
        </span>
      </div>
      <div className="flex shrink-0 flex-col items-end text-right">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-label-sm font-ui font-semibold ${meta.className}`}>
          {meta.icon && <Icon name={meta.icon} className="text-[13px]" />}
          {meta.label}
        </span>
        {prospecto.nextActionAt && <span className="mt-1 font-ui text-body-sm font-medium text-secondary">{prospecto.nextActionAt}</span>}
      </div>
    </div>
  );
}

function ProspectoDetail({ prospecto, holds }: { prospecto: Prospecto; holds: Hold[] }) {
  const units = usePortalStore((state) => state.units);
  const updateProspectoStage = usePortalStore((state) => state.updateProspectoStage);
  const logProspectoNote = usePortalStore((state) => state.logProspectoNote);
  const [noteValue, setNoteValue] = useState('');
  const [copied, setCopied] = useState(false);

  const linkedHold = holds.find((h) => h.prospectoId === prospecto.id && (h.status === 'vigente' || h.status === 'por_vencer'));
  const unit = linkedHold ? unitByCode(units, linkedHold.unitCode) : prospecto.interestedUnitCodes[0] ? unitByCode(units, prospecto.interestedUnitCodes[0]) : undefined;

  function submitNote(event: FormEvent) {
    event.preventDefault();
    if (!noteValue.trim()) return;
    logProspectoNote(prospecto.id, 'Nota comercial', noteValue.trim());
    setNoteValue('');
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-surface-container-lowest p-6 shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary font-serif text-headline-sm text-on-primary shadow-inner">
            {prospecto.initials}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <h2 className="font-serif text-headline-sm tracking-tight text-primary">{prospecto.name}</h2>
              <Icon name="verified" className="text-[18px] text-secondary" />
            </div>
            <select
              value={prospecto.stage}
              onChange={(event) => updateProspectoStage(prospecto.id, event.target.value as ProspectoStage)}
              className="mt-0.5 w-fit rounded bg-transparent font-ui text-label-sm font-semibold uppercase tracking-wider text-secondary outline-none"
            >
              {STAGE_ORDER.map((stage) => (
                <option key={stage} value={stage}>
                  {STAGE_META[stage].label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-lg bg-surface-container-low p-3 font-ui text-body-sm">
        <div className="flex min-w-0 flex-col">
          <span className="text-[11px] font-label-sm uppercase tracking-wider text-on-surface-variant">Teléfono</span>
          <span className="mt-0.5 truncate text-[13px] text-on-surface">{prospecto.phone}</span>
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="text-[11px] font-label-sm uppercase tracking-wider text-on-surface-variant">Correo</span>
          <span className="mt-0.5 truncate text-[13px] text-on-surface">{prospecto.email || '—'}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <a
          href={`https://wa.me/${prospecto.phone.replace(/\D/g, '')}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 font-ui text-label-md text-on-primary shadow-sm transition-all hover:bg-primary-container"
        >
          <Icon name="chat" className="text-[18px]" />
          <span>Abrir WhatsApp</span>
        </a>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(prospecto.phone);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
          }}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-surface-container px-3 py-2 font-ui text-label-md text-on-surface transition-all hover:bg-surface-container-high"
        >
          <Icon name="content_copy" className="text-[18px]" />
          <span>{copied ? '¡Copiado!' : 'Copiar teléfono'}</span>
        </button>
      </div>

      {unit && (
        <div className="flex flex-col gap-1.5 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-label-sm font-ui font-semibold uppercase tracking-wider text-on-surface-variant">Unidad de interés</span>
            {linkedHold && <span className="font-ui text-label-sm text-secondary">Folio {linkedHold.folio}</span>}
          </div>
          <div className="flex flex-col gap-2 rounded-xl bg-surface-container-low p-4 shadow-[0_1px_4px_rgba(0,0,0,0.02)]">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-serif text-headline-sm text-primary">Depto {unit.code}</span>
                  {linkedHold && (
                    <span className="rounded-full bg-secondary-container px-2 py-0.5 text-label-sm font-ui font-semibold text-on-secondary-container">
                      Apartado activo
                    </span>
                  )}
                </div>
                <span className="mt-0.5 font-ui text-body-sm text-on-surface-variant">
                  Torre Aura Del Valle · Nivel {unit.floor} · {unit.orientation}
                </span>
              </div>
              <span className="font-ui text-currency-display text-primary">{formatCurrency(unit.price)}</span>
            </div>
            {linkedHold && (
              <div className="flex items-center justify-between pt-1 text-[12px] text-on-surface-variant">
                <span className="flex items-center gap-1">
                  <Icon name="schedule" className="text-[16px] text-secondary" />
                  Vence en: <strong className="font-semibold text-on-surface">{formatRelativeExpiry(linkedHold.expiresAt)}</strong>
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 pt-1">
        <span className="text-label-sm font-ui font-semibold uppercase tracking-wider text-on-surface-variant">Añadir nota o registrar llamada</span>
        <form onSubmit={submitNote} className="flex flex-col gap-2">
          <textarea
            rows={2}
            value={noteValue}
            onChange={(event) => setNoteValue(event.target.value)}
            placeholder="Detalle acuerdos de llamada, requerimientos de enganche o inquietudes..."
            className="w-full resize-none rounded-lg bg-surface-container-low p-2 font-ui text-body-sm text-on-surface outline-none placeholder:text-on-surface-variant focus:bg-surface-container-lowest"
          />
          <button
            type="submit"
            className="flex shrink-0 items-center justify-center gap-1 self-end rounded-lg bg-primary px-4 py-1.5 font-ui text-label-md text-on-primary transition-all hover:bg-primary-container"
          >
            <Icon name="send" className="text-[16px]" />
            <span>Guardar</span>
          </button>
        </form>
      </div>

      <div className="flex flex-col gap-2 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-label-sm font-ui font-semibold uppercase tracking-wider text-on-surface-variant">Bitácora de seguimiento</span>
          <span className="font-ui text-body-sm text-on-surface-variant">{prospecto.timeline.length} registros</span>
        </div>
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
      </div>
    </div>
  );
}
