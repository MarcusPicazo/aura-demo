import type { SVGProps } from 'react';
import { useDragToDismiss } from '../lib/useDragToDismiss';
import { useEscapeKey } from '../lib/useEscapeKey';
import { buildAdvisorMessage, buildScheduleVisitMessage, buildWhatsappLink } from '../lib/whatsapp';
import type { AdvisorConfig, Unit } from '../types';

interface ContactCardProps {
  advisor: AdvisorConfig;
  developmentName: string;
  /** Si hay una unidad seleccionada en el selector 3D, los mensajes de WhatsApp la
   *  incluyen — así el asesor no tiene que preguntar de cuál departamento se trata. */
  selectedUnit: Unit | null;
  visible: boolean;
  onClose: () => void;
}

function Icon({ children, ...props }: SVGProps<SVGSVGElement> & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      {children}
    </svg>
  );
}

function PhoneIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 5c0-.6.4-1 1-1h3l2 4-1.8 1.2a11 11 0 0 0 5.6 5.6L15 13l4 2v3c0 .6-.4 1-1 1C10.5 19 4 12.5 4 5Z" />
    </Icon>
  );
}

function MailIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" />
      <path d="M4.5 6.5 12 12l7.5-5.5" />
    </Icon>
  );
}

function ClockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </Icon>
  );
}

function PinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 21s-6.5-5.4-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.6 12 21 12 21Z" />
      <circle cx="12" cy="10.5" r="2.2" />
    </Icon>
  );
}

/** Botón "hablar con un asesor" reutilizable — misma pinta desde la interfaz principal
 *  (AuraLayout) y desde la ficha de unidad, sin duplicar el markup. */
export function ContactTriggerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="3.3" />
      <path d="M5 20c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5" />
    </Icon>
  );
}

/** Dos letras a partir del nombre, para el avatar de respaldo cuando no hay foto — mismo
 *  patrón que `AmenityConfig.image` opcional: sin foto real, no se rompe, se degrada. */
function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Ficha comercial del asesor: foto/iniciales, teléfono, WhatsApp, correo, horario y
 * dirección de la sala de ventas con enlace a mapa, más botones de agendar visita y
 * descargar brochure. Mismo estilo y animación de apertura que `UnitPanel` — hoja inferior
 * en móvil (con su propia pestaña de arrastre), panel a la derecha en escritorio.
 */
export function ContactCard({ advisor, developmentName, selectedUnit, visible, onClose }: ContactCardProps) {
  useEscapeKey(onClose, visible);
  const { dragging, dragY, handlePointerDown, handlePointerMove, handlePointerUp } = useDragToDismiss(onClose, visible);

  const whatsappHref = buildWhatsappLink(advisor.phone, buildAdvisorMessage(developmentName, selectedUnit));
  const scheduleHref = buildWhatsappLink(advisor.phone, buildScheduleVisitMessage(developmentName, selectedUnit));
  const mapHref = `https://www.google.com/maps/search/?api=1&query=${advisor.salesOffice.lat}%2C${advisor.salesOffice.lng}`;

  return (
    <div
      // z-30: por encima de la ficha de unidad (z-20) — las dos son hojas ancladas al mismo
      // borde (abajo en móvil, derecha en escritorio), así que si se abre esta estando la
      // otra abierta, simplemente la tapa; cerrar esta vuelve a dejar ver la de unidad.
      // `select-none` (solo móvil): mismo motivo que en `UnitPanel` — un swipe que arranca
      // sobre texto del panel disparaba selección nativa en vez de mover el panel.
      className={`fixed inset-x-0 bottom-0 z-30 flex max-h-[70dvh] select-none flex-col overflow-hidden rounded-t-2xl border-t-4 border-[var(--brand-accent)] bg-white shadow-2xl transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-96 sm:max-h-[80dvh] sm:select-auto sm:rounded-2xl sm:border-t-0 sm:border-l-4 ${
        visible ? 'translate-y-0 opacity-100 sm:translate-y-0' : 'translate-y-full opacity-0 sm:translate-y-4'
      }`}
      style={dragging ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
    >
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

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-1 sm:p-5">
        <div
          className={`transition-opacity duration-300 ease-out delay-100 motion-reduce:transition-none motion-reduce:delay-0 ${
            visible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="flex items-center gap-3">
            {advisor.photo ? (
              <img src={advisor.photo} alt={advisor.name} className="h-14 w-14 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)] font-serif text-lg text-white">
                {initials(advisor.name)}
              </div>
            )}
            <div>
              <p className="font-serif text-lg text-neutral-900">{advisor.name}</p>
              <p className="text-sm text-neutral-500">{advisor.role}</p>
            </div>
          </div>

          {selectedUnit && (
            <p className="mt-3 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
              Sobre la unidad <span className="font-medium text-neutral-900">{selectedUnit.code}</span>
            </p>
          )}

          <div className="mt-4 space-y-2 text-sm">
            <a href={`tel:+${advisor.phone}`} className="flex items-center gap-2 text-neutral-700 hover:text-neutral-900">
              <PhoneIcon className="h-4 w-4 shrink-0 text-[var(--brand-primary)]" />
              +{advisor.phone}
            </a>
            <a href={`mailto:${advisor.email}`} className="flex items-center gap-2 text-neutral-700 hover:text-neutral-900">
              <MailIcon className="h-4 w-4 shrink-0 text-[var(--brand-primary)]" />
              {advisor.email}
            </a>
            <p className="flex items-center gap-2 text-neutral-700">
              <ClockIcon className="h-4 w-4 shrink-0 text-[var(--brand-primary)]" />
              {advisor.hours}
            </p>
            <a
              href={mapHref}
              target="_blank"
              rel="noreferrer"
              className="flex items-start gap-2 text-neutral-700 hover:text-neutral-900"
            >
              <PinIcon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-primary)]" />
              <span>{advisor.salesOffice.address}</span>
            </a>
          </div>

          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="mt-5 block w-full rounded-full bg-[#25D366] py-3 text-center font-medium text-white"
          >
            Escribir por WhatsApp
          </a>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <a
              href={scheduleHref}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-[var(--brand-primary)] py-2 text-center text-sm font-medium text-[var(--brand-primary)]"
            >
              Agendar visita
            </a>
            <a
              href={advisor.brochureUrl}
              download
              className="rounded-full border border-neutral-300 py-2 text-center text-sm font-medium text-neutral-700"
            >
              Descargar brochure
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
