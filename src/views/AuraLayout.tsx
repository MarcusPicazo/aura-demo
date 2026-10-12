import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { fetchDevelopmentUnits, subscribeToUnitChanges } from '../lib/supabase';
import { usePresence } from '../lib/usePresence';
import { FAVORITES_PARAM, parseKeyList } from '../lib/collections';
import { useLatch } from '../lib/useLatch';
import { useCompareStore } from '../store/compareStore';
import { useFavoritesStore } from '../store/favoritesStore';
import { useI18n } from '../i18n/useI18n';
import { enterFullscreen, fullscreenSupported, isFullscreen } from '../lib/fullscreen';
import { availableModes } from '../lib/modes';
import { homePath } from '../lib/unitDetails';
import { useKioskStore } from '../store/kioskStore';
import { useTourStore } from '../store/tourStore';
import { usePwaStore } from '../store/pwaStore';
import { readInventorySnapshot, writeInventorySnapshot } from '../lib/inventoryCache';
import { loadInventory } from '../lib/loadInventory';
import { PwaToast } from './PwaToast';
import { useKioskSession } from './useKioskSession';
import { useSelectionStore } from '../store/selectionStore';
import { ContactCard, ContactTriggerIcon } from './ContactCard';
import { CollectionDock } from './CollectionDock';
import { ViewTabs } from './ViewTabs';
import { ModeSwitchButton } from './ModeSwitchButton';
import { Logo } from './Logo';
import { activeConfig as auraConfig, brandStyle, buildings, messageDevelopmentName, unitIdentity } from '../config/active';
import { assignBuildings } from '../lib/buildings';
import type { Unit } from '../types';

/** Cuánto se espera a la red antes de mostrar el último inventario guardado (mientras tanto sigue intentando y lo reemplaza si llega). */
const INVENTORY_GRACE_MS = 2500;
/** Con el inventario viniendo del caché, cada cuánto se vuelve a intentar con la red. */
const INVENTORY_RETRY_MS = 30_000;

// Las hojas de favoritos y de comparación se bajan la primera vez que se abren: quien solo mira la torre nunca las descarga.
const FavoritesSheet = lazy(() => import('./FavoritesSheet').then((module) => ({ default: module.FavoritesSheet })));
const CompareSheet = lazy(() => import('./CompareSheet').then((module) => ({ default: module.CompareSheet })));

export interface AuraOutletContext {
  units: Unit[];
  developmentId: string | null;
  /** Mensaje listo para mostrar en la interfaz si falló la carga inicial; null si no hubo error. */
  loadError: string | null;
  /** Abre la ficha de contacto del asesor — expuesta por contexto para que la ficha de
   *  unidad (dentro del selector 3D) también pueda dispararla, sin duplicar el panel. */
  openContact: () => void;
}

/** El detalle técnico del error (el texto que lo rodea se traduce al mostrarlo). */
function loadErrorDetail(error: unknown): string {
  // PostgrestError (de postgrest-js) es un objeto plano con `.message`, no una instancia
  // de Error; un fallo de red (DNS, sin conexión) sí lanza un Error real. Cubrimos los dos.
  const detail =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);
  return detail;
}

/**
 * Layout compartido por las pestañas (Torre 3D, Render y Proyecto, SPEC §4.2): trae las
 * unidades de Supabase y mantiene la suscripción Realtime una sola vez, y las pasa a
 * la vista activa por contexto de ruta — así ninguna duplica el fetch ni la suscripción,
 * y los dos modos (3D y render) siempre muestran el mismo inventario.
 */
export function AuraLayout() {
  const i18n = useI18n();
  const { t } = i18n;
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Presentación y showroom: durante el recorrido la interfaz se esconde; el showroom agranda todo y se apoya en el reposo.
  const tourActive = useTourStore((state) => state.active);
  const kiosk = useKioskStore((state) => state.kiosk);
  const kioskLogoHandlers = useKioskSession();
  const tower3d = availableModes(auraConfig).tower3d;
  const on3dRoute = pathname === '/aura' || pathname.startsWith('/aura/edificio') || pathname.startsWith('/aura/unidad');
  const handlePresent = useCallback(() => {
    useTourStore.getState().request();
    // Desde render o proyecto se pasa primero a la pantalla 3D, que es donde corre el recorrido.
    if (!on3dRoute) navigate(homePath());
  }, [navigate, on3dRoute]);
  // El navegador solo da pantalla completa tras un toque: si el showroom arrancó por dirección (`?modo=showroom`), se pide con un botón.
  const [fullscreen, setFullscreen] = useState(isFullscreen());
  useEffect(() => {
    const sync = () => setFullscreen(isFullscreen());
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  const [units, setUnits] = useState<Unit[]>([]);
  const [developmentId, setDevelopmentId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  // El inventario sale de la red; si esta falla o tarda se muestra el último guardado en el dispositivo (con aviso de cuándo se
  // sincronizó) y se sigue intentando: una sala de ventas con mal wifi no se queda con la pantalla vacía.
  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    void loadInventory({
      fetchFresh: () => fetchDevelopmentUnits(auraConfig.slug),
      cached: readInventorySnapshot(auraConfig.slug),
      graceMs: INVENTORY_GRACE_MS,
      now: Date.now,
      onResult: (result) => {
        if (cancelled) return;
        // Un reintento que vuelve a caer en lo mismo guardado no debe repintar todo el inventario.
        const shown = usePwaStore.getState().inventory;
        if (result.source === 'cache' && shown.source === 'cache' && shown.syncedAt === result.syncedAt) return;
        setUnits(assignBuildings(result.units, buildings, unitIdentity.defaultBuildingId));
        setDevelopmentId(result.developmentId);
        usePwaStore.getState().setInventory({ source: result.source, syncedAt: result.syncedAt });
      },
      onError: (error) => {
        console.error('No se pudieron cargar las unidades desde Supabase:', error);
        if (!cancelled) setLoadError(loadErrorDetail(error));
      },
    });
    return () => {
      cancelled = true;
    };
  }, [retryToken]);

  // Con el inventario guardado en pantalla, se reintenta al volver la red y de vez en cuando; los cambios que llegan por Realtime
  // (con red) se guardan para la próxima vez.
  const inventorySource = usePwaStore((state) => state.inventory.source);
  const online = usePwaStore((state) => state.online);
  useEffect(() => {
    if (inventorySource !== 'cache') return undefined;
    const timer = window.setInterval(() => setRetryToken((token) => token + 1), INVENTORY_RETRY_MS);
    return () => window.clearInterval(timer);
  }, [inventorySource]);
  useEffect(() => {
    if (online && usePwaStore.getState().inventory.source === 'cache') setRetryToken((token) => token + 1);
  }, [online]);
  useEffect(() => {
    if (inventorySource !== 'network' || !developmentId || units.length === 0) return undefined;
    const timer = window.setTimeout(() => {
      const savedAt = Date.now();
      writeInventorySnapshot(auraConfig.slug, { savedAt, developmentId, units });
      usePwaStore.getState().setInventory({ source: 'network', syncedAt: savedAt });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [units, developmentId, inventorySource]);

  // SPEC §2 (momento 3): cambios del admin (estado, precio) llegan aquí sin recargar.
  useEffect(() => {
    if (!developmentId) return undefined;
    return subscribeToUnitChanges(developmentId, (updatedUnit) => {
      const [assigned] = assignBuildings([updatedUnit], buildings, unitIdentity.defaultBuildingId);
      setUnits((current) => current.map((unit) => (unit.id === assigned.id ? assigned : unit)));
    });
  }, [developmentId]);

  // Un link de favoritos compartido (`?favoritos=a:1,b:2`) abre la lista de quien lo mandó. El parámetro solo es la
  // señal de entrada: se lee una vez y se quita de la URL, para que recargar o seguir navegando no la vuelva a abrir.
  const [searchParams, setSearchParams] = useSearchParams();
  const receiveShared = useFavoritesStore((state) => state.receiveShared);
  const mountFavorites = useLatch(useFavoritesStore((state) => state.panelOpen));
  const mountCompare = useLatch(useCompareStore((state) => state.open));
  const sharedParam = searchParams.get(FAVORITES_PARAM);
  useEffect(() => {
    if (sharedParam === null) return;
    const keys = parseKeyList(sharedParam);
    if (keys.length > 0) receiveShared(keys);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete(FAVORITES_PARAM);
        return next;
      },
      { replace: true },
    );
  }, [sharedParam, receiveShared, setSearchParams]);

  // La ficha de contacto vive aquí (no en Selector3D) porque debe abrirse desde cualquier
  // pestaña (Torre 3D, Fachada, Proyecto), no solo desde el selector 3D — `openContact` se
  // expone por el contexto de ruta para que la ficha de unidad también la dispare.
  const [contactOpen, setContactOpen] = useState(false);
  const { rendered: presentContact, visible: contactVisible } = usePresence(contactOpen ? true : null, 300);
  const selectedUnitKey = useSelectionStore((state) => state.selectedUnitKey);
  const selectedUnit = unitIdentity.find(units, selectedUnitKey) ?? null;

  // Memoizado (objeto Y callback): `Selector3D` lee este contexto con `useOutletContext()`
  // y monta el <Canvas> del selector 3D — un objeto/función NUEVOS aquí en cada render de
  // AuraLayout (por ejemplo, al abrir la ficha de asesor, que vive en ESTE componente, no
  // en Selector3D) forzarían que React reconcilie TODO el árbol de Three.js dentro del
  // Canvas otra vez, aunque `units`/`developmentId`/`loadError` no hayan cambiado en
  // realidad — el tirón al abrir un panel completamente ajeno al selector 3D.
  const openContact = useCallback(() => setContactOpen(true), []);
  const context: AuraOutletContext = useMemo(
    () => ({ units, developmentId, loadError, openContact }),
    [units, developmentId, loadError, openContact],
  );
  const { rendered: presentLoadError, visible: errorBannerVisible } = usePresence(loadError, 300);


  return (
    <main className="relative h-dvh w-screen" style={brandStyle}>
      {/* En móvil, ViewTabs (centrado, tres pestañas) casi no deja hueco a la izquierda —
          se recorta a solo el ícono (ancho fijo + overflow-hidden) para que no se encimen;
          desde `sm:` hay espacio de sobra para el logo completo. */}
      <div
        {...kioskLogoHandlers}
        className="fixed left-4 top-4 z-20 h-8 w-8 touch-none select-none overflow-hidden drop-shadow-sm sm:h-9 sm:w-auto sm:overflow-visible"
      >
        <Logo src={auraConfig.brand.logo} name={auraConfig.name} className="h-full w-auto" />
      </div>
      {!tourActive && <ViewTabs units={units} />}
      {!tourActive && <ModeSwitchButton units={units} />}
      <Outlet context={context} />

      {/* Único botón para "hablar con un asesor" en toda la interfaz principal, visible en
          las tres pestañas — abajo a la izquierda: arriba a la izquierda ya está el logo,
          arriba a la derecha lo usa Filtros en Torre 3D. La ficha de contacto (`ContactCard`)
          "crece" desde esta misma esquina en escritorio (`sm:origin-bottom-left` + escala
          allá), así que el botón se desvanece mientras esa ficha está montada — si se
          quedara visible, se vería duplicado justo debajo de la esquina del panel. */}
      {!tourActive && (
      <button
        type="button"
        onClick={() => setContactOpen(true)}
        aria-label={t('unit.talkToAdvisor')}
        className={`pointer-events-auto fixed bottom-4 left-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--brand-primary)] text-white shadow-lg transition-opacity duration-300 ease-elegant motion-reduce:transition-none ${
          presentContact ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
      >
        <ContactTriggerIcon className="h-5 w-5" />
      </button>
      )}

      {!tourActive && <CollectionDock canPresent={tower3d && units.length > 0} onPresent={handlePresent} />}
      {!tourActive && <PwaToast />}

      {kiosk && !fullscreen && fullscreenSupported() && !tourActive && (
        <button
          type="button"
          onClick={() => void enterFullscreen()}
          className="fixed bottom-24 left-1/2 z-30 -translate-x-1/2 rounded-full bg-[var(--brand-primary)] px-6 py-3 text-base font-medium text-white shadow-2xl"
        >
          {t('kiosk.tapToStart')}
        </button>
      )}

      {presentContact && !tourActive && (
        <ContactCard
          advisor={auraConfig.advisor}
          developmentName={messageDevelopmentName(i18n, selectedUnit?.buildingId)}
          selectedUnit={selectedUnit}
          visible={contactVisible}
          onClose={() => setContactOpen(false)}
        />
      )}

      <Suspense fallback={null}>
        {mountFavorites && <FavoritesSheet units={units} developmentName={auraConfig.name} />}
        {mountCompare && (
          <CompareSheet
            units={units}
            downPaymentPercent={auraConfig.paymentPlan.downPaymentPercent}
            constructionMonths={auraConfig.paymentPlan.constructionMonths}
          />
        )}
      </Suspense>

      {presentLoadError && (
        <div
          className={`pointer-events-auto fixed inset-x-4 bottom-4 z-30 rounded-xl bg-red-50 p-3 text-sm text-red-800 shadow-lg transition-[opacity,transform] duration-300 ease-elegant motion-reduce:transition-none sm:inset-x-auto sm:right-4 sm:w-96 ${
            errorBannerVisible ? 'translate-y-0 opacity-100 sm:translate-y-0' : 'translate-y-full opacity-0 sm:translate-y-4'
          }`}
        >
          <p role="alert">{t('errors.loadUnits', { detail: presentLoadError })}</p>
          <button
            type="button"
            onClick={() => setRetryToken((token) => token + 1)}
            className="mt-2 text-xs font-medium underline"
          >
            {t('errors.retry')}
          </button>
        </div>
      )}
    </main>
  );
}
