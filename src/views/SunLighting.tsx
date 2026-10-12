import { memo, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { Environment, Sky } from '@react-three/drei';
import { skylightStrength, solarPosition, sunlightColor, sunlightStrength, sunVector } from '../lib/solar';
import { StaticShadows } from '../engine/StaticShadows';
import { useSunStore } from '../store/sunStore';
import type { SolarConfig } from '../types';

/** Parámetros del modelo de cielo (Preetham) compartidos entre el `<Sky>` visible y el que alimenta el `<Environment>` de reflejos. */
export interface SkyParams {
  distance: number;
  turbidity: number;
  rayleigh: number;
  mieCoefficient: number;
  mieDirectionalG: number;
}

interface SunLightingProps {
  /** Sin esto el sol es fijo (`fixedDirection`) y no responde al control de hora y fecha. */
  solar: SolarConfig | undefined;
  /** A dónde apunta la luz: el centro del conjunto, a media altura. */
  target: [number, number, number];
  /** Radio que debe cubrir el frustum de la sombra: el conjunto completo más margen. */
  sceneRadius: number;
  /** Dirección (normalizada) del sol cuando el control está apagado. */
  fixedDirection: [number, number, number];
  shadowMapSize: [number, number];
  skyParams: SkyParams;
  /** Tono de la franja baja del cielo: la niebla apaga lo lejano hacia él. */
  fogColor: string;
  /** Resume lo que cambia dónde cae una sombra (edificio activo, detalle montado, piezas que proyectan): al cambiar, se recalcula. */
  shadowKey: string;
}

/** Intensidad del sol a pleno día. Ver el comentario de la luz direccional, abajo. */
const SUN_INTENSITY = 6;
/** Luz de relleno del hemisferio (cielo arriba, rebote de piso abajo) a pleno día. */
const HEMISPHERE_INTENSITY = 0.22;
const FIXED_SUN_COLOR = '#fff3e0';
/** La niebla nunca se oscurece del todo: de noche el cielo tampoco es negro puro. */
const NIGHT_FOG_FACTOR = 0.18;
/** Cuánto se espera sin cambios del sol antes de recapturar el entorno de reflejos (arrastrar el control no lo recaptura en cada paso). */
const ENVIRONMENT_DEBOUNCE_MS = 220;

/**
 * Entorno de reflejos del vidrio, capturado del cielo. Antes: `preset="city"` descargaba un HDRI de ~1.5 MB de un CDN
 * externo en cada carga (SPEC §8: <3s en 4G simulado); un env map de baja resolución generado del `<Sky>` da el mismo
 * tono de reflejo sin descargar nada. `frames={1}` captura el cubemap una vez por cambio de sus hijos, y `memo` hace que
 * sus hijos solo cambien cuando cambia el sol: sin eso, cada repintado del padre lo recapturaría.
 */
const SkyEnvironment = memo(function SkyEnvironment({ position, skyParams }: { position: [number, number, number]; skyParams: SkyParams }) {
  return (
    <Environment resolution={256} background={false} frames={1}>
      <Sky sunPosition={position} {...skyParams} />
    </Environment>
  );
});

/**
 * Sol y cielo de la escena. Con el control de asoleamiento apagado reproduce el sol fijo de siempre; encendido,
 * la dirección sale de la posición solar real (fecha y hora local del desarrollo) y la luz cambia con la altura del
 * sol: más dorada y suave al amanecer y al atardecer, sin sol directo de noche. Vive en su propio componente para
 * que mover la hora vuelva a pintar solo esto y no toda la escena.
 */
function SunLightingComponent({ solar, target, sceneRadius, fixedDirection, shadowMapSize, skyParams, fogColor, shadowKey }: SunLightingProps) {
  const enabled = useSunStore((state) => state.enabled) && solar !== undefined;
  const date = useSunStore((state) => state.date);
  const hour = useSunStore((state) => state.hour);

  // El sol apunta al centro del conjunto (a media altura), no al origen del mundo — si no, el frustum de su shadow
  // camera queda descentrado y desperdicia resolución de sombra. `target` va como prop del propio
  // `<directionalLight>` (R3F la asigna igual que cualquier otra prop, de forma síncrona y en cada commit) —
  // asignarla a mano con un `ref` + `useEffect` aparte dependía del orden exacto en que se monta el ref frente al
  // efecto y se perdía en cuanto había un remount (HMR, StrictMode): `light.target` se quedaba apuntando al
  // Object3D por default de three.js, en el origen, y la sombra dejaba de proyectarse donde debía.
  const sunTarget = useMemo(() => new THREE.Object3D(), []);
  const sunDistance = sceneRadius * 4;

  const sun = useMemo(() => {
    if (enabled && solar) {
      const position = solarPosition(solar, date, hour);
      return { direction: sunVector(position, solar.northAngleDeg), elevationDeg: position.elevationDeg };
    }
    return { direction: fixedDirection, elevationDeg: null };
  }, [enabled, solar, date, hour, fixedDirection]);

  const sunPosition = useMemo<[number, number, number]>(
    () => [target[0] + sun.direction[0] * sunDistance, target[1] + sun.direction[1] * sunDistance, target[2] + sun.direction[2] * sunDistance],
    [target, sun, sunDistance],
  );
  // El cielo solo necesita la dirección del sol (su shader la normaliza), medida desde el origen y no desde el conjunto.
  const skySunPosition = useMemo<[number, number, number]>(
    () => [sun.direction[0] * sunDistance, sun.direction[1] * sunDistance, sun.direction[2] * sunDistance],
    [sun, sunDistance],
  );

  // Cuánta luz queda: 1 con el sol alto (o con el sol fijo), menos al amanecer y al atardecer, ~0 de noche.
  const direct = sun.elevationDeg === null ? 1 : sunlightStrength(sun.elevationDeg);
  const ambient = sun.elevationDeg === null ? 1 : skylightStrength(sun.elevationDeg);
  const sunColor = sun.elevationDeg === null ? FIXED_SUN_COLOR : sunlightColor(sun.elevationDeg);
  const fog = useMemo(() => {
    const color = new THREE.Color(fogColor);
    // La niebla sigue la luz del cielo: de noche no debe quedar un horizonte claro sobre un cielo oscuro.
    color.multiplyScalar(NIGHT_FOG_FACTOR + (1 - NIGHT_FOG_FACTOR) * ((ambient - 0.16) / 0.84));
    return `#${color.getHexString()}`;
  }, [fogColor, ambient]);

  // El entorno de reflejos del vidrio se captura del cielo, y capturarlo cuesta (seis caras y su filtrado): se espera a
  // que el sol deje de moverse.
  const [environmentPosition, setEnvironmentPosition] = useState(skySunPosition);
  useEffect(() => {
    const timer = window.setTimeout(() => setEnvironmentPosition(skySunPosition), ENVIRONMENT_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [skySunPosition]);

  return (
    <>
      {/* Niebla ligera a la distancia (solo se nota cerca del horizonte, no sobre la torre): da profundidad sin
          necesitar postprocesado. */}
      <fog attach="fog" args={[fog, sunDistance * 0.45, sunDistance * 1.4]} />
      <Sky sunPosition={skySunPosition} {...skyParams} />

      {/* Hemisferio (cielo arriba, rebote de piso abajo) en vez de ambiental plano: así la sombra del sol tiene con qué
          contrastar sin que la escena se vea gris. Bajado de 0.35 a 0.22: con más luz de relleno ambiental, la zona en
          sombra casi no se distinguía de la iluminada — la sombra del sol necesita algo de contraste para leerse. */}
      <hemisphereLight color="#bcd4f2" groundColor="#9c9384" intensity={HEMISPHERE_INTENSITY * ambient} />
      <directionalLight
        position={sunPosition}
        target={sunTarget}
        // Subida de 1.4 a 6, junto con `TONE_MAPPING_EXPOSURE` bajado para compensar: la sombra solo resta la
        // contribución DIRECCIONAL, nunca la ambiental (el `Environment` entero actuando como luz), y con una
        // intensidad "razonable" en papel (1.4–1.6) esa resta apenas se notaba contra tanto relleno ambiental — ACES
        // además comprime más las diferencias chicas que las grandes, así que hacía falta una diferencia de partida
        // bastante más grande de lo que parece razonable a simple vista para que sobreviva la curva y se lea "dura".
        intensity={SUN_INTENSITY * direct}
        color={sunColor}
        castShadow
        shadow-mapSize={shadowMapSize}
        // `radius` bajado de 4 a 1: el pedido es sombra DURA y bien definida, no un desenfoque suave. `normalBias` bajado
        // de 0.4 a 0.05: 0.4 empujaba la muestra ~40cm a lo largo de la normal, mucho para geometría delgada (mullions,
        // cantos de losa, vidrio) — "peter-panning", que desprendía la sombra de su objeto. El frustum de la shadow
        // camera se acota cerca de la escena real (±1.2×): con casi toda esa distancia vacía, la precisión de
        // profundidad se repartía donde no hacía falta.
        shadow-radius={1}
        shadow-bias={-0.0006}
        shadow-normalBias={0.05}
        shadow-camera-left={-sceneRadius}
        shadow-camera-right={sceneRadius}
        shadow-camera-top={sceneRadius}
        shadow-camera-bottom={-sceneRadius}
        shadow-camera-near={sunDistance - sceneRadius * 1.2}
        shadow-camera-far={sunDistance + sceneRadius * 1.2}
      />
      <primitive object={sunTarget} position={target} />
      {/* El mapa de sombras se reutiliza entre cuadros; se recalcula al moverse el sol o al cambiar `shadowKey`. */}
      <StaticShadows refreshKey={`${shadowKey}|${sunPosition.join(',')}|${shadowMapSize.join('x')}`} />

      <SkyEnvironment position={environmentPosition} skyParams={skyParams} />
    </>
  );
}

export const SunLighting = memo(SunLightingComponent);
