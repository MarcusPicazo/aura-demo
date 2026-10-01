import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuraLayout } from './views/AuraLayout';
import { Selector3D } from './views/Selector3D';

// CLAUDE.md: carga diferida del panel de admin y de la vista de fachada — un prospecto
// que solo ve la torre (SPEC §2, momento 1) nunca descarga ninguno de los dos.
const FacadeView = lazy(() => import('./views/FacadeView').then((m) => ({ default: m.FacadeView })));
const ProjectView = lazy(() => import('./views/ProjectView').then((m) => ({ default: m.ProjectView })));
const PrivacyNotice = lazy(() => import('./views/PrivacyNotice').then((m) => ({ default: m.PrivacyNotice })));
const AdminPage = lazy(() => import('./admin/AdminPage'));
const UnitsTable = lazy(() => import('./admin/UnitsTable').then((m) => ({ default: m.UnitsTable })));
const FacadeEditor = lazy(() => import('./admin/FacadeEditor').then((m) => ({ default: m.FacadeEditor })));
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

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/aura" replace />} />

      <Route path="/aura" element={<AuraLayout />}>
        <Route index element={<Selector3D />} />
        <Route path="unidad/:code" element={<Selector3D />} />
        <Route
          path="fachada"
          element={
            <Suspense fallback={null}>
              <FacadeView />
            </Suspense>
          }
        />
        <Route
          path="proyecto"
          element={
            <Suspense fallback={null}>
              <ProjectView />
            </Suspense>
          }
        />
      </Route>

      <Route
        path="/aviso-de-privacidad"
        element={
          <Suspense fallback={null}>
            <PrivacyNotice />
          </Suspense>
        }
      />

      <Route
        path="/admin"
        element={
          <Suspense fallback={null}>
            <AdminPage />
          </Suspense>
        }
      >
        <Route
          index
          element={
            <Suspense fallback={null}>
              <UnitsTable />
            </Suspense>
          }
        />
        <Route
          path="facade"
          element={
            <Suspense fallback={null}>
              <FacadeEditor />
            </Suspense>
          }
        />
        <Route
          path="leads"
          element={
            <Suspense fallback={null}>
              <LeadsTable />
            </Suspense>
          }
        />
        <Route
          path="analitica"
          element={
            <Suspense fallback={null}>
              <AnalyticsDashboard />
            </Suspense>
          }
        />
      </Route>

      <Route
        path="/portal/login"
        element={
          <Suspense fallback={null}>
            <PortalLogin />
          </Suspense>
        }
      />
      <Route
        path="/portal"
        element={
          <Suspense fallback={null}>
            <PortalLayout />
          </Suspense>
        }
      >
        <Route index element={<Navigate to="/portal/resumen" replace />} />
        <Route
          path="resumen"
          element={
            <Suspense fallback={null}>
              <Resumen />
            </Suspense>
          }
        />
        <Route
          path="inventario"
          element={
            <Suspense fallback={null}>
              <Inventario />
            </Suspense>
          }
        />
        <Route
          path="inventario/:code"
          element={
            <Suspense fallback={null}>
              <UnitDetail />
            </Suspense>
          }
        />
        <Route
          path="operaciones"
          element={
            <Suspense fallback={null}>
              <RoleGate allow={['admin']}>
                <OperacionesAdmin />
              </RoleGate>
            </Suspense>
          }
        />
        <Route
          path="mis-apartados"
          element={
            <Suspense fallback={null}>
              <RoleGate allow={['asesor']}>
                <MisApartadosAsesor />
              </RoleGate>
            </Suspense>
          }
        />
        <Route
          path="prospectos"
          element={
            <Suspense fallback={null}>
              <Prospectos />
            </Suspense>
          }
        />
        <Route
          path="equipo"
          element={
            <Suspense fallback={null}>
              <RoleGate allow={['admin']}>
                <EquipoAdmin />
              </RoleGate>
            </Suspense>
          }
        />
        <Route
          path="historial"
          element={
            <Suspense fallback={null}>
              <RoleGate allow={['admin']}>
                <HistorialAdmin />
              </RoleGate>
            </Suspense>
          }
        />
        <Route
          path="configuracion"
          element={
            <Suspense fallback={null}>
              <RoleGate allow={['admin']}>
                <ConfiguracionAdmin />
              </RoleGate>
            </Suspense>
          }
        />
      </Route>
    </Routes>
  );
}

export default App;
