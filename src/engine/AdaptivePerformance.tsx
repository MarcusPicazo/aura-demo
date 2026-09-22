import { useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';

interface AdaptivePerformanceProps {
  dprRange: [number, number];
}

/**
 * DPR adaptativo real (CLAUDE.md, SPEC §8: ≥50fps en Android de gama media). drei
 * expone `<PerformanceMonitor>` (mide fps) y `<AdaptiveDpr>` (lee
 * `state.performance.current`), pero esos dos NO están conectados entre sí por
 * defecto: `state.performance.current` es un mecanismo aparte de R3F pensado para
 * dispararse con `regress()` en interacciones (drag, etc.), no con las mediciones de
 * fps de PerformanceMonitor. Conectamos `onIncline`/`onDecline` directo a `setDpr`
 * para que la medición de fps sí mueva la resolución de render.
 */
export function AdaptivePerformance({ dprRange }: AdaptivePerformanceProps) {
  const setDpr = useThree((state) => state.setDpr);
  const [min, max] = dprRange;

  return <PerformanceMonitor onIncline={() => setDpr(max)} onDecline={() => setDpr(min)} />;
}
