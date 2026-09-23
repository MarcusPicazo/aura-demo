import * as THREE from 'three';

/**
 * Textura de una sola celda ventana+muro (se repite vía `texture.repeat` para formar la
 * cuadrícula). Genérica: colores por parámetro, nada de datos de cliente aquí. Es una
 * aproximación razonable para edificios de fondo — no se alinea ventana-por-piso exacto
 * en cada vecino (cada uno mide distinto), pero a la distancia a la que se ven no se nota.
 */
export function createWindowGridTexture(wallColor: string, windowColor: string): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = wallColor;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = windowColor;
  const marginX = size * 0.18;
  const marginY = size * 0.22;
  ctx.fillRect(marginX, marginY, size - marginX * 2, size - marginY * 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Aclara (amount > 0) u oscurece (amount < 0) un color hex, para derivar tonos de grano
 *  sin depender de un segundo color en la config. */
function shadeHex(hex: string, amount: number): string {
  const value = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (value >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((value >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (value & 0xff) + amount));
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Concreto con grano fino y vetas verticales sutiles (marcas de colado/escurrimiento).
 * Los tonos de grano se derivan del mismo `baseColor` (aclarado/oscurecido) en vez de
 * recibir un segundo color: así losas, núcleo y pretil comparten un tono de concreto sin
 * desviarse de la paleta neutra de la config.
 */
export function createConcreteTexture(baseColor: string): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);

  const light = shadeHex(baseColor, 16);
  const dark = shadeHex(baseColor, -16);

  // Grano fino: motas claras y oscuras de 1px, ruido determinista (seno de índices).
  let seed = 0;
  for (let i = 0; i < 1400; i += 1) {
    seed += 1;
    const x = (Math.sin(seed * 12.9898) * 43758.5453) % 1;
    const y = (Math.sin(seed * 78.233) * 12345.678) % 1;
    const px = (Math.abs(x) * size) | 0;
    const py = (Math.abs(y) * size) | 0;
    ctx.fillStyle = i % 2 === 0 ? light : dark;
    ctx.globalAlpha = 0.05 + (i % 3) * 0.02;
    ctx.fillRect(px, py, 1, 1);
  }

  // Vetas verticales sutiles: franjas angostas y casi transparentes, como marcas de
  // colado o escurrimiento de agua en concreto expuesto.
  ctx.fillStyle = dark;
  for (let i = 0; i < 6; i += 1) {
    seed += 1;
    const t = Math.abs((Math.sin(seed * 37.719) * 21341.221) % 1);
    const px = (t * size) | 0;
    ctx.globalAlpha = 0.04 + (i % 2) * 0.02;
    ctx.fillRect(px, 0, 1 + (i % 2), size);
  }

  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Textura de piso con manchas sutiles (ruido determinista, no una foto): rompe la
 * uniformidad de un plano de color plano sin pesar como una textura descargada.
 */
export function createGroundTexture(baseColor: string, noiseColor: string): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = noiseColor;
  // Ruido determinista (seno de índices, no Math.random): mismo resultado siempre.
  let seed = 0;
  for (let i = 0; i < 900; i += 1) {
    seed += 1;
    const x = (Math.sin(seed * 12.9898) * 43758.5453) % 1;
    const y = (Math.sin(seed * 78.233) * 12345.678) % 1;
    const px = (Math.abs(x) * size) | 0;
    const py = (Math.abs(y) * size) | 0;
    const radius = 1 + (i % 3);
    ctx.globalAlpha = 0.08 + (i % 4) * 0.03;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
