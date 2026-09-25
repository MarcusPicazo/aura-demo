import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Red de seguridad de toda la app (envuelve `<App/>` en `main.tsx`): sin esto, CUALQUIER
 * excepción no capturada durante un render — en cualquier componente, no solo el selector
 * 3D — hace que React desmonte el árbol completo desde la raíz (comportamiento estándar
 * desde React 16+), dejando el `<div id="root">` vacío: pantalla en blanco, sin rastro en
 * pantalla de qué pasó. `componentDidCatch` deja el error en consola para diagnóstico;
 * "Recargar" es la salida — un boundary de React solo puede reintentar el MISMO árbol que
 * ya falló (con el mismo estado de módulo, mismas refs de Three.js potencialmente ya
 * descompuestas), así que un simple reintento in-place es más frágil que arrancar de cero.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error no capturado en la interfaz:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-neutral-50 p-6 text-center">
        <p className="font-serif text-xl text-neutral-900">Algo salió mal</p>
        <p className="max-w-sm text-sm text-neutral-500">
          Hubo un problema mostrando la página. Recarga para seguir viendo la torre.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-full bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white"
        >
          Recargar
        </button>
      </div>
    );
  }
}
