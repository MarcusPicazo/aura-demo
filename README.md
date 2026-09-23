# Torre Aura Del Valle — Selector 3D inmobiliario

Demo comercial de un **selector de unidades 3D interactivo** para desarrolladoras
inmobiliarias. Es la versión 0 de un motor reutilizable: un cliente nuevo se resuelve
cambiando solo `src/config/<cliente>.json` y los datos en Supabase, sin tocar
`src/engine/`. El detalle completo del producto está en [SPEC.md](./SPEC.md).

## Stack

- Vite + React + TypeScript (modo estricto)
- React Three Fiber + @react-three/drei + three.js
- Zustand (estado global)
- Tailwind CSS
- Supabase (Postgres, Auth, Realtime)
- React Router
- Deploy en Vercel

## Requisitos

- Node.js 20+
- Un proyecto de Supabase (para datos reales; sin uno, el selector muestra un
  banner de error con botón de reintentar en vez de quedarse cargando para siempre)

## Cómo correrlo localmente

```bash
npm install
cp .env.example .env.local   # llena VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run dev
```

Abre `http://localhost:5173/aura`.

## Base de datos

El esquema, RLS y activación de Realtime están en `supabase/migrations/`, en orden.
Pégalos en el SQL Editor del dashboard de Supabase (o usa la CLI de Supabase si la
tienes configurada). El script de seed de las 46 unidades está en `scripts/`.

## Estructura del repo

```
src/
  engine/     Motor 3D genérico — nada específico de un cliente
  views/      Selector 3D, vista de fachada, proyecto, ficha de unidad...
  admin/      Panel de administración (unidades, fachada, leads)
  lib/        Supabase, precios, WhatsApp, geometría
  store/      Zustand
  config/     aura.json — todo lo específico del cliente
public/clients/aura/   Imágenes del cliente (fachada, interiores, logo)
supabase/migrations/   SQL
scripts/                Seed de datos
```

## Otros comandos

```bash
npm run build     # build de producción
npm run preview   # sirve el build de producción (útil para medir rendimiento real)
npm run lint       # oxlint
```
