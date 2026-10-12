import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv, type HtmlTagDescriptor, type Plugin } from 'vite'
import auraConfig from './src/config/aura.json' with { type: 'json' }
import { localize } from './src/i18n/localized.ts'
import { buildManifest, manifestIcons, shortNameOf } from './src/pwa/manifest.ts'

/**
 * Título, favicon, descripción y etiquetas Open Graph/Twitter Card, generadas en el HTML
 * servido (no con JS del lado del cliente): los bots que arman la tarjeta de vista previa
 * al pegar un link (WhatsApp, Facebook, Twitter/X) no ejecutan JavaScript, solo leen el
 * HTML tal cual llega — si estas etiquetas se pusieran con React después de montar, esos
 * bots nunca las verían. Todo sale de `config/aura.json`; cambiar de cliente es cambiar
 * ese JSON, este plugin no cambia.
 */
function clientMetaPlugin(): Plugin {
  const { name, seo } = auraConfig;
  // Los bots que arman la tarjeta de vista previa no ejecutan JavaScript: no pueden elegir idioma, así que se usa el idioma por omisión del cliente.
  const language = auraConfig.i18n?.defaultLanguage ?? 'es';
  const tagline = localize(auraConfig.tagline, language, language);
  const title = `${name} — ${tagline}`;
  const description = localize(auraConfig.project.description, language, language);
  const absoluteImage = `${seo.siteUrl}${seo.ogImage}`;

  const tags: HtmlTagDescriptor[] = [
    { tag: 'title', children: title, injectTo: 'head-prepend' },
    { tag: 'link', attrs: { rel: 'icon', type: 'image/svg+xml', href: seo.icon }, injectTo: 'head-prepend' },
    { tag: 'meta', attrs: { name: 'description', content: description }, injectTo: 'head' },
    { tag: 'meta', attrs: { property: 'og:type', content: 'website' }, injectTo: 'head' },
    { tag: 'meta', attrs: { property: 'og:site_name', content: name }, injectTo: 'head' },
    { tag: 'meta', attrs: { property: 'og:title', content: title }, injectTo: 'head' },
    { tag: 'meta', attrs: { property: 'og:description', content: description }, injectTo: 'head' },
    { tag: 'meta', attrs: { property: 'og:image', content: absoluteImage }, injectTo: 'head' },
    { tag: 'meta', attrs: { property: 'og:url', content: seo.siteUrl }, injectTo: 'head' },
    { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' }, injectTo: 'head' },
    { tag: 'meta', attrs: { name: 'twitter:title', content: title }, injectTo: 'head' },
    { tag: 'meta', attrs: { name: 'twitter:description', content: description }, injectTo: 'head' },
    { tag: 'meta', attrs: { name: 'twitter:image', content: absoluteImage }, injectTo: 'head' },
  ];

  return {
    name: 'client-meta-tags',
    transformIndexHtml: () => tags,
  };
}

/**
 * Adelanta lo que está en el camino crítico de la primera carga, para que se pida mientras todavía baja el resto:
 *  - `preconnect` al servidor de Supabase: el inventario es lo último que se espera para mostrar la torre, y abrir la conexión
 *    (DNS + TCP + TLS, ~3 viajes de ida y vuelta en 4G) desde que llega el HTML en vez de hasta que corre el JavaScript.
 *  - `modulepreload` del código del edificio 3D (`engine/Tower`), que se carga aparte: sin esto se pide recién cuando el selector
 *    ya montó, un viaje de red después del resto.
 * Los nombres con huella del build solo se conocen al construir, por eso es un plugin y no una línea en `index.html`.
 */
function clientPreloadPlugin(): Plugin {
  let supabaseOrigin: string | null = null
  return {
    name: 'client-preload',
    configResolved(config) {
      const env = loadEnv(config.mode, config.envDir || config.root, 'VITE_')
      try {
        supabaseOrigin = env.VITE_SUPABASE_URL ? new URL(env.VITE_SUPABASE_URL).origin : null
      } catch {
        supabaseOrigin = null
      }
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, context) {
        const tags: HtmlTagDescriptor[] = []
        if (supabaseOrigin) {
          tags.push({ tag: 'link', attrs: { rel: 'preconnect', href: supabaseOrigin, crossorigin: '' }, injectTo: 'head-prepend' })
        }
        const tower = Object.values(context.bundle ?? {}).find(
          (item) => item.type === 'chunk' && item.isDynamicEntry && /engine[\\/]Tower\.tsx$/.test(item.facadeModuleId ?? ''),
        )
        if (tower) {
          tags.push({ tag: 'link', attrs: { rel: 'modulepreload', crossorigin: '', href: `/${tower.fileName}` }, injectTo: 'head' })
        }
        return tags
      },
    },
  }
}

/** Los archivos de una carpeta (rutas relativas con `/`), recursivo. */
function listFiles(directory: string, base = directory): string[] {
  if (!existsSync(directory)) return []
  return readdirSync(directory).flatMap((entry) => {
    const absolute = path.join(directory, entry)
    return statSync(absolute).isDirectory() ? listFiles(absolute, base) : [path.relative(base, absolute).split(path.sep).join('/')]
  })
}

/**
 * App instalable (PWA): manifiesto con la marca del cliente, pantalla de arranque inmediata en el HTML y service worker.
 *  - El manifiesto, los íconos y los colores salen de `config/aura.json` (+ `public/clients/<slug>/pwa/`).
 *  - La pantalla de arranque (logo, nombre, frase y barra) va dentro del `index.html`: se pinta antes de que baje el JavaScript,
 *    que es lo más lento con mal wifi. La interfaz la quita al montar.
 *  - `src/pwa/sw.template.js` se completa al construir con la lista de archivos (JS/CSS con huella, imágenes del cliente y su
 *    revisión) y se escribe como `dist/sw.js`. En desarrollo no hay service worker.
 */
function clientPwaPlugin(): Plugin {
  const { name, brand, seo, slug } = auraConfig
  const language = auraConfig.i18n?.defaultLanguage ?? 'es'
  const text = (value: Parameters<typeof localize>[0]) => localize(value, language, language)
  const root = process.cwd()
  const pwaFiles = listFiles(path.join(root, 'public', 'clients', slug, 'pwa'))
  const manifestSource = JSON.stringify(
    buildManifest({
      name,
      shortName: shortNameOf(name, auraConfig.pwa?.shortName),
      description: text(auraConfig.project.description),
      themeColor: brand.primary,
      backgroundColor: brand.background,
      lang: language,
      display: (auraConfig.pwa?.display as 'standalone' | 'fullscreen' | 'minimal-ui' | undefined) ?? 'standalone',
      startUrl: '/aura',
      icons: manifestIcons(slug, pwaFiles, seo.icon),
      shortcuts: [{ name: 'Showroom', url: '/aura?modo=showroom' }],
    }),
    null,
    2,
  )
  const appleTouchIcon = pwaFiles.includes('apple-touch-icon.png') ? `/clients/${slug}/pwa/apple-touch-icon.png` : seo.icon

  const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
  const splashCss = `
#boot-splash{position:fixed;inset:0;z-index:15;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:${brand.background};color:${brand.primary};transition:opacity .45s ease}
#boot-splash.leaving{opacity:0;pointer-events:none}
#boot-splash img{height:36px;width:auto}
#boot-splash .name{margin:0;font:500 18px/1.2 'Playfair Display',Georgia,serif;color:${brand.primary}}
#boot-splash .tagline{margin:0;font:italic 14px/1.2 Inter,system-ui,sans-serif;color:#737373}
#boot-splash .bar{margin-top:8px;height:3px;width:160px;overflow:hidden;border-radius:9999px;background:${brand.primary}26}
#boot-splash .bar i{display:block;height:100%;width:33%;border-radius:9999px;background:${brand.accent};animation:boot-bar 1.3s ease-in-out infinite}
@keyframes boot-bar{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}
@media (prefers-reduced-motion:reduce){#boot-splash .bar i{animation:none;width:100%;opacity:.6}}`
  const splashHtml = `<img src="${escapeHtml(brand.logo)}" alt="" /><p class="name">${escapeHtml(name)}</p><p class="tagline">${escapeHtml(text(auraConfig.tagline))}</p><div class="bar"><i></i></div>`

  let outDir = path.resolve(root, 'dist')
  let isBuild = false

  return {
    name: 'client-pwa',
    configResolved(resolved) {
      outDir = path.resolve(resolved.root, resolved.build.outDir)
      isBuild = resolved.command === 'build'
    },
    transformIndexHtml: () => [
      { tag: 'link', attrs: { rel: 'manifest', href: '/manifest.webmanifest' }, injectTo: 'head' },
      { tag: 'meta', attrs: { name: 'theme-color', content: brand.primary }, injectTo: 'head' },
      { tag: 'meta', attrs: { name: 'mobile-web-app-capable', content: 'yes' }, injectTo: 'head' },
      { tag: 'meta', attrs: { name: 'apple-mobile-web-app-capable', content: 'yes' }, injectTo: 'head' },
      { tag: 'meta', attrs: { name: 'apple-mobile-web-app-title', content: shortNameOf(name, auraConfig.pwa?.shortName) }, injectTo: 'head' },
      { tag: 'link', attrs: { rel: 'apple-touch-icon', href: appleTouchIcon }, injectTo: 'head' },
      { tag: 'style', children: splashCss, injectTo: 'head' },
      { tag: 'div', attrs: { id: 'boot-splash', 'aria-hidden': 'true' }, children: splashHtml, injectTo: 'body-prepend' },
    ] satisfies HtmlTagDescriptor[],
    // En desarrollo el manifiesto se sirve desde memoria (no hay service worker).
    configureServer(server) {
      server.middlewares.use('/manifest.webmanifest', (_request, response) => {
        response.setHeader('Content-Type', 'application/manifest+json')
        response.end(manifestSource)
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: manifestSource })
    },
    closeBundle() {
      if (!isBuild) return
      const files = listFiles(outDir).filter((file) => file !== 'sw.js' && !file.endsWith('.map'))
      const sizeOf = (file: string) => statSync(path.join(outDir, file))
      // La app (HTML, JS, CSS, manifiesto, íconos de la raíz): lo indispensable para abrir sin red.
      const shell = files.filter((file) => !file.startsWith('clients/')).map((file) => `/${file}`)
      // Imágenes y archivos del cliente: se guardan en segundo plano, cada uno con su revisión (tamaño + fecha).
      // Los JPG de respaldo del modo render (`<nombre>.jpg` junto a sus `<nombre>-<ancho>.webp`) los usa solo un navegador sin `srcset`
      // ni WebP: ninguno moderno los baja, así que no se guardan para uso sin conexión (eran ~0.6 MB de descarga y de caché de más).
      const clientFiles = files.filter((file) => file.startsWith('clients/'))
      const fileSet = new Set(clientFiles)
      const isRenderFallback = (file: string) =>
        file.endsWith('.jpg') && clientFiles.some((other) => other.startsWith(`${file.slice(0, -4)}-`) && other.endsWith('.webp') && fileSet.has(other))
      const assets = clientFiles
        .filter((file) => !isRenderFallback(file))
        .map((file) => [`/${file}`, `${sizeOf(file).size}-${Math.round(sizeOf(file).mtimeMs)}`] as const)
      const indexHtml = readFileSync(path.join(outDir, 'index.html'), 'utf8')
      // (La misma hoja aparece dos veces —`preload` y `noscript`—; solo la tipografía del sitio público: la del portal se pide al entrar a él.)
      const fontStylesheets = [
        ...new Set(
          [...indexHtml.matchAll(/href="(https:\/\/fonts\.googleapis\.com\/css2\?[^"]+)"/g)]
            .map((match) => match[1].replace(/&amp;/g, '&'))
            .filter((href) => !href.includes('Material+Symbols') && !href.includes('Plus+Jakarta')),
        ),
      ]
      const template = readFileSync(path.resolve(root, 'src/pwa/sw.template.js'), 'utf8')
      // La versión cambia si cambia la app o el propio service worker.
      const version = createHash('sha1')
        .update(shell.map((url) => `${url}:${sizeOf(url.slice(1)).size}`).join('|'))
        .update(manifestSource)
        .update(template)
        .digest('hex')
        .slice(0, 10)
      const source = template
        .replace(/__VERSION__/g, version)
        .replace(/__SLUG__/g, slug)
        .replace('__SHELL_FILES__', JSON.stringify(shell))
        .replace('__ASSET_FILES__', JSON.stringify(assets))
        .replace('__FONT_STYLESHEETS__', JSON.stringify(fontStylesheets))
      mkdirSync(outDir, { recursive: true })
      writeFileSync(path.join(outDir, 'sw.js'), source)
      console.log(`[client-pwa] sw.js: ${shell.length} archivos de la app, ${assets.length} del cliente (versión ${version})`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), clientMetaPlugin(), clientPreloadPlugin(), clientPwaPlugin()],
})
