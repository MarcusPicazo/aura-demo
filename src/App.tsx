import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useOutletContext, useParams } from 'react-router-dom';
import { AuraLayout, type AuraOutletContext } from './views/AuraLayout';
import { Selector3D } from './views/Selector3D';
import { WebGLGate } from './views/WebGLGate';
import { RouteFallback } from './views/RouteFallback';
import { NotFound } from './views/NotFound';
import { availableModes, usableRenderOf } from './lib/modes';
import { RENDER_BASE_PATH, renderPath } from './lib/render';
import { activeConfig as auraConfig, unitIdentity } from './config/active';
import { homePath as computeHomePath } from './lib/unitDetails';

const modes = availableModes(auraConfig);

// CLAUDE.md: carga diferida del panel de admin y del modo render — un prospecto
// que solo ve la torre (SPEC §2, momento 1) nunca descarga ninguno de los dos.
const RenderView = lazy(() => import('./views/render/RenderView').then((m) => ({ default: m.RenderView })));
const ProjectView = lazy(() => import('./views/ProjectView').then((m) => ({ default: m.ProjectView })));
const PrivacyNotice = lazy(() => import('./views/PrivacyNotice').then((m) => ({ default: m.PrivacyNotice })));
const AdminPage = lazy(() => import('./admin/AdminPage'));
const UnitsTable = lazy(() => import('./admin/UnitsTable').then((m) => ({ default: m.UnitsTable })));
const RenderEditor = lazy(() => import('./admin/RenderEditor').then((m) => ({ default: m.RenderEditor })));
const PlanExporter = lazy(() => import('./admin/PlanExporter').then((m) => ({ default: m.PlanExporter })));
const LeadsTable = lazy(() => import('./admin/LeadsTable').then((m) => ({ default: m.LeadsTable })));
const AnalyticsDashboard = lazy(() => import('./admin/AnalyticsDashboard').then((m) => ({ default: m.AnalyticsDashboard })));

// Portal comercial (src/portal/): panel privado de ventas y administración, separado
// del /admin sencillo de arriba — ver README de la Fase 1 en el PR/commit correspondiente.
const PortalLogin = lazy(() => import('./portal/pages/Login').then((m) => ({ default: m.PortalLogin })));
const PortalLayout = lazy(() => import('./portal/layout/PortalLayout').then((m) => ({ default: m.PortalLayout })));
const Resumen = lazy(() => import('./portal/pages/Resumen').then((m) => ({ default: m.Resumen })));
const Inventario = lazy(() => import('./portal/pages/Inventario').then((m) => ({ default: m.Inventario })));
const UnitDetail = lazy(() => import('./portal/pages/UnitDetail').then((m) => ({ default: m.UnitDetail })));
const OperacionesAdmin = lazy(() => import('./portal/pages/admin/OperacionesAdmin').then((m) => ({ default: m.OperacionesAdmin })));
const MisApartadosAsesor = lazy(() =>
  import('./portal/pages/asesor/MisApartadosAsesor').then((m) => ({ default: m.MisApartadosAsesor })),
);
const Prospectos = lazy(() => import('./portal/pages/Prospectos').then((m) => ({ default: m.Prospectos })));
const EquipoAdmin = lazy(() => import('./portal/pages/admin/EquipoAdmin').then((m) => ({ default: m.EquipoAdmin })));
const HistorialAdmin = lazy(() => import('./portal/pages/admin/HistorialAdmin').then((m) => ({ default: m.HistorialAdmin })));
const ConfiguracionAdmin = lazy(() =>
  import('./portal/pages/admin/ConfiguracionAdmin').then((m) => ({ default: m.ConfiguracionAdmin })),
);
const RoleGate = lazy(() => import('./portal/components/RoleGate').then((m) => ({ default: m.RoleGate })));

/** El selector 3D, solo si el navegador puede dibujarlo (si no: los renders o una explicación). */
function Selector3DRoute() {
  return (
    <WebGLGate>
      <Selector3D />
    </WebGLGate>
  );
}

/** Dónde cae quien entra a `/aura` o al link viejo `/aura/fachada` según los modos que tenga el desarrollo. */
const homePath = computeHomePath();
const legacyFacadePath = modes.render ? RENDER_BASE_PATH : homePath;

/**
 * `/aura/unidad/:code` cuando ya no es la ruta propia de la unidad: en un conjunto (donde el código solo
 * puede repetirse) lleva al edificio de esa unidad —así siguen sirviendo los enlaces y QR viejos—, y sin
 * modelo 3D la abre en el modo render.
 */
function UnitRedirect() {
  const { code } = useParams<{ code: string }>();
  const { units } = useOutletContext<AuraOutletContext>();
  const render = usableRenderOf(auraConfig);

  if (modes.tower3d && unitIdentity.multi) {
    // Hasta que cargue el inventario no se sabe de qué edificio es; si no existe (o es ambigua), al masterplan.
    if (units.length === 0) return null;
    const unit = unitIdentity.find(units, code);
    return <Navigate to={unit ? unitIdentity.path(unit) : '/aura'} replace />;
  }
  if (!render) return <Navigate to={homePath} replace />;
  return <Navigate to={renderPath({ viewId: render.defaultViewId, unitParam: code })} replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/aura" replace />} />

      <Route path="/aura" element={<AuraLayout />}>
        <Route index element={modes.tower3d ? <Selector3DRoute /> : <Navigate to={homePath} replace />} />
        <Route path="unidad/:code" element={modes.tower3d && !unitIdentity.multi ? <Selector3DRoute /> : <UnitRedirect />} />
        {/* Conjunto: cada edificio es una ruta (el masterplan es `/aura`). */}
        {modes.tower3d && unitIdentity.multi && (
          <>
            <Route path="edificio/:buildingId" element={<Selector3DRoute />} />
            <Route path="edificio/:buildingId/unidad/:code" element={<Selector3DRoute />} />
          </>
        )}
        {modes.render && (
          <Route
            path="render/:viewId?"
            element={
              <Suspense fallback={<RouteFallback inline />}>
                <RenderView />
              </Suspense>
            }
          />
        )}
        <Route path="fachada" element={<Navigate to={legacyFacadePath} replace />} />
        <Route path="*" element={<NotFound />} />
        <Route
          path="proyecto"
          element={
            <Suspense fallback={<RouteFallback inline />}>
              <ProjectView />
            </Suspense>
          }
        />
      </Route>

      <Route
        path="/aviso-de-privacidad"
        element={
          <Suspense fallback={<RouteFallback />}>
            <PrivacyNotice />
          </Suspense>
        }
      />

      <Route
        path="/admin"
        element={
          <Suspense fallback={<RouteFallback />}>
            <AdminPage />
          </Suspense>
        }
      >
        <Route
          index
          element={
            <Suspense fallback={<RouteFallback inline />}>
              <UnitsTable />
            </Suspense>
          }
        />
        <Route
          path="render"
          element={
            <Suspense fallback={<RouteFallback inline />}>
              <RenderEditor />
            </Suspense>
          }
        />
        <Route
          path="plantas"
          element={
            <Suspense fallback={<RouteFallback inline />}>
              <PlanExporter />
            </Suspense>
          }
        />
        <Route path="facade" element={<Navigate to="/admin/render" replace />} />
        <Route
          path="leads"
          element={
            <Suspense fallback={<RouteFallback inline />}>
              <LeadsTable />
            </Suspense>
          }
        />
        <Route
          path="analitica"
          element={
            <Suspense fallback={<RouteFallback inline />}>
              <AnalyticsDashboard />
            </Suspense>
          }
        />
      </Route>

      <Route
        path="/portal/login"
        element={
          <Suspense fallback={<RouteFallback />}>
            <PortalLogin />
          </Suspense>
        }
      />
      <Route
        path="/portal"
        element={
          <Suspense fallback={<RouteFallback />}>
            <PortalLayout />
          </Suspense>
        }
      >
        <Route index element={<Navigate to="/portal/resumen" replace />} />
        <Route
          path="resumen"
          element={
            <Suspense fallback={<RouteFallback inline />}>
              <Resumen />
            </Suspense>
          }
        />
        <Route
          path="inventario"
          element={
            <Suspense fallback={<RouteFallback inline />}>
              <Inventario />
            </Suspense>
          }
        />
        <Route
          path="inventario/:code"
          element={
            <Suspense fallback={<RouteFallback inline />}>
              <UnitDetail />
            </Suspense>
          }
        />
        <Route
          path="operaciones"
          element={
            <Suspense fallback={<RouteFallback inline />}>
              <RoleGate allow={['admin']}>
                <OperacionesAdmin />
              </RoleGate>
            </Suspense>
          }
        />
        <Route
          path="mis-apartados"
          element={
            <Suspense fallback={<RouteFallback inline />}>
              <RoleGate allow={['asesor']}>
                <MisApartadosAsesor />
              </RoleGate>
            </Suspense>
          }
        />
        <Route
          path="prospectos"
          element={
            <Suspense fallback={<RouteFallback inline />}>
              <Prospectos />
            </Suspense>
          }
        />
        <Route
          path="equipo"
          element={
            <Suspense fallback={<RouteFallback inline />}>
              <RoleGate allow={['admin']}>
                <EquipoAdmin />
              </RoleGate>
            </Suspense>
          }
        />
        <Route
          path="historial"
          element={
            <Suspense fallback={<RouteFallback inline />}>
              <RoleGate allow={['admin']}>
                <HistorialAdmin />
              </RoleGate>
            </Suspense>
          }
        />
        <Route
          path="configuracion"
          element={
            <Suspense fallback={<RouteFallback inline />}>
              <RoleGate allow={['admin']}>
                <ConfiguracionAdmin />
              </RoleGate>
            </Suspense>
          }
        />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
