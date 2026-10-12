/**
 * Genera las versiones responsivas de las imágenes del modo render (renders, aéreas,
 * plantas…) a partir de los originales del cliente.
 *
 * Entrada:  render-src/<slug>/<nombre>.{jpg,jpeg,png,webp,svg}
 * Salida:   public/clients/<slug>/render/<nombre>-<ancho>.webp   (para `srcset`: 800/1600/2400,
 *                                                                nunca por encima del original)
 *           public/clients/<slug>/render/<nombre>.jpg            (respaldo, tamaño máximo)
 *
 * Al terminar imprime, por imagen, el bloque `image` listo para pegar en `render` de
 * `src/config/<slug>.json` (ruta base, anchos generados y tamaño del original).
 *
 * No se conecta a nada: solo lee y escribe archivos locales. Es idempotente.
 *
 * Uso: npx tsx scripts/build-render-images.ts <slug>
 */
import { mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { variantWidths } from '../src/lib/renderWidths.ts';

const WEBP_QUALITY = 80;
const JPG_QUALITY = 82;
const SOURCE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.svg']);

const slug = process.argv[2];
if (!slug) {
  console.error('Uso: npx tsx scripts/build-render-images.ts <slug>');
  process.exit(1);
}

const sourceDir = path.resolve('render-src', slug);
const outputDir = path.resolve('public', 'clients', slug, 'render');

const sources = readdirSync(sourceDir)
  .filter((file) => SOURCE_EXTENSIONS.has(path.extname(file).toLowerCase()))
  .sort();

if (sources.length === 0) {
  console.error(`No hay imágenes en ${sourceDir}`);
  process.exit(1);
}

mkdirSync(outputDir, { recursive: true });

for (const file of sources) {
  const name = path.basename(file, path.extname(file));
  const input = path.join(sourceDir, file);
  const { width, height } = await sharp(input).metadata();
  if (!width || !height) throw new Error(`No se pudo leer el tamaño de ${file}`);

  const widths = variantWidths(width);
  for (const variantWidth of widths) {
    await sharp(input)
      .resize({ width: variantWidth })
      .webp({ quality: WEBP_QUALITY })
      .toFile(path.join(outputDir, `${name}-${variantWidth}.webp`));
  }
  await sharp(input)
    .resize({ width: widths[widths.length - 1] })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: JPG_QUALITY, mozjpeg: true })
    .toFile(path.join(outputDir, `${name}.jpg`));

  const image = { base: `/clients/${slug}/render/${name}`, widths, width, height };
  console.log(`${file}\n  ${JSON.stringify(image)}`);
}
