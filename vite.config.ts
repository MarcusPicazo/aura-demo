import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type HtmlTagDescriptor, type Plugin } from 'vite'
import auraConfig from './src/config/aura.json' with { type: 'json' }

/**
 * Título, favicon, descripción y etiquetas Open Graph/Twitter Card, generadas en el HTML
 * servido (no con JS del lado del cliente): los bots que arman la tarjeta de vista previa
 * al pegar un link (WhatsApp, Facebook, Twitter/X) no ejecutan JavaScript, solo leen el
 * HTML tal cual llega — si estas etiquetas se pusieran con React después de montar, esos
 * bots nunca las verían. Todo sale de `config/aura.json`; cambiar de cliente es cambiar
 * ese JSON, este plugin no cambia.
 */
function clientMetaPlugin(): Plugin {
  const { name, tagline, project, seo } = auraConfig;
  const title = `${name} — ${tagline}`;
  const description = project.description;
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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), clientMetaPlugin()],
})
