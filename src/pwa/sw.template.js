/* eslint-disable */
// Service worker de la app. NO se importa desde la aplicación: el plugin `clientPwaPlugin` (vite.config.ts) lo toma
// como plantilla al construir, rellena los marcadores `__…__` con la lista de archivos del build y lo escribe como
// `dist/sw.js`. Está en JavaScript plano y sin imports: corre en el contexto del worker.
//
// Qué hace, para usar la app en una sala de ventas con mal wifi:
//  - Precarga la app (HTML, JS y CSS con huella) al instalarse: abre y funciona sin red.
//  - Precarga TODAS las imágenes y archivos del cliente (`/clients/**`) en segundo plano, con avance, solo lo que
//    cambió (cada archivo lleva su revisión); después se sirven de caché primero.
//  - Las navegaciones (cualquier ruta de la SPA) se sirven con el HTML de la versión instalada.
//  - Las fuentes de Google se guardan al usarse y se sirven aunque no haya red.
//  - No toca las llamadas a Supabase: el último inventario conocido lo guarda la propia app.
//  - Una versión nueva espera a que la persona (o el showroom en reposo) acepte actualizar: así una página abierta
//    nunca pierde de golpe los archivos que todavía necesita.

const VERSION = '__VERSION__';
const SHELL_CACHE = '__SLUG__-shell-' + VERSION;
const ASSET_CACHE = '__SLUG__-assets';
const RUNTIME_CACHE = '__SLUG__-runtime';

const SHELL_FILES = __SHELL_FILES__;
const ASSET_FILES = __ASSET_FILES__;
const FONT_STYLESHEETS = __FONT_STYLESHEETS__;

const SHELL_SET = new Set(SHELL_FILES);
const INDEX = '/index.html';
/** Los archivos se guardaron sin cabeceras de petición: ignorar `Vary` evita que una petición con `Origin` (los módulos `crossorigin`) no encuentre su archivo. */
const MATCH = { ignoreVary: true };
const FONT_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);
const REVISION_HEADER = 'x-precache-rev';
/** Cuántas descargas de imágenes a la vez: suficiente para avanzar sin ahogar un wifi malo. */
const PRECACHE_CONCURRENCY = 4;

// ─── Ciclo de vida ───────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  // Lo indispensable para abrir sin red: si algo falla, la instalación falla y se reintenta en la siguiente visita.
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      await Promise.all(
        SHELL_FILES.map(async (url) => {
          const response = await fetch(new Request(url, { cache: url === INDEX ? 'reload' : 'default' }));
          if (!response.ok) throw new Error('No se pudo guardar ' + url + ' (' + response.status + ')');
          await cache.put(url, response);
        }),
      );
    }),
  );
  // Sin `skipWaiting()`: una versión nueva espera a que se acepte la actualización (mensaje SKIP_WAITING).
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name.startsWith('__SLUG__-shell-') && name !== SHELL_CACHE).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  const type = event.data && event.data.type;
  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (type === 'PRECACHE_ASSETS') {
    event.waitUntil(precacheAssets());
  }
});

// ─── Precarga de imágenes y archivos del cliente ─────────────────────────────────────

async function broadcast(message) {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  windows.forEach((client) => client.postMessage(message));
}

let precaching = null;

/** Guarda lo que falte o haya cambiado de `/clients/**`, avisando el avance a las páginas. Es idempotente y reintentable. */
function precacheAssets() {
  if (precaching) return precaching;
  precaching = (async () => {
    const cache = await caches.open(ASSET_CACHE);
    const total = ASSET_FILES.length;
    let done = 0;
    let failed = 0;
    let lastSent = 0;
    const report = (completed) => {
      const now = Date.now();
      if (completed || now - lastSent > 250) {
        lastSent = now;
        broadcast({ type: 'precache', done, total, failed, completed });
      }
    };
    report(false);

    // Lo que ya no está en el build se borra de la caché.
    const wanted = new Set(ASSET_FILES.map((entry) => entry[0]));
    for (const request of await cache.keys()) {
      if (!wanted.has(new URL(request.url).pathname)) await cache.delete(request);
    }

    const queue = ASSET_FILES.slice();
    async function worker() {
      for (let entry = queue.shift(); entry; entry = queue.shift()) {
        const url = entry[0];
        const revision = entry[1];
        try {
          const existing = await cache.match(url);
          if (!existing || existing.headers.get(REVISION_HEADER) !== revision) {
            const response = await fetch(url, { cache: 'no-cache' });
            if (!response.ok) throw new Error(String(response.status));
            const headers = new Headers(response.headers);
            headers.set(REVISION_HEADER, revision);
            await cache.put(url, new Response(await response.blob(), { status: 200, statusText: 'OK', headers }));
          }
        } catch (error) {
          failed += 1;
        }
        done += 1;
        report(false);
      }
    }
    await Promise.all(Array.from({ length: PRECACHE_CONCURRENCY }, worker));
    await precacheFonts();
    report(true);
  })().finally(() => {
    precaching = null;
  });
  return precaching;
}

/** Las hojas de estilo de Google Fonts y los archivos de letra que citan, para que el sitio conserve su tipografía sin red. Se intenta una vez; si falla, no pasa nada. */
async function precacheFonts() {
  try {
    const cache = await caches.open(RUNTIME_CACHE);
    for (const stylesheet of FONT_STYLESHEETS) {
      const response = await fetch(stylesheet);
      if (!response.ok) continue;
      await cache.put(stylesheet, response.clone());
      const css = await response.text();
      const urls = Array.from(css.matchAll(/url\((https:[^)]+)\)/g), (match) => match[1]);
      await Promise.all(
        urls.map(async (fontUrl) => {
          if (await cache.match(fontUrl)) return;
          const fontResponse = await fetch(fontUrl);
          if (fontResponse.ok) await cache.put(fontUrl, fontResponse);
        }),
      );
    }
  } catch (error) {
    // Sin fuentes se ve con las del sistema; no vale la pena fallar por eso.
  }
}

// ─── Respuestas ──────────────────────────────────────────────────────────────────────

async function fromShell(request) {
  const cache = await caches.open(SHELL_CACHE);
  return (await cache.match(request, MATCH)) || fetch(request);
}

async function handleNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  const shell = await cache.match(INDEX, MATCH);
  if (shell) return shell;
  // Sin HTML guardado (instalación incompleta): la red, como si no hubiera service worker.
  return fetch(request);
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, MATCH);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.status === 200) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, MATCH);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return cached || (await refresh) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') {
      event.respondWith(handleNavigation(request));
    } else if (url.pathname.startsWith('/clients/')) {
      // Las peticiones con rango (visor de PDF, video) las atiende la red: la caché devolvería el archivo entero.
      if (request.headers.has('range')) return;
      event.respondWith(cacheFirst(request, ASSET_CACHE));
    } else if (SHELL_SET.has(url.pathname)) {
      event.respondWith(fromShell(request));
    }
    return;
  }

  if (FONT_HOSTS.has(url.hostname)) event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
});
