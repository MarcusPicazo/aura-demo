/**
 * Manifiesto de la app instalable (PWA) y sus íconos, armados a partir de la config del cliente. Funciones puras (sin
 * `fs` ni Vite): las usa `vite.config.ts` al construir y las pruebas.
 */

export interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: 'any' | 'maskable';
}

export interface ManifestInput {
  name: string;
  /** Nombre corto bajo el ícono de la pantalla de inicio. */
  shortName: string;
  description: string;
  themeColor: string;
  backgroundColor: string;
  lang: string;
  display: 'standalone' | 'fullscreen' | 'minimal-ui';
  startUrl: string;
  icons: ManifestIcon[];
  shortcuts: { name: string; url: string }[];
}

/** Los 12 caracteres que muestran los launchers: el nombre corto de la config, o las primeras palabras que caben. */
export function shortNameOf(name: string, configured?: string): string {
  if (configured) return configured;
  const words = name.split(/\s+/).filter(Boolean);
  let result = '';
  for (const word of words) {
    const next = result ? `${result} ${word}` : word;
    if (next.length > 12) break;
    result = next;
  }
  return result || name.slice(0, 12);
}

/**
 * Los íconos que existen en `public/clients/<slug>/pwa/` (los genera `scripts/build-pwa-icons.ts`), más el SVG del cliente
 * como respaldo si aún no se generaron: Chrome acepta un SVG `sizes: "any"`, pero para instalar bien pide PNG de 192 y 512.
 */
export function manifestIcons(slug: string, pwaFiles: readonly string[], svgIcon: string): ManifestIcon[] {
  const base = `/clients/${slug}/pwa`;
  const has = (file: string) => pwaFiles.includes(file);
  const icons: ManifestIcon[] = [];
  if (has('icon-192.png')) icons.push({ src: `${base}/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' });
  if (has('icon-512.png')) icons.push({ src: `${base}/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' });
  if (has('maskable-512.png')) icons.push({ src: `${base}/maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' });
  if (icons.length === 0) icons.push({ src: svgIcon, sizes: 'any', type: 'image/svg+xml', purpose: 'any' });
  return icons;
}

export function buildManifest(input: ManifestInput): Record<string, unknown> {
  return {
    name: input.name,
    short_name: input.shortName,
    description: input.description,
    id: input.startUrl,
    start_url: input.startUrl,
    scope: '/',
    display: input.display,
    orientation: 'any',
    lang: input.lang,
    theme_color: input.themeColor,
    background_color: input.backgroundColor,
    icons: input.icons,
    shortcuts: input.shortcuts.map((shortcut) => ({ name: shortcut.name, short_name: shortcut.name, url: shortcut.url, icons: input.icons.slice(0, 1) })),
  };
}
