let supported: boolean | null = null;

/**
 * ¿Este navegador puede crear un contexto WebGL? Se prueba una sola vez con un lienzo desechable (que se suelta enseguida para
 * no gastar uno de los pocos contextos que permite un navegador). Sin WebGL el Canvas del selector 3D lanza una excepción al
 * montarse y la persona veía el aviso genérico de error; con esto se le da un camino (los renders) o una explicación.
 */
export function webglSupported(): boolean {
  if (supported !== null) return supported;
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    supported = context !== null;
    context?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    supported = false;
  }
  return supported;
}
