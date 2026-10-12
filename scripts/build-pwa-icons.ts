/**
 * Genera los íconos de la app instalable (PWA) a partir del ícono SVG del cliente.
 *
 * Entrada:  `seo.icon` de src/config/<slug>.json (un SVG cuadrado, p. ej. /clients/<slug>/icon.svg)
 * Salida:   public/clients/<slug>/pwa/icon-192.png, icon-512.png   (ícono normal)
 *           public/clients/<slug>/pwa/maskable-512.png             (con margen de seguridad y fondo de marca,
 *                                                                   para las máscaras redondas de Android)
 *           public/clients/<slug>/pwa/apple-touch-icon.png (180)   (iOS)
 *
 * El manifiesto (vite.config.ts) incluye solo los que existan. Es idempotente y no se conecta a nada.
 *
 * Uso: npx tsx scripts/build-pwa-icons.ts <slug>
 */
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const slug = process.argv[2];
if (!slug) {
  console.error('Uso: npx tsx scripts/build-pwa-icons.ts <slug>');
  process.exit(1);
}

const config = JSON.parse(readFileSync(path.resolve('src', 'config', `${slug}.json`), 'utf8')) as {
  seo: { icon: string };
  brand: { background: string };
};
const source = path.resolve('public', config.seo.icon.replace(/^\//, ''));
const outputDir = path.resolve('public', 'clients', slug, 'pwa');
mkdirSync(outputDir, { recursive: true });

// Un SVG chico se rasteriza con densidad alta para que los 512 px salgan nítidos.
const density = 600;

for (const size of [192, 512]) {
  await sharp(source, { density }).resize(size, size).png().toFile(path.join(outputDir, `icon-${size}.png`));
}
await sharp(source, { density }).resize(180, 180).png().toFile(path.join(outputDir, 'apple-touch-icon.png'));

// Maskable: la zona segura es el círculo central del 80 %; el ícono va al 62 % sobre el color de fondo de la marca.
const maskableSize = 512;
const inner = Math.round(maskableSize * 0.62);
const glyph = await sharp(source, { density }).resize(inner, inner).png().toBuffer();
await sharp({ create: { width: maskableSize, height: maskableSize, channels: 4, background: config.brand.background } })
  .composite([{ input: glyph, gravity: 'center' }])
  .png()
  .toFile(path.join(outputDir, 'maskable-512.png'));

console.log(`Íconos PWA de "${slug}" en ${path.relative(process.cwd(), outputDir)}`);
