import { Link } from 'react-router-dom';
import auraConfigJson from '../config/aura.json';
import { useI18n } from '../i18n/useI18n';
import type { DevelopmentConfig } from '../types';

const auraConfig = auraConfigJson as unknown as DevelopmentConfig;

/**
 * Aviso de privacidad: texto base para México (LFPDPPP — Ley Federal de Protección de
 * Datos Personales en Posesión de los Particulares), con los datos del responsable
 * tomados de `config.legal` en vez de estar fijos aquí. Página estática, sin dependencia
 * de Supabase ni de `AuraOutletContext`: se abre en una pestaña aparte desde el link de
 * consentimiento del formulario de contacto (SPEC §2), y también funciona sola por URL.
 */
export function PrivacyNotice() {
  const { name } = auraConfig;
  const { t, text } = useI18n();
  const { privacyContactEmail } = auraConfig.legal;
  const privacyResponsibleParty = text(auraConfig.legal.privacyResponsibleParty);
  const privacyAddress = text(auraConfig.legal.privacyAddress);

  return (
    <main className="min-h-dvh w-screen overflow-y-auto bg-neutral-50 py-8">
      <div className="mx-auto w-full max-w-2xl px-4">
        <Link to="/aura" className="text-sm text-neutral-500 underline">
          {t('privacy.back', { name })}
        </Link>

        <h1 className="mt-4 font-serif text-2xl text-neutral-900">{t('privacy.title')}</h1>
        <p className="mt-1 text-xs text-neutral-400">{t('privacy.subtitle')}</p>

        <div className="mt-6 space-y-5 text-sm leading-relaxed text-neutral-700">
          <section>
            <h2 className="font-serif text-lg text-neutral-900">{t('privacy.s1.title')}</h2>
            <p className="mt-1">
              <strong>{privacyResponsibleParty}</strong>
              {t('privacy.s1.body', { address: privacyAddress })}
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg text-neutral-900">{t('privacy.s2.title')}</h2>
            <p className="mt-1">{t('privacy.s2.body', { name })}</p>
          </section>

          <section>
            <h2 className="font-serif text-lg text-neutral-900">{t('privacy.s3.title')}</h2>
            <p className="mt-1">{t('privacy.s3.primary')}</p>
            <ul className="mt-1 list-disc pl-5">
              <li>{t('privacy.s3.primary1', { name })}</li>
              <li>{t('privacy.s3.primary2')}</li>
            </ul>
            <p className="mt-2">{t('privacy.s3.secondary')}</p>
            <ul className="mt-1 list-disc pl-5">
              <li>{t('privacy.s3.secondary1')}</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-lg text-neutral-900">{t('privacy.s4.title')}</h2>
            <p className="mt-1">{t('privacy.s4.body')}</p>
          </section>

          <section>
            <h2 className="font-serif text-lg text-neutral-900">{t('privacy.s5.title')}</h2>
            <p className="mt-1">
              {t('privacy.s5.body')}{' '}
              <a href={`mailto:${privacyContactEmail}`} className="underline">
                {privacyContactEmail}
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg text-neutral-900">{t('privacy.s6.title')}</h2>
            <p className="mt-1">{t('privacy.s6.body')}</p>
          </section>
        </div>
      </div>
    </main>
  );
}
