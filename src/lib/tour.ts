/**
 * Recorrido cinematográfico del modo presentación: una pista de cámara (cuadros clave con tiempo, posición, punto de
 * mira, campo de visión y plano cercano) más los rótulos y los pasos de asoleamiento que acompañan a cada tramo.
 * Todo son funciones puras sobre números (sin three.js ni React): `buildTourPlan` arma el recorrido a partir de dónde
 * está la cámara, el edificio y la unidad elegidos; `sampleTrack` dice dónde debe estar la cámara en cada instante.
 */

export type Vec3 = [number, number, number];

export interface Keyframe {
  /** Segundos desde el inicio del recorrido. */
  time: number;
  position: Vec3;
  target: Vec3;
  /** Campo de visión vertical (grados) y plano cercano de la cámara en este cuadro. */
  fov: number;
  near: number;
}

/** Qué rótulo se muestra: la interfaz decide qué texto lleva cada uno. */
export type TourCaptionId = 'intro' | 'building' | 'unit' | 'window' | 'sun' | 'outro';

export interface TourCue {
  id: TourCaptionId;
  start: number;
  end: number;
}

export interface TourPlan {
  /** Duración total, en segundos. */
  duration: number;
  keyframes: Keyframe[];
  cues: TourCue[];
  /** Tramo en que la cámara está dentro de la unidad (no se dibujan sus aristas ni proyecta sombra). */
  inside: [number, number] | null;
  /** Barrido de asoleamiento: entre `start` y `end` la hora del sol va de `fromHour` a `toHour`. */
  sun: { start: number; end: number; fromHour: number; toHour: number } | null;
}

/** Duración de referencia: los tiempos de abajo están escritos para 45 s y se escalan a la duración pedida. */
const REFERENCE_SECONDS = 45;

// ─── Interpolación ───────────────────────────────────────────────────────────────────

const smoothstep = (value: number) => {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
};

/** Hermite cúbica entre dos valores con sus velocidades (por segundo) y la duración del tramo `h`. */
function hermite(p0: number, p1: number, m0: number, m1: number, h: number, s: number): number {
  const s2 = s * s;
  const s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + s) * h * m0 + (-2 * s3 + 3 * s2) * p1 + (s3 - s2) * h * m1;
}

type VectorField = 'position' | 'target';

/** Velocidad (por segundo) de un eje de un cuadro: sale de sus vecinos, para que no haya cambios bruscos de dirección. */
function velocity(frames: readonly Keyframe[], index: number, field: VectorField, axis: number): number {
  // En los extremos la velocidad es cero: el recorrido arranca y termina quieto, sin tirón.
  if (index <= 0 || index >= frames.length - 1) return 0;
  const before = frames[index - 1];
  const after = frames[index + 1];
  return (after[field][axis] - before[field][axis]) / (after.time - before.time);
}

/**
 * Escribe en `out` dónde está la cámara en `time`, sin crear objetos (se llama en cada cuadro). Es una curva suave que
 * pasa por todos los cuadros clave; el campo de visión se mezcla con suavizado y el plano cercano cambia a la mitad del tramo.
 */
export function sampleTrackInto(out: Keyframe, keyframes: readonly Keyframe[], time: number): void {
  const first = keyframes[0];
  const last = keyframes[keyframes.length - 1];
  if (time <= first.time || time >= last.time) {
    const edge = time <= first.time ? first : last;
    out.time = edge.time;
    for (let axis = 0; axis < 3; axis += 1) {
      out.position[axis] = edge.position[axis];
      out.target[axis] = edge.target[axis];
    }
    out.fov = edge.fov;
    out.near = edge.near;
    return;
  }

  let index = 0;
  while (index < keyframes.length - 2 && time >= keyframes[index + 1].time) index += 1;
  const a = keyframes[index];
  const b = keyframes[index + 1];
  const h = b.time - a.time;
  const s = (time - a.time) / h;

  out.time = time;
  for (let axis = 0; axis < 3; axis += 1) {
    out.position[axis] = hermite(a.position[axis], b.position[axis], velocity(keyframes, index, 'position', axis), velocity(keyframes, index + 1, 'position', axis), h, s);
    out.target[axis] = hermite(a.target[axis], b.target[axis], velocity(keyframes, index, 'target', axis), velocity(keyframes, index + 1, 'target', axis), h, s);
  }
  out.fov = a.fov + (b.fov - a.fov) * smoothstep(s);
  out.near = s < 0.5 ? a.near : b.near;
}

/** Lo mismo devolviendo un cuadro nuevo (para armar el recorrido y las pruebas; en el bucle de dibujo usa `sampleTrackInto`). */
export function sampleTrack(keyframes: readonly Keyframe[], time: number): Keyframe {
  const out: Keyframe = { time, position: [0, 0, 0], target: [0, 0, 0], fov: 0, near: 0 };
  sampleTrackInto(out, keyframes, time);
  return out;
}

// ─── Armado del recorrido ────────────────────────────────────────────────────────────

export interface TourInput {
  /** Dónde está la cámara al empezar: el recorrido termina ahí. */
  home: { position: Vec3; target: Vec3 };
  /** Campo de visión de la vista exterior y de la vista dentro de la unidad. */
  exteriorFov: number;
  interiorFov: number;
  /** Plano cercano de la vista exterior y de la interior. */
  exteriorNear: number;
  interiorNear: number;
  /** Los ojos dentro de la unidad y hacia dónde miran (vector horizontal unitario); sin ella no hay tramo interior. */
  unit: { eye: Vec3; heading: [number, number] } | null;
  /** El edificio elegido: centro (x, z) y radio de su huella. */
  building: { center: [number, number]; radius: number };
  durationSeconds: number;
  /** Barrido de asoleamiento; sin esto el recorrido no lo incluye. */
  sun: { fromHour: number; toHour: number } | null;
}

function rotateAround(point: Vec3, center: [number, number], angle: number): Vec3 {
  const dx = point[0] - center[0];
  const dz = point[2] - center[1];
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [center[0] + dx * cos - dz * sin, point[1], center[1] + dx * sin + dz * cos];
}

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mix = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const TWO_PI = Math.PI * 2;

/** El giro (radianes) con que la órbita llega de `from` a `to`: el sentido que da una vuelta de al menos 50° y la más corta posible. */
function orbitSweep(from: number, to: number): number {
  const ccw = (((to - from) % TWO_PI) + TWO_PI) % TWO_PI;
  const cw = ccw - TWO_PI;
  const minimum = (50 * Math.PI) / 180;
  const candidates = [ccw, cw].filter((candidate) => Math.abs(candidate) >= minimum);
  if (candidates.length === 0) return ccw;
  return candidates.reduce((best, candidate) => (Math.abs(candidate) < Math.abs(best) ? candidate : best));
}

export function buildTourPlan(input: TourInput): TourPlan {
  const { home, building, unit } = input;
  const k = Math.max(10, input.durationSeconds) / REFERENCE_SECONDS;
  const at = (seconds: number) => seconds * k;
  const frames: Keyframe[] = [];
  const exterior = (time: number, position: Vec3, target: Vec3, near = input.exteriorNear): Keyframe => ({ time, position, target, fov: input.exteriorFov, near });
  const interior = (time: number, position: Vec3, target: Vec3): Keyframe => ({ time, position, target, fov: input.interiorFov, near: input.interiorNear });

  // ── Órbita general: alrededor del punto que mira la cámara, a su misma distancia y altura. ──
  const center: [number, number] = [home.target[0], home.target[2]];
  const startOffset = [home.position[0] - center[0], home.position[2] - center[1]];
  const orbitRadius = Math.max(building.radius * 2, Math.hypot(startOffset[0], startOffset[1]));
  const startAngle = Math.atan2(startOffset[1], startOffset[0]);
  const heading: [number, number] | null = unit ? unit.heading : null;
  // La órbita termina del lado por donde mira la unidad: de ahí se acerca a su fachada sin cruzar el edificio.
  const endAngle = heading ? Math.atan2(heading[1], heading[0]) : startAngle + Math.PI / 2;
  const sweep = orbitSweep(startAngle, endAngle);
  const orbitEnd = unit ? at(9) : at(11);
  const steps = 6;
  for (let step = 0; step <= steps; step += 1) {
    const progress = step / steps;
    const eased = smoothstep(progress);
    const angle = startAngle + sweep * eased;
    const radius = orbitRadius * (1 - 0.1 * eased);
    const height = home.position[1] * (1 + 0.1 * Math.sin(Math.PI * progress));
    frames.push(
      exterior(orbitEnd * progress, [center[0] + radius * Math.cos(angle), height, center[1] + radius * Math.sin(angle)], home.target),
    );
  }

  const cues: TourCue[] = [{ id: 'intro', start: at(0.6), end: orbitEnd - at(0.6) }];
  let inside: TourPlan['inside'] = null;
  let sunWindow: TourPlan['sun'] = null;
  let sunStart = 0;
  let sunEnd = 0;
  let lastPosition: Vec3;
  let lastTarget: Vec3;

  if (unit && heading) {
    const [hx, hz] = heading;
    const eye = unit.eye;
    // El vidrio queda a ~1.2 m delante de los ojos; la ventana es ese punto.
    const windowPoint = add(eye, [hx * 1.2, 0, hz * 1.2]);
    const approachStart = add(windowPoint, [hx * 30, 8, hz * 30]);
    const nearGlass = add(windowPoint, [hx * 5, 1, hz * 5]);

    // Acercamiento a la fachada.
    frames.push(exterior(at(16), approachStart, windowPoint));
    cues.push({ id: 'building', start: at(9.6), end: at(15.4) });

    // Entrada: se atraviesa el vidrio hasta los ojos de la unidad, y el campo de visión se abre.
    frames.push({ time: at(18.5), position: nearGlass, target: add(windowPoint, [hx * 4, 0, hz * 4]), fov: (input.exteriorFov + input.interiorFov) / 2, near: input.interiorNear });
    const lookAhead = (angle: number): Vec3 => {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return add(eye, [(hx * cos - hz * sin) * 10, 0, (hx * sin + hz * cos) * 10]);
    };
    frames.push(interior(at(21), eye, lookAhead(0)));
    cues.push({ id: 'unit', start: at(17), end: at(22.4) });

    // Vista desde la ventana: la cabeza gira despacio a un lado y al otro.
    const degrees = (value: number) => (value * Math.PI) / 180;
    frames.push(interior(at(23.5), eye, lookAhead(degrees(38))));
    frames.push(interior(at(26), eye, lookAhead(degrees(-38))));
    frames.push(interior(at(28), eye, lookAhead(0)));
    cues.push({ id: 'window', start: at(23), end: at(28) });
    inside = [at(19.4), at(29.2)];

    // Salida: la cámara vuelve a la fachada, mirando la ventana de donde salió.
    const exitPosition = add(windowPoint, [hx * 26, 5, hz * 26]);
    frames.push({ time: at(31), position: exitPosition, target: windowPoint, fov: input.exteriorFov, near: input.exteriorNear });

    // Barrido de asoleamiento: la cámara se desliza alrededor de la torre mientras el sol cruza el día.
    const swing = input.sun ? 0.42 : 0.2;
    frames.push(exterior(at(35.5), rotateAround(exitPosition, building.center, swing / 2), windowPoint));
    frames.push(exterior(at(40), rotateAround(exitPosition, building.center, swing), windowPoint));
    if (input.sun) {
      sunStart = at(31.5);
      sunEnd = at(39.5);
      cues.push({ id: 'sun', start: sunStart, end: sunEnd });
    }
    lastPosition = rotateAround(exitPosition, building.center, swing);
    lastTarget = windowPoint;
  } else {
    // Sin unidad con vista: acercamiento al edificio y barrido de asoleamiento sobre él.
    const buildingTarget: Vec3 = [building.center[0], home.target[1], building.center[1]];
    const approach = mix(frames[frames.length - 1].position, buildingTarget, 0.55);
    frames.push(exterior(at(22), approach, buildingTarget));
    cues.push({ id: 'building', start: at(11.6), end: at(21.4) });
    const orbitAround = rotateAround(approach, building.center, 0.5);
    frames.push(exterior(at(36), orbitAround, buildingTarget));
    if (input.sun) {
      sunStart = at(22.5);
      sunEnd = at(35.5);
      cues.push({ id: 'sun', start: sunStart, end: sunEnd });
    }
    lastPosition = orbitAround;
    lastTarget = buildingTarget;
  }

  if (input.sun) sunWindow = { start: sunStart, end: sunEnd, fromHour: input.sun.fromHour, toHour: input.sun.toHour };

  // ── Regreso al conjunto: sube un poco y se acomoda donde empezó. ──
  const returnStart = unit ? at(40) : at(36);
  const duration = at(45);
  const lift = Math.max(10, orbitRadius * 0.25);
  const middle = mix(lastPosition, home.position, 0.5);
  frames.push(exterior((returnStart + duration) / 2, [middle[0], middle[1] + lift, middle[2]], mix(lastTarget, home.target, 0.5)));
  frames.push(exterior(duration, home.position, home.target));
  cues.push({ id: 'outro', start: returnStart + at(1), end: duration - at(0.4) });

  return { duration, keyframes: frames, cues, inside, sun: sunWindow };
}

/** El rótulo que toca mostrar en `time` (o `null` entre rótulos). */
export function activeCue(cues: readonly TourCue[], time: number): TourCue | null {
  return cues.find((cue) => time >= cue.start && time < cue.end) ?? null;
}

/** La hora del sol en el barrido: avanza de forma pareja con un suavizado en los extremos. `null` fuera del barrido. */
export function sunHourAt(sun: TourPlan['sun'], time: number): number | null {
  if (!sun || time < sun.start || time > sun.end) return null;
  const progress = (time - sun.start) / (sun.end - sun.start);
  return sun.fromHour + (sun.toHour - sun.fromHour) * smoothstep(progress);
}
