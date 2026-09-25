import { memo, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Edges, Outlines } from '@react-three/drei';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { buildTowerLayout, deriveRegularUnitCode, insetRectilinearPolygon, polygonToShape } from '../lib/geometry';
import { unitMatchesFilters, type UnitFilters } from '../lib/filters';
import { FacadeMullions } from './FacadeMullions';
import { Balconies } from './Balconies';
import { Lobby } from './Lobby';
import { Roof } from './Roof';
import { createConcreteTexture } from './textures';
import type { DevelopmentConfig, MaterialsConfig, PenthousePlateUnit, PlateUnit, Unit, UnitStatus } from '../types';

const STATUSES: UnitStatus[] = ['available', 'reserved', 'sold'];

/** Cómo se ve una unidad, de menor a mayor énfasis: filtrada (no coincide con los
 *  filtros activos) < nada < su piso en hover < ella en hover < seleccionada. */
type InteractionState = 'filtered' | 'none' | 'floor' | 'unit' | 'selected';
const INTERACTION_STATES: InteractionState[] = ['filtered', 'none', 'floor', 'unit', 'selected'];
// Subidos respecto a la primera versión: con opacidad 0.55 en reposo, dos caras de vidrio
// una detrás de otra dejaban ver de lado a lado y la torre se leía hueca. Es convención
// genérica del selector (como STATUS_COLORS en lib/status.ts), no dato de marca — por eso
// vive aquí y no en la config del cliente.
const INTERACTION_OPACITY: Record<InteractionState, number> = {
  filtered: 0.08,
  none: 0.74,
  floor: 0.85,
  unit: 0.92,
  selected: 0.94,
};
const INTERACTION_EMISSIVE: Record<InteractionState, number> = {
  filtered: 0,
  none: 0,
  floor: 0.12,
  unit: 0.3,
  selected: 0.55,
};

/**
 * Vidrio de las unidades: MeshPhysicalMaterial sin `transmission` (refracción real).
 * `transmission` obliga a three.js a redibujar el fondo en una textura por frame, lo
 * cual es caro en celulares de gama media con ~46 unidades semitransparentes en pantalla.
 * Con reflectividad + clearcoat + el HDRI del entorno alcanza un look de vidrio creíble
 * a una fracción del costo. Hover y selección solo suben opacidad y emisivo, así que
 * siguen leyéndose como vidrio. `baseColor` es lo único que cambia entre el vidrio neutro
 * del edificio real y el tinte por estado — todo lo demás (opacidad, reflectividad) es
 * el mismo look de vidrio en los dos modos.
 *
 * `side: THREE.FrontSide` (antes `DoubleSide`): con las dos caras activas se veía la cara
 * trasera de la misma caja a través de la delantera —la fachada opuesta de la unidad,
 * invertida— que es justo lo que hacía leer la torre como hueca. Con un solo lado, más el
 * forro interior opaco detrás (ver `buildInteriorMaterial`), la vista se detiene ahí.
 *
 * `depthWrite: false`: un material transparente que sí escribe en el depth buffer puede
 * tapar (no solo atenuar) lo que tiene detrás a corta distancia — el forro interior, los
 * mullions, las líneas de `Edges` — porque a esa escala la diferencia de profundidad entre
 * el vidrio y esa geometría (unos centímetros) cae dentro del margen de error del depth
 * buffer y el z-fighting resultante ya no es un parpadeo de un píxel: ocupa la mitad de la
 * pantalla. Sin escritura de profundidad, el vidrio se sigue dibujando encima por orden
 * (three.js ordena la transparencia de atrás hacia adelante), pero deja de competir por el
 * mismo píxel del depth buffer con lo que tiene inmediatamente detrás.
 */
function createGlassMaterial(
  baseColor: string,
  reflectivity: number,
  opacity: number,
  emissiveIntensity: number,
): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: baseColor,
    emissive: baseColor,
    emissiveIntensity,
    transparent: true,
    opacity,
    roughness: 0.1,
    metalness: 0,
    clearcoat: 0.4,
    clearcoatRoughness: 0.15,
    envMapIntensity: reflectivity,
    side: THREE.FrontSide,
    depthWrite: false,
  });
}

function buildGlassVariants(baseColor: string, reflectivity: number): Record<InteractionState, THREE.MeshPhysicalMaterial> {
  const variants = {} as Record<InteractionState, THREE.MeshPhysicalMaterial>;
  for (const state of INTERACTION_STATES) {
    variants[state] = createGlassMaterial(baseColor, reflectivity, INTERACTION_OPACITY[state], INTERACTION_EMISSIVE[state]);
  }
  return variants;
}

/**
 * Vidrio con tinte de estado (modo "ver disponibilidad"): mismo look de vidrio que
 * `buildGlassVariants`, pero partiendo de un piso de opacidad/emisivo más alto que el
 * vidrio neutro — en reposo (antes: opacidad 0.74, emisivo 0, igual que el edificio real)
 * el color de disponible/apartado se perdía contra el reflejo del entorno. Los pisos
 * (`opacityFloor`/`emissiveFloor`) vienen de la config; los saltos entre hover/selección
 * reutilizan los mismos deltas que ya usa el vidrio neutro, así que "seleccionada" sigue
 * siendo siempre la más marcada dentro de su propio estado.
 */
function buildStatusGlassVariants(
  baseColor: string,
  reflectivity: number,
  opacityFloor: number,
  emissiveFloor: number,
): Record<InteractionState, THREE.MeshPhysicalMaterial> {
  const variants = {} as Record<InteractionState, THREE.MeshPhysicalMaterial>;
  for (const state of INTERACTION_STATES) {
    const opacity =
      state === 'filtered' ? INTERACTION_OPACITY.filtered : Math.min(0.98, opacityFloor + (INTERACTION_OPACITY[state] - INTERACTION_OPACITY.none));
    const emissiveIntensity = state === 'filtered' ? 0 : emissiveFloor + INTERACTION_EMISSIVE[state];
    variants[state] = createGlassMaterial(baseColor, reflectivity, opacity, emissiveIntensity);
  }
  return variants;
}

interface UnitMaterialSets {
  /** Vidrio neutro del edificio real (default): el mismo material sin importar el estado. */
  neutral: Record<InteractionState, THREE.MeshPhysicalMaterial>;
  /** Tinte sutil por estado; solo se usa cuando el modo "ver disponibilidad" está activo. */
  byStatus: Record<UnitStatus, Record<InteractionState, THREE.MeshPhysicalMaterial>>;
}

/**
 * Se construyen una sola vez por config (30 variantes: 5 de vidrio neutro + 3 estados × 5 de
 * interacción) y se reutilizan por referencia — cambiar de modo solo elige cuál usar, nunca
 * reconstruye materiales.
 */
function buildUnitMaterialSets(materials: MaterialsConfig): UnitMaterialSets {
  const byStatus = {} as Record<UnitStatus, Record<InteractionState, THREE.MeshPhysicalMaterial>>;
  for (const status of STATUSES) {
    // Vendida usa su propio piso, más bajo, para leerse claramente apagada frente a
    // disponible/apartado — no solo con otro color, también con menos presencia.
    const opacityFloor = status === 'sold' ? materials.soldOpacity : materials.statusOpacity;
    const emissiveFloor = status === 'sold' ? materials.soldEmissiveIntensity : materials.statusEmissiveIntensity;
    byStatus[status] = buildStatusGlassVariants(materials.statusTint[status], materials.glassReflectivity, opacityFloor, emissiveFloor);
  }
  return { neutral: buildGlassVariants(materials.glass, materials.glassReflectivity), byStatus };
}

interface StructureMaterials {
  slab: THREE.MeshStandardMaterial;
  core: THREE.MeshStandardMaterial;
  /** Compartida entre slab y core: un solo `repeat` ajusta el grano en ambas mallas. */
  concreteTexture: THREE.CanvasTexture;
}

/** Concreto de losas y núcleo: misma textura (mismo color base), cada malla con su propio
 *  material por si algún día necesitan variar aparte. Sin `color` en el material —solo
 *  `map`— para no oscurecer la textura multiplicándola contra un tono aparte. */
function buildStructureMaterials(concrete: string): StructureMaterials {
  const concreteTexture = createConcreteTexture(concrete);
  return {
    slab: new THREE.MeshStandardMaterial({ map: concreteTexture, roughness: 0.85, metalness: 0.05 }),
    core: new THREE.MeshStandardMaterial({ map: concreteTexture, roughness: 0.85, metalness: 0.05, side: THREE.DoubleSide }),
    concreteTexture,
  };
}

/** No son unidades vendibles: fuera del raycasting para no interferir con el picking. */
const noRaycast = () => null;

function geometryKey(unit: PlateUnit): string {
  if ('code' in unit) {
    return (unit as PenthousePlateUnit).code;
  }
  return unit.type;
}

function buildUnitGeometryMap(units: PlateUnit[], floorHeight: number): Map<string, THREE.ExtrudeGeometry> {
  const map = new Map<string, THREE.ExtrudeGeometry>();
  for (const unit of units) {
    const shape = polygonToShape(unit.polygon);
    map.set(geometryKey(unit), new THREE.ExtrudeGeometry(shape, { depth: floorHeight, bevelEnabled: false }));
  }
  return map;
}

/** Un forro por *tipo* de unidad (no por unidad): unidades del mismo tipo en pisos
 *  distintos comparten exactamente el mismo polígono encogido, solo cambia su Y. */
function buildInteriorGeometryMap(units: PlateUnit[], floorHeight: number, inset: number): Map<string, THREE.ExtrudeGeometry> {
  const map = new Map<string, THREE.ExtrudeGeometry>();
  for (const unit of units) {
    const shape = polygonToShape(insetRectilinearPolygon(unit.polygon, inset));
    map.set(geometryKey(unit), new THREE.ExtrudeGeometry(shape, { depth: floorHeight, bevelEnabled: false }));
  }
  return map;
}

/** Opaco y mate a propósito: es lo primero que corta la vista detrás del vidrio, no debe
 *  competir con él ni con brillo ni con reflejo. */
function buildInteriorMaterial(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 });
}

/** Escribe las matrices en el buffer del InstancedMesh una sola vez (o cuando cambian) y
 *  pide un frame — mismo patrón que en Roof/Lobby/Balconies/FacadeMullions. */
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

interface InteriorLinerGroupProps {
  geometry: THREE.ExtrudeGeometry;
  matrices: THREE.Matrix4[];
  material: THREE.MeshStandardMaterial;
}

/** Un `InstancedMesh` por tipo de unidad (A/B/C/D/penthouses), no uno por unidad: el forro
 *  interior es idéntico en todos los pisos que repiten el mismo tipo. Componente aparte
 *  (no un `.map()` con el hook adentro) porque `useInstanceMatrices` no puede llamarse
 *  condicionalmente dentro de un loop. */
function InteriorLinerGroup({ geometry, matrices, material }: InteriorLinerGroupProps) {
  const ref = useInstanceMatrices(matrices);
  if (matrices.length === 0) return null;
  // Sin `rotation` en el propio InstancedMesh: combinada con matrices que solo trasladan,
  // la rotación del mesh se aplica DESPUÉS de la traslación de cada instancia (en su
  // espacio local, antes de rotar), así que "subir en Y" terminaba siendo "correrse en Z"
  // — la rotación ya viene horneada en cada matriz (ver `interiorMatricesByKey`).
  return <instancedMesh ref={ref} args={[geometry, material, matrices.length]} raycast={noRaycast} />;
}

interface HoverState {
  floor: number;
  code: string;
}

interface TowerProps {
  config: DevelopmentConfig;
  units: Unit[];
  filters: UnitFilters;
  selectedUnitCode: string | null;
  onSelectUnit: (code: string | null) => void;
  /** SPEC §4.2: piso "enfocado" al llegar desde la vista de fachada (se ve como el hover de piso). */
  focusedFloor?: number | null;
  /** Tinta las unidades por estado (verde/ámbar/gris); si es false se ve el edificio real. */
  availabilityMode: boolean;
}

/**
 * Motor genérico: extruye la torre completa a partir de `config.geometry`, colorea
 * cada unidad según su estado en `units` solo cuando `availabilityMode` está activo (si no,
 * se ve el edificio real con los materiales de `config.materials`), resalta piso/unidad al
 * hover o tap, y atenúa las que no coinciden con `filters`. No conoce nombres, colores de
 * marca ni datos de negocio propios del cliente: todo (geometría, materiales, unidades,
 * filtros, selección) llega por props.
 *
 * `memo`: es, con mucho, el componente más pesado dentro del `<Canvas>` (una malla por
 * unidad — 46 en la demo — más núcleo, losas, forro interior...). Sin esto, React lo vuelve
 * a reconciliar completo cada vez que `Selector3D` se re-renderiza por CUALQUIER motivo
 * (abrir el panel de asesor, expandir filtros), aunque ninguna de estas props haya
 * cambiado — el llamador ya memoiza `filters`/`onSelectUnit` para que esto de verdad sirva.
 */
function TowerComponent({
  config,
  units,
  filters,
  selectedUnitCode,
  onSelectUnit,
  focusedFloor = null,
  availabilityMode,
}: TowerProps) {
  const { geometry } = config;

  const layout = useMemo(() => buildTowerLayout(geometry), [geometry]);
  const unitsByCode = useMemo(() => new Map(units.map((unit) => [unit.code, unit])), [units]);

  const [hovered, setHovered] = useState<HoverState | null>(null);

  const { neutral: neutralMaterials, byStatus: statusMaterials } = useMemo(
    () => buildUnitMaterialSets(config.materials),
    [config.materials],
  );
  const structureMaterials = useMemo(() => buildStructureMaterials(config.materials.concrete), [config.materials.concrete]);
  // Repeat en metros de mundo (≈1.2 m por tile, como un tablero de cimbra), no un valor fijo:
  // así el grano se ve igual de fino sin importar cuánto mida la huella de este cliente.
  const footprintSpan = Math.max(
    layout.footprint.maxX - layout.footprint.minX,
    layout.footprint.maxZ - layout.footprint.minZ,
  );
  const concreteRepeat = Math.max(2, Math.round(footprintSpan / 1.2));
  structureMaterials.concreteTexture.repeat.set(concreteRepeat, concreteRepeat);

  const unitGeometries = useMemo(
    () => buildUnitGeometryMap(geometry.plate, geometry.floorHeight),
    [geometry.plate, geometry.floorHeight],
  );

  const penthouseGeometries = useMemo(
    () => buildUnitGeometryMap(geometry.penthousePlate, geometry.floorHeight),
    [geometry.penthousePlate, geometry.floorHeight],
  );

  // Forro interior oscuro detrás del vidrio (evita que la torre se vea hueca): una
  // geometría por tipo (encogida hacia adentro `interiorInset` m) y sus posiciones Y se
  // arman por separado — mismo polígono en cada piso que repite ese tipo, solo cambia Y.
  const interiorInset = config.materials.interiorInset;
  const interiorGeometries = useMemo(() => {
    const map = buildInteriorGeometryMap(geometry.plate, geometry.floorHeight, interiorInset);
    for (const [key, value] of buildInteriorGeometryMap(geometry.penthousePlate, geometry.floorHeight, interiorInset)) {
      map.set(key, value);
    }
    return map;
  }, [geometry.plate, geometry.penthousePlate, geometry.floorHeight, interiorInset]);
  const interiorMaterial = useMemo(
    () => buildInteriorMaterial(config.materials.interior),
    [config.materials.interior],
  );
  const interiorMatricesByKey = useMemo(() => {
    // Misma rotación que usan las unidades de vidrio ([-90°, 0, 0], para acostar la
    // extrusión), horneada en la matriz de cada instancia — no como prop del InstancedMesh.
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    const scale = new THREE.Vector3(1, 1, 1);
    const map = new Map<string, THREE.Matrix4[]>();
    for (const level of layout.levels) {
      for (const unit of level.units) {
        const key = geometryKey(unit);
        const list = map.get(key) ?? [];
        list.push(new THREE.Matrix4().compose(new THREE.Vector3(0, level.y, 0), rotation, scale));
        map.set(key, list);
      }
    }
    return map;
  }, [layout.levels]);

  const coreGeometry = useMemo(() => {
    const shape = polygonToShape(layout.core);
    return new THREE.ExtrudeGeometry(shape, { depth: layout.totalHeight, bevelEnabled: false });
  }, [layout.core, layout.totalHeight]);

  const slabGeometry = useMemo(() => {
    const { minX, maxX, minZ, maxZ } = layout.footprint;
    return new THREE.BoxGeometry(maxX - minX, layout.slabThickness, maxZ - minZ);
  }, [layout.footprint, layout.slabThickness]);

  const footprintCenterX = (layout.footprint.minX + layout.footprint.maxX) / 2;
  const footprintCenterZ = (layout.footprint.minZ + layout.footprint.maxZ) / 2;

  return (
    <group>
      {/* Planta baja: lobby de doble altura (vidrio + columnas + marquesina en voladizo). */}
      <Lobby
        footprint={layout.footprint}
        groundFloorHeight={geometry.groundFloorHeight}
        profileColor={config.materials.profile}
        lobby={config.lobby}
      />

      {/* Núcleo: una sola extrusión de la base al techo. */}
      <mesh
        geometry={coreGeometry}
        material={structureMaterials.core}
        rotation={[-Math.PI / 2, 0, 0]}
        raycast={noRaycast}
        castShadow
        receiveShadow
      >
        <Edges color={config.materials.profile} />
      </mesh>

      {/* Departamentos por nivel (plate) y penthouses (penthousePlate) en el último nivel. */}
      {layout.levels.map((level) => {
        const geometryMap = level.isPenthouse ? penthouseGeometries : unitGeometries;
        return level.units.map((unit, orderInFloor) => {
          const unitGeometry = geometryMap.get(geometryKey(unit));
          if (!unitGeometry) return null;

          const code = level.isPenthouse ? geometryKey(unit) : deriveRegularUnitCode(level.index, orderInFloor);
          const unitData = unitsByCode.get(code);
          const status = unitData?.status ?? 'available';
          // Antes de que carguen las unidades no hay nada que filtrar; no ocultar todo.
          const matchesFilters = unitData ? unitMatchesFilters(unitData, filters) : true;

          const isSelected = selectedUnitCode === code;
          const interactionState: InteractionState = isSelected
            ? 'selected'
            : hovered?.code === code
              ? 'unit'
              : !matchesFilters
                ? 'filtered'
                : hovered?.floor === level.index || focusedFloor === level.index
                  ? 'floor'
                  : 'none';

          const materialSet = availabilityMode ? statusMaterials[status] : neutralMaterials;
          // Contorno del color de estado (no solo el tinte del vidrio) para que la
          // disponibilidad se lea incluso donde el vidrio quede casi de canto.
          const edgeColor = availabilityMode ? config.materials.statusTint[status] : config.materials.profile;

          return (
            <mesh
              key={`${level.index}-${geometryKey(unit)}`}
              geometry={unitGeometry}
              material={materialSet[interactionState]}
              position={[0, level.y, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              // `castShadow` aquí también: sin él, lo único que proyectaba sombra era el
              // núcleo, las losas delgadas y los mullions — una filigrana casi invisible en
              // vez de la silueta del edificio. Un torre de vidrio real sí proyecta una
              // sombra marcada (el vidrio absorbe/refleja suficiente luz); dejarla sin
              // sombra se veía flotando, no "vidrio realista".
              castShadow
              receiveShadow
              onPointerOver={(event: ThreeEvent<PointerEvent>) => {
                event.stopPropagation();
                setHovered({ floor: level.index, code });
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={(event: ThreeEvent<PointerEvent>) => {
                event.stopPropagation();
                setHovered((current) => (current?.code === code ? null : current));
                document.body.style.cursor = 'auto';
              }}
              onClick={(event: ThreeEvent<MouseEvent>) => {
                event.stopPropagation();
                onSelectUnit(isSelected ? null : code);
              }}
            >
              <Edges color={edgeColor} />
              {/* Contorno de selección: independiente del material/modo, siempre visible.
                  Sin `screenspace`: en ese modo `thickness` son metros de mundo, no
                  píxeles, y con unidades de ~3m de piso un valor chico ya revienta el
                  contorno. El modo default sí da grosor constante en píxeles de pantalla. */}
              {isSelected && <Outlines thickness={3} color={config.brand.accent} transparent opacity={0.95} />}
            </mesh>
          );
        });
      })}

      {/* Forro interior oscuro, un InstancedMesh por tipo de unidad (no por unidad ni por
          piso): corta la vista detrás del vidrio para que la torre no se lea hueca. */}
      {[...interiorGeometries.entries()].map(([key, unitGeometry]) => (
        <InteriorLinerGroup
          key={key}
          geometry={unitGeometry}
          matrices={interiorMatricesByKey.get(key) ?? []}
          material={interiorMaterial}
        />
      ))}

      {/* Losas: una franja delgada en cada frontera de nivel. */}
      {layout.slabYs.map((y) => (
        <mesh
          key={`slab-${y}`}
          geometry={slabGeometry}
          material={structureMaterials.slab}
          position={[footprintCenterX, y, footprintCenterZ]}
          raycast={noRaycast}
          castShadow
          receiveShadow
        />
      ))}

      <FacadeMullions geometry={geometry} layout={layout} carpentry={config.carpentry} />
      <Balconies geometry={geometry} layout={layout} balcony={config.balcony} />
      <Roof footprint={layout.footprint} core={layout.core} roofY={layout.totalHeight} roof={config.roof} />
    </group>
  );
}

export const Tower = memo(TowerComponent);
