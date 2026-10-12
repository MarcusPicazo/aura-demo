import { useEffect, useState } from 'react';
import { activeConfig } from '../config/active';
import { downloadQuote, buildQuoteMessage, shareQuoteViaWhatsapp } from '../lib/shareQuote';
import { buildQuotePdf, type QuoteDocument, type QuoteInput } from '../lib/quotePdf';
import { buildWhatsappLink } from '../lib/whatsapp';
import { CurrencyNote } from './CurrencyNote';
import { DocumentIcon } from './CollectionIcons';
import { Sheet } from './Sheet';

interface QuoteSheetProps {
  open: boolean;
  onClose: () => void;
  /** Lo que lleva la cotización; el PDF se arma al abrir la hoja y se rehace si esto cambia. */
  input: QuoteInput;
}

type BuildState = { status: 'building' } | { status: 'ready'; quote: QuoteDocument } | { status: 'error'; message: string };

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Cotización en PDF de una unidad. Al abrirse arma el documento en el navegador (nada se envía a ningún servidor) y
 * luego ofrece descargarlo o mandarlo por WhatsApp. Se arma ANTES de los botones, no al hacer clic: compartir un archivo
 * exige un gesto reciente del usuario y esperar a generar el PDF después del clic lo perdería.
 */
export function QuoteSheet({ open, onClose, input }: QuoteSheetProps) {
  const [state, setState] = useState<BuildState>({ status: 'building' });
  const [notice, setNotice] = useState<string | null>(null);
  const { unit, downPaymentPercent, developmentName, i18n } = input;
  const { t, money } = i18n;
  const { advisor } = activeConfig;

  // Las dependencias son los datos que cambian el documento (no el objeto `input`, que se arma de nuevo en cada render).
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setState({ status: 'building' });
    setNotice(null);
    buildQuotePdf(input)
      .then((quote) => {
        if (!cancelled) setState({ status: 'ready', quote });
      })
      .catch((error: unknown) => {
        console.error('No se pudo generar la cotización en PDF:', error);
        if (!cancelled) setState({ status: 'error', message: 'error' });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, unit.id, unit.price, unit.status, downPaymentPercent, developmentName, i18n.language, i18n.currency]);

  const message = buildQuoteMessage(i18n, unit, developmentName);
  const chatHref = buildWhatsappLink(advisor.phone, message);

  async function handleWhatsapp(quote: QuoteDocument) {
    const outcome = await shareQuoteViaWhatsapp(i18n, quote, message, advisor.phone);
    setNotice(outcome === 'shared' ? t('quoteSheet.shared') : outcome === 'fallback' ? t('quoteSheet.fallback') : null);
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('quoteSheet.title')}>
      <div className="rounded-lg bg-neutral-50 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{developmentName}</p>
        <p className="font-serif text-xl text-neutral-900">{t('pdf.apartment', { code: unit.code })}</p>
        <p className="text-sm text-neutral-600">{t('quoteSheet.summary', { type: unit.type, m2: unit.m2, bedrooms: unit.bedrooms, floor: unit.floor })}</p>
        <p className="mt-1 text-lg font-semibold text-neutral-900">{money(unit.price)}</p>
        <CurrencyNote />
        <p className="text-xs text-neutral-500">{t('quoteSheet.scheme', { percent: downPaymentPercent, advisor: advisor.name })}</p>
      </div>

      {state.status === 'building' && (
        <p role="status" className="mt-4 flex items-center justify-center gap-2 py-4 text-sm text-neutral-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-[var(--brand-primary)]" aria-hidden="true" />
          {t('quoteSheet.preparing')}
        </p>
      )}

      {state.status === 'error' && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {t('quoteSheet.error')}
        </p>
      )}

      {state.status === 'ready' && (
        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={() => downloadQuote(state.quote)}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-primary)] py-3 text-sm font-medium text-white"
          >
            <DocumentIcon className="h-4 w-4" />
            {t('quoteSheet.download', { size: formatSize(state.quote.blob.size) })}
          </button>
          <button
            type="button"
            onClick={() => void handleWhatsapp(state.quote)}
            className="w-full rounded-full bg-[#25D366] py-3 text-sm font-medium text-[#0B2E18]"
          >
            {t('quoteSheet.whatsapp')}
          </button>
          {notice && (
            <p role="status" className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
              {notice}{' '}
              <a href={chatHref} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2">
                {t('quoteSheet.openChat', { name: advisor.name })}
              </a>
            </p>
          )}
        </div>
      )}

      <p className="mt-4 text-xs text-neutral-400">
        {t('quoteSheet.privacy')}
      </p>
    </Sheet>
  );
}
