import { usePwaStore, type PrecacheProgress } from '../store/pwaStore';

/**
 * App instalable y sin conexión, del lado de la página: registra el service worker (solo en producción), le pide que guarde
 * las imágenes del cliente y recibe su avance, detecta que hay una versión nueva, sigue si hay red y guarda el evento que
 * deja instalar la app. El service worker en sí (`src/pwa/sw.template.js`) lo arma el build.
 */

/** Espera después de cargar la página antes de registrar el service worker: la precarga (varios MB) no debe competir con el primer render ni con el wifi. */
const REGISTER_DELAY_MS = 2500;
/** Cada cuánto se busca una versión nueva con la página abierta (una pantalla de showroom no recarga nunca). */
const UPDATE_CHECK_MS = 15 * 60 * 1000;
/** Si la precarga termina con fallos (el wifi se cayó), se reintenta pasado este tiempo, unas pocas veces. */
const PRECACHE_RETRY_MS = 30_000;
const PRECACHE_RETRIES = 3;
/** Cuánto se muestra el aviso "listo para usar sin conexión". */
const READY_FLASH_MS = 4500;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let registration: ServiceWorkerRegistration | null = null;
let installPrompt: BeforeInstallPromptEvent | null = null;
let applyingUpdate = false;
let retries = 0;
let started = false;

function requestPrecache() {
  void navigator.serviceWorker.ready.then((ready) => ready.active?.postMessage({ type: 'PRECACHE_ASSETS' }));
}

function handleMessage(event: MessageEvent) {
  const data = event.data as ({ type?: string } & Partial<PrecacheProgress>) | null;
  if (!data || data.type !== 'precache') return;
  const progress: PrecacheProgress = { done: data.done ?? 0, total: data.total ?? 0, failed: data.failed ?? 0, completed: data.completed === true };
  const store = usePwaStore.getState();
  store.setPrecache(progress);
  if (!progress.completed) return;
  if (progress.failed === 0) {
    store.setReadyFlash(true);
    window.setTimeout(() => usePwaStore.getState().setReadyFlash(false), READY_FLASH_MS);
  } else if (retries < PRECACHE_RETRIES) {
    retries += 1;
    window.setTimeout(requestPrecache, PRECACHE_RETRY_MS);
  }
}

function watchForUpdates(current: ServiceWorkerRegistration) {
  // Una versión que ya esperaba al abrir la página, o una que termina de instalarse con la página abierta.
  if (current.waiting && navigator.serviceWorker.controller) usePwaStore.getState().setUpdateReady(true);
  current.addEventListener('updatefound', () => {
    const installing = current.installing;
    installing?.addEventListener('statechange', () => {
      if (installing.state === 'installed' && navigator.serviceWorker.controller) usePwaStore.getState().setUpdateReady(true);
    });
  });
  window.setInterval(() => void current.update().catch(() => undefined), UPDATE_CHECK_MS);
}

function register() {
  navigator.serviceWorker
    .register('/sw.js')
    .then((current) => {
      registration = current;
      watchForUpdates(current);
      requestPrecache();
    })
    .catch((error: unknown) => console.error('No se pudo registrar el service worker:', error));
}

/** Pone en marcha todo lo anterior. Se llama una vez al arrancar la app. */
export function startPwa(): void {
  if (started || typeof window === 'undefined') return;
  started = true;

  const store = usePwaStore.getState();
  window.addEventListener('online', () => usePwaStore.getState().setOnline(true));
  window.addEventListener('offline', () => usePwaStore.getState().setOnline(false));
  window.addEventListener('beforeinstallprompt', (event) => {
    // El navegador mostraría su propio aviso a destiempo: se guarda y se ofrece desde la interfaz.
    event.preventDefault();
    installPrompt = event as BeforeInstallPromptEvent;
    usePwaStore.getState().setInstallable(true);
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    usePwaStore.getState().setInstallable(false);
  });
  store.setOnline(navigator.onLine);

  // Sin service worker en desarrollo (compite con el recargador en caliente) ni en navegadores que no lo tienen.
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('message', handleMessage);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Solo se recarga si la persona pidió la actualización: la primera instalación también "cambia de controlador".
    if (applyingUpdate) window.location.reload();
  });
  const delayed = () => window.setTimeout(register, REGISTER_DELAY_MS);
  if (document.readyState === 'complete') delayed();
  else window.addEventListener('load', delayed, { once: true });
}

/** Activa la versión nueva y recarga. Con ninguna esperando, no hace nada. */
export function applyUpdate(): boolean {
  const waiting = registration?.waiting;
  if (!waiting) return false;
  applyingUpdate = true;
  waiting.postMessage({ type: 'SKIP_WAITING' });
  return true;
}

/** Muestra el cuadro de instalación del navegador (solo existe si el navegador lo ofreció). */
export async function promptInstall(): Promise<void> {
  const prompt = installPrompt;
  if (!prompt) return;
  await prompt.prompt();
  await prompt.userChoice;
  installPrompt = null;
  usePwaStore.getState().setInstallable(false);
}
