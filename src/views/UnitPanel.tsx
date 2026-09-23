import { Link } from 'react-router-dom';
import { useEffect, useState, type FormEvent } from 'react';
import { FloorPlanDetailed } from './FloorPlanDetailed';
import { InteriorGallery } from './InteriorGallery';
import { PaymentSchedule } from './PaymentSchedule';
import { buildInterestMessage, buildWhatsappLink } from '../lib/whatsapp';
import { createLead } from '../lib/supabase';
import { formatPrice } from '../lib/pricing';
import { STATUS_LABELS } from '../lib/status';
import { useDragToDismiss } from '../lib/useDragToDismiss';
import { useEscapeKey } from '../lib/useEscapeKey';
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
  /** Abre la ficha de contacto del asesor (vive en `AuraLayout`, se expone por contexto de
   *  ruta) — así "hablar con un asesor" desde aquí y el botón de la interfaz principal
   *  terminan en el mismo panel, sin duplicarlo. */
  onOpenContact: () => void;
  /** Dispara la transición de entrada/salida (ver `usePresence` en el llamador) — arranca
   *  en `false` un frame después de montar, y vuelve a `false` antes de desmontar. */
  visible: boolean;
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
  onOpenContact,
  visible,
}: UnitPanelProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [leadStatus, setLeadStatus] = useState<LeadFormStatus>('idle');

  // El panel ya no se remonta al cambiar de unidad (ver Selector3D.tsx — remontarlo ahí
  // cortaba la animación de salida/entrada de golpe cada vez que se elegía otra unidad
  // sin cerrar antes). El formulario sí debe reiniciarse por unidad, así que ese reseteo
  // se hace a mano aquí en vez de depender de un remount completo del panel.
  useEffect(() => {
    setName('');
    setPhone('');
    setConsentAccepted(false);
    setLeadStatus('idle');
  }, [unit.code]);

  useEscapeKey(onClose, visible);
  const { dragging, dragY, handlePointerDown, handlePointerMove, handlePointerUp } = useDragToDismiss(onClose, visible);

  function handleInterest() {
    // window.open debe llamarse de forma síncrona en el click, antes de cualquier
    // await, o el navegador lo trata como popup no solicitado y lo bloquea.
    const message = buildInterestMessage(unit, developmentName);
    window.open(buildWhatsappLink(whatsappPhone, message), '_blank', 'noopener,noreferrer');

    createLead({ developmentId, unitId: unit.id, origin: 'whatsapp' }).catch((error: unknown) => {
      console.error('No se pudo guardar el lead de "Me interesa":', error);
    });
  }

  async function handleLeadSubmit(event: FormEvent) {
    event.preventDefault();
    if (!consentAccepted) return;
    setLeadStatus('submitting');
    try {
      await createLead({
        developmentId,
        unitId: unit.id,
        name,
        phone,
        origin: 'form',
        consentAt: new Date().toISOString(),
      });
      setLeadStatus('success');
    } catch (error) {
      console.error('No se pudo guardar el lead del formulario:', error);
      setLeadStatus('error');
    }
  }

  return (
    <div
      // `select-none` (solo móvil, `sm:select-auto` lo revierte en escritorio donde no hay
      // gesto de arrastre): un swipe que arranca sobre texto del panel en vez de la
      // pestaña de arriba disparaba selección de texto nativa en lugar de mover el panel.
      className={`fixed inset-x-0 bottom-0 z-20 flex max-h-[65dvh] select-none flex-col overflow-hidden rounded-t-2xl border-t-4 border-[var(--brand-accent)] bg-white shadow-2xl transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-96 sm:max-h-[75dvh] sm:select-auto sm:rounded-2xl sm:border-t-0 sm:border-l-4 ${
        visible ? 'translate-y-0 opacity-100 sm:translate-y-0' : 'translate-y-full opacity-0 sm:translate-y-4'
      }`}
      style={dragging ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
    >
      {/* Pestaña de arrastre: solo en móvil (el panel de escritorio entra desde la derecha,
          no desde abajo, así que no aplica ahí). Tocar cierra igual que el botón ×; deslizar
          hacia abajo más de `HANDLE_CLOSE_THRESHOLD_PX` también cierra, menos regresa al
          panel abierto — así "cerrarlo" y "desexpandirlo deslizando" son el mismo gesto. */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="flex shrink-0 touch-none cursor-grab justify-center pb-1 pt-2.5 active:cursor-grabbing sm:hidden"
      >
        <span className="h-1.5 w-10 rounded-full bg-neutral-300" aria-hidden="true" />
        <span className="sr-only">Deslizar o tocar para cerrar</span>
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute right-4 top-4 text-2xl leading-none text-neutral-400 hover:text-neutral-700"
      >
        &times;
      </button>

      {/* Región con scroll propio: el encabezado (pestaña + ×, arriba) se queda fijo en su
          lugar aunque el contenido sea más largo que `max-h`. `min-h-0` es necesario para
          que un hijo de `flex-col` respete `overflow-y-auto` en vez de estirar al padre. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-1 sm:p-5">
        {/* El marco (arriba) se desliza/desvanece de inmediato; el contenido espera 100ms
            más y solo se desvanece (sin desplazarse aparte) — se siente como que el panel
            se acomoda primero y la información aparece después, no todo de golpe junto. */}
        <div
          className={`transition-opacity duration-300 ease-out delay-100 motion-reduce:transition-none motion-reduce:delay-0 ${
            visible ? 'opacity-100' : 'opacity-0'
          }`}
        >
      <p className="text-sm font-medium uppercase tracking-wide text-neutral-500">Unidad {unit.code}</p>
      <h2 className="font-serif text-2xl text-neutral-900">Tipo {unit.type}</h2>
      <p className="mt-1 text-lg font-semibold text-neutral-900">{formatPrice(unit.price)}</p>
      <p className="text-sm text-neutral-500">{STATUS_LABELS[unit.status]}</p>

      <button
        type="button"
        onClick={onOpenContact}
        className="mt-2 text-sm font-medium text-[var(--brand-primary)] underline underline-offset-2"
      >
        Hablar con un asesor
      </button>

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

      {/* `key`: reinicia solo el control de enganche al cambiar de unidad, sin necesitar
          que el panel completo se remonte (eso era lo que cortaba su propia animación). */}
      <PaymentSchedule key={unit.code} price={unit.price} plan={paymentPlan} />

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
          <label className="flex items-start gap-2 text-xs text-neutral-600">
            <input
              type="checkbox"
              required
              checked={consentAccepted}
              onChange={(event) => setConsentAccepted(event.target.checked)}
              className="mt-0.5 accent-[var(--brand-primary)]"
            />
            <span>
              Acepto el tratamiento de mis datos personales conforme al{' '}
              <Link to="/aviso-de-privacidad" target="_blank" rel="noreferrer" className="underline">
                aviso de privacidad
              </Link>
              .
            </span>
          </label>
          <button
            type="submit"
            disabled={leadStatus === 'submitting' || !consentAccepted}
            className="w-full rounded-full border border-[var(--brand-primary)] py-2 text-sm font-medium text-[var(--brand-primary)] disabled:opacity-50"
          >
            {leadStatus === 'submitting' ? 'Enviando…' : 'Dejar mis datos'}
          </button>
          {leadStatus === 'error' && <p className="text-center text-sm text-red-600">No se pudo enviar. Intenta de nuevo.</p>}
        </form>
      )}
      </div>
      </div>
    </div>
  );
}
