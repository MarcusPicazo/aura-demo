import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './views/ErrorBoundary.tsx'
import { startPwa } from './lib/pwa.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)

// La pantalla de arranque del `index.html` (la pinta el navegador antes de que baje el JavaScript) se funde y se quita cuando la
// interfaz ya montó: en el selector 3D la toma su pantalla de carga, con el avance real.
requestAnimationFrame(() =>
  requestAnimationFrame(() => {
    const splash = document.getElementById('boot-splash')
    if (!splash) return
    splash.classList.add('leaving')
    window.setTimeout(() => splash.remove(), 600)
  }),
)

// Tras publicar una versión nueva, una pestaña que se quedó abierta pide archivos con huella que ya no existen y el JavaScript de la
// pantalla no carga. Se recarga una sola vez (la marca en sessionStorage evita el ciclo) para traer la versión nueva.
window.addEventListener('vite:preloadError', () => {
  try {
    const last = Number(window.sessionStorage.getItem('preload-reload-at') ?? 0)
    if (Date.now() - last < 15_000) return
    window.sessionStorage.setItem('preload-reload-at', String(Date.now()))
  } catch {
    return
  }
  window.location.reload()
})

// App instalable y sin conexión (service worker, aviso de actualización, instalación).
startPwa()
