import { useState, type FormEvent } from 'react';
import { FloorPlanDetailed } from './FloorPlanDetailed';
import { InteriorGallery } from './InteriorGallery';
import { PaymentSchedule } from './PaymentSchedule';
import { buildInterestMessage, buildWhatsappLink } from '../lib/whatsapp';
import { createLead } from '../lib/supabase';
import { formatPrice } from '../lib/pricing';
import { STATUS_LABELS } from '../lib/status';
import type { FloorPlanConfig, PaymentPlanConfig, Point, Unit } from '../types';

type LeadFormStatus = 'idle' | 'submitting' | 'success' | 'error';

interface UnitPanelProps {
  unit: Unit;
  polygon: Point[] | undefined;
  floorPlan: FloorPlanConfig | undefined;
  interiorImages: string[];
  paymentPlan: PaymentPlanConfig;
  developmentId: string;
  developmentName: string;
  whatsappPhone: string;
  onClose: () => void;
}

/**
 * Ficha de la unidad seleccionada: plano SVG generado de su polígono, botón de
 * WhatsApp con mensaje prellenado (SPEC §2) y formulario opcional que guarda un lead.
 */
export function UnitPanel({
  unit,
  polygon,
  floorPlan,
  interiorImages,
  paymentPlan,
  developmentId,
  developmentName,
  whatsappPhone,
  onClose,
}: UnitPanelProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [leadStatus, setLeadStatus] = useState<LeadFormStatus>('idle');

  function handleInterest() {
    // window.open debe llamarse de forma síncrona en el click, antes de cualquier
    // await, o el navegador lo trata como popup no solicitado y lo bloquea.
    const message = buildInterestMessage(unit, developmentName);
    window.open(buildWhatsappLink(whatsappPhone, message), '_blank', 'noopener,noreferrer');

    createLead({ developmentId, unitId: unit.id }).catch((error: unknown) => {
      console.error('No se pudo guardar el lead de "Me interesa":', error);
    });
  }

  async function handleLeadSubmit(event: FormEvent) {
    event.preventDefault();
    setLeadStatus('submitting');
    try {
      await createLead({ developmentId, unitId: unit.id, name, phone });
      setLeadStatus('success');
    } catch (error) {
      console.error('No se pudo guardar el lead del formulario:', error);
      setLeadStatus('error');
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 max-h-[75dvh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-96 sm:rounded-2xl">
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute right-4 top-4 text-2xl leading-none text-neutral-400 hover:text-neutral-700"
      >
        &times;
      </button>

      <p className="text-sm font-medium uppercase tracking-wide text-neutral-500">Unidad {unit.code}</p>
      <h2 className="font-serif text-2xl text-neutral-900">Tipo {unit.type}</h2>
      <p className="mt-1 text-lg font-semibold text-neutral-900">{formatPrice(unit.price)}</p>
      <p className="text-sm text-neutral-500">{STATUS_LABELS[unit.status]}</p>

      {polygon && (
        <div className="mt-4">
          <FloorPlanDetailed outline={polygon} plan={floorPlan} />
        </div>
      )}

      <InteriorGallery images={interiorImages} />

      <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
        <dt className="text-neutral-500">Recámaras</dt>
        <dd className="text-right text-neutral-900">{unit.bedrooms}</dd>
        <dt className="text-neutral-500">Baños</dt>
        <dd className="text-right text-neutral-900">{unit.bathrooms}</dd>
        <dt className="text-neutral-500">m²</dt>
        <dd className="text-right text-neutral-900">{unit.m2}</dd>
        <dt className="text-neutral-500">Piso</dt>
        <dd className="text-right text-neutral-900">{unit.floor}</dd>
        <dt className="text-neutral-500">Orientación</dt>
        <dd className="text-right text-neutral-900">{unit.orientation}</dd>
      </dl>

      <PaymentSchedule price={unit.price} plan={paymentPlan} />

      <button
        type="button"
        onClick={handleInterest}
        className="mt-5 w-full rounded-full bg-[#25D366] py-3 text-center font-medium text-white"
      >
        Me interesa
      </button>

      {leadStatus === 'success' ? (
        <p className="mt-4 text-center text-sm text-neutral-600">¡Gracias! Te contactaremos pronto.</p>
      ) : (
        <form onSubmit={handleLeadSubmit} className="mt-4 space-y-2">
          <p className="text-sm text-neutral-500">¿Prefieres que te contactemos nosotros?</p>
          <input
            type="text"
            placeholder="Nombre"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <input
            type="tel"
            placeholder="Teléfono"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={leadStatus === 'submitting'}
            className="w-full rounded-full border border-neutral-900 py-2 text-sm font-medium text-neutral-900 disabled:opacity-50"
          >
            {leadStatus === 'submitting' ? 'Enviando…' : 'Dejar mis datos'}
          </button>
          {leadStatus === 'error' && <p className="text-center text-sm text-red-600">No se pudo enviar. Intenta de nuevo.</p>}
        </form>
      )}
    </div>
  );
}
