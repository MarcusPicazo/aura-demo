import { Link } from 'react-router-dom';
import { usePortalStore } from '../../store/portalStore';
import { Icon } from '../../components/Icon';
import { formatCurrency, formatRelativeExpiry } from '../../lib/format';
import { unitByCode, teamMemberById } from '../../store/portalStore';
import type { UnitStatus } from '../../types';

const DISTRIBUTION_META: { status: UnitStatus; label: string; barColor: string; dotColor: string; hint: string }[] = [
  { status: 'available', label: 'Disponibles', barColor: 'bg-[#2E5E4E]', dotColor: 'bg-[#2E5E4E]', hint: 'Listas para venta' },
  { status: 'reserved', label: 'Apartadas', barColor: 'bg-[#B69A70]', dotColor: 'bg-[#B69A70]', hint: 'con folio activo' },
  { status: 'sold', label: 'Vendidas / Firmadas', barColor: 'bg-[#252525]', dotColor: 'bg-[#252525]', hint: 'contratos liquidados' },
  { status: 'blocked', label: 'Bloqueadas', barColor: 'bg-[#596B78]', dotColor: 'bg-[#596B78]', hint: 'reserva técnica / socios' },
];

export function ResumenComercial() {
  const units = usePortalStore((state) => state.units);
  const approvals = usePortalStore((state) => state.approvals);
  const holds = usePortalStore((state) => state.holds);
  const prospectos = usePortalStore((state) => state.prospectos);
  const team = usePortalStore((state) => state.team);
  const auditLog = usePortalStore((state) => state.auditLog);
  const resolveApproval = usePortalStore((state) => state.resolveApproval);
  const assignProspecto = usePortalStore((state) => state.assignProspecto);

  const total = units.length;
  const counts = DISTRIBUTION_META.map((meta) => ({
    ...meta,
    count: units.filter((unit) => unit.status === meta.status).length,
  }));

  const pending = approvals.filter((approval) => approval.status === 'pendiente');
  const expiringHolds = holds.filter((hold) => hold.status === 'por_vencer');
  const unassigned = prospectos.filter((prospecto) => !prospecto.advisorId);
  const asesores = team.filter((member) => member.role === 'asesor' && member.status === 'activo');

  function assignEquitably(prospectoIds: string[]) {
    // Reparte al asesor activo con menos carga en cada paso (no al azar), contando
    // también lo que ya se asignó dentro de este mismo lote — así "Auto-reparto
    // equitativo" distribuye parejo aunque se apliquen varias asignaciones de un jalón.
    const loadByAdvisor = new Map(asesores.map((advisor) => [advisor.id, prospectos.filter((p) => p.advisorId === advisor.id).length]));
    prospectoIds.forEach((prospectoId) => {
      const advisor = [...asesores].sort((a, b) => loadByAdvisor.get(a.id)! - loadByAdvisor.get(b.id)!)[0];
      if (!advisor) return;
      assignProspecto(prospectoId, advisor.id);
      loadByAdvisor.set(advisor.id, loadByAdvisor.get(advisor.id)! + 1);
    });
  }

  return (
    <div className="flex w-full flex-col">
      {pending.length > 0 && (
        <div className="mb-6 rounded-xl bg-surface-container-low p-4 shadow-sm">
          <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex min-w-0 items-start gap-4 lg:items-center">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary-container text-on-secondary-container">
                <Icon name="pending_actions" className="text-[22px]" />
              </div>
              <div className="flex min-w-0 flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-ui text-title-md text-on-surface">
                    {pending.length} operaciones requieren tu validación inmediata
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-label-sm font-ui text-on-secondary">
                    Prioridad Alta
                  </span>
                </div>
                <p className="mt-0.5 truncate font-ui text-body-sm text-on-surface-variant">
                  {pending.map((approval) => approval.detail).join(' · ')}
                </p>
              </div>
            </div>
            <Link
              to="/portal/operaciones"
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 py-2 font-ui text-label-md text-on-primary shadow-sm transition-all hover:bg-primary-container active:scale-[0.97]"
            >
              <span>Revisar bandeja ({pending.length})</span>
              <Icon name="arrow_forward" className="text-[16px]" />
            </Link>
          </div>
        </div>
      )}

      <div className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col justify-between lg:col-span-8">
          <div>
            <div className="mb-1.5 flex items-center gap-2 text-label-sm font-ui uppercase tracking-widest text-secondary">
              <span className="h-2 w-2 rounded-full bg-secondary" />
              <span>Desarrollo Residencial Boutique</span>
              <span className="text-on-surface-variant">/</span>
              <span className="text-on-surface-variant">Col. Del Valle, San Pedro Garza García</span>
            </div>
            <h1 className="font-serif text-headline-lg tracking-tight text-on-surface">
              Resumen Comercial · Torre Aura Del Valle
            </h1>
            <p className="mt-2 max-w-2xl font-ui text-body-md text-on-surface-variant">
              Monitoreo en tiempo real del ciclo de inventario, flujo de aprobaciones de contratos, y asignación de
              prospectos de alta intención.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-2 pt-4">
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg bg-surface-container-lowest px-4 py-2 font-ui text-label-md font-medium text-on-surface shadow-sm transition-colors hover:bg-surface-container active:scale-[0.97]"
            >
              <Icon name="file_download" className="text-[18px] text-secondary" />
              <span>Descargar reporte de disponibilidad (PDF)</span>
            </button>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg bg-surface-container-lowest px-4 py-2 font-ui text-label-md font-medium text-on-surface shadow-sm transition-colors hover:bg-surface-container active:scale-[0.97]"
            >
              <Icon name="share" className="text-[18px] text-secondary" />
              <span>Compartir lista de precios vigente</span>
            </button>
            <div className="ml-auto hidden items-center gap-2 text-label-sm font-ui text-on-surface-variant xl:flex">
              <Icon name="schedule" className="text-[16px] text-secondary" />
              <span>Corte al instante: {new Date().toLocaleString('es-MX', { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </div>

        <div className="relative flex min-h-[220px] flex-col justify-end overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm lg:col-span-4">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/clients/aura/facade.jpg')" }} />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/95 via-primary/50 to-transparent" />
          <div className="relative p-4 text-on-primary">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-label-sm font-ui uppercase tracking-wider text-secondary-fixed">Avance Físico de Obra</span>
              <span className="rounded bg-surface-container-lowest/20 px-2 py-0.5 text-label-sm font-ui text-on-primary backdrop-blur-md">
                78% ejecutado
              </span>
            </div>
            <p className="font-serif text-headline-sm font-semibold">Entrega Fase 1: Q1 2026</p>
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-container-lowest/30">
              <div className="h-full w-[78%] rounded-full bg-secondary-fixed" />
            </div>
            <p className="mt-1.5 flex items-center gap-1 font-ui text-body-sm text-surface-container-highest">
              <Icon name="architecture" className="text-[14px]" />
              <span>Estructura concluida · Instalaciones hidrosanitarias en nivel 8</span>
            </p>
          </div>
        </div>
      </div>

      <div className="mb-10">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-ui text-title-md text-on-surface">Estado del Inventario Global</span>
            <span className="rounded bg-surface-container-high px-2 py-0.5 text-label-sm font-ui text-on-surface-variant">
              {total} unidades en total
            </span>
          </div>
          <span className="text-label-sm font-ui font-medium text-secondary">100% catalogado en sistema</span>
        </div>
        <div className="mb-4 flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-surface-container-high">
          {counts.map((c) => (
            <div
              key={c.status}
              className={`h-full ${c.barColor}`}
              style={{ width: `${(c.count / total) * 100}%` }}
              title={`${c.count} ${c.label} (${((c.count / total) * 100).toFixed(1)}%)`}
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {counts.map((c) => (
            <div key={c.status} className="flex flex-col justify-between rounded-xl bg-surface-container-lowest p-4 shadow-sm transition-all hover:shadow-md">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-label-sm font-ui uppercase tracking-wider text-on-surface-variant">{c.label}</span>
                <span className={`h-2.5 w-2.5 rounded-full ${c.dotColor}`} />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-serif text-display-lg font-semibold leading-none text-on-surface">{c.count}</span>
                <span className="font-ui text-body-sm text-on-surface-variant">de {total} unidades</span>
              </div>
              <div className="mt-2 flex items-center justify-between pt-1 font-ui text-label-sm text-on-surface-variant">
                <span>{((c.count / total) * 100).toFixed(1)}% del desarrollo</span>
                <span className="font-medium text-on-surface">{c.hint}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-7">
          <div className="rounded-xl bg-surface-container-lowest p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-low text-primary">
                  <Icon name="assignment_turned_in" className="text-[20px]" />
                </div>
                <div>
                  <h2 className="font-ui text-title-md text-on-surface">Solicitudes pendientes de autorización</h2>
                  <span className="text-label-sm font-ui text-on-surface-variant">
                    {pending.length} operaciones requieren tu dictamen para avanzar en inventario
                  </span>
                </div>
              </div>
              {pending.length > 0 && (
                <span className="rounded-full bg-secondary-container px-2.5 py-1 text-label-sm font-ui font-semibold text-on-secondary-container">
                  {pending.length} solicitudes
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {pending.length === 0 && (
                <p className="rounded-lg bg-surface-container-low p-4 text-center font-ui text-body-sm text-on-surface-variant">
                  Sin solicitudes pendientes. Todo al día.
                </p>
              )}
              {pending.map((approval) => {
                const advisor = teamMemberById(team, approval.advisorId);
                return (
                  <div
                    key={approval.id}
                    className="flex flex-col justify-between gap-4 rounded-lg bg-surface-container-low p-4 transition-colors hover:bg-surface-container sm:flex-row sm:items-center"
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-surface-container-lowest shadow-sm">
                        <span className="text-label-sm font-ui text-on-surface-variant">DEPTO</span>
                        <span className="text-title-md font-ui font-bold leading-none text-on-surface">{approval.unitCode}</span>
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-ui text-body-md font-semibold text-on-surface">
                            {approval.kind === 'venta'
                              ? 'Confirmación de Venta Definitiva'
                              : approval.kind === 'cancelacion'
                                ? 'Cancelación y Devolución de Apartado'
                                : 'Solicitud de Prórroga'}
                          </span>
                          <span className="rounded bg-primary px-2 py-0.5 text-label-sm font-ui text-on-primary">
                            {approval.folio}
                          </span>
                        </div>
                        <p className="mt-0.5 font-ui text-body-sm text-on-surface-variant">{approval.detail}</p>
                        <div className="mt-1 flex items-center gap-2 font-ui text-label-sm text-on-surface-variant">
                          <Icon name="person" className="text-[14px]" />
                          <span>Asesor: {advisor?.name ?? 'Sin asignar'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => resolveApproval(approval.id, 'rechazada')}
                        className="rounded-lg bg-surface-container-lowest px-3 py-1.5 font-ui text-label-md text-on-surface-variant shadow-sm transition-colors hover:text-on-surface active:scale-[0.97]"
                      >
                        Rechazar
                      </button>
                      <button
                        type="button"
                        onClick={() => resolveApproval(approval.id, 'aprobada')}
                        className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 font-ui text-label-md text-on-primary shadow-sm transition-all hover:bg-primary-container active:scale-[0.97]"
                      >
                        <Icon name="check" className="text-[16px]" />
                        <span>Aprobar</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl bg-surface-container-lowest p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-low text-secondary">
                  <Icon name="hourglass_bottom" className="text-[20px]" />
                </div>
                <div>
                  <h2 className="font-ui text-title-md text-on-surface">Apartados con vencimiento inminente</h2>
                  <span className="text-label-sm font-ui text-on-surface-variant">
                    Unidades con plazo comercial a expirar en menos de 48 horas
                  </span>
                </div>
              </div>
              <span className="text-label-sm font-ui font-medium text-secondary">{expiringHolds.length} unidades críticas</span>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {expiringHolds.length === 0 && (
                <p className="rounded-lg bg-surface-container-low p-4 text-center font-ui text-body-sm text-on-surface-variant md:col-span-2">
                  Ningún apartado vence pronto.
                </p>
              )}
              {expiringHolds.map((hold) => {
                const unit = unitByCode(units, hold.unitCode);
                const advisor = teamMemberById(team, hold.advisorId);
                return (
                  <div key={hold.id} className="flex flex-col justify-between gap-2 rounded-lg bg-surface-container-low p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-serif text-headline-sm font-semibold text-on-surface">Unidad {hold.unitCode}</span>
                        <span className="block text-label-sm font-ui text-on-surface-variant">
                          Nivel {unit?.floor} · {unit?.m2} m² · {unit?.bedrooms} Rec
                        </span>
                      </div>
                      <span className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-label-sm font-ui text-on-secondary">
                        <Icon name="alarm" className="text-[13px]" />
                        {formatRelativeExpiry(hold.expiresAt)}
                      </span>
                    </div>
                    <p className="font-ui text-body-sm text-on-surface-variant">
                      {hold.notes ?? 'Sin observaciones adicionales.'}
                    </p>
                    <p className="text-label-sm font-ui font-semibold text-on-surface">Asesor: {advisor?.name ?? '—'}</p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="font-ui text-currency-display font-semibold text-on-surface">
                        {unit ? formatCurrency(unit.price) : '—'}
                      </span>
                      <Link
                        to="/portal/inventario"
                        className="flex items-center gap-0.5 font-ui text-label-md font-medium text-secondary transition-colors hover:text-on-surface"
                      >
                        <span>Inspeccionar</span>
                        <Icon name="chevron_right" className="text-[16px]" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-5">
          <div className="flex flex-col justify-between rounded-xl bg-surface-container-lowest p-6 shadow-sm">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-low text-primary">
                    <Icon name="person_pin" className="text-[20px]" />
                  </div>
                  <div>
                    <h2 className="font-ui text-title-md text-on-surface">Prospectos sin asignar</h2>
                    <span className="text-label-sm font-ui text-on-surface-variant">Captados vía selector web público</span>
                  </div>
                </div>
                <span className="rounded-full bg-secondary-fixed px-2 py-0.5 text-label-sm font-ui font-semibold text-on-secondary-fixed">
                  {unassigned.length} nuevos
                </span>
              </div>
              <p className="mb-4 font-ui text-body-sm text-on-surface-variant">
                Prospectos con scoring financiero calificado pendientes de asignación a uno de los {asesores.length}{' '}
                asesores activos del equipo.
              </p>
              <div className="flex flex-col gap-1">
                {unassigned.length === 0 && (
                  <p className="rounded-lg bg-surface-container-low p-3 text-center font-ui text-body-sm text-on-surface-variant">
                    Cartera al día, sin prospectos sin asignar.
                  </p>
                )}
                {unassigned.map((prospecto) => (
                  <div key={prospecto.id} className="flex items-center justify-between rounded-lg bg-surface-container-low p-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-label-sm font-ui font-bold text-on-surface">
                        {prospecto.initials}
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-ui text-body-md font-semibold text-on-surface">{prospecto.name}</span>
                        <span className="truncate font-ui text-body-sm text-on-surface-variant">
                          {prospecto.interestedUnitCodes.length > 0
                            ? `Interesado en depto ${prospecto.interestedUnitCodes.join(', ')}`
                            : prospecto.origin}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => assignEquitably([prospecto.id])}
                      className="shrink-0 rounded bg-surface-container-lowest px-2.5 py-1 text-label-sm font-ui text-primary transition-all hover:bg-primary hover:text-on-primary active:scale-[0.95]"
                    >
                      Asignar
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between pt-2">
              <Link
                to="/portal/prospectos"
                className="flex items-center gap-1 font-ui text-label-md font-medium text-secondary transition-colors hover:text-on-surface"
              >
                <span>Ver cartera completa ({prospectos.length} leads)</span>
                <Icon name="chevron_right" className="text-[16px]" />
              </Link>
              {unassigned.length > 0 && (
                <button
                  type="button"
                  onClick={() => assignEquitably(unassigned.map((p) => p.id))}
                  className="rounded-lg bg-primary px-3 py-1.5 font-ui text-label-sm text-on-primary shadow-sm transition-all hover:bg-primary-container active:scale-[0.97]"
                >
                  Auto-reparto equitativo
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 rounded-xl bg-surface-container-lowest p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-low text-primary">
                  <Icon name="history" className="text-[20px]" />
                </div>
                <div>
                  <h2 className="font-ui text-title-md text-on-surface">Actividad reciente del equipo</h2>
                  <span className="text-label-sm font-ui text-on-surface-variant">Eventos comerciales en tiempo real</span>
                </div>
              </div>
              <span className="h-2 w-2 animate-pulse rounded-full bg-secondary" title="Feed en vivo" />
            </div>
            <div className="relative flex flex-col gap-4 before:absolute before:bottom-2 before:left-3 before:top-2 before:w-px before:bg-surface-container-high">
              {auditLog.map((entry) => (
                <div key={entry.id} className="relative flex items-start gap-4">
                  <div className="z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
                    <Icon name={entry.icon} className="text-[12px]" />
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-ui text-body-md font-semibold text-on-surface">{entry.actionLabel}</span>
                      <span className="text-label-sm font-ui text-on-surface-variant">{entry.at}</span>
                    </div>
                    <p className="mt-0.5 font-ui text-body-sm text-on-surface-variant">
                      <strong className="font-medium text-on-surface">{entry.actorName}</strong> {entry.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-2">
              <Link
                to="/portal/historial"
                className="flex items-center gap-1 font-ui text-label-md font-medium text-secondary transition-colors hover:text-on-surface"
              >
                <span>Ver bitácora de auditoría histórica</span>
                <Icon name="arrow_forward" className="text-[16px]" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
