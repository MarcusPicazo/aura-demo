/** Pantalla completa del navegador. Solo se puede pedir desde un gesto del usuario (un toque), por eso no se arranca sola. */
export function fullscreenSupported(): boolean {
  return typeof document !== 'undefined' && document.fullscreenEnabled === true;
}

export function isFullscreen(): boolean {
  return typeof document !== 'undefined' && document.fullscreenElement !== null;
}

export async function enterFullscreen(): Promise<boolean> {
  if (!fullscreenSupported() || isFullscreen()) return isFullscreen();
  try {
    await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    return true;
  } catch {
    // El navegador la negó (sin gesto, o un iframe sin permiso): el showroom sigue, solo que no a pantalla completa.
    return false;
  }
}

export async function exitFullscreen(): Promise<void> {
  if (!isFullscreen()) return;
  try {
    await document.exitFullscreen();
  } catch {
    // Nada que hacer: ya se salió.
  }
}
