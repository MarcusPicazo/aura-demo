import { useMemo, useState } from 'react';
import { usePortalStore, unitByCode, prospectoById } from '../../store/portalStore';
import { Icon } from '../../components/Icon';
import { formatCurrency, formatRelativeExpiry } from '../../lib/format';
import type { Hold, HoldStatus } from '../../types';

type FilterKey = 'todos' | 'vigente' | 'por_vencer' | 'vencido' | 'cancelado' | 'convertido';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'vigente', label: 'Vigentes' },
  { key: 'por_vencer', label: 'Por vencer' },
  { key: 'vencido', label: 'Vencidos' },
  { key: 'cancelado', label: 'Cancelados' },
  { key: 'convertido', label: 'Convertidos' },
];

const STATUS_LABEL: Record<HoldStatus, { label: string; className: string }> = {
  vigente: { label: 'Vigente', className: 'bg-surface-container-high text-on-surface-variant' },
  por_vencer: { label: 'Por vencer', className: 'bg-secondary-container/60 text-secondary' },
  vencido: { label: 'Vencido', className: 'bg-error-container text-on-error-container' },
  cancelado: { label: 'Cancelado', className: 'bg-surface-container text-on-surface-variant' },
  convertido: { label: 'Convertido', className: 'bg-primary-fixed text-on-primary-fixed' },
};

export function MisApartadosAsesor() {
  const currentUser = usePortalStore((state) => state.currentUser)!;
  const holds = usePortalStore((state) => state.holds);
  const units = usePortalStore((state) => state.units);
  const prospectos = usePortalStore((state) => state.prospectos);

  const myHolds = useMemo(() => holds.filter((hold) => hold.advisorId === currentUser.id), [holds, currentUser.id]);
  const [filter, setFilter] = useState<FilterKey>('todos');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(myHolds[0]?.id ?? null);

  const filtered = myHolds.filter((hold) => {
    if (filter !== 'todos' && hold.status !== filter) return false;
    if (!search.trim()) return true;
    const term = search.trim().toLowerCase();
    const prospecto = prospectoById(prospectos, hold.prospectoId);
    return hold.unitCode.toLowerCase().includes(term) || hold.folio.toLowerCase().includes(term) || prospecto?.name.toLowerCase().includes(term);
  });

  const selected = filtered.find((h) => h.id === selectedId) ?? filtered[0] ?? null;
  const reserveValue = myHolds.filter((h) => h.status === 'vigente' || h.status === 'por_vencer').reduce((sum, h) => sum + (unitByCode(units, h.unitCode)?.price ?? 0), 0);
  const urgent = myHolds.find((h) => h.status === 'por_vencer');

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-label-sm font-ui uppercase tracking-wider text-on-surface-variant">
            <span>AURA Inmuebles</span>
            <Icon name="chevron_right" className="text-[14px]" />
            <span>Gestión Comercial</span>
            <Icon name="chevron_right" className="text-[14px]" />
            <span className="font-semibold text-secondary">Mis Apartados</span>
          </div>
          <h1 className="font-serif text-headline-lg tracking-tight text-primary">Mis Apartados</h1>
          <p className="mt-1 font-ui text-body-md text-on-surface-variant">
            Control de unidades bloqueadas temporalmente y seguimiento a vencimientos de promesa.
          </p>
        </div>
        <div className="flex items-center gap-4 rounded-xl bg-surface-container-lowest p-3 shadow-sm">
          <div className="flex items-center gap-2 border-r border-surface-container-highest/60 px-3 py-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container-high text-primary">
              <Icon name="lock_clock" className="text-[20px]" />
            </div>
            <div className="flex flex-col">
              <span className="text-label-sm font-ui uppercase text-on-surface-variant">Valor en Reserva</span>
              <span className="font-ui text-currency-display text-primary">{formatCurrency(reserveValue)}</span>
            </div>
          </div>
          {urgent && (
            <div className="flex items-center gap-2 px-3 py-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-container/40 text-secondary">
                <Icon name="hourglass_top" className="text-[20px]" />
              </div>
              <div className="flex flex-col">
                <span className="text-label-sm font-ui font-semibold uppercase text-secondary">1 Urgente</span>
                <span className="font-ui text-body-md font-semibold text-on-surface">
                  Depto {urgent.unitCode} · {formatRelativeExpiry(urgent.expiresAt)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-12 items-start gap-6">
        <section className="col-span-12 flex flex-col gap-4 lg:col-span-7">
          <div className="flex flex-col gap-3 rounded-xl bg-surface-container-lowest p-4 shadow-sm">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={`whitespace-nowrap rounded-full px-4 py-1.5 font-ui text-label-md transition-all ${
                    filter === f.key ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  {f.label} <span className="ml-1 opacity-70">({myHolds.filter((h) => f.key === 'todos' || h.status === f.key).length})</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <div className="flex flex-1 items-center rounded-lg bg-surface-container-low px-3 py-2">
                <Icon name="search" className="mr-2 text-[18px] text-on-surface-variant" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Filtrar por folio, cliente, departamento..."
                  className="w-full bg-transparent font-ui text-body-sm text-on-surface outline-none placeholder:text-on-surface-variant"
                />
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container-low/60 font-ui text-label-sm uppercase tracking-wider text-on-surface-variant">
                    <th className="px-4 py-3">Folio / Unidad</th>
                    <th className="px-4 py-3">Prospecto</th>
                    <th className="px-4 py-3 text-right">Apartado</th>
                    <th className="px-4 py-3">Vencimiento</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high/60 font-ui text-body-sm">
                  {filtered.map((hold) => {
                    const prospecto = prospectoById(prospectos, hold.prospectoId);
                    const isSelected = selected?.id === hold.id;
                    const statusMeta = STATUS_LABEL[hold.status];
                    return (
                      <tr
                        key={hold.id}
                        onClick={() => setSelectedId(hold.id)}
                        className={`cursor-pointer transition-colors ${isSelected ? 'bg-surface-container-low/80' : 'hover:bg-surface-container-low'}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`h-8 w-1.5 rounded-full ${isSelected ? 'bg-secondary' : 'bg-transparent'}`} />
                            <div className="flex flex-col">
                              <span className="font-ui text-title-md font-bold text-primary">Depto {hold.unitCode}</span>
                              <span className="text-label-sm font-ui font-semibold text-secondary">#{hold.folio}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-ui text-title-md text-on-surface">{prospecto?.name ?? '—'}</span>
                            <span className="text-xs text-on-surface-variant">{prospecto?.phone}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-semibold text-primary">{formatCurrency(hold.amount)}</span>
                        </td>
                        <td className="px-4 py-3 font-ui text-xs font-semibold text-on-surface">
                          {hold.status === 'vigente' || hold.status === 'por_vencer' ? formatRelativeExpiry(hold.expiresAt) : statusMeta.label}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-label-sm font-ui ${statusMeta.className}`}>
                            {statusMeta.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center font-ui text-body-sm text-on-surface-variant">
                        No hay apartados con este filtro.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl bg-surface-container p-4 shadow-sm">
            <Icon name="policy" className="mt-0.5 text-[24px] text-secondary" />
            <div className="flex flex-col">
              <span className="font-ui text-title-md font-bold text-primary">Normativa de Bloqueo de Unidades</span>
              <p className="mt-0.5 font-ui text-body-sm text-on-surface-variant">
                Los apartados tienen vigencia improrrogable con depósito de garantía verificado. Si no se confirma
                venta o cancelación antes del plazo, la unidad se reintegra en automático al selector público.
              </p>
            </div>
          </div>
        </section>

        <aside className="sticky top-24 col-span-12 lg:col-span-5">
          {selected ? <HoldDetail hold={selected} /> : (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-2 rounded-xl bg-surface-container-lowest p-10 text-center shadow-sm">
              <Icon name="inbox" className="text-[32px] text-on-surface-variant" />
              <p className="font-ui text-body-sm text-on-surface-variant">Selecciona un apartado de la lista.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function HoldDetail({ hold }: { hold: Hold }) {
  const units = usePortalStore((state) => state.units);
  const prospectos = usePortalStore((state) => state.prospectos);
  const requestSaleApproval = usePortalStore((state) => state.requestSaleApproval);
  const requestCancellation = usePortalStore((state) => state.requestCancellation);
  const approvals = usePortalStore((state) => state.approvals);

  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [copied, setCopied] = useState(false);

  const unit = unitByCode(units, hold.unitCode);
  const prospecto = prospectoById(prospectos, hold.prospectoId);
  const statusMeta = STATUS_LABEL[hold.status];
  const isActive = hold.status === 'vigente' || hold.status === 'por_vencer';

  const pendingSale = approvals.find((a) => a.unitCode === hold.unitCode && a.kind === 'venta' && a.status === 'pendiente');
  const pendingCancel = approvals.find((a) => a.unitCode === hold.unitCode && a.kind === 'cancelacion' && a.status === 'pendiente');

  return (
    <div className="flex flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-lg">
      <div className="flex flex-col gap-2 border-b border-surface-container-highest/60 bg-surface-container-low p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded bg-surface-container-highest px-2 py-0.5 text-label-sm font-ui font-bold uppercase tracking-wider text-on-surface-variant">
              Folio activo
            </span>
            <span className="font-ui text-title-md font-bold text-primary">#{hold.folio}</span>
          </div>
          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-label-sm font-ui font-semibold ${statusMeta.className}`}>
            <Icon name="timer" className="text-[14px]" />
            {isActive ? formatRelativeExpiry(hold.expiresAt) : statusMeta.label}
          </span>
        </div>
        <div className="flex items-baseline justify-between pt-1">
          <div>
            <h2 className="font-serif text-headline-sm text-primary">
              Depto {hold.unitCode} · Nivel {unit?.floor}
            </h2>
            <p className="text-label-sm font-ui font-medium uppercase tracking-wide text-secondary">
              Torre Aura Del Valle · {unit?.orientation}
            </p>
          </div>
          <div className="text-right">
            <span className="font-ui text-currency-display text-primary">{formatCurrency(unit?.price ?? 0)}</span>
            <span className="block text-[11px] text-on-surface-variant">Precio de Lista (MXN)</span>
          </div>
        </div>
      </div>

      <div className="flex max-h-[calc(100vh-420px)] flex-col gap-6 overflow-y-auto p-6">
        <div className="flex flex-col gap-2">
          <span className="text-label-sm font-ui font-semibold uppercase tracking-wider text-on-surface-variant">Especificaciones de unidad</span>
          <div className="grid grid-cols-3 gap-2 rounded-lg bg-surface-container-low p-3">
            <SpecMini label="Área Total" value={`${unit?.m2.toFixed(2)} m²`} />
            <SpecMini label="Precio / m²" value={formatCurrency(unit ? Math.round(unit.price / unit.m2) : 0)} />
            <SpecMini label="Distribución" value={`${unit?.bedrooms} Rec · ${unit?.bathrooms} B`} />
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-xl bg-surface-container-low/70 p-4">
          <div className="flex items-center justify-between">
            <span className="text-label-sm font-ui font-semibold uppercase tracking-wider text-on-surface-variant">Datos del prospecto</span>
          </div>
          <div className="mt-1 flex items-start gap-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-container font-serif text-lg text-on-primary">
              {prospecto?.initials ?? '—'}
            </div>
            <div className="flex flex-1 flex-col">
              <span className="font-ui text-title-md font-bold text-primary">{prospecto?.name ?? 'Sin identificar'}</span>
              <span className="font-ui text-body-sm text-on-surface-variant">{prospecto?.email}</span>
              <span className="font-ui text-body-sm font-medium text-on-surface">{prospecto?.phone}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-label-sm font-ui font-semibold uppercase tracking-wider text-on-surface-variant">Términos de la reserva</span>
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-container-low p-4">
            <div className="flex flex-col">
              <span className="text-[11px] uppercase text-on-surface-variant">Monto apartado</span>
              <span className="font-ui text-title-md font-bold text-primary">{formatCurrency(hold.amount)}</span>
              <span className="text-[11px] font-medium text-secondary">Reembolsable</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] uppercase text-on-surface-variant">Vencimiento</span>
              <span className="text-xs font-bold text-secondary">
                {new Date(hold.expiresAt).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </div>

        {hold.notes && (
          <div className="rounded-lg bg-surface-container-low p-3 font-ui text-body-sm text-on-surface-variant">
            <Icon name="sticky_note_2" className="mr-1.5 align-middle text-[16px] text-secondary" />
            {hold.notes}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-surface-container-highest/80 bg-surface-container-low p-4">
        <div className="grid grid-cols-2 gap-1.5">
          <a
            href={`https://wa.me/${(prospecto?.phone ?? '').replace(/\D/g, '')}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-lg bg-surface-container-lowest px-3 py-2 font-ui text-label-md text-primary shadow-sm transition-colors hover:bg-surface-container-high"
          >
            <Icon name="chat" className="text-[18px] text-[#128C7E]" />
            <span>WhatsApp</span>
          </a>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1800);
            }}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-surface-container-lowest px-3 py-2 font-ui text-label-md text-primary shadow-sm transition-colors hover:bg-surface-container-high"
          >
            <Icon name="share" className="text-[18px] text-secondary" />
            <span>{copied ? '¡Copiado!' : 'Ficha pública'}</span>
          </button>
        </div>

        {isActive && (
          <div className="flex flex-col gap-1 pt-1">
            <button
              type="button"
              disabled={!!pendingSale}
              onClick={() => requestSaleApproval(hold.id)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-3 font-ui text-label-md text-on-primary shadow-md transition-all hover:bg-primary-container active:scale-[0.98] disabled:opacity-60"
            >
              <Icon name="verified_user" className="text-[18px]" />
              <span>{pendingSale ? 'Revisión de venta en curso' : 'Solicitar revisión de venta'}</span>
            </button>
            <div className="flex items-center gap-1 px-1 text-[11px] text-on-surface-variant">
              <Icon name="info" className="text-[13px] text-secondary" />
              <span>Envía el expediente a administración; la venta final requiere validación contractual.</span>
            </div>
          </div>
        )}

        {isActive && !pendingCancel && (
          <div className="flex flex-col gap-1 pt-1">
            {!cancelling ? (
              <button
                type="button"
                onClick={() => setCancelling(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-transparent py-2 font-ui text-label-sm text-error transition-colors hover:bg-error-container/40"
              >
                <Icon name="cancel" className="text-[16px]" />
                <span>Solicitar cancelación de apartado</span>
              </button>
            ) : (
              <div className="flex flex-col gap-1.5 rounded-lg bg-error-container/30 p-2.5">
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Motivo de la cancelación..."
                  className="w-full resize-none rounded-md bg-surface-container-lowest p-2 font-ui text-body-sm text-on-surface outline-none placeholder:text-on-surface-variant"
                />
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCancelling(false)}
                    className="flex-1 rounded-md bg-surface-container-lowest py-1.5 font-ui text-label-sm text-on-surface-variant hover:bg-surface-container"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={!reason.trim()}
                    onClick={() => {
                      requestCancellation(hold.id, reason.trim());
                      setCancelling(false);
                      setReason('');
                    }}
                    className="flex-1 rounded-md bg-error py-1.5 font-ui text-label-sm text-on-error disabled:opacity-60"
                  >
                    Enviar solicitud
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {pendingCancel && (
          <p className="pt-1 text-center font-ui text-[11px] text-on-surface-variant">Cancelación en revisión por administración.</p>
        )}
      </div>
    </div>
  );
}

function SpecMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] text-on-surface-variant">{label}</span>
      <span className="font-ui text-title-md text-on-surface">{value}</span>
    </div>
  );
}
