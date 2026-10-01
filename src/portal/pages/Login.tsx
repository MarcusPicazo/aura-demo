import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalStore } from '../store/portalStore';
import { Icon } from '../components/Icon';
import '../portal-theme.css';

export function PortalLogin() {
  const login = usePortalStore((state) => state.login);
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setUnauthorized(false);

    // Mock: sin backend todavía (Fase 1), cualquier contraseña sirve — el correo es lo
    // que decide sesión y rol. Se simula una validación breve para que el botón anime.
    window.setTimeout(() => {
      const user = login(email);
      if (!user) {
        setUnauthorized(true);
        setSubmitting(false);
        return;
      }
      navigate('/portal/resumen', { replace: true });
    }, 500);
  }

  return (
    <div className="portal-root flex min-h-screen w-full items-center justify-center p-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-surface-container-lowest shadow-xl lg:flex-row">
        {/* Panel izquierdo: editorial, fachada real del desarrollo */}
        <div className="relative flex min-h-[300px] w-full flex-col justify-between overflow-hidden bg-primary p-8 lg:min-h-[720px] lg:w-7/12 lg:p-14">
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 ease-out hover:scale-105"
            style={{ backgroundImage: "url('/clients/aura/facade.jpg')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/30 to-primary/40" />
          <div className="absolute inset-0 bg-secondary/10 mix-blend-multiply" />

          <div className="relative z-10 flex items-center justify-between">
            <div className="inline-flex items-center gap-2 rounded-full bg-surface-container-lowest/80 px-3 py-1.5 shadow-sm backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-secondary" />
              <span className="text-label-sm font-ui uppercase tracking-widest text-primary">Plataforma Comercial</span>
            </div>
            <span className="text-label-sm font-ui uppercase tracking-widest text-on-primary/70">Colección Residencial</span>
          </div>

          <div className="relative z-10 mt-auto max-w-md pt-24">
            <div className="mb-6 h-0.5 w-10 bg-secondary-fixed" />
            <blockquote className="font-serif text-headline-lg font-normal italic leading-snug text-on-primary">
              “Espacios concebidos desde la arquitectura y la proporción.”
            </blockquote>
            <div className="mt-6 flex items-center gap-4">
              <span className="text-label-md font-ui uppercase tracking-widest text-on-primary/80">AURA Desarrollos</span>
              <span className="h-1.5 w-1.5 rounded-full bg-on-primary/40" />
              <span className="text-body-sm font-ui text-on-primary/60">Dirección de Ventas • 2025</span>
            </div>
          </div>
        </div>

        {/* Panel derecho: formulario de acceso */}
        <div className="flex w-full flex-col justify-between bg-surface-bright p-8 sm:p-12 lg:w-5/12 lg:p-14">
          <div className="mx-auto my-auto flex w-full max-w-md flex-col">
            <div className="mb-8 flex flex-col items-center text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-surface-container-low p-3 shadow-sm">
                <img src="/portal/emblem.svg" alt="AURA" className="h-full w-full object-contain" />
              </div>
              <span className="mb-2 text-label-sm font-ui uppercase tracking-widest text-secondary">Portal Privado</span>
              <h1 className="font-serif text-headline-md font-medium text-primary">Acceso comercial</h1>
              <p className="mt-2 max-w-xs font-ui text-body-md text-on-surface-variant">
                Gestiona las unidades y los interesados de tu desarrollo.
              </p>
            </div>

            {unauthorized && (
              <div className="mb-6 rounded-xl bg-surface-container-high p-4 transition-all duration-300">
                <div className="flex items-start gap-3">
                  <Icon name="error" className="mt-0.5 shrink-0 text-xl text-error" />
                  <div className="flex-1">
                    <h2 className="text-label-md font-ui font-semibold text-primary">Credenciales no autorizadas</h2>
                    <p className="mt-0.5 text-body-sm font-ui text-on-surface-variant">
                      Verifica tu correo institucional o solicita reactivación al área directiva.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUnauthorized(false)}
                    className="text-on-surface-variant hover:text-primary"
                  >
                    <Icon name="close" className="text-base" />
                  </button>
                </div>
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <label htmlFor="commercial-email" className="block text-label-md font-ui font-semibold text-on-surface">
                  Correo electrónico
                </label>
                <input
                  id="commercial-email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="asesor@aura.com.mx"
                  className="w-full rounded-lg bg-surface-container-lowest px-4 py-3 font-ui text-body-md text-primary placeholder:text-outline/70 outline-none ring-1 ring-outline-variant transition-all duration-200 focus:ring-2 focus:ring-gold-accent"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="commercial-password" className="block text-label-md font-ui font-semibold text-on-surface">
                    Contraseña
                  </label>
                  <a
                    href="#recuperar"
                    className="text-body-sm font-ui text-secondary underline decoration-outline-variant underline-offset-4 transition-colors hover:text-primary"
                  >
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>
                <div className="relative">
                  <input
                    id="commercial-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••••••"
                    className="w-full rounded-lg bg-surface-container-lowest py-3 pl-4 pr-12 font-ui text-body-md text-primary placeholder:text-outline/70 outline-none ring-1 ring-outline-variant transition-all duration-200 focus:ring-2 focus:ring-gold-accent"
                  />
                  <button
                    type="button"
                    aria-label="Alternar visibilidad de contraseña"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-outline transition-colors hover:text-primary"
                  >
                    <Icon name={showPassword ? 'visibility_off' : 'visibility'} className="text-xl" />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3.5 font-ui text-title-md font-medium tracking-wide text-on-primary shadow-md transition-all duration-200 hover:bg-primary-container active:scale-[0.99] disabled:opacity-80"
              >
                {submitting ? (
                  <>
                    <Icon name="progress_activity" className="animate-spin text-lg" />
                    <span>Validando token...</span>
                  </>
                ) : (
                  <>
                    <span>Iniciar sesión</span>
                    <Icon name="arrow_forward" className="text-lg" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 flex items-start gap-3 rounded-xl bg-surface-container-low p-3.5">
              <Icon name="verified_user" className="mt-0.5 shrink-0 text-lg text-secondary" />
              <p className="text-body-sm font-ui leading-relaxed text-on-surface-variant">
                Acceso exclusivo para fuerza de ventas autorizada. Si necesitas acceso, contacta al administrador de tu
                desarrollo.
              </p>
            </div>

            <div className="mt-6 rounded-xl border border-dashed border-outline-variant p-3.5">
              <p className="text-label-sm font-ui uppercase tracking-wider text-on-surface-variant">Modo de prueba</p>
              <p className="mt-1 text-body-sm font-ui text-on-surface-variant">
                <span className="font-semibold text-on-surface">valeria@aura.com.mx</span> — Admin Comercial ·{' '}
                <span className="font-semibold text-on-surface">rodrigo@aura.com.mx</span> — Asesor (cualquier contraseña)
              </p>
            </div>
          </div>

          <div className="mt-6 w-full text-center">
            <span className="text-label-sm font-ui uppercase tracking-wider text-outline">
              AURA Sales Advisory System • v4.2
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
