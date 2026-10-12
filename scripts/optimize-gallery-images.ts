/**
 * Optimiza las imágenes del sitio público que no son del modo render: interiores por tipo de unidad, amenidades y la imagen de
 * portada. Los JPG de cámara/render pesan 100–370 KB cada uno y se muestran a menos de la mitad de su tamaño en un celular.
 *
 * Qué hace, dentro de `public/clients/<slug>/`:
 *   interiors/**, amenities/**   .jpg/.jpeg/.png  →  .webp (ancho máximo 1280, calidad 76). El original se borra (queda en git).
 *   *.jpg de la raíz (portada/OG)  →  JPG recomprimido con mozjpeg (ancho máximo 1200). Sigue siendo JPG: WhatsApp y las redes
 *                                    arman la tarjeta de vista previa con él.
 * y cambia las rutas `.jpg` → `.webp` en `src/config/<slug>.json` para esas dos carpetas.
 *
 * Es idempotente (volver a correrlo no cambia nada) y no se conecta a nada. Los renders del modo render tienen su propio
 * script: `scripts/build-render-images.ts`.
 *
 * Uso: npx tsx scripts/optimize-gallery-images.ts <slug> [--keep]    (--keep conserva los originales)
 */
import { existsSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

// Windows no deja reescribir un archivo que sharp tiene abierto en su caché: se lee a un buffer y no se cachea.
sharp.cache(false);

const GALLERY_MAX_WIDTH = 1280;
const GALLERY_WEBP_QUALITY = 76;
const COVER_MAX_WIDTH = 1200;
const COVER_JPG_QUALITY = 78;
const SOURCE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);
const GALLERY_FOLDERS = ['interiors', 'amenities'];

const slug = process.argv[2];
const keepOriginals = process.argv.includes('--keep');
if (!slug) {
  console.error('Uso: npx tsx scripts/optimize-gallery-images.ts <slug> [--keep]');
  process.exit(1);
}

const clientDir = path.resolve('public', 'clients', slug);
if (!existsSync(clientDir)) {
  console.error(`No existe ${clientDir}`);
  process.exit(1);
}

function filesIn(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesIn(path.join(directory, entry.name)) : [path.join(directory, entry.name)],
  );
}

const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

/** Windows con antivirus o sincronización de carpetas a veces rechaza una escritura que al segundo intento sí pasa. */
function writeFileWithRetry(file: string, data: Buffer | string): void {
  for (let attempt = 1; ; attempt += 1) {
    try {
      writeFileSync(file, data);
      return;
    } catch (error) {
      if (attempt >= 5) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300 * attempt);
    }
  }
}
let before = 0;
let after = 0;

for (const folder of GALLERY_FOLDERS) {
  const directory = path.join(clientDir, folder);
  if (!existsSync(directory)) continue;
  for (const file of filesIn(directory)) {
    if (!SOURCE_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
    const output = file.replace(/\.[^.]+$/, '.webp');
    const original = statSync(file).size;
    await sharp(file).resize({ width: GALLERY_MAX_WIDTH, withoutEnlargement: true }).webp({ quality: GALLERY_WEBP_QUALITY, effort: 5 }).toFile(output);
    const optimized = statSync(output).size;
    before += original;
    after += optimized;
    console.log(`${path.relative(clientDir, file)}  ${kb(original)} → ${path.relative(clientDir, output)} ${kb(optimized)}`);
    if (!keepOriginals) unlinkSync(file);
  }
}

// Portada/OG y otras imágenes de la raíz: se queda en JPG, solo más liviana.
for (const entry of readdirSync(clientDir, { withFileTypes: true })) {
  if (!entry.isFile() || !['.jpg', '.jpeg'].includes(path.extname(entry.name).toLowerCase())) continue;
  const file = path.join(clientDir, entry.name);
  const original = statSync(file).size;
  const buffer = await sharp(readFileSync(file)).resize({ width: COVER_MAX_WIDTH, withoutEnlargement: true }).jpeg({ quality: COVER_JPG_QUALITY, mozjpeg: true }).toBuffer();
  if (buffer.length >= original) {
    console.log(`${entry.name}  ya está optimizada (${kb(original)})`);
    continue;
  }
  writeFileWithRetry(file, buffer);
  before += original;
  after += buffer.length;
  console.log(`${entry.name}  ${kb(original)} → ${kb(buffer.length)}`);
}

// Rutas del config: interiors/** y amenities/** pasan de .jpg a .webp.
const configPath = path.resolve('src', 'config', `${slug}.json`);
if (existsSync(configPath)) {
  const pattern = new RegExp(`(/clients/${slug}/(?:${GALLERY_FOLDERS.join('|')})/[^"]+)\\.(?:jpe?g|png)"`, 'g');
  const source = readFileSync(configPath, 'utf8');
  const updated = source.replace(pattern, '$1.webp"');
  if (updated !== source) {
    writeFileWithRetry(configPath, updated);
    console.log(`Config actualizado: ${path.relative(process.cwd(), configPath)}`);
  }
}

console.log(`\nTotal: ${kb(before)} → ${kb(after)}`);
