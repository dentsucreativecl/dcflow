# DC Flow

Plataforma de gestión de proyectos para dentsu creative Chile. Centraliza la gestión de clientes, proyectos, tareas, tiempo, documentos y comunicación del equipo.

## Stack

- **Frontend**: Next.js 14 (App Router) + React 18 + TypeScript
- **UI**: Tailwind CSS + shadcn/ui + Radix UI
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Realtime)
- **ORM**: Prisma 7
- **Deploy**: Vercel

## Requisitos

- Node.js 18+
- Cuenta de Supabase con proyecto configurado

## Setup

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales de Supabase

# Aplicar schema a la base de datos
npx prisma db push

# Seed de datos (opcional)
npm run db:seed

# Iniciar servidor de desarrollo
npm run dev
```

La app estará disponible en `http://localhost:3000`.

## Variables de Entorno

| Variable | Descripcion |
|----------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL publica del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key publica |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (solo servidor) |
| `DATABASE_URL` | Connection string PostgreSQL |

## Scripts

```bash
npm run dev          # Servidor de desarrollo
npm run build        # Build de produccion
npm run start        # Servidor de produccion
npm run lint         # Linter
npm run db:seed      # Seed de datos base
npm run db:seed-real # Seed con datos reales (33 users, 302 tasks)
npm run seed:excel   # Importar desde Excel
```

## Estructura del Proyecto

```
app/
  (dashboard)/       # Paginas protegidas (dashboard, projects, tasks, etc.)
  api/               # 18 rutas API (admin, projects, tasks, team, etc.)
  login/             # Paginas publicas
components/
  ui/                # Componentes base (shadcn/ui)
  features/          # Componentes de features
  modals/            # 18 modales (task detail, create, delete, etc.)
  layout/            # Sidebar, header, breadcrumbs
contexts/
  auth-context.tsx   # AuthProvider — sesion, roles, permisos
lib/
  supabase/          # Clientes Supabase (browser, server, admin)
  auth/              # Permisos y roles
  store.ts           # Zustand (estado UI)
prisma/
  schema.prisma      # 30 modelos de datos
```

## Funcionalidades

- **Clientes y Proyectos** — Espacios de trabajo por cliente con folders y listas
- **Tareas** — Vistas: lista, kanban, calendario, timeline. Subtareas, dependencias, campos custom, automaciones
- **Equipo** — Perfiles, carga de trabajo, desactivacion con reasignacion de tareas
- **Tiempo** — Timer integrado, registro manual, reportes y export CSV
- **Documentos** — Editor rich text (TipTap)
- **Canales** — Mensajeria en tiempo real (Supabase Realtime)
- **Notificaciones** — Real-time con fallback polling
- **Reportes** — Horas, tareas, equipo, proyectos
- **Admin** — Gestion de usuarios, roles, perfiles
- **Busqueda Global** — Command palette (Cmd+K)
- **Automaciones** — Reglas trigger-accion configurables por espacio

## Roles

| Rol | Acceso |
|-----|--------|
| Super Admin | Total — puede eliminar cualquier recurso |
| Admin | Gestion completa de la agencia |
| PM | Gestion de proyectos y equipo |
| Member | Acceso a tareas propias |
| Guest | Acceso restringido al espacio asignado |

## Arquitectura de Auth

El sistema usa Supabase Auth con JWT y refresh tokens de un solo uso. Un mutex serializa las operaciones de auth para evitar race conditions cuando el tab vuelve de inactividad.

Flujo de recuperacion post-inactividad:
1. `VisibilityRefetchProvider` detecta que el tab vuelve a estar visible
2. Llama `refreshSession()` serializado por mutex
3. Propaga token fresco a Realtime WebSocket
4. Dispara evento `dcflow:refresh` para que todas las paginas re-fetch

## Testing

```bash
# Setup Playwright
npm run pw:setup

# Ejecutar tests
npm run pw:test

# Tests con UI
npm run pw:ui
```

## Documentacion Tecnica

Ver `CONTEXT.md` para documentacion detallada del proyecto incluyendo modelo de datos, API routes, patrones de codigo y decisiones de arquitectura.
