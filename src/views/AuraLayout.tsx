import { useEffect, useState, type CSSProperties } from 'react';
import { Outlet } from 'react-router-dom';
import { fetchDevelopmentUnits, subscribeToUnitChanges } from '../lib/supabase';
import { usePresence } from '../lib/usePresence';
import { useSelectionStore } from '../store/selectionStore';
import { ContactCard, ContactTriggerIcon } from './ContactCard';
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
  /** Abre la ficha de contacto del asesor — expuesta por contexto para que la ficha de
   *  unidad (dentro del selector 3D) también pueda dispararla, sin duplicar el panel. */
  openContact: () => void;
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

  // La ficha de contacto vive aquí (no en Selector3D) porque debe abrirse desde cualquier
  // pestaña (Torre 3D, Fachada, Proyecto), no solo desde el selector 3D — `openContact` se
  // expone por el contexto de ruta para que la ficha de unidad también la dispare.
  const [contactOpen, setContactOpen] = useState(false);
  const { rendered: presentContact, visible: contactVisible } = usePresence(contactOpen ? true : null, 380);
  const selectedUnitCode = useSelectionStore((state) => state.selectedUnitCode);
  const selectedUnit = units.find((unit) => unit.code === selectedUnitCode) ?? null;

  const context: AuraOutletContext = { units, developmentId, loadError, openContact: () => setContactOpen(true) };
  const { rendered: presentLoadError, visible: errorBannerVisible } = usePresence(loadError, 300);

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

      {/* Único botón para "hablar con un asesor" en toda la interfaz principal, visible en
          las tres pestañas — abajo a la izquierda: arriba a la izquierda ya está el logo,
          arriba a la derecha lo usa Filtros en Torre 3D. La ficha de contacto (`ContactCard`)
          "crece" desde esta misma esquina en escritorio (`sm:origin-bottom-left` + escala
          allá), así que el botón se desvanece mientras esa ficha está montada — si se
          quedara visible, se vería duplicado justo debajo de la esquina del panel. */}
      <button
        type="button"
        onClick={() => setContactOpen(true)}
        aria-label="Hablar con un asesor"
        className={`pointer-events-auto fixed bottom-4 left-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--brand-primary)] text-white shadow-lg transition-opacity duration-300 ease-elegant motion-reduce:transition-none ${
          presentContact ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
      >
        <ContactTriggerIcon className="h-5 w-5" />
      </button>

      {presentContact && (
        <ContactCard
          advisor={auraConfig.advisor}
          developmentName={auraConfig.name}
          selectedUnit={selectedUnit}
          visible={contactVisible}
          onClose={() => setContactOpen(false)}
        />
      )}

      {presentLoadError && (
        <div
          className={`pointer-events-auto fixed inset-x-4 bottom-4 z-30 rounded-xl bg-red-50 p-3 text-sm text-red-800 shadow-lg transition-[opacity,transform] duration-300 ease-elegant motion-reduce:transition-none sm:inset-x-auto sm:right-4 sm:w-96 ${
            errorBannerVisible ? 'translate-y-0 opacity-100 sm:translate-y-0' : 'translate-y-full opacity-0 sm:translate-y-4'
          }`}
        >
          <p>{presentLoadError}</p>
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
