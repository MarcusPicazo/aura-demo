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
