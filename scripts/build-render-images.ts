/**
 * Genera las versiones responsivas de las imágenes del modo render (renders, aéreas,
 * plantas…) a partir de los originales del cliente.
 *
 * Modo normal — uso: npx tsx scripts/build-render-images.ts <slug>
 *   Entrada:  render-src/<slug>/<nombre>.{jpg,jpeg,png,webp,svg}
 *   Salida:   public/clients/<slug>/render/<nombre>-<ancho>.webp   (para `srcset`: 800/1600/2400,
 *                                                                  nunca por encima del original)
 *             public/clients/<slug>/render/<nombre>.jpg            (respaldo, tamaño máximo)
 *
 * Modo en sitio — uso: npx tsx scripts/build-render-images.ts <slug> --in-place <ruta>
 *   Para una imagen que ya está dentro de `public/clients/<slug>/` (por ejemplo `views/aerial.jpg`, ya comprimida a su
 *   tamaño final): genera solo las variantes `<nombre>-<ancho>.webp` junto a ella, con el ancho de la propia imagen como
 *   la variante más grande, y deja el JPG como respaldo tal cual (no lo reescribe).
 *
 * Al terminar imprime, por imagen, el bloque `image` listo para pegar en `render` de
 * `src/config/<slug>.json` (ruta base, anchos generados y tamaño del original).
 *
 * No se conecta a nada: solo lee y escribe archivos locales. Es idempotente.
 */
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { variantWidths } from '../src/lib/renderWidths.ts';

const WEBP_QUALITY = 80;
const JPG_QUALITY = 82;
const SOURCE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.svg']);

// Windows no deja reescribir un archivo que sharp tiene abierto en su caché: se leen a un buffer y no se cachea.
sharp.cache(false);

const args = process.argv.slice(2);
const slug = args[0];
const inPlaceIndex = args.indexOf('--in-place');
const inPlaceTarget = inPlaceIndex >= 0 ? args[inPlaceIndex + 1] : undefined;
if (!slug || slug.startsWith('--') || (inPlaceIndex >= 0 && !inPlaceTarget)) {
  console.error('Uso: npx tsx scripts/build-render-images.ts <slug> [--in-place <ruta dentro de public/clients/<slug>>]');
  process.exit(1);
}

async function writeVariants(input: string, outputDir: string, publicBase: string, widths: number[], originalWidth: number, originalHeight: number) {
  const name = path.basename(input, path.extname(input));
  const buffer = readFileSync(input);
  for (const variantWidth of widths) {
    await sharp(buffer)
      .resize({ width: variantWidth })
      .webp({ quality: WEBP_QUALITY })
      .toFile(path.join(outputDir, `${name}-${variantWidth}.webp`));
  }
  return { name, buffer, image: { base: `${publicBase}/${name}`, widths, width: originalWidth, height: originalHeight } };
}

if (inPlaceTarget) {
  const input = path.resolve('public', 'clients', slug, inPlaceTarget);
  const outputDir = path.dirname(input);
  const buffer = readFileSync(input);
  const { width, height } = await sharp(buffer).metadata();
  if (!width || !height) throw new Error(`No se pudo leer el tamaño de ${inPlaceTarget}`);

  // Las variantes estándar que caben y, además, el ancho completo de la imagen (si no es ya uno de ellos).
  const standard = variantWidths(width);
  const widths = standard[standard.length - 1] === width ? standard : [...standard, width];
  const publicBase = `/clients/${slug}/${path.dirname(inPlaceTarget).split(path.sep).join('/')}`;
  const { image } = await writeVariants(input, outputDir, publicBase, widths, width, height);
  console.log(`${inPlaceTarget}\n  ${JSON.stringify(image)}`);
} else {
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
    const input = path.join(sourceDir, file);
    const { width, height } = await sharp(readFileSync(input)).metadata();
    if (!width || !height) throw new Error(`No se pudo leer el tamaño de ${file}`);

    const widths = variantWidths(width);
    const { name, buffer, image } = await writeVariants(input, outputDir, `/clients/${slug}/render`, widths, width, height);
    await sharp(buffer)
      .resize({ width: widths[widths.length - 1] })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: JPG_QUALITY, mozjpeg: true })
      .toFile(path.join(outputDir, `${name}.jpg`));

    console.log(`${file}\n  ${JSON.stringify(image)}`);
  }
}
