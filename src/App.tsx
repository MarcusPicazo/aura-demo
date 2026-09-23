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
      </Route>
    </Routes>
  );
}

export default App;
