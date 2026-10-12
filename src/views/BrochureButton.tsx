import { useState } from 'react';
import { activeConfig } from '../config/active';
import { useI18n } from '../i18n/useI18n';
import { downloadQuote } from '../lib/shareQuote';
import type { Unit } from '../types';

interface BrochureButtonProps {
  /** Inventario actual: de aquí salen las tipologías del brochure. */
  units: Unit[];
}

const BUTTON_CLASS = 'rounded-full border border-neutral-300 py-2 text-center text-sm font-medium text-neutral-700';

type BuildState = 'idle' | 'building' | 'error';

/**
 * "Descargar brochure". Si el cliente trae su propio PDF (`advisor.brochureUrl`), lo descarga tal cual; si no, arma el brochure
 * en el navegador (portada con la fachada, tipologías con su plano, amenidades, pagos y asesor) y lo descarga. El generador
 * y jsPDF solo se bajan al presionar el botón: nadie que solo mira la torre paga ese peso.
 */
export function BrochureButton({ units }: BrochureButtonProps) {
  const i18n = useI18n();
  const { t } = i18n;
  const [state, setState] = useState<BuildState>('idle');
  const { brochureUrl } = activeConfig.advisor;

  if (brochureUrl) {
    return (
      <a href={brochureUrl} download className={BUTTON_CLASS}>
        {t('contact.brochure')}
      </a>
    );
  }

  async function handleClick() {
    if (state === 'building') return;
    setState('building');
    try {
      const { buildBrochurePdf } = await import('../lib/brochurePdf');
      downloadQuote(await buildBrochurePdf({ i18n, units }));
      setState('idle');
    } catch (error) {
      console.error('No se pudo generar el brochure en PDF:', error);
      setState('error');
    }
  }

  return (
    <div className="flex flex-col">
      <button type="button" onClick={() => void handleClick()} disabled={state === 'building'} aria-busy={state === 'building'} className={`${BUTTON_CLASS} disabled:cursor-wait disabled:opacity-70`}>
        {state === 'building' ? t('contact.brochurePreparing') : t('contact.brochure')}
      </button>
      {state === 'error' && (
        <p role="alert" className="mt-1.5 text-xs text-red-700">
          {t('contact.brochureError')}
        </p>
      )}
    </div>
  );
}
