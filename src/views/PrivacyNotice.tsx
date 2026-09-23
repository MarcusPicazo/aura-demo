import { Link } from 'react-router-dom';
import auraConfigJson from '../config/aura.json';
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
  const { privacyResponsibleParty, privacyAddress, privacyContactEmail } = auraConfig.legal;

  return (
    <div className="min-h-dvh w-screen overflow-y-auto bg-neutral-50 py-8">
      <div className="mx-auto w-full max-w-2xl px-4">
        <Link to="/aura" className="text-sm text-neutral-500 underline">
          &larr; Volver a {name}
        </Link>

        <h1 className="mt-4 font-serif text-2xl text-neutral-900">Aviso de privacidad</h1>
        <p className="mt-1 text-xs text-neutral-400">
          Texto base conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares
          (LFPDPPP). No sustituye asesoría legal: revísalo con tu abogado antes de usarlo en producción.
        </p>

        <div className="mt-6 space-y-5 text-sm leading-relaxed text-neutral-700">
          <section>
            <h2 className="font-serif text-lg text-neutral-900">1. Responsable del tratamiento</h2>
            <p className="mt-1">
              <strong>{privacyResponsibleParty}</strong>, con domicilio en {privacyAddress}, es responsable del
              tratamiento de tus datos personales conforme a este aviso de privacidad.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg text-neutral-900">2. Datos personales que recabamos</h2>
            <p className="mt-1">
              Recabamos tu nombre y número de teléfono cuando los proporcionas voluntariamente a través del
              formulario de contacto o del botón "Me interesa" de {name}. No recabamos datos personales sensibles.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg text-neutral-900">3. Finalidades del tratamiento</h2>
            <p className="mt-1">Finalidades primarias, necesarias para atender tu solicitud:</p>
            <ul className="mt-1 list-disc pl-5">
              <li>Contactarte para dar seguimiento a tu interés en una unidad de {name}.</li>
              <li>Compartirte información, cotizaciones y disponibilidad de las unidades del desarrollo.</li>
            </ul>
            <p className="mt-2">Finalidades secundarias, que puedes rechazar sin que eso afecte la atención de tu solicitud:</p>
            <ul className="mt-1 list-disc pl-5">
              <li>Enviarte promociones y novedades del desarrollo.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-lg text-neutral-900">4. Transferencia de datos</h2>
            <p className="mt-1">
              No transferimos tus datos personales a terceros, salvo que una autoridad competente lo requiera
              conforme a la ley.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg text-neutral-900">5. Derechos ARCO</h2>
            <p className="mt-1">
              Tienes derecho a Acceder, Rectificar y Cancelar tus datos personales, así como a Oponerte a su
              tratamiento (derechos ARCO), y a revocar tu consentimiento en cualquier momento. Para ejercerlos,
              escríbenos a{' '}
              <a href={`mailto:${privacyContactEmail}`} className="underline">
                {privacyContactEmail}
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg text-neutral-900">6. Cambios a este aviso de privacidad</h2>
            <p className="mt-1">
              Cualquier cambio a este aviso de privacidad se publicará en esta misma página.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
