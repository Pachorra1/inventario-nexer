# Inventario Nexer

Aplicacion minima de inventario con Next.js (App Router), Supabase y TailwindCSS.

## Funcionalidades

- Inventario con cards de productos (imagen, nombre, cantidad).
- Alta de productos con carga de imagen a Supabase Storage.
- Registro de movimientos (`add` / `remove`) desde cada card del inventario.
- Historial de movimientos con filtro por producto.

## Requisitos

- Node.js 20+
- Proyecto de Supabase

## Configuracion

1. Copia `.env.example` a `.env.local` y completa:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=productos
```

2. Ejecuta el SQL de [`supabase/schema.sql`](supabase/schema.sql) en el SQL Editor de Supabase.
3. Instala dependencias y ejecuta en local:

```bash
npm install
npm run dev
```

## Deploy en Vercel

1. Importa el repositorio en Vercel.
2. Configura las mismas variables de entorno en el proyecto de Vercel.
3. Deploy.

La aplicacion usa Server Actions para operaciones de base de datos y subida de imagenes.
