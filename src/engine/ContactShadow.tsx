import { memo, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { HorizontalBlurShader } from 'three/examples/jsm/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/examples/jsm/shaders/VerticalBlurShader.js';

interface ContactShadowProps {
  /** Centro de la sombra sobre el piso: [x, y, z]. */
  position: [number, number, number];
  /** Lado, en metros, del cuadrado de piso que recibe la sombra. */
  size: number;
  /** Hasta qué altura sobre el piso se ve lo que proyecta sombra, en metros. */
  far: number;
  opacity?: number;
  blur?: number;
  /** Lado en píxeles de la textura de sombra. */
  resolution?: number;
  /**
   * La sombra solo depende de la forma de lo que hay encima: se vuelve a dibujar tras un cambio de este valor y el resto del tiempo se
   * reutiliza la textura. (Antes se repintaba en cada cuadro: la escena completa otra vez más cuatro pasadas de desenfoque.)
   */
  refreshKey?: string;
}

/** Cuadros mínimos que se redibuja tras un cambio: las matrices de las instancias se ponen en un efecto, un cuadro después de montar. */
const REFRESH_FRAMES = 4;
/** Tiempo mínimo que se sigue redibujando tras un cambio, por si el detalle del edificio termina de montarse un poco después. */
const REFRESH_MS = 700;

/**
 * Sombra de contacto bajo un edificio: dibuja la escena vista desde abajo con un material de
 * profundidad, la desenfoca en dos pasadas y la pone como una textura sobre el piso. Es la misma
 * técnica de `ContactShadows` de drei, pero libera sus render targets, geometría y materiales al
 * desmontarse: el de drei los crea en un `useMemo` y no los suelta nunca, así que cada vez que
 * se entraba a un edificio quedaban dos render targets huérfanos en la GPU.
 */
function ContactShadowComponent({ position, size, far, opacity = 0.7, blur = 2, resolution = 512, refreshKey = '' }: ContactShadowProps) {
  const scene = useThree((state) => state.scene);
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const framesLeft = useRef(REFRESH_FRAMES);
  const refreshUntil = useRef(0);
  const groupRef = useRef<THREE.Group>(null);
  const shadowCamera = useRef<THREE.OrthographicCamera>(null);

  const resources = useMemo(() => {
    const renderTarget = new THREE.WebGLRenderTarget(resolution, resolution);
    const renderTargetBlur = new THREE.WebGLRenderTarget(resolution, resolution);
    renderTarget.texture.generateMipmaps = false;
    renderTargetBlur.texture.generateMipmaps = false;

    const planeGeometry = new THREE.PlaneGeometry(size, size).rotateX(Math.PI / 2);
    const blurPlane = new THREE.Mesh(planeGeometry);

    const depthMaterial = new THREE.MeshDepthMaterial();
    depthMaterial.depthTest = false;
    depthMaterial.depthWrite = false;
    depthMaterial.onBeforeCompile = (shader) => {
      shader.uniforms = { ...shader.uniforms, ucolor: { value: new THREE.Color('#000000') } };
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'uniform vec3 ucolor;\nvoid main() {')
        // Sombra oscura que se desvanece con la altura: el centro (junto al piso) queda más denso.
        .replace('vec4( vec3( 1.0 - fragCoordZ ), opacity );', 'vec4( ucolor * fragCoordZ * 2.0, ( 1.0 - fragCoordZ ) * 1.0 );');
    };

    const horizontalBlurMaterial = new THREE.ShaderMaterial({ ...HorizontalBlurShader, uniforms: THREE.UniformsUtils.clone(HorizontalBlurShader.uniforms) });
    const verticalBlurMaterial = new THREE.ShaderMaterial({ ...VerticalBlurShader, uniforms: THREE.UniformsUtils.clone(VerticalBlurShader.uniforms) });
    horizontalBlurMaterial.depthTest = false;
    verticalBlurMaterial.depthTest = false;

    return { renderTarget, renderTargetBlur, planeGeometry, blurPlane, depthMaterial, horizontalBlurMaterial, verticalBlurMaterial };
  }, [resolution, size]);

  useEffect(
    () => () => {
      resources.renderTarget.dispose();
      resources.renderTargetBlur.dispose();
      resources.planeGeometry.dispose();
      resources.depthMaterial.dispose();
      resources.horizontalBlurMaterial.dispose();
      resources.verticalBlurMaterial.dispose();
    },
    [resources],
  );

  // Se vuelve a armar (y a dibujar unos cuadros) cuando cambia la textura de destino o lo que la invalida.
  useEffect(() => {
    framesLeft.current = REFRESH_FRAMES;
    refreshUntil.current = performance.now() + REFRESH_MS;
    invalidate();
  }, [resources, refreshKey, invalidate]);

  useFrame(() => {
    const camera = shadowCamera.current;
    const group = groupRef.current;
    if (!camera || !group) return;
    if (framesLeft.current <= 0 && performance.now() >= refreshUntil.current) return;
    framesLeft.current = Math.max(0, framesLeft.current - 1);
    const { renderTarget, renderTargetBlur, blurPlane, depthMaterial, horizontalBlurMaterial, verticalBlurMaterial } = resources;

    const blurShadows = (amount: number) => {
      blurPlane.visible = true;
      blurPlane.material = horizontalBlurMaterial;
      horizontalBlurMaterial.uniforms.tDiffuse.value = renderTarget.texture;
      horizontalBlurMaterial.uniforms.h.value = (amount * 1) / 256;
      gl.setRenderTarget(renderTargetBlur);
      gl.render(blurPlane, camera);

      blurPlane.material = verticalBlurMaterial;
      verticalBlurMaterial.uniforms.tDiffuse.value = renderTargetBlur.texture;
      verticalBlurMaterial.uniforms.v.value = (amount * 1) / 256;
      gl.setRenderTarget(renderTarget);
      gl.render(blurPlane, camera);
      blurPlane.visible = false;
    };

    const initialBackground = scene.background;
    const initialOverrideMaterial = scene.overrideMaterial;
    group.visible = false;
    scene.background = null;
    scene.overrideMaterial = depthMaterial;
    gl.setRenderTarget(renderTarget);
    gl.render(scene, camera);
    blurShadows(blur);
    blurShadows(blur * 0.4);
    gl.setRenderTarget(null);
    group.visible = true;
    scene.overrideMaterial = initialOverrideMaterial;
    scene.background = initialBackground;
  });

  return (
    <group ref={groupRef} position={position} rotation-x={Math.PI / 2}>
      <mesh geometry={resources.planeGeometry} scale={[1, -1, 1]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshBasicMaterial transparent map={resources.renderTarget.texture} opacity={opacity} depthWrite={false} />
      </mesh>
      <orthographicCamera ref={shadowCamera} args={[-size / 2, size / 2, size / 2, -size / 2, 0, far]} />
    </group>
  );
}

export const ContactShadow = memo(ContactShadowComponent);
