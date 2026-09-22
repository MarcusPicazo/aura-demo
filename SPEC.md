# SPEC — Aura Demo (Selector 3D inmobiliario)

## 1. Qué es
Demo comercial de un **selector de unidades 3D interactivo** para desarrolladoras inmobiliarias.
Es la **versión 0 de un motor reutilizable**: cada cliente futuro debe resolverse cambiando
solo archivos de configuración y datos, nunca el código del motor.

Objetivo de negocio: que un director comercial vea la demo en su celular y pida
"quiero ver MI torre así". Después de la demo, debe ser posible montar la torre de un
prospecto en menos de 48 horas cambiando solo `src/config/<cliente>.json` y los datos en Supabase.

## 2. Los tres momentos que la demo DEBE lograr (prioridad absoluta)
1. **"Ábralo en su celular"**: el prospecto escanea un QR y la torre carga en menos de 3 s en 4G,
   con una animación de cámara de entrada, fluida en un Android de gama media.
2. **"Elija un departamento"**: toca un piso, luego una unidad, ve su ficha y presiona "Me interesa".
   Se abre WhatsApp con un mensaje prellenado:
   `Hola, me interesa el departamento 804 (Tipo A, 85 m², $6,450,000) de Torre Aura Del Valle.`
   El lead también se guarda en Supabase.
3. **"Ahora lo vendo"**: desde el panel de administración (en otro dispositivo) se marca la unidad
   como vendida y cambia de color en todas las pantallas abiertas al instante, sin recargar (Supabase Realtime).

Si una funcionalidad no ayuda a estos tres momentos, no es prioridad.

## 3. El desarrollo ficticio: Torre Aura Del Valle
- Ubicación ficticia: colonia Del Valle, CDMX.
- 12 niveles: planta baja (lobby y amenidades, no se vende), pisos 1–11 con 4 unidades (A, B, C, D),
  piso 12 con 2 penthouses (PH1, PH2). Total: 46 unidades.
- Códigos de unidad: `{piso}{nn}` → 101, 102, 103, 104 … 1101 … 1104; penthouses 1201, 1202.

| Tipo | Recámaras | Baños | m²      | Orientación        | Precio base (piso 1) |
|------|-----------|-------|---------|--------------------|----------------------|
| A    | 2         | 2     | 85      | Norponiente        | $5,600,000           |
| B    | 1         | 1     | 62      | Nororiente         | $4,300,000           |
| C    | 3         | 2.5   | 120     | Surponiente        | $7,600,000           |
| D    | 2         | 2     | 92      | Suroriente         | $6,000,000           |
| PH   | 3         | 3.5   | 165–180 | Doble orientación  | $9,400,000–9,800,000 |

- Precio: precio base × (1 + 0.015 × (piso − 1)), redondeado a miles.
- Estados: ~60% `available`, ~25% `sold`, ~15% `reserved`. Distribución realista:
  pisos bajos y altos más vendidos, penthouses uno vendido y uno disponible.
- Marca: nombre "Torre Aura Del Valle", frase "Vivir en la luz de Del Valle", paleta sobria
  (arena, grafito, un acento cálido). Tipografía elegante (serif para títulos, sans para datos).

## 4. Funcionalidades

### 4.1 Obligatorias (v1)
- **Torre 3D procedural** generada desde `config/aura.json` (ver §5): cada unidad es un polígono
  extruido a la altura de piso; losas y núcleo como geometría aparte.
- **Look arquitectónico**: vidrio (`MeshPhysicalMaterial`), bordes (`Edges`), HDRI de ciudad,
  sombras de contacto, edificios vecinos como bloques grises semitransparentes.
- **Animación de entrada**: la cámara llega orbitando a la vista principal.
- **Controles**: órbita con límites (no ir bajo el suelo, zoom acotado). Touch: arrastrar, pellizcar, tocar.
- **Interacción**: hover/tap resalta piso y luego unidad. Colores por estado:
  verde = disponible, ámbar = apartado, gris = vendido.
- **Panel de unidad**: código, tipo, recámaras, baños, m², orientación, piso, precio,
  **plano SVG generado a partir del polígono de la unidad**, botón "Me interesa" (WhatsApp) y formulario
  opcional de nombre y teléfono que guarda el lead.
- **Filtros**: recámaras, rango de precio, "solo disponibles". Las unidades que no coinciden
  se vuelven casi transparentes.
- **Leyenda** de estados y contador ("18 de 46 disponibles").
- **URL por unidad**: `/aura/unidad/804` abre la torre con esa unidad seleccionada.
- **Panel de administración** `/admin`: login con Supabase Auth, tabla de unidades con selector
  de estado y precio editable. Los cambios se reflejan en tiempo real en el selector.
- **Mobile-first**: se diseña primero para celular vertical.

### 4.2 Vista de fachada (segunda pestaña)
- Imagen conceptual de la fachada (archivo en `public/clients/aura/facade.jpg`, marcada como
  "imagen conceptual") con polígonos SVG encima de cada piso, definidos en el config.
- Hover/tap en un piso muestra sus unidades disponibles; clic lleva al selector 3D con ese piso enfocado.

### 4.3 Si sobra tiempo
- **Asoleamiento**: slider de hora del día que mueve una luz direccional según la posición solar
  real para la latitud de CDMX (19.4° N) y una fecha elegible.

### 4.4 Fuera de alcance
Configurador de acabados, recorridos interiores, modelos glTF, modo showroom, integración con CRM.

## 5. Configuración por cliente (`src/config/aura.json`)
Todo lo específico del cliente vive aquí. Esquema de referencia:

```json
{
  "slug": "aura",
  "name": "Torre Aura Del Valle",
  "tagline": "Vivir en la luz de Del Valle",
  "whatsapp": "5215500000000",
  "brand": { "primary": "#2B2B2B", "accent": "#C8A27A", "background": "#F4EFE8" },
  "geometry": {
    "floorHeight": 3.2,
    "slabThickness": 0.3,
    "groundFloorHeight": 4.5,
    "levels": 12,
    "plate": [
      { "type": "A", "polygon": [[0,0],[11,0],[11,8],[0,8]] },
      { "type": "B", "polygon": [[13,0],[24,0],[24,8],[13,8]] },
      { "type": "C", "polygon": [[0,10],[11,10],[11,18],[0,18]] },
      { "type": "D", "polygon": [[13,10],[24,10],[24,18],[13,18]] }
    ],
    "penthousePlate": [
      { "type": "PH", "code": "1201", "polygon": [[0,0],[11,0],[11,18],[0,18]] },
      { "type": "PH", "code": "1202", "polygon": [[13,0],[24,0],[24,18],[13,18]] }
    ],
    "core": [[11,6],[13,6],[13,12],[11,12]]
  },
  "camera": { "intro": [60, 45, 60], "target": [12, 20, 9] },
  "facade": { "image": "/clients/aura/facade.jpg", "floors": [] }
}
```
Las coordenadas están en metros. Los polígonos pueden ser irregulares (no solo rectángulos):
el motor debe soportar cualquier polígono simple. Para la demo, usar al menos una unidad
con forma irregular (en L o con esquina recortada) para demostrarlo.

## 6. Datos (Supabase)

```sql
create table developments (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  published boolean default false,
  created_at timestamptz default now()
);

create table units (
  id uuid primary key default gen_random_uuid(),
  development_id uuid references developments(id) on delete cascade,
  code text not null,
  floor int not null,
  type text not null,
  bedrooms int not null,
  bathrooms numeric not null,
  m2 numeric not null,
  price numeric not null,
  orientation text,
  status text not null check (status in ('available','reserved','sold')),
  updated_at timestamptz default now(),
  unique (development_id, code)
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  development_id uuid references developments(id) on delete cascade,
  unit_id uuid references units(id),
  name text,
  phone text,
  created_at timestamptz default now()
);
```
- **RLS**: lectura pública de `developments` y `units` cuando `published = true`;
  `update` de `units` solo para usuarios autenticados (para la demo basta con autenticado);
  `insert` público en `leads`; lectura de `leads` solo autenticados.
- **Realtime** activado en `units`.
- Migraciones en `supabase/migrations/`. Script de seed que genera las 46 unidades con la
  lógica de precios y estados de §3.

## 7. Estructura del repo
```
src/
  engine/     Tower, Floor, Unit, Core, Context, CameraRig, Sun   ← genérico, sin nada del cliente
  views/      Selector3D, FacadeView, UnitPanel, Filters, Legend
  admin/      Login, UnitsTable
  lib/        supabase.ts, pricing.ts, whatsapp.ts, geometry.ts
  store/      Zustand
  config/     aura.json                                            ← todo lo del cliente
public/clients/aura/   facade.jpg, logo.svg
supabase/migrations/   SQL
scripts/               seed.ts
```

## 8. Criterios de terminado
- Carga inicial < 3 s en 4G simulado; bundle inicial lo más ligero posible.
- ≥ 50 fps en un Android de gama media; funciona en Safari de iPhone.
- `frameloop="demand"` o equivalente: no renderizar cuando nada cambia.
- Los tres momentos de §2 funcionan diez veces seguidas sin fallar.
- Cambiar a otro cliente = nuevo JSON + nuevos datos, sin tocar `engine/`.

## 9. Plan por días
| Día | Entregable |
|-----|------------|
| 1  | Proyecto base; torre extruida desde el JSON, con órbita |
| 2  | Materiales, HDRI, contexto urbano, animación de entrada |
| 3  | Raycasting: resaltar piso y unidad; colores por estado (datos mock) |
| 4  | Supabase: migraciones, RLS, seed de 46 unidades; conectar datos reales |
| 5  | Panel de unidad, plano SVG, WhatsApp, leads, URL por unidad |
| 6  | Filtros, transparencias, leyenda, contador |
| 7  | Admin con login + Realtime (momento 3) |
| 8  | Vista de fachada con polígonos SVG |
| 9  | Rendimiento y pruebas en dispositivos reales; deploy en Vercel |
| 10 | Pulido, QR, ensayo; asoleamiento si sobra tiempo |
