import * as THREE from 'three';

/** Libera de la GPU las texturas que usa un material (mapas de color, normales, rugosidad…). */
function disposeMaterial(material: THREE.Material): void {
  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture) value.dispose();
  }
  material.dispose();
}

/**
 * Libera de la GPU todo lo que cuelga de `root`: geometrías, materiales y sus texturas. R3F
 * solo libera solo lo que él mismo creó con JSX; lo que se arma a mano (en `useMemo`) se queda
 * en la GPU hasta que alguien llama a `dispose()`. Se usa al desmontar el detalle de un edificio,
 * para que entrar y salir de varios edificios no vaya acumulando memoria de video.
 *
 * Es seguro aunque algo se comparta con otra parte de la escena: three.js vuelve a subir a la GPU,
 * en el siguiente dibujo, lo que se haya liberado y todavía se use.
 */
export function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((object) => {
    // Los buffers de matriz/color por instancia son aparte de la geometría: `InstancedMesh.dispose()` los suelta.
    if (object instanceof THREE.InstancedMesh) object.dispose();
    if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line) {
      object.geometry.dispose();
      const { material } = object;
      if (Array.isArray(material)) material.forEach(disposeMaterial);
      else disposeMaterial(material);
    }
  });
}
