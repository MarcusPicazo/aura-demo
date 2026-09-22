# CLAUDE.md — Reglas del proyecto

Lee `SPEC.md` antes de cualquier tarea. Es la fuente de verdad de qué construimos y por qué.

## Stack (no cambiar sin preguntar)
- Vite + React + TypeScript (modo estricto)
- React Three Fiber + @react-three/drei + three.js
- Zustand para estado global
- Tailwind CSS para la interfaz
- Supabase (@supabase/supabase-js): Postgres, Auth, Realtime
- React Router para rutas
- Deploy en Vercel

No instales librerías nuevas sin explicarme para qué y pedir confirmación.

## Regla de oro: el motor es genérico
- `src/engine/` NO puede contener nada específico de un cliente: ni nombres, ni colores,
  ni medidas, ni textos. Todo eso sale de `src/config/<cliente>.json` o de Supabase.
- Si necesitas un dato del cliente dentro del motor, recíbelo por props o desde la config.
- Antes de terminar una tarea, verifica que la palabra "aura" no aparezca dentro de `src/engine/`.

## Cómo trabajamos
- Una tarea a la vez. Haz solo lo que te pido en el prompt actual; no adelantes funcionalidades.
- Antes de escribir código en tareas grandes, dame un plan corto (qué archivos creas o cambias).
- Al terminar, dime exactamente cómo verifico que funciona (qué abrir, qué tocar, qué debería ver).
- Si algo de la SPEC es ambiguo, pregunta en vez de inventar.
- Componentes pequeños y con una sola responsabilidad. Lógica de geometría en `src/lib/geometry.ts`,
  separada de los componentes, con funciones puras.
- Tipos compartidos en `src/types.ts`. Nada de `any`.
- Código y nombres en inglés; textos visibles al usuario en español de México.

## Rendimiento (es parte del producto)
- Pensado primero para celular.
- Usa `frameloop="demand"` e invalida el frame solo cuando algo cambia.
- Reutiliza geometrías y materiales; evita crear objetos dentro de `useFrame`.
- DPR adaptativo (drei `PerformanceMonitor` / `AdaptiveDpr`).
- Carga diferida (lazy) del panel de admin y de la vista de fachada.

## Supabase y seguridad
- Variables en `.env.local` (nunca en el repo): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Mantén un `.env.example` con los nombres de las variables, sin valores.
- NUNCA uses la service role key en el frontend.
- Todo cambio de base de datos va como migración SQL en `supabase/migrations/`, con RLS incluido.
- Cuando necesites que yo ejecute SQL en el dashboard de Supabase, dame el SQL completo y dime dónde pegarlo.

## Git
- Al terminar cada tarea que funcione, propón un mensaje de commit corto en español.
- `.gitignore` debe incluir `node_modules`, `dist`, `.env*` (excepto `.env.example`).
