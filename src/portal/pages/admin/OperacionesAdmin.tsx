import { useMemo, useState } from 'react';
import { usePortalStore, unitByCode, teamMemberById } from '../../store/portalStore';
import { Icon } from '../../components/Icon';
import { formatCurrency, formatRelativeExpiry } from '../../lib/format';
import type { Approval } from '../../types';

type Tab = 'pendientes' | 'vigentes' | 'ventas';

const APPROVE_LABEL: Record<Approval['kind'], string> = {
  venta: 'Confirmar y registrar venta definitiva',
  cancelacion: 'Autorizar cancelación y liberar unidad',
  prorroga: 'Conceder prórroga (+24 hrs)',
};

const KIND_META: Record<Approval['kind'], { label: string; badgeClass: string; dotClass: string }> = {
  venta: { label: 'Confirmación Venta', badgeClass: 'bg-primary text-on-primary', dotClass: 'bg-secondary' },
  cancelacion: { label: 'Cancelación Apartado', badgeClass: 'bg-error-container text-on-error-container', dotClass: 'bg-error' },
  prorroga: { label: 'Prórroga de Apartado', badgeClass: 'bg-secondary-container text-on-secondary-container', dotClass: 'bg-outline-variant' },
};

export function OperacionesAdmin() {
  const approvals = usePortalStore((state) => state.approvals);
  const holds = usePortalStore((state) => state.holds);
  const units = usePortalStore((state) => state.units);
  const team = usePortalStore((state) => state.team);
  const resolveApproval = usePortalStore((state) => state.resolveApproval);

  const [tab, setTab] = useState<Tab>('pendientes');
  const [advisorFilter, setAdvisorFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const pending = useMemo(() => approvals.filter((a) => a.status === 'pendiente'), [approvals]);
  const vigentes = useMemo(() => holds.filter((h) => h.status === 'vigente' || h.status === 'por_vencer'), [holds]);
  const ventas = useMemo(() => approvals.filter((a) => a.kind === 'venta' && a.status === 'aprobada'), [approvals]);

  const filteredPending = advisorFilter ? pending.filter((a) => a.advisorId === advisorFilter) : pending;
  const asesores = team.filter((member) => member.role === 'asesor');

  const selected = pending.find((a) => a.id === selectedId) ?? filteredPending[0] ?? null;

  function decide(decision: 'aprobada' | 'rechazada') {
    if (!selected) return;
    resolveApproval(selected.id, decision, note || undefined);
    setNote('');
    setSelectedId(null);
  }

  const totalInValidation = pending.reduce((sum, a) => sum + a.amount, 0);

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-secondary">
            <Icon name="verified" className="text-[16px]" />
            <span className="text-label-sm font-ui uppercase tracking-widest">Módulo de Gobierno Comercial</span>
          </div>
          <h1 className="font-serif text-headline-lg tracking-tight text-primary">Operaciones y Aprobaciones</h1>
          <p className="mt-1 font-ui text-body-md text-on-surface-variant">
            Supervisión en tiempo real de transacciones, bloqueos de inventario y formalización de escrituraciones.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-3 rounded-lg bg-surface-container-lowest px-4 py-2 shadow-sm">
            <div className="h-2 w-2 animate-pulse rounded-full bg-secondary" />
            <div className="flex flex-col">
              <span className="text-label-sm font-ui uppercase text-on-surface-variant">Monto en Validación</span>
              <span className="font-ui text-title-md font-bold text-primary">{formatCurrency(totalInValidation)}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-surface-container-lowest px-4 py-2 shadow-sm">
            <Icon name="history_toggle_off" className="text-[22px] text-secondary" />
            <div className="flex flex-col">
              <span className="text-label-sm font-ui uppercase text-on-surface-variant">Tiempo promedio</span>
              <span className="font-ui text-title-md font-bold text-primary">3.2 hrs</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-between gap-4 rounded-xl bg-surface-container-lowest p-2 shadow-sm md:flex-row md:items-center">
        <div className="inline-flex rounded-lg bg-surface-container-low p-1">
          <TabButton active={tab === 'pendientes'} label="Solicitudes pendientes" count={filteredPending.length} onClick={() => setTab('pendientes')} />
          <TabButton active={tab === 'vigentes'} label="Apartados vigentes" count={vigentes.length} onClick={() => setTab('vigentes')} />
          <TabButton active={tab === 'ventas'} label="Ventas registradas" count={ventas.length} onClick={() => setTab('ventas')} />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <select
            value={advisorFilter}
            onChange={(event) => setAdvisorFilter(event.target.value)}
            className="min-w-[170px] cursor-pointer rounded-lg bg-surface-container-low px-3 py-2 font-ui text-body-sm text-on-surface focus:outline-none"
          >
            <option value="">Todos los asesores</option>
            {asesores.map((advisor) => (
              <option key={advisor.id} value={advisor.id}>
                {advisor.name}
              </option>
            ))}
          </select>
          {advisorFilter && (
            <button
              type="button"
              onClick={() => setAdvisorFilter('')}
              title="Limpiar filtros"
              className="rounded-lg bg-surface-container-low p-2 text-on-surface-variant hover:bg-surface-container-high"
            >
              <Icon name="filter_alt_off" className="text-[18px]" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl bg-surface-container-low p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container-lowest text-secondary shadow-sm">
            <Icon name="policy" className="text-[20px]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-ui text-body-md font-bold text-primary">Protocolo de Integridad de Ventas y Reversiones</span>
            </div>
            <p className="mt-0.5 font-ui text-body-sm text-on-surface-variant">
              Toda confirmación impacta el inventario activo de Torre Aura. Las reversiones de contratos cerrados exigen
              expediente con motivo legal y quedan inmutables en la bitácora de auditoría.
            </p>
          </div>
        </div>
      </div>

      {tab === 'pendientes' && (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
          <div className="flex flex-col gap-4 xl:col-span-6">
            <div className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
              <div className="flex items-center justify-between bg-surface-container-lowest p-4">
                <h2 className="font-ui text-title-md text-primary">Solicitudes pendientes de resolución</h2>
                <span className="text-label-sm font-ui text-on-surface-variant">Actualizado justo ahora</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-surface-container-low font-ui text-label-sm uppercase tracking-wider text-on-surface-variant">
                      <th className="px-4 py-3 font-semibold">Tipo / Folio</th>
                      <th className="px-4 py-3 font-semibold">Unidad</th>
                      <th className="px-4 py-3 font-semibold">Asesor / Cliente</th>
                      <th className="px-4 py-3 text-right font-semibold">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="font-ui text-body-sm">
                    {filteredPending.map((approval) => {
                      const meta = KIND_META[approval.kind];
                      const unit = unitByCode(units, approval.unitCode);
                      const advisor = teamMemberById(team, approval.advisorId);
                      const isSelected = selected?.id === approval.id;
                      return (
                        <tr
                          key={approval.id}
                          onClick={() => setSelectedId(approval.id)}
                          className={`group cursor-pointer transition-colors ${isSelected ? 'bg-surface-container-low/70' : 'hover:bg-surface-container-low'}`}
                        >
                          <td className="px-4 py-3.5 align-top">
                            <div className="flex items-center gap-2">
                              <span className={`h-2 w-2 rounded-full ${meta.dotClass}`} />
                              <span className="font-ui text-label-md font-semibold text-on-surface">{meta.label}</span>
                            </div>
                            <div className="mt-0.5 text-label-sm font-ui text-on-surface-variant">{approval.folio}</div>
                          </td>
                          <td className="px-4 py-3.5 align-top">
                            <div className="font-semibold text-on-surface">Depto {approval.unitCode}</div>
                            <div className="text-label-sm font-ui text-on-surface-variant">
                              Nivel {unit?.floor} · {unit?.m2.toFixed(0)} m²
                            </div>
                          </td>
                          <td className="px-4 py-3.5 align-top">
                            <div className="font-medium text-on-surface">{advisor?.name ?? '—'}</div>
                            <div className="max-w-[150px] truncate text-body-sm text-on-surface-variant">{approval.buyerName}</div>
                          </td>
                          <td className="px-4 py-3.5 text-right align-middle">
                            {isSelected ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 font-ui text-label-sm font-medium text-on-primary shadow-sm">
                                <span>Revisando</span>
                                <Icon name="arrow_forward" className="text-[14px]" />
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="rounded-lg px-2.5 py-1 font-ui text-label-sm text-on-surface-variant transition-colors group-hover:bg-surface-container-high group-hover:text-primary"
                              >
                                Examinar
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredPending.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center font-ui text-body-sm text-on-surface-variant">
                          Sin solicitudes pendientes.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between bg-surface-container-lowest px-4 py-3 text-on-surface-variant">
                <span className="font-ui text-label-sm">Mostrando {filteredPending.length} solicitudes sin atender</span>
                <div className="flex items-center gap-1">
                  <Icon name="lock_clock" className="text-[16px]" />
                  <span className="font-ui text-label-sm">SLA de aprobación: &lt; 24h hábiles</span>
                </div>
              </div>
            </div>
          </div>

          <div className="xl:col-span-6">
            {selected ? (
              <ApprovalDetail
                approval={selected}
                note={note}
                onNoteChange={setNote}
                onApprove={() => decide('aprobada')}
                onReject={() => decide('rechazada')}
                onClose={() => setSelectedId(null)}
              />
            ) : (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-2 rounded-xl bg-surface-container-lowest p-10 text-center shadow-sm">
                <Icon name="task_alt" className="text-[32px] text-on-surface-variant" />
                <p className="font-ui text-body-sm text-on-surface-variant">
                  Selecciona una solicitud de la lista para revisar el expediente completo.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'vigentes' && (
        <div className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-low font-ui text-label-sm uppercase tracking-wider text-on-surface-variant">
                  <th className="px-4 py-3">Folio / Unidad</th>
                  <th className="px-4 py-3">Asesor</th>
                  <th className="px-4 py-3 text-right">Apartado</th>
                  <th className="px-4 py-3">Vencimiento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low font-ui text-body-sm">
                {vigentes.map((hold) => {
                  const unit = unitByCode(units, hold.unitCode);
                  const advisor = teamMemberById(team, hold.advisorId);
                  return (
                    <tr key={hold.id} className="hover:bg-surface-container-low/60">
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-primary">Depto {hold.unitCode}</div>
                        <div className="text-label-sm text-on-surface-variant">#{hold.folio}</div>
                      </td>
                      <td className="px-4 py-3.5">{advisor?.name ?? '—'}</td>
                      <td className="px-4 py-3.5 text-right font-semibold text-on-surface">{formatCurrency(unit?.price ?? hold.amount)}</td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-label-sm font-semibold ${hold.status === 'por_vencer' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-high text-on-surface-variant'}`}>
                          <Icon name="schedule" className="text-[13px]" />
                          {formatRelativeExpiry(hold.expiresAt)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {vigentes.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center font-ui text-body-sm text-on-surface-variant">
                      No hay apartados vigentes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'ventas' && (
        <div className="flex flex-col gap-2 rounded-xl bg-surface-container-lowest p-4 shadow-sm">
          {ventas.map((approval) => {
            const advisor = teamMemberById(team, approval.advisorId);
            return (
              <div key={approval.id} className="flex items-center justify-between rounded-lg bg-surface-container-low p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-surface-container-lowest font-ui text-body-sm font-bold text-primary shadow-sm">
                    {approval.unitCode}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-ui text-label-md font-semibold text-primary">Torre Aura · Depto {approval.unitCode}</span>
                    <span className="font-ui text-body-sm text-on-surface-variant">
                      Comprador: {approval.buyerName} · Asesor: {advisor?.name ?? '—'}
                    </span>
                  </div>
                </div>
                <span className="font-ui text-title-md font-bold text-primary">{formatCurrency(approval.amount)}</span>
              </div>
            );
          })}
          {ventas.length === 0 && (
            <p className="py-10 text-center font-ui text-body-sm text-on-surface-variant">Aún no hay ventas registradas.</p>
          )}
        </div>
      )}
    </div>
  );
}

function TabButton({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-4 py-2 font-ui text-label-md transition-all ${
        active ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
      }`}
    >
      <span>{label}</span>
      <span className={`rounded-full px-2 py-0.5 text-label-sm ${active ? 'bg-secondary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>
        {count}
      </span>
    </button>
  );
}

interface ApprovalDetailProps {
  approval: Approval;
  note: string;
  onNoteChange: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onClose: () => void;
}

function ApprovalDetail({ approval, note, onNoteChange, onApprove, onReject, onClose }: ApprovalDetailProps) {
  const units = usePortalStore((state) => state.units);
  const holds = usePortalStore((state) => state.holds);
  const team = usePortalStore((state) => state.team);
  const unit = unitByCode(units, approval.unitCode);
  const advisor = teamMemberById(team, approval.advisorId);
  const hold = holds.find((h) => h.unitCode === approval.unitCode);
  const meta = KIND_META[approval.kind];

  const downPayment = Math.round(approval.amount * 0.2);
  const construction = Math.round(approval.amount * 0.1);
  const delivery = approval.amount - downPayment - construction;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-xl">
      <div className="flex items-start justify-between bg-surface-container-low p-6">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="rounded bg-secondary px-2 py-0.5 text-label-sm font-ui font-bold uppercase tracking-wider text-on-primary">
              Folio #{approval.folio}
            </span>
            <span className={`rounded px-2 py-0.5 text-label-sm font-ui font-semibold ${meta.badgeClass}`}>{meta.label}</span>
          </div>
          <h2 className="mt-1 font-serif text-headline-md font-semibold text-primary">Revisión y confirmación</h2>
          <span className="font-ui text-body-sm text-on-surface-variant">
            Torre Aura Del Valle · Depto {approval.unitCode} (Piso {unit?.floor} · {unit?.m2.toFixed(1)} m²)
          </span>
        </div>
        <button type="button" onClick={onClose} title="Cerrar panel" className="rounded-lg bg-surface-container-lowest p-1.5 text-on-surface-variant shadow-sm hover:text-on-surface">
          <Icon name="close" className="text-[20px]" />
        </button>
      </div>

      <div className="flex max-h-[calc(100vh-360px)] flex-col gap-6 overflow-y-auto p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl bg-surface-container-low p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-secondary">
              <Icon name="person" className="text-[18px]" />
              <span className="text-label-sm font-ui font-semibold uppercase tracking-wider">Cliente / Comprador</span>
            </div>
            <div className="font-ui text-title-md font-bold text-primary">{approval.buyerName}</div>
          </div>
          <div className="rounded-xl bg-surface-container-low p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-secondary">
              <Icon name="badge" className="text-[18px]" />
              <span className="text-label-sm font-ui font-semibold uppercase tracking-wider">Asesor responsable</span>
            </div>
            <div className="font-ui text-title-md font-bold text-primary">{advisor?.name ?? '—'}</div>
            {hold && <div className="mt-1 font-ui text-body-sm text-on-surface-variant">Folio origen: #{hold.folio}</div>}
          </div>
        </div>

        <div className="rounded-xl bg-surface-container-low p-4 shadow-sm">
          <p className="font-ui text-body-sm text-on-surface-variant">{approval.detail}</p>
        </div>

        {approval.kind === 'venta' && (
          <div className="rounded-xl bg-surface-container-low p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Icon name="payments" className="text-[20px] text-secondary" />
              <span className="font-ui text-body-md font-bold text-primary">Condiciones financieras propuestas</span>
            </div>
            <div className="mb-3 rounded-lg bg-surface-container-lowest p-3 shadow-sm">
              <span className="block text-label-sm font-ui text-on-surface-variant">Precio acordado de venta</span>
              <span className="font-serif text-headline-sm font-bold text-primary">{formatCurrency(approval.amount)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <PaymentChip pct="20%" label="Enganche" amount={downPayment} />
              <PaymentChip pct="10%" label="Durante obra" amount={construction} />
              <PaymentChip pct="70%" label="Escrituración" amount={delivery} />
            </div>
          </div>
        )}

        <div className="flex items-start gap-3 rounded-xl bg-surface-container-high p-4 shadow-sm">
          <Icon name="warning" className="mt-0.5 shrink-0 text-[22px] text-secondary" />
          <div className="flex flex-col font-ui text-body-sm">
            <span className="font-semibold text-primary">Aviso legal y operativo</span>
            <p className="mt-1 leading-relaxed text-on-surface-variant">
              Esta decisión actualiza de inmediato la disponibilidad del selector web y cotizadores de asesores. No
              sustituye el contrato notarial definitivo formalizado por la notaría asignada al proyecto.
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-surface-container-low p-4 shadow-sm">
          <label htmlFor="admin-observation-notes" className="mb-1 block font-ui text-label-md font-semibold text-primary">
            Instrucciones u observaciones (opcional para aprobar, recomendado si se rechaza):
          </label>
          <textarea
            id="admin-observation-notes"
            rows={2}
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder="Ej. El comprobante coincide con tesorería. Procede formalización..."
            className="w-full resize-none rounded-lg bg-surface-container-lowest p-2.5 font-ui text-body-sm text-on-surface shadow-sm outline-none placeholder:text-on-surface-variant focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 bg-surface-container-low p-6">
        <button
          type="button"
          onClick={onApprove}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3.5 font-ui text-label-md font-bold text-on-primary shadow-md transition-all hover:bg-primary-container active:scale-[0.98]"
        >
          <Icon name="check_circle" className="text-[20px]" />
          <span>{APPROVE_LABEL[approval.kind]}</span>
        </button>
        <button
          type="button"
          onClick={onReject}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-surface-container-lowest py-2.5 font-ui text-label-md text-error shadow-sm transition-all hover:bg-error-container active:scale-[0.98]"
        >
          <Icon name="cancel" className="text-[18px]" />
          <span>Rechazar con motivo</span>
        </button>
      </div>
    </div>
  );
}

function PaymentChip({ pct, label, amount }: { pct: string; label: string; amount: number }) {
  return (
    <div className="rounded bg-surface-container-low p-2">
      <div className="mb-0.5 flex items-center justify-between text-label-sm font-ui">
        <span className="font-bold text-secondary">{pct}</span>
        <span className="text-on-surface-variant">{label}</span>
      </div>
      <div className="font-ui text-body-sm font-bold text-primary">{formatCurrency(amount)}</div>
    </div>
  );
}
