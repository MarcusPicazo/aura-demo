import { useState, type FormEvent, type ReactNode } from 'react';
import { usePortalStore } from '../store/portalStore';
import { Icon } from './Icon';
import type { ProspectoStage } from '../types';

const ORIGENES = ['Visita espontánea Showroom', 'Selector web público', 'Referido de cliente', 'Campaña digital Meta / Google', 'Broker externo'];

interface NewProspectoModalProps {
  /** Si viene fijo (caso del asesor dando de alta para sí mismo), el formulario oculta
   *  el selector de asesor; si se omite (caso admin), lo muestra para elegir a quién asignarlo. */
  fixedAdvisorId?: string;
  onClose: () => void;
}

export function NewProspectoModal({ fixedAdvisorId, onClose }: NewProspectoModalProps) {
  const units = usePortalStore((state) => state.units);
  const team = usePortalStore((state) => state.team);
  const addProspecto = usePortalStore((state) => state.addProspecto);
  const updateProspectoStage = usePortalStore((state) => state.updateProspectoStage);
  const logProspectoNote = usePortalStore((state) => state.logProspectoNote);

  const asesores = team.filter((member) => member.role === 'asesor');
  const availableUnits = units.filter((unit) => unit.status === 'available');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [origin, setOrigin] = useState(ORIGENES[0]);
  const [unitCode, setUnitCode] = useState('');
  const [advisorId, setAdvisorId] = useState(fixedAdvisorId ?? asesores[0]?.id ?? '');
  const [stage, setStage] = useState<ProspectoStage>('nuevo');
  const [note, setNote] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const prospecto = addProspecto({
      name,
      phone,
      email: email || undefined,
      origin,
      advisorId,
      interestedUnitCodes: unitCode ? [unitCode] : [],
    });
    if (stage !== 'nuevo') updateProspectoStage(prospecto.id, stage);
    if (note.trim()) logProspectoNote(prospecto.id, 'Nota de alta', note.trim());
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-surface-container-lowest shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-8 pb-4 pt-8">
          <div className="flex flex-col">
            <span className="text-label-sm font-ui font-semibold uppercase tracking-wider text-secondary">Nuevo registro</span>
            <h3 className="font-serif text-headline-sm tracking-tight text-primary">Alta de prospecto comercial</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="rounded-full p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
          >
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-8 pb-8">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nombre completo *">
              <input
                type="text"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej. Mariana Robles Díaz"
                className="rounded-lg bg-surface-container-low p-2.5 font-ui text-body-sm text-on-surface shadow-sm outline-none focus:bg-surface-container-lowest"
              />
            </Field>
            <Field label="Teléfono celular *">
              <input
                type="tel"
                required
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+52 55 0000 0000"
                className="rounded-lg bg-surface-container-low p-2.5 font-ui text-body-sm text-on-surface shadow-sm outline-none focus:bg-surface-container-lowest"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Correo electrónico">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="mariana.robles@email.com"
                className="rounded-lg bg-surface-container-low p-2.5 font-ui text-body-sm text-on-surface shadow-sm outline-none focus:bg-surface-container-lowest"
              />
            </Field>
            <Field label="Origen del prospecto">
              <select
                value={origin}
                onChange={(event) => setOrigin(event.target.value)}
                className="rounded-lg bg-surface-container-low p-2.5 font-ui text-body-sm text-on-surface shadow-sm outline-none focus:bg-surface-container-lowest"
              >
                {ORIGENES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Unidad de interés">
              <select
                value={unitCode}
                onChange={(event) => setUnitCode(event.target.value)}
                className="rounded-lg bg-surface-container-low p-2.5 font-ui text-body-sm text-on-surface shadow-sm outline-none focus:bg-surface-container-lowest"
              >
                <option value="">Sin unidad específica</option>
                {availableUnits.map((unit) => (
                  <option key={unit.code} value={unit.code}>
                    Depto {unit.code} (Nivel {unit.floor} · {unit.m2.toFixed(0)} m²)
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Etapa inicial">
              <select
                value={stage}
                onChange={(event) => setStage(event.target.value as ProspectoStage)}
                className="rounded-lg bg-surface-container-low p-2.5 font-ui text-body-sm text-on-surface shadow-sm outline-none focus:bg-surface-container-lowest"
              >
                <option value="nuevo">Nuevo sin contactar</option>
                <option value="contactado">Contactado</option>
                <option value="cita">Cita en Showroom agendada</option>
                <option value="seguimiento">En seguimiento de propuesta</option>
              </select>
            </Field>
          </div>

          {!fixedAdvisorId && (
            <Field label="Asesor asignado">
              <select
                value={advisorId}
                onChange={(event) => setAdvisorId(event.target.value)}
                className="rounded-lg bg-surface-container-low p-2.5 font-ui text-body-sm text-on-surface shadow-sm outline-none focus:bg-surface-container-lowest"
              >
                {asesores.map((advisor) => (
                  <option key={advisor.id} value={advisor.id}>
                    {advisor.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Nota o requerimiento inicial">
            <textarea
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Presupuesto aproximado, forma de pago preferida o requerimientos particulares..."
              className="resize-none rounded-lg bg-surface-container-low p-2.5 font-ui text-body-sm text-on-surface shadow-sm outline-none focus:bg-surface-container-lowest"
            />
          </Field>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-surface-container px-4 py-2 font-ui text-label-md text-on-surface transition-colors hover:bg-surface-container-high"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-lg bg-primary px-6 py-2 font-ui text-label-md font-semibold text-on-primary shadow-md transition-all hover:bg-primary-container active:scale-[0.98]"
            >
              Guardar y asignar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-ui text-label-sm font-semibold uppercase text-on-surface-variant">{label}</span>
      {children}
    </label>
  );
}
