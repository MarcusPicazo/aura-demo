import { useMemo, useState } from 'react';
import { usePortalStore } from '../store/portalStore';
import { formatCurrency } from '../lib/format';
import { Icon } from './Icon';
import type { PortalUnit } from '../types';

interface ApartadoDrawerProps {
  unit: PortalUnit;
  onClose: () => void;
  onCreated: () => void;
}

const ORIGENES = ['Visita espontánea Showroom', 'Selector web público', 'Referido de cliente', 'Campaña digital', 'Broker externo'];

export function ApartadoDrawer({ unit, onClose, onCreated }: ApartadoDrawerProps) {
  const currentUser = usePortalStore((state) => state.currentUser)!;
  const prospectos = usePortalStore((state) => state.prospectos);
  const createHold = usePortalStore((state) => state.createHold);
  const addProspecto = usePortalStore((state) => state.addProspecto);

  const myProspectos = prospectos.filter((p) => p.advisorId === currentUser.id);
  const [mode, setMode] = useState<'existente' | 'nuevo'>(myProspectos.length > 0 ? 'existente' : 'nuevo');
  const [selectedProspectoId, setSelectedProspectoId] = useState(myProspectos[0]?.id ?? '');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newOrigin, setNewOrigin] = useState(ORIGENES[0]);
  const [amount, setAmount] = useState(50000);
  const [holdHours, setHoldHours] = useState(72);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const selectedProspecto = myProspectos.find((p) => p.id === selectedProspectoId);
  const canSubmit = mode === 'existente' ? Boolean(selectedProspecto) : newName.trim().length > 2 && newPhone.trim().length > 6;

  function handleConfirm() {
    if (!canSubmit) return;
    setSubmitting(true);

    window.setTimeout(() => {
      const prospectoId =
        mode === 'existente'
          ? selectedProspecto!.id
          : addProspecto({ name: newName.trim(), phone: newPhone.trim(), origin: newOrigin, advisorId: currentUser.id, interestedUnitCodes: [unit.code] }).id;

      createHold({ unitCode: unit.code, prospectoId, advisorId: currentUser.id, amount, holdHours, notes: notes || undefined });

      setSubmitting(false);
      setDone(true);
      window.setTimeout(onCreated, 1000);
    }, 700);
  }

  const expiresLabel = useMemo(
    () =>
      new Date(Date.now() + holdHours * 3600_000).toLocaleString('es-MX', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [holdHours],
  );

  return (
    <>
      <div className="fixed inset-0 z-40 bg-primary/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <aside className="fixed bottom-0 right-0 top-0 z-50 flex w-full flex-col overflow-y-auto bg-surface-container-lowest shadow-2xl sm:w-[540px]">
        <div className="sticky top-0 z-10 flex items-start justify-between bg-surface-container-lowest/95 px-8 py-4 shadow-sm backdrop-blur-md">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-secondary-container px-2 py-0.5 text-label-sm font-ui font-semibold uppercase tracking-wider text-on-secondary-container">
                Nuevo apartado comercial
              </span>
            </div>
            <h2 className="font-serif text-headline-sm font-semibold text-on-surface">Apartar Depto {unit.code}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
            aria-label="Cerrar panel"
          >
            <Icon name="close" className="text-[22px]" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-6 p-8">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-label-sm font-ui font-bold uppercase tracking-wider text-secondary">Paso 1 · Unidad a bloquear</span>
            </div>
            <div className="flex flex-col gap-2 rounded-xl bg-surface-container-low p-4">
              <div className="flex items-center justify-between">
                <span className="font-ui text-title-md font-bold text-on-surface">Torre Aura Del Valle · Depto {unit.code}</span>
                <span className="font-ui text-body-lg font-bold text-primary">{formatCurrency(unit.price)}</span>
              </div>
              <div className="flex items-center gap-2 font-ui text-body-sm text-on-surface-variant">
                <span>Nivel {unit.floor}</span>
                <span>·</span>
                <span>{(unit.m2 + unit.terraceM2).toFixed(2)} m² Totales</span>
                <span>·</span>
                <span>{unit.parkingSpots} Cajones Asignados</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 rounded-md bg-surface-container-lowest/80 px-2.5 py-1.5 font-ui text-body-sm text-on-surface">
                <Icon name="lock_clock" className="text-[18px] text-secondary" />
                <span>Regla comercial: bloqueo de inventario por {holdHours} horas para integración de expediente.</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-label-sm font-ui font-bold uppercase tracking-wider text-secondary">Paso 2 · Prospecto asociado</span>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-container-low p-1">
              <button
                type="button"
                onClick={() => setMode('existente')}
                className={`rounded-md py-1.5 text-center font-ui text-label-md font-semibold transition-all ${mode === 'existente' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                Prospecto existente
              </button>
              <button
                type="button"
                onClick={() => setMode('nuevo')}
                className={`rounded-md py-1.5 text-center font-ui text-label-md font-semibold transition-all ${mode === 'nuevo' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                + Nuevo prospecto
              </button>
            </div>

            {mode === 'existente' ? (
              myProspectos.length > 0 ? (
                <select
                  value={selectedProspectoId}
                  onChange={(event) => setSelectedProspectoId(event.target.value)}
                  className="w-full rounded-xl bg-surface-container-low p-3 font-ui text-body-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
                >
                  {myProspectos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.phone}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="rounded-xl bg-surface-container-low p-3 text-center font-ui text-body-sm text-on-surface-variant">
                  No tienes prospectos propios todavía. Usa "+ Nuevo prospecto".
                </p>
              )
            ) : (
              <div className="flex flex-col gap-2 rounded-xl bg-surface-container-low p-4">
                <input
                  type="text"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="Nombre completo *"
                  className="w-full rounded-lg bg-surface-container-lowest p-2.5 font-ui text-body-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(event) => setNewPhone(event.target.value)}
                  placeholder="+52 55 0000 0000 *"
                  className="w-full rounded-lg bg-surface-container-lowest p-2.5 font-ui text-body-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
                />
                <select
                  value={newOrigin}
                  onChange={(event) => setNewOrigin(event.target.value)}
                  className="w-full rounded-lg bg-surface-container-lowest p-2.5 font-ui text-body-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
                >
                  {ORIGENES.map((origin) => (
                    <option key={origin} value={origin}>
                      {origin}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-label-sm font-ui font-bold uppercase tracking-wider text-secondary">Paso 3 · Vigencia y condiciones</span>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col rounded-xl bg-surface-container-low p-4">
                <label htmlFor="apartado-amount" className="text-label-sm font-ui uppercase text-on-surface-variant">
                  Monto requerido
                </label>
                <div className="mt-1 flex items-center gap-1">
                  <span className="font-ui text-body-md text-on-surface-variant">$</span>
                  <input
                    id="apartado-amount"
                    type="text"
                    inputMode="numeric"
                    value={amount.toLocaleString('es-MX')}
                    onChange={(event) => setAmount(Number(event.target.value.replace(/[^0-9]/g, '')) || 0)}
                    className="w-full bg-transparent font-ui text-title-md font-bold text-primary outline-none"
                  />
                </div>
                <span className="font-ui text-body-sm text-on-surface-variant">MXN (Reembolsable)</span>
              </div>
              <div className="flex flex-col rounded-xl bg-surface-container-low p-4">
                <span className="text-label-sm font-ui uppercase text-on-surface-variant">Vigencia automática</span>
                <span className="mt-1 font-ui text-body-md font-bold text-primary">{expiresLabel}</span>
                <select
                  value={holdHours}
                  onChange={(event) => setHoldHours(Number(event.target.value))}
                  className="mt-1 w-fit rounded bg-transparent font-ui text-body-sm font-medium text-secondary outline-none"
                >
                  <option value={24}>24 horas</option>
                  <option value={48}>48 horas</option>
                  <option value={72}>72 horas naturales</option>
                </select>
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-lg bg-surface-container-low p-3">
              <Icon name="account_circle" className="mt-0.5 text-[18px] text-secondary" />
              <p className="font-ui text-body-sm text-on-surface-variant">
                El asesor responsable registrado es <strong className="text-on-surface">{currentUser.name}</strong>{' '}
                (sesión activa). No se requiere cobro con tarjeta en este paso; la transferencia bancaria se valida en
                administración.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="apartado-notes" className="text-label-sm font-ui font-bold uppercase tracking-wider text-secondary">
                Paso 4 · Notas internas para administración
              </label>
              <span className="font-ui text-label-sm text-on-surface-variant">Opcional</span>
            </div>
            <textarea
              id="apartado-notes"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Ej. Cliente interesado en plan de pagos 15-15-70."
              className="w-full resize-none rounded-lg bg-surface-container-lowest p-3 font-ui text-body-sm text-on-surface shadow-sm outline-none ring-1 ring-outline-variant placeholder:text-on-surface-variant/70 focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="sticky bottom-0 flex flex-col gap-3 bg-surface-container-lowest p-6 shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 rounded-lg bg-surface-container-low px-4 py-3 text-center font-ui text-label-md font-semibold text-on-surface transition-colors hover:bg-surface-container"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!canSubmit || submitting || done}
              onClick={handleConfirm}
              className="flex w-2/3 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-ui text-label-md font-semibold text-on-primary shadow-md transition-colors hover:bg-primary-container disabled:opacity-60"
            >
              <Icon
                name={done ? 'check_circle' : submitting ? 'progress_activity' : 'lock'}
                className={`text-[18px] text-secondary-fixed ${submitting ? 'animate-spin' : ''}`}
              />
              <span>{done ? '¡Apartado creado con éxito!' : submitting ? 'Bloqueando inventario...' : `Confirmar y bloquear unidad (${holdHours} hrs)`}</span>
            </button>
          </div>
          <p className="text-center font-ui text-[11px] leading-tight text-on-surface-variant">
            Esta acción notificará al equipo de ventas e inhabilitará el Depto {unit.code} en el selector público de
            inmediato.
          </p>
        </div>
      </aside>
    </>
  );
}
