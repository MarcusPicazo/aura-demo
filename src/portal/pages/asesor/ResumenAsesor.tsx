import { Link } from 'react-router-dom';
import { usePortalStore, unitByCode } from '../../store/portalStore';
import { Icon } from '../../components/Icon';
import { formatCurrency, formatRelativeExpiry } from '../../lib/format';
import type { UnitStatus } from '../../types';

const DISTRIBUTION_META: { status: UnitStatus; label: string; dotColor: string }[] = [
  { status: 'available', label: 'Disponibles', dotColor: 'bg-[#3d7a5a]' },
  { status: 'reserved', label: 'Apartadas', dotColor: 'bg-secondary' },
  { status: 'sold', label: 'Vendidas', dotColor: 'bg-on-surface-variant' },
  { status: 'blocked', label: 'Bloqueadas', dotColor: 'bg-[#526071]' },
];

export function ResumenAsesor() {
  const currentUser = usePortalStore((state) => state.currentUser)!;
  const units = usePortalStore((state) => state.units);
  const holds = usePortalStore((state) => state.holds);
  const prospectos = usePortalStore((state) => state.prospectos);
  const team = usePortalStore((state) => state.team);

  const myHolds = holds.filter((hold) => hold.advisorId === currentUser.id);
  const myExpiringHolds = myHolds
    .filter((hold) => hold.status === 'vigente' || hold.status === 'por_vencer')
    .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());
  const myProspectos = prospectos.filter((prospecto) => prospecto.advisorId === currentUser.id);
  const me = team.find((member) => member.id === currentUser.id);
  const teamAvgConversion = Math.round(
    team.filter((member) => member.role === 'asesor').reduce((sum, member) => sum + member.conversionRate, 0) /
      Math.max(1, team.filter((member) => member.role === 'asesor').length),
  );

  const myTimeline = myProspectos
    .flatMap((prospecto) => prospecto.timeline.map((entry) => ({ ...entry, prospectoName: prospecto.name })))
    .filter((entry) => entry.by === currentUser.name);

  const featuredUnit = unitByCode(units, '204');
  const firstName = currentUser.name.split(' ')[0];

  return (
    <div className="flex w-full flex-col gap-8">
      <section className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div className="flex max-w-2xl flex-col gap-1">
          <div className="flex items-center gap-2 text-secondary">
            <Icon name="calendar_today" className="text-[18px]" />
            <span className="text-label-sm font-ui uppercase tracking-widest text-on-surface-variant">
              {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            <span className="h-1 w-1 rounded-full bg-secondary" />
            <span className="text-label-sm font-ui font-semibold text-secondary">Sesión activa</span>
          </div>
          <h1 className="font-serif text-headline-lg tracking-tight text-primary">
            Tu actividad comercial, <span className="font-normal italic">{firstName}</span>
          </h1>
          <p className="font-ui text-body-md text-on-surface-variant">
            Torre Aura Del Valle · Resumen operativo, compromisos del día y prioridades de seguimiento comercial.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start lg:self-end">
          <Link
            to="/portal/inventario"
            className="flex items-center gap-1 rounded-lg bg-surface-container-lowest px-4 py-2 font-ui text-label-md text-primary shadow-sm transition-colors hover:bg-surface-container-high active:scale-[0.97]"
          >
            <Icon name="grid_view" className="text-[18px] text-on-surface-variant" />
            <span>Consultar inventario</span>
          </Link>
          <Link
            to="/portal/prospectos"
            className="flex items-center gap-1 rounded-lg bg-primary px-5 py-2 font-ui text-label-md text-on-primary shadow-sm transition-all hover:bg-primary-container active:scale-[0.97]"
          >
            <Icon name="add" className="text-[18px]" />
            <span>Registrar prospecto</span>
          </Link>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-xl bg-surface-container-low shadow-sm">
        <div className="grid grid-cols-1 items-stretch lg:grid-cols-12">
          <div className="z-10 flex flex-col justify-between gap-6 p-6 lg:col-span-8 lg:p-10">
            <div className="flex flex-col gap-1">
              <div className="inline-flex w-fit items-center gap-1 rounded-full bg-surface-container px-2 py-1 text-label-sm font-ui text-secondary">
                <Icon name="apartment" className="text-[14px]" />
                <span>PROYECTO ACTIVO EN VENTA PRIVADA</span>
              </div>
              <h2 className="mt-1 font-serif text-headline-md text-primary">Torre Aura Del Valle</h2>
              <p className="max-w-xl font-ui text-body-sm text-on-surface-variant">
                Desarrollo residencial boutique de 46 departamentos con arquitectura bioclimática, terrazas de madera
                natural y acabados de autor en Col. Del Valle Sur.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              {DISTRIBUTION_META.map((meta) => (
                <div key={meta.status} className="flex items-center gap-1.5 rounded-full bg-surface-container-lowest px-4 py-1.5 shadow-sm">
                  <span className={`h-2.5 w-2.5 rounded-full ${meta.dotColor}`} />
                  <span className="text-label-sm font-ui uppercase text-on-surface-variant">{meta.label}:</span>
                  <span className="font-ui text-title-md text-primary">
                    {units.filter((unit) => unit.status === meta.status).length}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="relative min-h-[180px] overflow-hidden lg:col-span-4 lg:min-h-full">
            <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: "url('/clients/aura/facade.jpg')" }} />
            <div className="absolute inset-0 bg-gradient-to-t from-surface-container-low via-transparent to-transparent lg:bg-gradient-to-r" />
            <div className="absolute bottom-4 right-4 rounded-lg bg-surface-container-lowest/90 px-2 py-1 text-label-sm font-ui text-on-surface shadow-sm backdrop-blur-md">
              Fase II · 61% Colocado
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex flex-col justify-between rounded-xl bg-surface-container-lowest p-6 shadow-[0_1px_4px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between">
            <span className="text-label-sm font-ui uppercase tracking-wider text-on-surface-variant">Mis apartados vigentes</span>
            <span className="rounded-lg bg-secondary-container/40 p-2 text-secondary">
              <Icon name="bookmark_added" className="text-[20px]" />
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="font-serif text-display-lg leading-none tracking-tight text-primary">{myExpiringHolds.length}</span>
            <span className="font-ui text-body-sm text-on-surface-variant">unidades activas</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-error">
            <Icon name="schedule" className="text-[16px]" />
            <span className="text-label-sm font-ui font-semibold">
              {myExpiringHolds.filter((h) => h.status === 'por_vencer').length} folios por vencer pronto
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl bg-surface-container-lowest p-6 shadow-[0_1px_4px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between">
            <span className="text-label-sm font-ui uppercase tracking-wider text-on-surface-variant">Prospectos asignados</span>
            <span className="rounded-lg bg-surface-container p-2 text-on-surface-variant">
              <Icon name="contacts" className="text-[20px]" />
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="font-serif text-display-lg leading-none tracking-tight text-primary">{myProspectos.length}</span>
            <span className="font-ui text-body-sm text-on-surface-variant">leads calificados</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-on-surface-variant">
            <Icon name="trending_up" className="text-[16px] text-secondary" />
            <span className="text-label-sm font-ui">
              {myProspectos.filter((p) => p.stage === 'nuevo').length} nuevos sin contactar
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl bg-surface-container-lowest p-6 shadow-[0_1px_4px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between">
            <span className="text-label-sm font-ui uppercase tracking-wider text-on-surface-variant">Tasa de conversión / cierre</span>
            <span className="rounded-lg bg-surface-container p-2 text-on-surface-variant">
              <Icon name="pie_chart" className="text-[20px]" />
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="font-serif text-display-lg leading-none tracking-tight text-primary">{me?.conversionRate ?? 0}%</span>
            <span className="text-label-sm font-ui font-semibold text-secondary">Alto desempeño</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-container">
              <span className="block h-full bg-secondary" style={{ width: `${me?.conversionRate ?? 0}%` }} />
            </span>
            <span className="text-label-sm font-ui text-on-surface-variant">Promedio equipo: {teamAvgConversion}%</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-8 lg:col-span-8">
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Icon name="alarm" className="text-[22px] text-secondary" />
                <h3 className="font-ui text-title-md tracking-tight text-primary">Mis apartados próximos a vencer</h3>
              </div>
              <span className="rounded-full bg-secondary-container/60 px-2 py-0.5 text-label-sm font-ui font-semibold text-secondary">
                Atención prioritaria ({myExpiringHolds.length})
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {myExpiringHolds.length === 0 && (
                <p className="rounded-xl bg-surface-container-lowest p-4 text-center font-ui text-body-sm text-on-surface-variant md:col-span-2">
                  No tienes apartados por vencer.
                </p>
              )}
              {myExpiringHolds.map((hold) => {
                const unit = unitByCode(units, hold.unitCode);
                const isUrgent = hold.status === 'por_vencer';
                return (
                  <div
                    key={hold.id}
                    className="flex flex-col justify-between gap-4 rounded-xl bg-surface-container-lowest p-6 shadow-[0_1px_4px_rgba(0,0,0,0.03)] transition-all hover:shadow-md"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-label-sm font-ui font-semibold uppercase text-secondary">Folio {hold.folio}</span>
                          <h4 className="mt-0.5 font-serif text-headline-sm text-primary">
                            Depto {hold.unitCode} · {unit?.tower}
                          </h4>
                        </div>
                        <div
                          className={`flex items-center gap-1 rounded-full px-2.5 py-1 ${
                            isUrgent ? 'bg-error/10 text-error' : 'bg-secondary-container/50 text-secondary'
                          }`}
                        >
                          <Icon name={isUrgent ? 'timer' : 'schedule'} className="text-[14px]" />
                          <span className="text-label-sm font-ui font-semibold">Vence en {formatRelativeExpiry(hold.expiresAt)}</span>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-col gap-1 rounded-lg bg-surface-container-low p-2">
                        <div className="flex items-center justify-between font-ui text-body-sm">
                          <span className="text-on-surface-variant">Monto apartado:</span>
                          <span className="font-ui text-title-md text-primary">{formatCurrency(hold.amount)}</span>
                        </div>
                        <div className="flex items-center justify-between font-ui text-body-sm">
                          <span className="text-on-surface-variant">Estatus:</span>
                          <span className="font-medium text-secondary">{hold.notes ?? 'Sin observaciones'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <Link
                        to="/portal/mis-apartados"
                        className="flex-1 rounded-lg bg-surface-container px-3 py-2 text-center font-ui text-label-md text-primary transition-colors hover:bg-surface-container-high active:scale-[0.97]"
                      >
                        Ver detalle
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Icon name="format_list_bulleted" className="text-[22px] text-primary" />
                <h3 className="font-ui text-title-md tracking-tight text-primary">Prospectos pendientes de seguimiento hoy</h3>
              </div>
              <Link to="/portal/prospectos" className="text-label-sm font-ui uppercase tracking-wider text-secondary hover:underline">
                Ver todos ({myProspectos.length})
              </Link>
            </div>
            <div className="flex flex-col gap-1">
              {myProspectos.slice(0, 4).map((prospecto) => (
                <div
                  key={prospecto.id}
                  className="flex flex-col justify-between gap-4 rounded-xl bg-surface-container-lowest p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-colors hover:bg-surface-container-low sm:flex-row sm:items-center"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary-container text-title-md font-ui font-bold text-on-secondary-container">
                      {prospecto.initials}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="font-ui text-title-md text-primary">{prospecto.name}</span>
                        <span className="rounded-full bg-surface-container px-2 py-0.5 text-label-sm font-ui text-on-surface-variant">
                          {prospecto.origin}
                        </span>
                      </div>
                      <span className="font-ui text-body-sm text-on-surface-variant">
                        {prospecto.interestedUnitCodes.length > 0
                          ? `Interés en Depto ${prospecto.interestedUnitCodes.join(', ')}`
                          : 'Sin unidad de interés vinculada aún'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 self-end sm:self-center">
                    {prospecto.nextActionLabel && (
                      <div className="flex items-center gap-1.5 rounded-md bg-secondary/10 px-2 py-1 text-secondary">
                        <Icon name="event" className="text-[16px]" />
                        <span className="text-label-sm font-ui font-semibold">{prospecto.nextActionAt ?? prospecto.nextActionLabel}</span>
                      </div>
                    )}
                    <a
                      href={`tel:${prospecto.phone.replace(/\s+/g, '')}`}
                      aria-label="Llamar"
                      className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
                    >
                      <Icon name="phone_in_talk" className="text-[20px]" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-4">
          <section className="flex flex-col gap-4 rounded-xl bg-surface-container-lowest p-6 shadow-[0_1px_4px_rgba(0,0,0,0.03)]">
            <div className="flex items-center justify-between">
              <h3 className="font-ui text-title-md tracking-tight text-primary">Actividad reciente</h3>
              <Icon name="history" className="text-[20px] text-on-surface-variant" />
            </div>
            <div className="relative flex flex-col gap-4 pl-6 before:absolute before:bottom-2 before:left-[11px] before:top-2 before:w-[2px] before:bg-surface-variant before:content-['']">
              {myTimeline.length === 0 && (
                <p className="font-ui text-body-sm text-on-surface-variant">Aún no registras actividad esta semana.</p>
              )}
              {myTimeline.map((entry) => (
                <div key={entry.id} className="relative flex flex-col gap-0.5">
                  <span className="absolute -left-[29px] top-1 h-3.5 w-3.5 rounded-full bg-secondary ring-4 ring-surface-container-lowest" />
                  <span className="text-label-sm font-ui text-on-surface-variant">{entry.at}</span>
                  <p className="font-ui text-body-sm font-medium text-primary">
                    {entry.label} — <span className="text-secondary">{entry.prospectoName}</span>
                  </p>
                </div>
              ))}
            </div>
          </section>

          {featuredUnit && (
            <section className="flex flex-col gap-4 rounded-xl bg-surface-container-lowest p-6 shadow-[0_1px_4px_rgba(0,0,0,0.03)]">
              <div className="flex items-center justify-between">
                <span className="text-label-sm font-ui uppercase tracking-wider text-secondary">Unidad destacada para cierre</span>
                <Icon name="star" className="text-[18px] text-secondary" />
              </div>
              <div className="relative h-40 overflow-hidden rounded-lg bg-surface-container-high">
                <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: "url('/clients/aura/facade.jpg')" }} />
                <div className="absolute bottom-2 left-2 rounded bg-primary/80 px-2 py-0.5 text-label-sm font-ui text-on-primary backdrop-blur-sm">
                  Nivel {featuredUnit.floor} · {featuredUnit.orientation}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between">
                  <h4 className="font-serif text-headline-sm text-primary">Depto {featuredUnit.code}</h4>
                  <span className="font-ui text-title-md font-bold text-secondary">{formatCurrency(featuredUnit.price)}</span>
                </div>
                <p className="font-ui text-body-sm text-on-surface-variant">
                  {featuredUnit.m2} m² totales · {featuredUnit.bedrooms} Recámaras · {featuredUnit.bathrooms} Baños ·{' '}
                  {featuredUnit.parkingSpots} Cajones independientes.
                </p>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  className="flex-1 rounded-lg bg-surface-container px-3 py-2 font-ui text-label-md text-primary transition-colors hover:bg-surface-container-high active:scale-[0.97]"
                >
                  Compartir PDF
                </button>
                <Link
                  to="/portal/inventario"
                  className="flex items-center justify-center rounded-lg bg-secondary px-3 py-2 text-on-secondary transition-colors hover:bg-secondary/90 active:scale-[0.97]"
                >
                  <Icon name="bookmark" className="text-[18px]" />
                </Link>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
