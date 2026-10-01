import { useState } from 'react';
import type { PortalUnit } from '../types';
import { usePortalStore } from '../store/portalStore';
import { formatCurrency } from '../lib/format';
import { Icon } from './Icon';

const REASONS = [
  'Actualización por avance de obra y nueva lista oficial autorizada por Dirección General',
  'Ajuste por equipamiento opcional incluido (paquete de acabados)',
  'Indexación anual de costo de edificación',
  'Corrección de error de captura en matriz inicial',
  'Otro (especificar en bitácora)',
];

interface PriceEditModalProps {
  unit: PortalUnit;
  onClose: () => void;
}

export function PriceEditModal({ unit, onClose }: PriceEditModalProps) {
  const currentUser = usePortalStore((state) => state.currentUser)!;
  const updateUnitPrice = usePortalStore((state) => state.updateUnitPrice);
  const holds = usePortalStore((state) => state.holds);
  const activeHold = holds.find((hold) => hold.unitCode === unit.code && (hold.status === 'vigente' || hold.status === 'por_vencer'));

  const [newPrice, setNewPrice] = useState(unit.price);
  const [reason, setReason] = useState(REASONS[0]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const pricePerM2 = unit.m2 > 0 ? Math.round(unit.price / unit.m2) : 0;
  const newPricePerM2 = unit.m2 > 0 ? Math.round(newPrice / unit.m2) : 0;
  const deltaPercent = unit.price > 0 ? ((newPrice - unit.price) / unit.price) * 100 : 0;
  const deltaAmount = newPrice - unit.price;

  function handleConfirm() {
    setSaving(true);
    window.setTimeout(() => {
      updateUnitPrice(unit.code, newPrice, reason, notes || undefined);
      setSaving(false);
      setDone(true);
      window.setTimeout(onClose, 900);
    }, 500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between bg-surface-container px-8 py-6">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-label-sm font-ui font-bold uppercase tracking-widest text-secondary">
                Torre Aura Del Valle · Unidad {unit.code}
              </span>
              {activeHold && (
                <span className="flex items-center gap-1 rounded-full bg-secondary-container px-2 py-0.5 text-label-sm font-ui font-semibold text-on-secondary-container">
                  <Icon name="schedule" className="text-[12px]" />
                  Apartado Vigente
                </span>
              )}
            </div>
            <h2 className="mt-1 font-serif text-headline-md font-medium text-primary">
              Modificar Precio de Lista · Depto {unit.code}
            </h2>
            <span className="font-ui text-body-sm text-on-surface-variant">
              Nivel {unit.floor} · {unit.m2.toFixed(2)} m² totales · {unit.typeLabel}
            </span>
          </div>
          <button
            type="button"
            aria-label="Cerrar modal"
            onClick={onClose}
            className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
          >
            <Icon name="close" className="text-[24px]" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-8 py-6 lg:flex-row">
          <div className="flex w-full flex-col gap-4 lg:w-5/12">
            <div className="flex flex-col rounded-xl bg-surface-container-low p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-label-sm font-ui uppercase tracking-wider text-on-surface-variant">
                  Planta Arquitectónica
                </span>
                <span className="text-label-sm font-ui font-semibold text-secondary">{unit.m2.toFixed(2)} m²</span>
              </div>
              <div className="relative flex h-56 flex-col justify-between overflow-hidden rounded-lg bg-surface-container-lowest p-3 shadow-inner">
                <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  <span>Residencia {unit.code} · Nivel {unit.floor}</span>
                  <span>Escala 1:50</span>
                </div>
                <svg viewBox="0 0 400 240" className="h-40 w-full text-on-surface/80" fill="none" stroke="currentColor">
                  <rect x="15" y="20" width="370" height="200" rx="2" strokeWidth="3" className="text-primary" />
                  <rect x="25" y="30" width="80" height="180" fill="#F5F1E8" fillOpacity="0.3" strokeDasharray="4 2" strokeWidth="1.2" />
                  <text x="65" y="120" fill="#725b36" fontFamily="Plus Jakarta Sans" fontSize="8" textAnchor="middle">
                    TERRAZA
                  </text>
                  <rect x="110" y="30" width="130" height="110" stroke="#747878" strokeWidth="1.5" />
                  <text x="175" y="75" fill="#101010" fontFamily="Plus Jakarta Sans" fontSize="9" fontWeight="600" textAnchor="middle">
                    ESTANCIA &amp; COMEDOR
                  </text>
                  <rect x="110" y="145" width="130" height="65" stroke="#747878" strokeDasharray="3 2" strokeWidth="1.2" />
                  <text x="175" y="180" fill="#444748" fontFamily="Plus Jakarta Sans" fontSize="8" textAnchor="middle">
                    COCINA INTEGRAL
                  </text>
                  <rect x="245" y="30" width="130" height="85" stroke="#747878" strokeWidth="1.5" />
                  <text x="310" y="65" fill="#101010" fontFamily="Plus Jakarta Sans" fontSize="8.5" fontWeight="600" textAnchor="middle">
                    MASTER SUITE
                  </text>
                  <rect x="245" y="165" width="130" height="45" stroke="#747878" strokeWidth="1.5" />
                  <text x="310" y="190" fill="#101010" fontFamily="Plus Jakarta Sans" fontSize="8" fontWeight="600" textAnchor="middle">
                    RECÁMARA 2
                  </text>
                </svg>
                <div className="flex items-center justify-between text-[10px] text-on-surface-variant">
                  <span>Orientación: {unit.orientation}</span>
                  <span>{unit.bedrooms} Rec · {unit.bathrooms} Baños</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-xl bg-surface-container-low p-4">
              <span className="text-label-sm font-ui font-semibold uppercase tracking-wider text-on-surface-variant">
                Parámetros actuales de venta
              </span>
              <div className="flex items-center justify-between py-1">
                <span className="font-ui text-body-sm text-on-surface-variant">Precio de lista base:</span>
                <span className="font-ui text-body-sm font-semibold text-primary">{formatCurrency(unit.price)}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="font-ui text-body-sm text-on-surface-variant">Valor unitario m²:</span>
                <span className="font-ui text-body-sm font-medium text-on-surface">{formatCurrency(pricePerM2)} / m²</span>
              </div>
              {activeHold && (
                <div className="flex items-center justify-between py-1">
                  <span className="font-ui text-body-sm text-on-surface-variant">Apartado registrado:</span>
                  <span className="font-ui text-body-sm font-semibold text-secondary">
                    #{activeHold.folio} ({formatCurrency(activeHold.amount)})
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex w-full flex-col gap-4 lg:w-7/12">
            {activeHold && (
              <div className="flex items-start gap-2 rounded-xl bg-secondary-container/40 p-4">
                <Icon name="warning" className="mt-0.5 shrink-0 text-[22px] text-secondary" />
                <div className="flex flex-col">
                  <span className="font-ui text-body-md font-semibold text-on-secondary-fixed">
                    Atención: unidad con apartado comercial activo
                  </span>
                  <p className="mt-1 font-ui text-body-sm leading-relaxed text-on-secondary-fixed-variant">
                    Esta unidad cuenta con un apartado activo (<strong>#{activeHold.folio}</strong>). Modificar el precio
                    de lista público <strong>no altera retroactivamente</strong> las condiciones ya pactadas salvo
                    cancelación formal del apartado.
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-4 rounded-xl bg-surface-container-low p-4">
              <span className="text-label-sm font-ui font-bold uppercase tracking-wider text-primary">
                Ajuste de Tarifa Comercial
              </span>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-lg bg-surface-container-lowest p-3">
                  <span className="text-label-sm font-ui uppercase text-on-surface-variant">Precio de lista anterior</span>
                  <div className="mt-1 font-ui text-currency-display font-medium text-on-surface-variant line-through">
                    {formatCurrency(unit.price)}
                  </div>
                  <span className="text-label-sm font-ui text-on-surface-variant">{formatCurrency(pricePerM2)} / m²</span>
                </div>
                <div className="rounded-lg bg-surface-container-lowest p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-label-sm font-ui font-bold uppercase text-primary">Nuevo precio de lista</span>
                    {deltaPercent !== 0 && (
                      <span
                        className={`rounded px-2 py-0.5 text-label-sm font-ui font-semibold ${deltaPercent > 0 ? 'bg-secondary-container text-on-secondary-container' : 'bg-error-container text-on-error-container'}`}
                      >
                        {deltaPercent > 0 ? '+' : ''}
                        {deltaPercent.toFixed(2)}%
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-1">
                    <span className="font-ui text-body-md font-semibold text-on-surface-variant">MXN $</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={newPrice.toLocaleString('es-MX')}
                      onChange={(event) => {
                        const raw = event.target.value.replace(/[^0-9]/g, '');
                        setNewPrice(raw ? Number(raw) : 0);
                      }}
                      className="w-full bg-transparent font-ui text-currency-display font-bold text-primary outline-none"
                    />
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-label-sm font-ui text-on-surface-variant">
                    <span>{formatCurrency(newPricePerM2)} / m²</span>
                    {deltaAmount !== 0 && (
                      <span className={deltaAmount > 0 ? 'font-medium text-secondary' : 'font-medium text-error'}>
                        {deltaAmount > 0 ? '+' : ''}
                        {formatCurrency(deltaAmount)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="motivoSelect" className="flex items-center justify-between font-ui text-label-sm font-semibold text-on-surface">
                  <span>Motivo formal de la revaluación (requerido para auditoría) *</span>
                </label>
                <select
                  id="motivoSelect"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="w-full cursor-pointer rounded-lg bg-surface-container-lowest px-3 py-2.5 font-ui text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {REASONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="txtNotas" className="font-ui text-label-sm text-on-surface-variant">
                  Notas internas para asesores de venta:
                </label>
                <textarea
                  id="txtNotas"
                  rows={2}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Ej. Se autoriza respetar cotizaciones con apartado pagado anteriores a esta fecha."
                  className="w-full resize-none rounded-lg bg-surface-container-lowest p-2.5 font-ui text-body-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-surface-container-low p-3">
              <Icon name="sensors" className="text-[18px] text-on-surface-variant" />
              <span className="font-ui text-body-sm text-on-surface-variant">
                Al confirmar, el precio público en el selector web y cotizadores de asesores se actualizará
                inmediatamente en tiempo real.
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-2 bg-surface-container px-8 py-4 sm:flex-row">
          <div className="flex items-center gap-2 font-ui text-label-sm text-on-surface-variant">
            <Icon name="verified" className="text-[16px]" />
            <span>
              Registrado por: <strong>{currentUser.name} ({currentUser.roleLabel})</strong>
            </span>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-surface-container-lowest px-4 py-2.5 font-ui text-label-md text-on-surface transition-colors hover:bg-surface-container-high"
            >
              Cancelar sin guardar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={saving || done || newPrice <= 0}
              className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 font-ui text-label-md font-semibold text-on-primary shadow-md transition-all hover:bg-primary-container active:scale-[0.98] disabled:opacity-70"
            >
              <Icon name={done ? 'check_circle' : saving ? 'sync' : 'price_check'} className={`text-[18px] ${saving ? 'animate-spin' : ''}`} />
              <span>{done ? '¡Precio publicado!' : saving ? 'Publicando...' : 'Confirmar y publicar nuevo precio'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
