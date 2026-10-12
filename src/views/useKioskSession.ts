import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { activeConfig } from '../config/active';
import { enterFullscreen, exitFullscreen, isFullscreen } from '../lib/fullscreen';
import { availableModes } from '../lib/modes';
import { homePath } from '../lib/unitDetails';
import { idleElapsed, presentationSettings } from '../lib/presentation';
import { useCompareStore } from '../store/compareStore';
import { useFavoritesStore } from '../store/favoritesStore';
import { useFiltersStore } from '../store/filtersStore';
import { useKioskStore } from '../store/kioskStore';
import { useSelectionStore } from '../store/selectionStore';
import { useSunStore } from '../store/sunStore';
import { useTourStore } from '../store/tourStore';

/** Cuánto se mantiene presionado el logotipo para salir del showroom (personal de la sala, no visitantes). */
const EXIT_HOLD_MS = 2000;
/** Tiempo que se deja para que termine el vuelo de regreso a la pantalla principal antes de arrancar el recorrido. */
const RESET_SETTLE_MS = 2200;

/** Entra al showroom: interfaz grande, y pantalla completa si el navegador lo permite (se pide desde el toque que lo activa). */
export function enterShowroom(): void {
  useKioskStore.getState().enter();
  void enterFullscreen();
}

export function exitShowroom(): void {
  useKioskStore.getState().exit();
  void exitFullscreen();
}

/**
 * Deja la pantalla como la encuentra el siguiente visitante: sin unidad abierta, filtros, sol, comparación ni
 * favoritos de la persona anterior (en un kiosco no deben quedar), y en la pantalla principal.
 */
function resetSession(navigate: ReturnType<typeof useNavigate>) {
  useSelectionStore.getState().selectUnit(null);
  useSelectionStore.getState().setFocusedFloor(null);
  useFiltersStore.getState().reset();
  useFiltersStore.setState({ showAvailability: false });
  useCompareStore.getState().clear();
  useFavoritesStore.getState().clear();
  useFavoritesStore.getState().closePanel();
  useFavoritesStore.getState().dismissShared();
  useSunStore.setState({ enabled: false, afternoonMap: false });
  navigate(homePath(), { replace: true });
}

/**
 * Sesión del showroom: tras `presentation.idleSeconds` sin uso (toque, tecla o rueda) limpia lo que dejó el visitante y
 * arranca la presentación; un toque la detiene y el reposo vuelve a contar. También sale del showroom si se sale de
 * pantalla completa (Esc). Devuelve los manejadores para salir manteniendo presionado el logotipo.
 */
export function useKioskSession() {
  const kiosk = useKioskStore((state) => state.kiosk);
  const navigate = useNavigate();
  const holdTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!kiosk) return undefined;
    const { idleSeconds } = presentationSettings();
    let lastActivity = Date.now();
    const bump = () => {
      lastActivity = Date.now();
    };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    events.forEach((name) => window.addEventListener(name, bump, { passive: true }));

    const timer = window.setInterval(() => {
      const tour = useTourStore.getState();
      if (tour.active || tour.requested) {
        // Mientras corre el recorrido el reposo no cuenta: cuenta desde que alguien lo detiene.
        return;
      }
      if (!idleElapsed(lastActivity, Date.now(), idleSeconds)) return;
      lastActivity = Date.now();
      resetSession(navigate);
      // El recorrido espera a que la cámara termine de volver a la pantalla principal (el vuelo dura ~1.4 s): arrancarlo antes tomaría
      // como punto de partida una pose a medio camino.
      if (availableModes(activeConfig).tower3d) window.setTimeout(() => useTourStore.getState().request(), RESET_SETTLE_MS);
    }, 1000);

    return () => {
      events.forEach((name) => window.removeEventListener(name, bump));
      window.clearInterval(timer);
    };
  }, [kiosk, navigate]);

  // Salir de pantalla completa (Esc o el gesto del sistema) también termina el showroom, si venía en pantalla completa.
  useEffect(() => {
    if (!kiosk) return undefined;
    let wasFullscreen = isFullscreen();
    const handleChange = () => {
      if (isFullscreen()) wasFullscreen = true;
      else if (wasFullscreen) useKioskStore.getState().exit();
    };
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, [kiosk]);

  return {
    onPointerDown: () => {
      if (!kiosk) return;
      window.clearTimeout(holdTimer.current);
      holdTimer.current = window.setTimeout(exitShowroom, EXIT_HOLD_MS);
    },
    onPointerUp: () => window.clearTimeout(holdTimer.current),
    onPointerLeave: () => window.clearTimeout(holdTimer.current),
  };
}
