import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { sideAxisFrom, type PolygonBounds } from '../lib/geometry';
import type { StreetConfig } from '../types';

const CURB_WIDTH = 0.15;
const DASH_LENGTH = 1.5;
const DASH_GAP = 1.5;
const DASH_WIDTH = 0.12;
const CAR_GAP_FROM_CURB = 0.35;

/** Proporciones del "auto de dos volúmenes" (chasis + cabina), como fracción de las medidas
 *  de `street.car*` de la config — nunca metros fijos, así cualquier tamaño de auto de
 *  cliente futuro sigue viéndose proporcionado. Una sola caja lisa se leía como una caja;
 *  un chasis bajo con una cabina más angosta encima ya se lee como auto de un vistazo. */
const CAR_CHASSIS_HEIGHT_FACTOR = 0.55;
const CAR_CABIN_HEIGHT_FACTOR = 0.55;
const CAR_CABIN_LENGTH_FACTOR = 0.55;
const CAR_CABIN_WIDTH_FACTOR = 0.86;
/** Hacia atrás del centro (cofre más largo que la cajuela, como en un auto real). */
const CAR_CABIN_SETBACK_FACTOR = 0.08;
const CAR_WHEEL_RADIUS_FACTOR = 0.26;
const CAR_WHEEL_WIDTH_FACTOR = 0.16;
const CAR_WHEEL_LONG_OFFSET_FACTOR = 0.32;
const CAR_WHEEL_COLOR = '#1a1a1a';

const Y_AXIS = new THREE.Vector3(0, 1, 0);

/** Piso/coches/línea, no interactivos: fuera del raycasting. */
const noRaycast = () => null;

interface StreetProps {
  footprint: PolygonBounds;
  street: StreetConfig;
}

/** Escribe las matrices en el buffer del InstancedMesh una sola vez (o cuando cambian) y pide un frame. */
function useInstanceMatrices(matrices: THREE.Matrix4[]) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    invalidate();
  }, [matrices, invalidate]);
  return ref;
}

/**
 * Calle a lo largo de un lado de la huella de la torre: banqueta con guarnición, arroyo de
 * asfalto con línea central punteada, banqueta/guarnición espejo del otro lado, y coches
 * estacionados junto a la guarnición cercana. Todo en coordenadas locales (u = a lo largo
 * de la calle, v = hacia afuera de la torre) convertidas a mundo según `street.side`.
 */
export function Street({ footprint, street }: StreetProps) {
  const span = Math.max(footprint.maxX - footprint.minX, footprint.maxZ - footprint.minZ);
  const streetLength = span * 5;

  const { toWorld: toWorldRaw, rotationY } = useMemo(() => sideAxisFrom(footprint, street.side), [footprint, street.side]);
  const toWorld = (u: number, v: number): [number, number] => toWorldRaw(u, street.distanceFromTower + v);

  // v acumulada desde el pie de la torre hacia afuera: banqueta, guarnición, arroyo, guarnición, banqueta.
  const vSidewalkNear = street.sidewalkWidth / 2;
  const vCurbNear = street.sidewalkWidth + CURB_WIDTH / 2;
  const vAsphalt = street.sidewalkWidth + CURB_WIDTH + street.width / 2;
  const vCurbFar = street.sidewalkWidth + CURB_WIDTH + street.width + CURB_WIDTH / 2;
  const vSidewalkFar = street.sidewalkWidth + CURB_WIDTH + street.width + CURB_WIDTH + street.sidewalkWidth / 2;

  const sidewalkGeometry = useMemo(
    () => new THREE.BoxGeometry(streetLength, 0.1, street.sidewalkWidth),
    [streetLength, street.sidewalkWidth],
  );
  // `envMapIntensity` bajo (igual que el piso en Context.tsx): sin esto, la luz ambiental
  // del `Environment` competía con la sombra direccional del sol y la sombra proyectada
  // sobre calle/banqueta se veía casi plana.
  const sidewalkMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: street.sidewalkColor, roughness: 0.9, metalness: 0, envMapIntensity: 0.3 }),
    [street.sidewalkColor],
  );
  const curbGeometry = useMemo(
    () => new THREE.BoxGeometry(streetLength, street.curbHeight, CURB_WIDTH),
    [streetLength, street.curbHeight],
  );
  const curbMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: street.curbColor, roughness: 0.8, metalness: 0, envMapIntensity: 0.3 }),
    [street.curbColor],
  );
  const asphaltGeometry = useMemo(() => new THREE.BoxGeometry(streetLength, 0.05, street.width), [streetLength, street.width]);
  const asphaltMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: street.asphaltColor, roughness: 0.95, metalness: 0, envMapIntensity: 0.3 }),
    [street.asphaltColor],
  );

  const [sidewalkNearX, sidewalkNearZ] = toWorld(0, vSidewalkNear);
  const [curbNearX, curbNearZ] = toWorld(0, vCurbNear);
  const [asphaltX, asphaltZ] = toWorld(0, vAsphalt);
  const [curbFarX, curbFarZ] = toWorld(0, vCurbFar);
  const [sidewalkFarX, sidewalkFarZ] = toWorld(0, vSidewalkFar);

  // Línea central punteada: un InstancedMesh de segmentos cortos a lo largo del arroyo.
  const dashMatrices = useMemo(() => {
    const step = DASH_LENGTH + DASH_GAP;
    const count = Math.max(1, Math.floor(streetLength / step));
    const matrices: THREE.Matrix4[] = [];
    const quaternion = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, rotationY);
    for (let index = 0; index < count; index += 1) {
      const u = -streetLength / 2 + step * index + step / 2;
      const [x, z] = toWorld(u, vAsphalt);
      matrices.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0.06, z), quaternion, new THREE.Vector3(1, 1, 1)));
    }
    return matrices;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streetLength, rotationY, vAsphalt, toWorldRaw, street.distanceFromTower]);
  const dashGeometry = useMemo(() => new THREE.BoxGeometry(DASH_LENGTH, 0.01, DASH_WIDTH), []);
  const dashMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: street.lineColor, roughness: 0.6 }), [street.lineColor]);
  const dashRef = useInstanceMatrices(dashMatrices);

  // Coches estacionados junto a la guarnición cercana, dentro del arroyo: chasis + cabina
  // (dos cajas, no una) más 4 ruedas, para leerse como auto y no como ladrillo de color. Un
  // InstancedMesh por color de la paleta para chasis/cabina (no `vertexColors` con
  // InstancedMesh: en esta versión de three.js el tinte por instancia se ve negro — ver
  // NeighborBuildings.tsx para el mismo hallazgo); las ruedas no dependen del color de la
  // carrocería, así que van en un solo InstancedMesh compartido por todos los autos.
  const { carsByColor, wheelMatrices } = useMemo(() => {
    const count = Math.max(0, Math.floor(streetLength / street.carSpacing) - 1);
    const quaternion = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, rotationY);
    const scale = new THREE.Vector3(1, 1, 1);
    const vCar = street.sidewalkWidth + CURB_WIDTH + CAR_GAP_FROM_CURB + street.carWidth / 2;

    const chassisHeight = street.carHeight * CAR_CHASSIS_HEIGHT_FACTOR;
    const cabinHeight = street.carHeight * CAR_CABIN_HEIGHT_FACTOR;
    const cabinSetback = street.carLength * CAR_CABIN_SETBACK_FACTOR;
    const wheelRadius = street.carHeight * CAR_WHEEL_RADIUS_FACTOR;
    const wheelLongOffset = street.carLength * CAR_WHEEL_LONG_OFFSET_FACTOR;
    const wheelLatOffset = street.carWidth / 2;
    // Rueda acostada (eje transversal al auto, no vertical): se acuesta el cilindro -90°
    // sobre Z en espacio local del auto y LUEGO se orienta con la misma rotación de la
    // calle — por eso `quaternion` (el del auto) multiplica al giro local, no al revés.
    const wheelTilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
    const wheelQuaternion = quaternion.clone().multiply(wheelTilt);

    const groups = new Map<string, { chassis: THREE.Matrix4[]; cabin: THREE.Matrix4[] }>();
    const wheels: THREE.Matrix4[] = [];

    for (let index = 0; index < count; index += 1) {
      const u = -streetLength / 2 + street.carSpacing * (index + 1);
      const [x, z] = toWorld(u, vCar);
      const basePosition = new THREE.Vector3(x, 0, z);

      const chassisMatrix = new THREE.Matrix4().compose(basePosition.clone().setY(chassisHeight / 2), quaternion, scale);

      const cabinOffset = new THREE.Vector3(-cabinSetback, 0, 0).applyQuaternion(quaternion);
      const cabinPosition = basePosition.clone().add(cabinOffset).setY(chassisHeight + cabinHeight / 2);
      const cabinMatrix = new THREE.Matrix4().compose(cabinPosition, quaternion, scale);

      const color = street.carColors[index % Math.max(1, street.carColors.length)] ?? '#8B8B8B';
      const group = groups.get(color) ?? { chassis: [], cabin: [] };
      group.chassis.push(chassisMatrix);
      group.cabin.push(cabinMatrix);
      groups.set(color, group);

      for (const longSign of [-1, 1]) {
        for (const latSign of [-1, 1]) {
          const wheelOffset = new THREE.Vector3(longSign * wheelLongOffset, 0, latSign * wheelLatOffset).applyQuaternion(quaternion);
          const wheelPosition = basePosition.clone().add(wheelOffset).setY(wheelRadius);
          wheels.push(new THREE.Matrix4().compose(wheelPosition, wheelQuaternion, scale));
        }
      }
    }

    return { carsByColor: Array.from(groups.entries()), wheelMatrices: wheels };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    streetLength,
    street.carSpacing,
    street.sidewalkWidth,
    street.carWidth,
    street.carLength,
    street.carHeight,
    street.carColors,
    rotationY,
    toWorldRaw,
    street.distanceFromTower,
  ]);
  const chassisGeometry = useMemo(
    () => new THREE.BoxGeometry(street.carLength, street.carHeight * CAR_CHASSIS_HEIGHT_FACTOR, street.carWidth),
    [street.carLength, street.carHeight, street.carWidth],
  );
  const cabinGeometry = useMemo(
    () =>
      new THREE.BoxGeometry(
        street.carLength * CAR_CABIN_LENGTH_FACTOR,
        street.carHeight * CAR_CABIN_HEIGHT_FACTOR,
        street.carWidth * CAR_CABIN_WIDTH_FACTOR,
      ),
    [street.carLength, street.carHeight, street.carWidth],
  );
  const wheelGeometry = useMemo(
    () =>
      new THREE.CylinderGeometry(
        street.carHeight * CAR_WHEEL_RADIUS_FACTOR,
        street.carHeight * CAR_WHEEL_RADIUS_FACTOR,
        street.carHeight * CAR_WHEEL_WIDTH_FACTOR,
        12,
      ),
    [street.carHeight],
  );
  const wheelMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: CAR_WHEEL_COLOR, roughness: 0.7, metalness: 0.1 }), []);
  const wheelRef = useInstanceMatrices(wheelMatrices);

  return (
    <group>
      <mesh geometry={sidewalkGeometry} material={sidewalkMaterial} position={[sidewalkNearX, 0.05, sidewalkNearZ]} rotation={[0, rotationY, 0]} raycast={noRaycast} receiveShadow />
      <mesh geometry={curbGeometry} material={curbMaterial} position={[curbNearX, street.curbHeight / 2, curbNearZ]} rotation={[0, rotationY, 0]} raycast={noRaycast} castShadow receiveShadow />
      <mesh geometry={asphaltGeometry} material={asphaltMaterial} position={[asphaltX, 0.025, asphaltZ]} rotation={[0, rotationY, 0]} raycast={noRaycast} receiveShadow />
      <mesh geometry={curbGeometry} material={curbMaterial} position={[curbFarX, street.curbHeight / 2, curbFarZ]} rotation={[0, rotationY, 0]} raycast={noRaycast} castShadow receiveShadow />
      <mesh geometry={sidewalkGeometry} material={sidewalkMaterial} position={[sidewalkFarX, 0.05, sidewalkFarZ]} rotation={[0, rotationY, 0]} raycast={noRaycast} receiveShadow />

      <instancedMesh ref={dashRef} args={[dashGeometry, dashMaterial, dashMatrices.length]} raycast={noRaycast} />
      <instancedMesh ref={wheelRef} args={[wheelGeometry, wheelMaterial, wheelMatrices.length]} raycast={noRaycast} castShadow receiveShadow />
      {carsByColor.map(([color, group]) => (
        <CarGroup key={color} color={color} chassisMatrices={group.chassis} cabinMatrices={group.cabin} chassisGeometry={chassisGeometry} cabinGeometry={cabinGeometry} />
      ))}
    </group>
  );
}

interface CarGroupProps {
  color: string;
  chassisMatrices: THREE.Matrix4[];
  cabinMatrices: THREE.Matrix4[];
  chassisGeometry: THREE.BoxGeometry;
  cabinGeometry: THREE.BoxGeometry;
}

/** Chasis y cabina del mismo color de carrocería, cada uno su propio InstancedMesh (misma
 *  restricción de siempre: no se puede tintar por instancia dentro de un solo InstancedMesh). */
function CarGroup({ color, chassisMatrices, cabinMatrices, chassisGeometry, cabinGeometry }: CarGroupProps) {
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3 }), [color]);
  const chassisRef = useInstanceMatrices(chassisMatrices);
  const cabinRef = useInstanceMatrices(cabinMatrices);
  return (
    <>
      <instancedMesh ref={chassisRef} args={[chassisGeometry, material, chassisMatrices.length]} raycast={noRaycast} castShadow receiveShadow />
      <instancedMesh ref={cabinRef} args={[cabinGeometry, material, cabinMatrices.length]} raycast={noRaycast} castShadow receiveShadow />
    </>
  );
}
