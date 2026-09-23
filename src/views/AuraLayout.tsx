import { useEffect, useState, type CSSProperties } from 'react';
import { Outlet } from 'react-router-dom';
import { fetchDevelopmentUnits, subscribeToUnitChanges } from '../lib/supabase';
import { ViewTabs } from './ViewTabs';
import { Logo } from './Logo';
import auraConfigJson from '../config/aura.json';
import type { DevelopmentConfig, Unit } from '../types';

const auraConfig = auraConfigJson as unknown as DevelopmentConfig;

export interface AuraOutletContext {
  units: Unit[];
  developmentId: string | null;
  /** Mensaje listo para mostrar en la interfaz si falló la carga inicial; null si no hubo error. */
  loadError: string | null;
}

function loadErrorMessage(error: unknown): string {
  // PostgrestError (de postgrest-js) es un objeto plano con `.message`, no una instancia
  // de Error; un fallo de red (DNS, sin conexión) sí lanza un Error real. Cubrimos los dos.
  const detail =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);
  return `No se pudieron cargar las unidades: ${detail}`;
}

/**
 * Layout compartido por las dos pestañas (Torre 3D y Fachada, SPEC §4.2): trae las
 * unidades de Supabase y mantiene la suscripción Realtime una sola vez, y las pasa a
 * la vista activa por contexto de ruta — así ninguna duplica el fetch ni la suscripción.
 */
export function AuraLayout() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [developmentId, setDevelopmentId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    fetchDevelopmentUnits(auraConfig.slug)
      .then((result) => {
        if (!cancelled) {
          setUnits(result.units);
          setDevelopmentId(result.developmentId);
        }
      })
      .catch((error: unknown) => {
        console.error('No se pudieron cargar las unidades desde Supabase:', error);
        if (!cancelled) setLoadError(loadErrorMessage(error));
      });
    return () => {
      cancelled = true;
    };
  }, [retryToken]);

  // SPEC §2 (momento 3): cambios del admin (estado, precio) llegan aquí sin recargar.
  useEffect(() => {
    if (!developmentId) return undefined;
    return subscribeToUnitChanges(developmentId, (updatedUnit) => {
      setUnits((current) => current.map((unit) => (unit.id === updatedUnit.id ? updatedUnit : unit)));
    });
  }, [developmentId]);

  const context: AuraOutletContext = { units, developmentId, loadError };

  // SPEC §3: paleta del cliente aplicada a botones, paneles y acentos. Se define una sola
  // vez aquí, como variables CSS heredadas por todo el árbol del selector (Torre 3D,
  // Fachada, Proyecto, ficha de unidad...) — así ningún componente hijo hardcodea un color
  // de marca, solo referencia `var(--brand-*)`.
  const brandStyle = {
    '--brand-primary': auraConfig.brand.primary,
    '--brand-accent': auraConfig.brand.accent,
    '--brand-background': auraConfig.brand.background,
  } as CSSProperties;

  return (
    <div className="relative h-dvh w-screen" style={brandStyle}>
      {/* En móvil, ViewTabs (centrado, tres pestañas) casi no deja hueco a la izquierda —
          se recorta a solo el ícono (ancho fijo + overflow-hidden) para que no se encimen;
          desde `sm:` hay espacio de sobra para el logo completo. */}
      <div className="fixed left-4 top-4 z-20 h-8 w-8 overflow-hidden drop-shadow-sm sm:h-9 sm:w-auto sm:overflow-visible">
        <Logo src={auraConfig.brand.logo} name={auraConfig.name} className="h-full w-auto" />
      </div>
      <ViewTabs />
      <Outlet context={context} />

      {loadError && (
        <div className="pointer-events-auto fixed inset-x-4 bottom-4 z-30 rounded-xl bg-red-50 p-3 text-sm text-red-800 shadow-lg sm:inset-x-auto sm:right-4 sm:w-96">
          <p>{loadError}</p>
          <button
            type="button"
            onClick={() => setRetryToken((token) => token + 1)}
            className="mt-2 text-xs font-medium underline"
          >
            Reintentar
          </button>
        </div>
      )}
    </div>
  );
}
