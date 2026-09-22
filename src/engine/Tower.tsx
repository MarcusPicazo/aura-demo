import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { Edges } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { buildTowerLayout, deriveRegularUnitCode, polygonToShape } from '../lib/geometry';
import { unitMatchesFilters, type UnitFilters } from '../lib/filters';
import { STATUS_COLORS } from '../lib/status';
import type { DevelopmentConfig, PenthousePlateUnit, PlateUnit, Unit, UnitStatus } from '../types';

const EDGE_COLOR = '#33302a';

const STATUSES: UnitStatus[] = ['available', 'reserved', 'sold'];

/** Cómo se ve una unidad, de menor a mayor énfasis: filtrada (no coincide con los
 *  filtros activos) < nada < su piso en hover < ella en hover < seleccionada. */
type InteractionState = 'filtered' | 'none' | 'floor' | 'unit' | 'selected';
const INTERACTION_STATES: InteractionState[] = ['filtered', 'none', 'floor', 'unit', 'selected'];
const INTERACTION_OPACITY: Record<InteractionState, number> = {
  filtered: 0.08,
  none: 0.55,
  floor: 0.72,
  unit: 0.88,
  selected: 0.92,
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
 * a una fracción del costo. El color base cambia por estado (verde/ámbar/gris); hover y
 * selección solo suben opacidad y emisivo, así que siguen leyéndose como vidrio.
 * Se construyen una sola vez (15 variantes fijas: 3 estados de negocio × 5 estados de
 * interacción) y se reutilizan por referencia.
 */
function buildUnitMaterials(): Record<UnitStatus, Record<InteractionState, THREE.MeshPhysicalMaterial>> {
  const materials = {} as Record<UnitStatus, Record<InteractionState, THREE.MeshPhysicalMaterial>>;
  for (const status of STATUSES) {
    const byState = {} as Record<InteractionState, THREE.MeshPhysicalMaterial>;
    for (const state of INTERACTION_STATES) {
      byState[state] = new THREE.MeshPhysicalMaterial({
        color: STATUS_COLORS[status],
        emissive: STATUS_COLORS[status],
        emissiveIntensity: INTERACTION_EMISSIVE[state],
        transparent: true,
        opacity: INTERACTION_OPACITY[state],
        roughness: 0.1,
        metalness: 0,
        clearcoat: 0.4,
        clearcoatRoughness: 0.15,
        envMapIntensity: 1.15,
        side: THREE.DoubleSide,
      });
    }
    materials[status] = byState;
  }
  return materials;
}

const unitMaterials = buildUnitMaterials();

const groundMaterial = new THREE.MeshStandardMaterial({
  color: '#bdb7a9',
  roughness: 0.75,
  metalness: 0.05,
  side: THREE.DoubleSide,
});

const slabMaterial = new THREE.MeshStandardMaterial({
  color: '#9a958c',
  roughness: 0.85,
  metalness: 0.05,
});

const coreMaterial = new THREE.MeshStandardMaterial({
  color: '#6b6862',
  roughness: 0.85,
  metalness: 0.05,
  side: THREE.DoubleSide,
});

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
}

/**
 * Motor genérico: extruye la torre completa a partir de `config.geometry`, colorea
 * cada unidad según su estado en `units`, resalta piso/unidad al hover o tap, y
 * atenúa las que no coinciden con `filters`. No conoce nombres, colores de marca ni
 * datos de negocio propios del cliente: todo (geometría, unidades, filtros, selección)
 * llega por props.
 */
export function Tower({ config, units, filters, selectedUnitCode, onSelectUnit, focusedFloor = null }: TowerProps) {
  const { geometry } = config;

  const layout = useMemo(() => buildTowerLayout(geometry), [geometry]);
  const unitsByCode = useMemo(() => new Map(units.map((unit) => [unit.code, unit])), [units]);

  const [hovered, setHovered] = useState<HoverState | null>(null);

  const unitGeometries = useMemo(
    () => buildUnitGeometryMap(geometry.plate, geometry.floorHeight),
    [geometry.plate, geometry.floorHeight],
  );

  const penthouseGeometries = useMemo(
    () => buildUnitGeometryMap(geometry.penthousePlate, geometry.floorHeight),
    [geometry.penthousePlate, geometry.floorHeight],
  );

  const coreGeometry = useMemo(() => {
    const shape = polygonToShape(layout.core);
    return new THREE.ExtrudeGeometry(shape, { depth: layout.totalHeight, bevelEnabled: false });
  }, [layout.core, layout.totalHeight]);

  const groundGeometry = useMemo(() => {
    const { minX, maxX, minZ, maxZ } = layout.footprint;
    return new THREE.BoxGeometry(maxX - minX, geometry.groundFloorHeight, maxZ - minZ);
  }, [layout.footprint, geometry.groundFloorHeight]);

  const slabGeometry = useMemo(() => {
    const { minX, maxX, minZ, maxZ } = layout.footprint;
    return new THREE.BoxGeometry(maxX - minX, layout.slabThickness, maxZ - minZ);
  }, [layout.footprint, layout.slabThickness]);

  const footprintCenterX = (layout.footprint.minX + layout.footprint.maxX) / 2;
  const footprintCenterZ = (layout.footprint.minZ + layout.footprint.maxZ) / 2;

  return (
    <group>
      {/* Planta baja: lobby y amenidades, envolvente simple sin subdividir en unidades. */}
      <mesh
        geometry={groundGeometry}
        material={groundMaterial}
        position={[footprintCenterX, geometry.groundFloorHeight / 2, footprintCenterZ]}
        raycast={noRaycast}
      >
        <Edges color={EDGE_COLOR} />
      </mesh>

      {/* Núcleo: una sola extrusión de la base al techo. */}
      <mesh
        geometry={coreGeometry}
        material={coreMaterial}
        rotation={[-Math.PI / 2, 0, 0]}
        raycast={noRaycast}
      >
        <Edges color={EDGE_COLOR} />
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

          return (
            <mesh
              key={`${level.index}-${geometryKey(unit)}`}
              geometry={unitGeometry}
              material={unitMaterials[status][interactionState]}
              position={[0, level.y, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
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
              <Edges color={EDGE_COLOR} />
            </mesh>
          );
        });
      })}

      {/* Losas: una franja delgada en cada frontera de nivel. */}
      {layout.slabYs.map((y) => (
        <mesh
          key={`slab-${y}`}
          geometry={slabGeometry}
          material={slabMaterial}
          position={[footprintCenterX, y, footprintCenterZ]}
          raycast={noRaycast}
        />
      ))}
    </group>
  );
}
