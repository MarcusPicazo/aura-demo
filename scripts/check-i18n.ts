/**
 * Revisa que las traducciones estén completas y coherentes:
 *  1. `es.json` y `en.json` tienen exactamente las mismas claves y los mismos marcadores `{nombre}`.
 *  2. Toda clave que el código pide con `t('...')` existe (se ignoran las armadas con plantillas, que se revisan por prefijo).
 *  3. Todo texto de la config que trae una versión por idioma las trae todas las que el cliente ofrece.
 *
 * Uso: `npx tsx scripts/check-i18n.ts` (sale con código 1 si algo falla; se puede enganchar a CI).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const read = (path: string): unknown => JSON.parse(readFileSync(join(ROOT, path), 'utf8')) as unknown;

function flatten(node: unknown, prefix = ''): Map<string, string> {
  const result = new Map<string, string>();
  if (typeof node === 'string') {
    result.set(prefix, node);
  } else if (typeof node === 'object' && node !== null) {
    for (const [key, value] of Object.entries(node)) {
      for (const [path, text] of flatten(value, prefix ? `${prefix}.${key}` : key)) result.set(path, text);
    }
  }
  return result;
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort().join(',');
const baseKey = (key: string) => key.replace(/_(zero|one|two|few|many|other)$/, '');

const problems: string[] = [];
const es = flatten(read('src/i18n/locales/es.json'));
const en = flatten(read('src/i18n/locales/en.json'));

for (const key of es.keys()) if (!en.has(key)) problems.push(`Falta en en.json: ${key}`);
for (const key of en.keys()) if (!es.has(key)) problems.push(`Falta en es.json: ${key}`);
for (const [key, text] of es) {
  const other = en.get(key);
  if (other !== undefined && placeholders(text) !== placeholders(other)) {
    problems.push(`Marcadores distintos en "${key}": es {${placeholders(text)}} vs en {${placeholders(other)}}`);
  }
  if (text.trim() === '') problems.push(`Texto vacío en es.json: ${key}`);
}
for (const [key, text] of en) if (text.trim() === '') problems.push(`Texto vacío en en.json: ${key}`);

// ── claves usadas en el código ──
function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return entry === 'portal' || entry === 'admin' ? [] : walk(path);
    return /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });
}

const knownBases = new Set([...es.keys()].map(baseKey));
const used = new Set<string>();
for (const file of walk(join(ROOT, 'src'))) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/\bt\(\s*'([\w.]+)'/g)) {
    used.add(match[1]);
    if (!knownBases.has(match[1])) problems.push(`${relative(ROOT, file)}: la clave "${match[1]}" no existe en es.json`);
  }
  // Claves armadas con plantilla (`compass.${…}`): debe existir al menos una clave con ese prefijo.
  for (const match of source.matchAll(/\bt\(\s*`([\w.]+)\.\$\{/g)) {
    const prefix = `${match[1]}.`;
    used.add(`${prefix}*`);
    if (![...knownBases].some((key) => key.startsWith(prefix))) problems.push(`${relative(ROOT, file)}: no hay claves con el prefijo "${prefix}"`);
  }
}
// ── textos de la config ──
interface ConfigShape {
  i18n?: { languages: string[] };
}
const config = read('src/config/aura.json') as ConfigShape;
const languages = config.i18n?.languages ?? ['es'];
function checkConfig(node: unknown, path: string) {
  if (Array.isArray(node)) node.forEach((item, index) => checkConfig(item, `${path}[${index}]`));
  else if (typeof node === 'object' && node !== null) {
    const entries = Object.entries(node);
    // Un texto localizado: un objeto cuyas claves son códigos de idioma y cuyos valores son cadenas.
    const isLocalized = entries.length > 0 && entries.every(([key, value]) => /^[a-z]{2}$/.test(key) && typeof value === 'string');
    if (isLocalized) {
      for (const language of languages) if (!(language in node)) problems.push(`Config ${path}: falta la versión "${language}"`);
    } else {
      for (const [key, value] of entries) checkConfig(value, path ? `${path}.${key}` : key);
    }
  }
}
checkConfig(config, '');

if (problems.length > 0) {
  console.error(`i18n: ${problems.length} problema(s)\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`i18n: todo bien — ${es.size} textos en es/en, ${used.size} claves usadas en el código, config completa en: ${languages.join(', ')}`);
