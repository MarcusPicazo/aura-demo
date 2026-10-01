import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { usePortalStore, unitByCode } from '../store/portalStore';
import { Icon } from '../components/Icon';
import { StatusChip } from '../components/StatusChip';
import { PriceEditModal } from '../components/PriceEditModal';
import { ApartadoDrawer } from '../components/ApartadoDrawer';
import { formatCurrency } from '../lib/format';

export function UnitDetail() {
  const { code = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const currentUser = usePortalStore((state) => state.currentUser)!;
  const units = usePortalStore((state) => state.units);
  const unit = unitByCode(units, code);

  const [drawerOpen, setDrawerOpen] = useState(searchParams.get('apartar') === '1');
  const [priceModalOpen, setPriceModalOpen] = useState(false);

  if (!unit) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 rounded-xl bg-surface-container-lowest p-12 text-center shadow-sm">
        <Icon name="search_off" className="text-[32px] text-on-surface-variant" />
        <h1 className="font-serif text-headline-sm text-primary">No encontramos el depto {code}</h1>
        <Link to="/portal/inventario" className="font-ui text-label-md text-secondary hover:underline">
          Volver al inventario
        </Link>
      </div>
    );
  }

  function closeDrawer() {
    setDrawerOpen(false);
    if (searchParams.get('apartar')) {
      searchParams.delete('apartar');
      setSearchParams(searchParams, { replace: true });
    }
  }

  const pricePerM2 = unit.m2 > 0 ? Math.round(unit.price / unit.m2) : 0;
  const downPayment = Math.round(unit.price * 0.15);

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 font-ui text-body-sm text-on-surface-variant">
          <Link to="/portal/inventario" className="flex items-center gap-1 font-medium transition-colors hover:text-primary">
            <Icon name="apartment" className="text-[18px]" />
            Inventario
          </Link>
          <span>/</span>
          <span>Torre Aura Del Valle</span>
          <span>/</span>
          <span className="font-semibold text-on-surface">
            Nivel {unit.floor} · Unidad {unit.code}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg bg-surface-container-lowest px-3.5 py-1.5 font-ui text-label-md text-on-surface shadow-sm transition-colors hover:bg-surface-container"
          >
            <Icon name="picture_as_pdf" className="text-[16px]" />
            Ficha técnica PDF
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg bg-surface-container-lowest px-3.5 py-1.5 font-ui text-label-md text-on-surface shadow-sm transition-colors hover:bg-surface-container"
          >
            <Icon name="share" className="text-[16px]" />
            Compartir liga
          </button>
          {currentUser.role === 'asesor' && unit.status === 'available' && (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 font-ui text-label-md text-on-primary shadow-sm transition-all hover:bg-primary-container active:scale-[0.97]"
            >
              <Icon name="bookmark" className="text-[18px] text-secondary-fixed" />
              Crear apartado
            </button>
          )}
          {currentUser.role === 'admin' && (
            <button
              type="button"
              onClick={() => setPriceModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 font-ui text-label-md text-on-primary shadow-sm transition-all hover:bg-primary-container active:scale-[0.97]"
            >
              <Icon name="price_change" className="text-[18px]" />
              Modificar precio
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col justify-between gap-6 rounded-xl bg-surface-container-lowest p-8 shadow-sm lg:flex-row lg:items-end">
        <div className="flex max-w-2xl flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <StatusChip status={unit.status} label={unit.status === 'available' ? 'Disponible para apartado' : unit.statusNote} />
            <span className="font-mono text-label-sm font-ui text-on-surface-variant">ID: TAV-{unit.code}</span>
            <span className="font-ui text-label-sm text-on-surface-variant">Orientación {unit.orientation}</span>
          </div>
          <h1 className="font-serif text-headline-lg tracking-tight text-on-surface">Departamento {unit.code}</h1>
          <p className="font-ui text-body-md text-on-surface-variant">
            Residencia con cancelería de suelo a techo, {unit.terraceM2 > 0 ? 'terraza perimetral y ' : ''}alturas libres
            de 3.10 m, diseñada para ventilación cruzada natural y captación solar optimizada.
          </p>
        </div>
        <div className="flex min-w-[280px] flex-col rounded-xl bg-surface-container-low p-4">
          <span className="text-label-sm font-ui uppercase tracking-wider text-on-surface-variant">Precio oficial de lista</span>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span className="font-ui text-currency-display text-primary">{formatCurrency(unit.price)}</span>
          </div>
          <div className="mt-2 flex flex-col gap-1 pt-2">
            <div className="flex items-center justify-between text-body-sm font-ui">
              <span className="text-on-surface-variant">Enganche requerido (15%):</span>
              <span className="font-semibold text-on-surface">{formatCurrency(downPayment)}</span>
            </div>
            <div className="flex items-center justify-between text-body-sm font-ui">
              <span className="text-on-surface-variant">Valor por m² total:</span>
              <span className="font-medium text-on-surface">{formatCurrency(pricePerM2)}/m²</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricTile label="Nivel / Piso" value={`Piso ${unit.floor}`} hint={unit.tower} />
        <MetricTile label="Área Interior" value={`${unit.m2.toFixed(2)} m²`} hint="Habitables techados" />
        <MetricTile label="Terraza" value={unit.terraceM2 > 0 ? `${unit.terraceM2.toFixed(2)} m²` : 'Sin terraza'} hint="Frontal + lateral" />
        <MetricTile label="Recámaras" value={`${unit.bedrooms} Recámaras`} hint="Principal con W.I.C." />
        <MetricTile label="Baños" value={`${unit.bathrooms} Baños`} hint="Acabado premium" />
        <MetricTile label="Estacionamiento" value={`${unit.parkingSpots} Cajones`} hint="Independientes" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col rounded-xl bg-surface-container-lowest p-6 shadow-sm lg:col-span-7">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <span className="text-label-sm font-ui font-semibold uppercase text-secondary">Esquema Técnico</span>
              <h2 className="font-serif text-headline-sm text-on-surface">Plano Arquitectónico y Distribución</h2>
            </div>
            <span className="rounded bg-surface-container-low px-2 py-1 font-mono text-body-sm text-on-surface-variant">
              Escala 1:50
            </span>
          </div>
          <div className="relative flex min-h-[360px] items-center justify-center overflow-hidden rounded-lg bg-surface-container-low/60 p-4">
            <svg viewBox="0 0 400 240" className="h-full w-full max-w-lg text-on-surface/80" fill="none" stroke="currentColor">
              <rect x="15" y="20" width="370" height="200" rx="2" strokeWidth="3" className="text-primary" />
              {unit.terraceM2 > 0 && (
                <>
                  <rect x="25" y="30" width="80" height="180" fill="#F5F1E8" fillOpacity="0.3" strokeDasharray="4 2" strokeWidth="1.2" />
                  <text x="65" y="120" fill="#725b36" fontFamily="Plus Jakarta Sans" fontSize="8" textAnchor="middle">
                    TERRAZA
                  </text>
                </>
              )}
              <rect x="110" y="30" width="130" height="110" stroke="#747878" strokeWidth="1.5" />
              <text x="175" y="75" fill="#101010" fontFamily="Plus Jakarta Sans" fontSize="10" fontWeight="600" textAnchor="middle">
                ESTANCIA &amp; COMEDOR
              </text>
              <rect x="110" y="145" width="130" height="65" stroke="#747878" strokeDasharray="3 2" strokeWidth="1.2" />
              <text x="175" y="180" fill="#444748" fontFamily="Plus Jakarta Sans" fontSize="9" textAnchor="middle">
                COCINA INTEGRAL
              </text>
              <rect x="245" y="30" width="130" height="85" stroke="#747878" strokeWidth="1.5" />
              <text x="310" y="65" fill="#101010" fontFamily="Plus Jakarta Sans" fontSize="9.5" fontWeight="600" textAnchor="middle">
                MASTER SUITE
              </text>
              <text x="310" y="78" fill="#747878" fontFamily="Plus Jakarta Sans" fontSize="7.5" textAnchor="middle">
                {unit.bathrooms} Baños + W.I.C.
              </text>
              {unit.bedrooms > 1 && (
                <>
                  <rect x="245" y="165" width="130" height="45" stroke="#747878" strokeWidth="1.5" />
                  <text x="310" y="190" fill="#101010" fontFamily="Plus Jakarta Sans" fontSize="9" fontWeight="600" textAnchor="middle">
                    RECÁMARA 2
                  </text>
                </>
              )}
            </svg>
            <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg bg-surface-container-lowest/90 px-3 py-1.5 text-on-surface shadow-sm backdrop-blur-md">
              <Icon name="straighten" className="text-[16px] text-secondary" />
              <span className="font-mono text-label-sm font-ui">{(unit.m2 + unit.terraceM2).toFixed(2)} m² Área Total Combinada</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-5">
          <div className="flex flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
            <div className="relative h-56 w-full">
              <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: "url('/clients/aura/facade.jpg')" }} />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between text-on-primary">
                <div>
                  <span className="text-label-sm font-ui uppercase tracking-wider opacity-80">Fachada {unit.orientation}</span>
                  <p className="font-ui text-title-md font-medium">Torre Aura Del Valle</p>
                </div>
                <span className="font-mono text-body-sm opacity-90">Planta N{unit.floor} señalada</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 p-4">
              <span className="text-label-sm font-ui font-semibold uppercase text-on-surface-variant">Memoria de Acabados Premium</span>
              <div className="grid grid-cols-2 gap-2 text-body-sm">
                {['Mármol Travertino', 'Nogal Americano', 'Cristalería Duovent', 'Aire Inverter VRF'].map((finish) => (
                  <div key={finish} className="flex items-center gap-2 rounded-lg bg-surface-container-low p-2">
                    <Icon name="check_circle" className="text-[16px] text-secondary" />
                    <span className="font-ui font-medium text-on-surface">{finish}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl bg-surface-container-lowest p-4 shadow-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary-container">
              <Icon name="verified_user" className="text-[22px] text-on-secondary-container" />
            </div>
            <div className="flex flex-col">
              <span className="font-ui text-body-md font-semibold text-on-surface">Condiciones Comerciales Oficiales</span>
              <p className="mt-0.5 font-ui text-body-sm text-on-surface-variant">
                Apartado formal vigente por <strong className="text-on-surface">72 horas naturales</strong> garantizado
                con depósito de <strong className="text-on-surface">$50,000 MXN</strong>. Congela precio y asigna
                prioridad exclusiva de escrituración.
              </p>
            </div>
          </div>
        </div>
      </div>

      {drawerOpen && <ApartadoDrawer unit={unit} onClose={closeDrawer} onCreated={() => navigate('/portal/inventario')} />}
      {priceModalOpen && <PriceEditModal unit={unit} onClose={() => setPriceModalOpen(false)} />}
    </div>
  );
}

function MetricTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="flex flex-col rounded-lg bg-surface-container-lowest p-3.5 shadow-sm">
      <span className="text-label-sm font-ui uppercase text-on-surface-variant">{label}</span>
      <span className="mt-1 font-ui text-title-md font-bold text-primary">{value}</span>
      <span className="font-ui text-body-sm text-on-surface-variant">{hint}</span>
    </div>
  );
}
