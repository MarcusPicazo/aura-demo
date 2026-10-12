/**
 * Imágenes PROVISIONALES del modo render para la demo: vista aérea y fachada posterior,
 * dibujadas a partir de la geometría del config. (Las plantas ya no se dibujan aquí: las genera
 * el motor en vivo, ver `engine/FloorPlan.tsx`.) No son renders del cliente —
 * están rotuladas "provisional" — y existen para poder probar el modo completo (zonas,
 * selector de piso, transiciones) mientras no haya renders reales. Cuando los haya, se
 * reemplazan los archivos de `render-src/<slug>/` (mismo nombre) y se vuelve a correr
 * `build-render-images.ts`; el config y las zonas no cambian si la proporción es la misma.
 *
 * Escribe:
 *   render-src/<slug>/vista-aerea.svg, fachada-posterior.svg
 *   render-src/<slug>/render.config.json   (el bloque `render` completo, para pegar en el config)
 *
 * La fachada frontal NO se dibuja: es el render real (`render-src/<slug>/fachada-frontal.jpg`)
 * y sus zonas están trazadas a mano sobre esa imagen (ver `FRONT_FACADE_BANDS`).
 *
 * Uso: npx tsx scripts/render-placeholders.ts <slug>
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { ensembleBounds, localToWorld, resolveBuildings, worldBounds, worldFootprint, type ResolvedBuilding } from '../src/lib/buildings.ts';
import { variantWidths } from '../src/lib/renderWidths.ts';
import type { DevelopmentConfig, Point, RenderHotspot, RenderImage, TowerDevelopmentConfig } from '../src/types.ts';

const slug = process.argv[2];
if (!slug) {
  console.error('Uso: npx tsx scripts/render-placeholders.ts <slug>');
  process.exit(1);
}

const configModule = await import(`../src/config/${slug}.json`, { with: { type: 'json' } });
const config = configModule.default as unknown as DevelopmentConfig;
const buildings = resolveBuildings(config);
const towers = buildings.filter((building) => building.sellable);
if (towers.length === 0 || !config.context) throw new Error('Este script dibuja desde la geometría 3D: el config debe tenerla.');
const { context } = config as TowerDevelopmentConfig;
/** La torre principal es la de la fachada del render real y la que se rodea de calle: la primera con ventas. */
const primary = towers[0];
const { geometry } = primary;

/** Id de la vista de plantas de una torre; la principal conserva `plantas` (los enlaces viejos siguen sirviendo). */
const planViewId = (building: ResolvedBuilding) => (building.id === primary.id ? 'plantas' : `plantas-${building.id}`);

const outputDir = path.resolve('render-src', slug);
const FONT = 'Arial, Helvetica, sans-serif';
const INK = '#2b2b2b';
const CONCRETE = '#d9d2c3';

// ─── Utilidades ──────────────────────────────────────────────────────────────────────

const round = (value: number) => Math.round(value * 10000) / 10000;
const toPoints = (points: Point[]) => points.map(([x, y]) => `${x},${y}`).join(' ');

function normalized(points: Point[], width: number, height: number): Point[] {
  return points.map(([x, y]) => [round(x / width), round(y / height)]);
}

function rect(x: number, y: number, width: number, height: number): Point[] {
  return [
    [x, y],
    [x + width, y],
    [x + width, y + height],
    [x, y + height],
  ];
}

function svgDocument(width: number, height: number, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n${body}\n</svg>\n`;
}

/** Rótulo de "imagen provisional": en cada archivo, para que nadie lo confunda con un render real. */
function placeholderBadge(width: number, height: number, title: string): string {
  const fontSize = Math.round(height * 0.02);
  const boxHeight = fontSize * 3.2;
  const boxWidth = Math.min(width * 0.62, fontSize * 24);
  return `<g transform="translate(${fontSize}, ${height - boxHeight - fontSize})">
  <rect width="${boxWidth}" height="${boxHeight}" rx="${fontSize * 0.5}" fill="rgba(255,255,255,0.88)"/>
  <text x="${fontSize}" y="${fontSize * 1.35}" font-family="${FONT}" font-size="${fontSize}" font-weight="700" fill="${INK}">${title}</text>
  <text x="${fontSize}" y="${fontSize * 2.5}" font-family="${FONT}" font-size="${fontSize * 0.78}" fill="#6b6862">IMAGEN PROVISIONAL — se reemplaza por el render del cliente</text>
</g>`;
}

function imageEntry(name: string, width: number, height: number, alt: string): RenderImage {
  return { base: `/clients/${slug}/render/${name}`, widths: variantWidths(width), width, height, alt };
}

// ─── Fachada frontal (render real): zonas trazadas a mano ────────────────────────────

/**
 * El render de la fachada muestra 10 niveles habitables sobre el lobby (el config tiene 12
 * pisos): se asignan de arriba abajo, el más alto es el penthouse (piso 12). Es una
 * aproximación para la demo, rotulada como imagen conceptual. Medidas en fracciones de la imagen.
 */
const FRONT_FACADE = { width: 1600, height: 2142 };
const FRONT_FACADE_X: [number, number] = [0.186, 0.818];
const FRONT_FACADE_BAND_EDGES = [0.12, 0.1825, 0.245, 0.31, 0.374, 0.438, 0.502, 0.566, 0.629, 0.6925, 0.7555];
const FRONT_FACADE_TOP_FLOOR = geometry.levels;

function frontFacadeHotspots(): RenderHotspot[] {
  const [x1, x2] = FRONT_FACADE_X;
  const gap = 0.0015;
  return FRONT_FACADE_BAND_EDGES.slice(0, -1).map((top, index) => {
    const bottom = FRONT_FACADE_BAND_EDGES[index + 1];
    const floor = FRONT_FACADE_TOP_FLOOR - index;
    return {
      id: `piso-${floor}`,
      label: `Piso ${floor}`,
      polygon: [
        [x1, round(top + gap)],
        [x2, round(top + gap)],
        [x2, round(bottom - gap)],
        [x1, round(bottom - gap)],
      ],
      target: { type: 'view', viewId: 'plantas', floor },
    };
  });
}

// ─── Vista aérea ─────────────────────────────────────────────────────────────────────

function aerial(): { svg: string; image: RenderImage; hotspots: RenderHotspot[] } {
  const width = 2400;
  const height = 1800;
  const scale = 26; // px por metro
  const ensemble = ensembleBounds(buildings);
  const centerX = (ensemble.minX + ensemble.maxX) / 2;
  const frontMargin = context.street.distanceFromTower + context.street.sidewalkWidth * 2 + context.street.width + 2;
  const topZ = ensemble.minZ - frontMargin;
  const px = ([x, z]: Point): Point => [width / 2 + (x - centerX) * scale, (z - topZ) * scale];

  // La calle corre a lo largo del borde del conjunto que da al norte (z mínima).
  const setbackY = px([0, ensemble.minZ - context.street.distanceFromTower])[1];
  const nearSidewalkTop = setbackY - context.street.sidewalkWidth * scale;
  const roadTop = nearSidewalkTop - context.street.width * scale;
  const farSidewalkTop = roadTop - context.street.sidewalkWidth * scale;
  const roadCenter = roadTop + (context.street.width * scale) / 2;
  const [ensembleLeft, ensembleTop] = px([ensemble.minX, ensemble.minZ]);
  const [ensembleRight, ensembleBottom] = px([ensemble.maxX, ensemble.maxZ]);

  const trees = Array.from({ length: Math.floor(width / (context.trees.spacing * scale)) }, (_, index) => {
    const x = (index + 0.5) * context.trees.spacing * scale;
    const y = nearSidewalkTop + (context.street.sidewalkWidth * scale) / 2;
    return `<circle cx="${x}" cy="${y}" r="${context.trees.canopyRadius * scale}" fill="${context.trees.canopyColor}" opacity="0.92"/>`;
  });

  const carWidth = context.street.carWidth * scale;
  const carLength = context.street.carLength * scale;
  const cars = Array.from({ length: Math.floor(width / (context.street.carSpacing * scale)) }, (_, index) => {
    if (index % 3 === 1) return '';
    const color = context.street.carColors[index % context.street.carColors.length];
    const x = index * context.street.carSpacing * scale + 30;
    const y = index % 2 === 0 ? roadCenter - carWidth - 10 : roadCenter + 10;
    return `<rect x="${x}" y="${y}" width="${carLength}" height="${carWidth}" rx="10" fill="${color}"/><rect x="${x + carLength * 0.62}" y="${y + 6}" width="${carLength * 0.22}" height="${carWidth - 12}" rx="4" fill="rgba(255,255,255,0.35)"/>`;
  });

  // Cada edificio con su posición y giro reales, no recostado en una esquina.
  const roofs = buildings.flatMap((building) => {
    const polygons = [...building.geometry.plate.map((unit) => unit.polygon), building.geometry.core];
    const fill = building.sellable ? CONCRETE : '#e8dfc9';
    return polygons.map((polygon, index) => {
      const points = toPoints(polygon.map((point) => px(localToWorld(building, point))));
      const isCore = index === polygons.length - 1;
      return `<polygon points="${points}" fill="${isCore ? '#bfb6a5' : fill}" stroke="#3b2a1e" stroke-width="3"/>`;
    });
  });
  const shadows = buildings.map((building) => {
    const footprint = worldFootprint(building).map((point) => px(point));
    return `<polygon points="${toPoints(footprint.map(([x, y]): Point => [x + 34, y + 26]))}" fill="rgba(0,0,0,0.2)"/>`;
  });

  const neighbors = [
    rect(40, ensembleTop - 40, Math.max(120, ensembleLeft - 200), 360),
    rect(40, ensembleTop + 380, Math.max(120, ensembleLeft - 200), 300),
    rect(ensembleRight + 160, ensembleTop - 20, Math.max(120, width - ensembleRight - 200), 340),
    rect(ensembleRight + 160, ensembleTop + 360, Math.max(120, width - ensembleRight - 200), 320),
    rect(ensembleLeft - 20, ensembleBottom + 110, ensembleRight - ensembleLeft + 40, Math.max(90, height - ensembleBottom - 150)),
  ].map(
    (block) =>
      `<polygon points="${toPoints(block.map(([x, y]): Point => [x + 12, y + 12]))}" fill="rgba(0,0,0,0.12)"/><polygon points="${toPoints(block)}" fill="#bdb6a8" stroke="#8f887b" stroke-width="3"/>`,
  );

  const body = `
<rect width="${width}" height="${height}" fill="#e6e0d3"/>
${neighbors.join('\n')}
<rect x="0" y="${farSidewalkTop}" width="${width}" height="${context.street.sidewalkWidth * scale}" fill="${context.street.sidewalkColor}"/>
<rect x="0" y="${roadTop}" width="${width}" height="${context.street.width * scale}" fill="${context.street.asphaltColor}"/>
<line x1="0" y1="${roadCenter}" x2="${width}" y2="${roadCenter}" stroke="${context.street.lineColor}" stroke-width="5" stroke-dasharray="50 34"/>
<rect x="0" y="${nearSidewalkTop}" width="${width}" height="${context.street.sidewalkWidth * scale}" fill="${context.street.sidewalkColor}"/>
${cars.join('\n')}
${shadows.join('\n')}
${roofs.join('\n')}
${trees.join('\n')}
<g font-family="${FONT}" font-size="40" font-weight="700" fill="${INK}" text-anchor="middle">
  <circle cx="${width - 130}" cy="130" r="60" fill="rgba(255,255,255,0.85)"/>
  <polygon points="${width - 130},82 ${width - 112},140 ${width - 148},140" fill="${INK}"/>
  <text x="${width - 130}" y="178">N</text>
</g>
${placeholderBadge(width, height, 'VISTA AÉREA DEL CONJUNTO')}`;

  // Las fachadas frontal y posterior de la demo son las de la torre principal; el cuerpo de cada torre abre sus plantas.
  const primaryBounds = worldBounds(primary);
  const [primaryLeft, primaryTop] = px([primaryBounds.minX, primaryBounds.minZ]);
  const [primaryRight, primaryBottom] = px([primaryBounds.maxX, primaryBounds.maxZ]);
  const hotspots: RenderHotspot[] = [
    {
      id: 'fachada-frontal',
      label: 'Fachada frontal',
      polygon: normalized(rect(primaryLeft, setbackY - 14, primaryRight - primaryLeft, primaryTop - setbackY + 12), width, height),
      target: { type: 'view', viewId: 'fachada-frontal' },
    },
    ...towers.map(
      (tower): RenderHotspot => ({
        id: `torre-${tower.id}`,
        label: tower.name,
        polygon: normalized(worldFootprint(tower).map((point) => px(point)), width, height),
        target: { type: 'view', viewId: planViewId(tower) },
      }),
    ),
    {
      id: 'fachada-posterior',
      label: 'Fachada posterior',
      polygon: normalized(rect(primaryLeft, primaryBottom + 2, primaryRight - primaryLeft, 84), width, height),
      target: { type: 'view', viewId: 'fachada-posterior' },
    },
  ];

  return {
    svg: svgDocument(width, height, body),
    image: imageEntry('vista-aerea', width, height, `Vista aérea de ${config.name} (imagen provisional)`),
    hotspots,
  };
}

// ─── Fachada posterior ───────────────────────────────────────────────────────────────

function rearFacade(): { svg: string; image: RenderImage; hotspots: RenderHotspot[] } {
  const width = 2400;
  const height = 3200;
  const scale = 55; // px por metro
  const plateWidth = Math.max(...geometry.plate.flatMap((unit) => unit.polygon.map(([x]) => x)));
  const buildingWidth = plateWidth * scale;
  const left = (width - buildingWidth) / 2;
  const groundY = height - 240;
  const groundFloorHeight = geometry.groundFloorHeight * scale;
  const floorHeight = geometry.floorHeight * scale;
  const topY = groundY - groundFloorHeight - geometry.levels * floorHeight;
  const floorTop = (floor: number) => groundY - groundFloorHeight - floor * floorHeight;

  const mullionSpacing = config.carpentry!.spacing * scale;
  const floorBands: string[] = [];
  const hotspots: RenderHotspot[] = [];
  for (let floor = 1; floor <= geometry.levels; floor += 1) {
    const top = floorTop(floor);
    const slab = geometry.slabThickness * scale;
    floorBands.push(
      `<rect x="${left}" y="${top}" width="${buildingWidth}" height="${floorHeight}" fill="#c9d6dc"/>`,
      `<rect x="${left - 26}" y="${top + floorHeight - slab}" width="${buildingWidth + 52}" height="${slab}" fill="${CONCRETE}"/>`,
    );
    for (let x = left; x <= left + buildingWidth; x += mullionSpacing) {
      floorBands.push(`<rect x="${x - 3}" y="${top}" width="6" height="${floorHeight - slab}" fill="#3b2a1e" opacity="0.8"/>`);
    }
    hotspots.push({
      id: `piso-${floor}`,
      label: `Piso ${floor}`,
      polygon: normalized(rect(left, top + 3, buildingWidth, floorHeight - 6), width, height),
      target: { type: 'view', viewId: 'plantas', floor },
    });
  }

  const body = `
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9d0e6"/><stop offset="1" stop-color="#ecdcc4"/></linearGradient></defs>
<rect width="${width}" height="${height}" fill="url(#sky)"/>
<rect x="0" y="${groundY}" width="${width}" height="${height - groundY}" fill="${context.ground.color}"/>
<rect x="${left}" y="${topY}" width="${buildingWidth}" height="${groundY - topY}" fill="#8f9aa0"/>
${floorBands.join('\n')}
<rect x="${left - 26}" y="${topY - 40}" width="${buildingWidth + 52}" height="40" fill="${CONCRETE}"/>
<rect x="${left}" y="${groundY - groundFloorHeight}" width="${buildingWidth}" height="${groundFloorHeight}" fill="#4a5258"/>
${Array.from({ length: 5 }, (_, i) => `<rect x="${left + 40 + i * ((buildingWidth - 100) / 4)}" y="${groundY - groundFloorHeight}" width="26" height="${groundFloorHeight}" fill="${CONCRETE}"/>`).join('\n')}
<rect x="${left + buildingWidth * 0.38}" y="${groundY - groundFloorHeight * 0.62}" width="${buildingWidth * 0.24}" height="${groundFloorHeight * 0.62}" fill="#2f353a"/>
${placeholderBadge(width, height, 'FACHADA POSTERIOR')}`;

  return {
    svg: svgDocument(width, height, body),
    image: imageEntry('fachada-posterior', width, height, `Fachada posterior de ${config.name} (imagen provisional)`),
    hotspots,
  };
}

// ─── Armado ──────────────────────────────────────────────────────────────────────────

const aerialView = aerial();
const rearView = rearFacade();

writeFileSync(path.join(outputDir, 'vista-aerea.svg'), aerialView.svg);
writeFileSync(path.join(outputDir, 'fachada-posterior.svg'), rearView.svg);

const render = {
  defaultViewId: 'fachada-frontal',
  views: [
    { id: 'aerea', label: 'Aérea', kind: 'aerial', image: aerialView.image, hotspots: aerialView.hotspots },
    {
      id: 'fachada-frontal',
      label: 'Frontal',
      kind: 'facade',
      image: imageEntry('fachada-frontal', FRONT_FACADE.width, FRONT_FACADE.height, `Fachada frontal de ${config.name} (imagen conceptual)`),
      hotspots: frontFacadeHotspots(),
    },
    { id: 'fachada-posterior', label: 'Posterior', kind: 'facade', image: rearView.image, hotspots: rearView.hotspots },
    // Las plantas las dibuja el motor desde la geometría (engine/FloorPlan): no hay imágenes que generar.
    // En un conjunto, una vista por torre (cada una con sus pisos y unidades).
    ...towers.map((tower) => ({
      id: planViewId(tower),
      label: towers.length > 1 ? `Plantas ${tower.name.replace(/^Torre /, '')}` : 'Plantas',
      kind: 'generatedPlan',
      ...(towers.length > 1 ? { buildingId: tower.id } : {}),
    })),
  ],
};

writeFileSync(path.join(outputDir, 'render.config.json'), `${JSON.stringify(render, null, 2)}\n`);
console.log(`Listo: 2 SVG y render.config.json en ${outputDir}`);
