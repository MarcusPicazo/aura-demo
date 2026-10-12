import { Link } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState, type FormEvent, type SVGProps } from 'react';
import { FloorPlanDetailed } from './FloorPlanDetailed';
import { InteriorGallery } from './InteriorGallery';
import { SunHoursIndicator, type UnitSunInfo } from './SunHoursIndicator';
import { CompareIcon, DocumentIcon, HeartIcon } from './CollectionIcons';
import { unitIdentity } from '../config/active';
import { useCompareStore } from '../store/compareStore';
import { useFavoritesStore } from '../store/favoritesStore';
import { PaymentSchedule } from './PaymentSchedule';
import { buildInterestMessage, buildWhatsappLink } from '../lib/whatsapp';
import { createLead } from '../lib/supabase';
import { trackEvent } from '../lib/analytics';
import { MAX_COMPARE } from '../lib/collections';
import { CurrencyNote } from './CurrencyNote';
import { useI18n } from '../i18n/useI18n';
import { useLatch } from '../lib/useLatch';
import { useDragToDismiss } from '../lib/useDragToDismiss';
import { useEscapeKey } from '../lib/useEscapeKey';
import type { FloorPlanConfig, PaymentPlanConfig, Point, Unit } from '../types';

// La hoja de cotización (y con ella jsPDF) se baja la primera vez que alguien pide una cotización.
const QuoteSheet = lazy(() => import('./QuoteSheet').then((module) => ({ default: module.QuoteSheet })));

type LeadFormStatus = 'idle' | 'submitting' | 'success' | 'error';

function ShareIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="18" cy="5" r="2.6" />
      <circle cx="6" cy="12" r="2.6" />
      <circle cx="18" cy="19" r="2.6" />
      <path d="M8.3 10.7l7.4-4.4M8.3 13.3l7.4 4.4" />
    </svg>
  );
}

interface UnitPanelProps {
  unit: Unit;
  /** Nombre del edificio de la unidad; solo en un conjunto, donde el código solo no basta para ubicarla. */
  buildingName?: string;
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
  /** Horas de sol directo de la unidad; sin esto (el desarrollo no configura asoleamiento) no hay indicador. */
  sun?: UnitSunInfo;
  /** Pone la cámara dentro de la unidad mirando hacia afuera; sin esto (no hay vista desde la unidad) no hay botón. */
  onViewFromUnit?: () => void;
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
  buildingName,
  polygon,
  floorPlan,
  interiorImages,
  paymentPlan,
  developmentId,
  developmentName,
  whatsappPhone,
  onClose,
  onOpenContact,
  sun,
  onViewFromUnit,
  visible,
}: UnitPanelProps) {
  const i18n = useI18n();
  const { t, money, status: statusLabel } = i18n;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [leadStatus, setLeadStatus] = useState<LeadFormStatus>('idle');
  const [copied, setCopied] = useState(false);
  // El enganche vive aquí (no dentro del esquema de pagos): la cotización en PDF usa el que la persona dejó elegido.
  const [downPaymentPercent, setDownPaymentPercent] = useState(paymentPlan.downPaymentPercent);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const mountQuote = useLatch(quoteOpen);
  const [compareNote, setCompareNote] = useState<string | null>(null);

  const unitKey = unitIdentity.param(unit);
  const isFavorite = useFavoritesStore((state) => state.keys.includes(unitKey));
  const toggleFavorite = useFavoritesStore((state) => state.toggle);
  const favoritesOpen = useFavoritesStore((state) => state.panelOpen);
  const isComparing = useCompareStore((state) => state.keys.includes(unitKey));
  const compareCount = useCompareStore((state) => state.keys.length);
  const toggleCompare = useCompareStore((state) => state.toggle);
  const openCompare = useCompareStore((state) => state.openCompare);
  const compareOpen = useCompareStore((state) => state.open);

  // El panel ya no se remonta al cambiar de unidad (ver Selector3D.tsx — remontarlo ahí
  // cortaba la animación de salida/entrada de golpe cada vez que se elegía otra unidad
  // sin cerrar antes). El formulario sí debe reiniciarse por unidad, así que ese reseteo
  // se hace a mano aquí en vez de depender de un remount completo del panel.
  useEffect(() => {
    setName('');
    setPhone('');
    setConsentAccepted(false);
    setLeadStatus('idle');
    setCopied(false);
    setDownPaymentPercent(paymentPlan.downPaymentPercent);
    setQuoteOpen(false);
    setCompareNote(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit.code]);

  // `window.location.href` (no `config.seo.siteUrl`): ya trae el dominio real donde se está
  // sirviendo el sitio en este momento (producción, preview de Vercel, localhost al probar)
  // y la ruta ya apunta a esta unidad (`/aura/unidad/:code`, ver el efecto de selección en
  // Selector3D.tsx) — no hay que reconstruir nada a mano.
  async function handleShare() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('No se pudo copiar el link al portapapeles:', error);
    }
  }

  // Con una hoja encima (cotización, comparador, favoritos), Escape cierra la hoja y no la ficha de abajo.
  useEscapeKey(onClose, visible && !quoteOpen && !compareOpen && !favoritesOpen);

  function handleToggleCompare() {
    const result = toggleCompare(unitKey);
    setCompareNote(result === 'full' ? t('unit.compareFull', { max: MAX_COMPARE }) : null);
  }
  const { dragging, dragY, handlePointerDown, handlePointerMove, handlePointerUp } = useDragToDismiss(onClose, visible);

  function handleInterest() {
    // window.open debe llamarse de forma síncrona en el click, antes de cualquier
    // await, o el navegador lo trata como popup no solicitado y lo bloquea.
    const message = buildInterestMessage(i18n, unit, developmentName);
    window.open(buildWhatsappLink(whatsappPhone, message), '_blank', 'noopener,noreferrer');

    trackEvent({ developmentId, type: 'interest_click', unitId: unit.id });
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
      trackEvent({ developmentId, type: 'lead_submitted', unitId: unit.id });
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
      className={`fixed inset-x-0 bottom-0 z-20 flex max-h-[65dvh] select-none flex-col overflow-hidden rounded-t-2xl border-t-4 border-[var(--brand-accent)] bg-white shadow-2xl transition-[opacity,transform] duration-[280ms] ease-elegant motion-reduce:transition-none sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-96 sm:max-h-[75dvh] sm:select-auto sm:rounded-2xl sm:border-t-0 sm:border-l-4 ${
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
        <span className="sr-only">{t('common.dragToClose')}</span>
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label={t('common.close')}
        className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center text-2xl leading-none text-neutral-500 hover:text-neutral-800"
      >
        &times;
      </button>

      {/* Región con scroll propio: el encabezado (pestaña + ×, arriba) se queda fijo en su
          lugar aunque el contenido sea más largo que `max-h`. `min-h-0` es necesario para
          que un hijo de `flex-col` respete `overflow-y-auto` en vez de estirar al padre. */}
      {/* `pb-16` en móvil: los accesos fijos de abajo a la izquierda (asesor, favoritos, idioma) no deben tapar el final de la ficha. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-16 pt-1 sm:p-5">
        {/* El marco (arriba) se desliza/desvanece de inmediato; el contenido espera 100ms
            más y solo se desvanece (sin desplazarse aparte) — se siente como que el panel
            se acomoda primero y la información aparece después, no todo de golpe junto. */}
        <div
          className={`transition-opacity duration-[280ms] ease-elegant delay-100 motion-reduce:transition-none motion-reduce:delay-0 ${
            visible ? 'opacity-100' : 'opacity-0'
          }`}
        >
      <p className="text-sm font-medium uppercase tracking-wide text-neutral-500">
        {buildingName ? `${buildingName} · ` : ''}
        {t('unit.label', { code: unit.code })}
      </p>
      <h2 className="font-serif text-2xl text-neutral-900">{t('unit.type', { type: unit.type })}</h2>
      <p className="mt-1 text-lg font-semibold text-neutral-900">{money(unit.price)}</p>
      <CurrencyNote />
      <p className="text-sm text-neutral-500">{statusLabel(unit.status)}</p>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <button
          type="button"
          onClick={onOpenContact}
          className="py-1.5 text-sm font-medium text-[var(--brand-primary)] underline underline-offset-2"
        >
          {t('unit.talkToAdvisor')}
        </button>
        <button
          type="button"
          onClick={handleShare}
          className="flex items-center gap-1 py-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-800"
        >
          <ShareIcon className="h-4 w-4" />
          {copied ? t('unit.linkCopied') : t('unit.share')}
        </button>
      </div>

      {/* Guardar, comparar y cotizar: lo que sigue después de ver la unidad. Todo vive en este navegador. */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-medium">
        <button
          type="button"
          onClick={() => toggleFavorite(unitKey)}
          aria-pressed={isFavorite}
          className={`flex flex-col items-center gap-1 rounded-xl border py-2 ${
            isFavorite ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-neutral-200 text-neutral-700'
          }`}
        >
          <HeartIcon className="h-5 w-5" filled={isFavorite} />
          {isFavorite ? t('unit.saved') : t('unit.save')}
        </button>
        <button
          type="button"
          onClick={handleToggleCompare}
          aria-pressed={isComparing}
          className={`flex flex-col items-center gap-1 rounded-xl border py-2 ${
            isComparing ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white' : 'border-neutral-200 text-neutral-700'
          }`}
        >
          <CompareIcon className="h-5 w-5" />
          {isComparing ? t('unit.comparing') : t('unit.compare')}
        </button>
        <button
          type="button"
          onClick={() => setQuoteOpen(true)}
          disabled={unit.status === 'sold'}
          title={unit.status === 'sold' ? t('unit.soldNoQuote') : undefined}
          className="flex flex-col items-center gap-1 rounded-xl border border-neutral-200 py-2 text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <DocumentIcon className="h-5 w-5" />
          {t('unit.quote')}
        </button>
      </div>
      {compareNote && <p className="mt-1.5 text-xs text-neutral-500">{compareNote}</p>}
      {compareCount >= 2 && (
        <button type="button" onClick={openCompare} className="mt-1 py-1.5 text-xs font-medium text-[var(--brand-primary)] underline underline-offset-2">
          {t('unit.viewComparison', { count: compareCount })}
        </button>
      )}

      {onViewFromUnit && (
        <button
          type="button"
          onClick={onViewFromUnit}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-[var(--brand-primary)] py-2 text-sm font-medium text-[var(--brand-primary)]"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" />
            <circle cx="12" cy="12" r="2.8" />
          </svg>
          {t('unit.viewFrom')}
        </button>
      )}

      {/* Un plano dibujado necesita el contorno de la unidad (sale del modelo 3D); uno en
          imagen no, así que un cliente sin modelo 3D igual muestra su plano. */}
      {(polygon || floorPlan?.kind === 'image') && (
        <div className="mt-4">
          <FloorPlanDetailed outline={polygon} plan={floorPlan} />
        </div>
      )}

      <InteriorGallery images={interiorImages} />

      <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
        <dt className="text-neutral-500">{t('unit.bedrooms')}</dt>
        <dd className="text-right text-neutral-900">{unit.bedrooms}</dd>
        <dt className="text-neutral-500">{t('unit.bathrooms')}</dt>
        <dd className="text-right text-neutral-900">{unit.bathrooms}</dd>
        <dt className="text-neutral-500">{t('unit.area')}</dt>
        <dd className="text-right text-neutral-900">{unit.m2}</dd>
        <dt className="text-neutral-500">{t('unit.floor')}</dt>
        <dd className="text-right text-neutral-900">{unit.floor}</dd>
        <dt className="text-neutral-500">{t('unit.orientation')}</dt>
        <dd className="text-right text-neutral-900">{i18n.orientation(unit.orientation)}</dd>
      </dl>

      {sun && <SunHoursIndicator info={sun} />}

      {/* `key`: reinicia solo el control de enganche al cambiar de unidad, sin necesitar
          que el panel completo se remonte (eso era lo que cortaba su propia animación). */}
      <PaymentSchedule
        key={unit.code}
        price={unit.price}
        plan={paymentPlan}
        downPaymentPercent={downPaymentPercent}
        onDownPaymentChange={setDownPaymentPercent}
      />

      <button
        type="button"
        onClick={handleInterest}
        className="mt-5 w-full rounded-full bg-[#25D366] py-3 text-center font-medium text-[#0B2E18]"
      >
        {t('unit.interested')}
      </button>

      {leadStatus === 'success' ? (
        <p className="mt-4 text-center text-sm text-neutral-600">{t('unit.thanks')}</p>
      ) : (
        <form onSubmit={handleLeadSubmit} className="mt-4 space-y-2">
          <p className="text-sm text-neutral-500">{t('unit.contactPrompt')}</p>
          <input
            type="text"
            placeholder={t('unit.name')}
            aria-label={t('unit.name')}
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <input
            type="tel"
            placeholder={t('unit.phone')}
            aria-label={t('unit.phone')}
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <label className="flex items-start gap-2 py-1 text-xs text-neutral-600">
            <input
              type="checkbox"
              required
              checked={consentAccepted}
              onChange={(event) => setConsentAccepted(event.target.checked)}
              className="mt-0.5 accent-[var(--brand-primary)]"
            />
            <span>
              {t('unit.consent')}{' '}
              <Link to="/aviso-de-privacidad" target="_blank" rel="noreferrer" className="underline">
                {t('unit.privacyLink')}
              </Link>
              .
            </span>
          </label>
          <button
            type="submit"
            disabled={leadStatus === 'submitting' || !consentAccepted}
            className="w-full rounded-full border border-[var(--brand-primary)] py-2 text-sm font-medium text-[var(--brand-primary)] disabled:opacity-50"
          >
            {leadStatus === 'submitting' ? t('unit.sending') : t('unit.submit')}
          </button>
          {leadStatus === 'error' && <p className="text-center text-sm text-red-600">{t('unit.sendError')}</p>}
        </form>
      )}
      </div>
      </div>

      {/* La hoja se monta en `document.body` (ver `Sheet`): aquí solo se declara. */}
      {mountQuote && (
        <Suspense fallback={null}>
          <QuoteSheet
            open={quoteOpen}
            onClose={() => setQuoteOpen(false)}
            input={{ i18n, unit, buildingName, developmentName, downPaymentPercent, polygon, floorPlan }}
          />
        </Suspense>
      )}
    </div>
  );
}
