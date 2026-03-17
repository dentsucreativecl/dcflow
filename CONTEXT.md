# DC Flow — Documento de Contexto del Proyecto
> Actualizado: 2026-03-17 | Uso: contexto para agentes de IA y desarrolladores

---

## 1. Stack Técnico

### Framework y Runtime
- **Next.js 14.1.0** (App Router)
- **React 18.2.0**
- **TypeScript 5.3.3** (strict mode, `ignoreBuildErrors: true` en next.config)
- **Node.js** (runtime)

### Base de Datos y ORM
- **PostgreSQL** (alojado en Supabase)
- **Prisma 7.3.0** con `@prisma/adapter-pg`
- **`pg` 8.18.0** (driver PostgreSQL nativo)
- 30 modelos, 14+ enums en `prisma/schema.prisma`
- 9 migraciones SQL en `supabase/migrations/`

### Autenticación
- **Supabase Auth** (`@supabase/supabase-js 2.94.1`, `@supabase/ssr 0.8.0`)
- Middleware en `middleware.ts` protege todas las rutas excepto públicas
- JWT expiry: 3600s; refresh token rotation habilitado
- **Token refresh serializado** via mutex en `lib/supabase/client.ts` para evitar race conditions con single-use refresh tokens
- Recuperación automática en tab inactivo via `VisibilityRefetchProvider`

### UI
- **Tailwind CSS 3.4.1** (dark mode por clase)
- **Radix UI** + **shadcn/ui** (componentes en `components/ui/`)
- **lucide-react 0.323.0** (iconos)
- **next-themes 0.2.1** (theme switching)

### Estado Global
- **Zustand 5.0.11** (`lib/store.ts`) — estado UI: sidebar, modales, timer

### Componentes Especializados
- **TipTap 3.x** (editor rich text)
- **react-big-calendar** (vista calendario)
- **@dnd-kit** (drag & drop en kanban/listas)
- **recharts** (gráficas en reports)
- **cmdk** (command palette / global search)
- **jspdf** + **xlsx** (export PDF/Excel)

### Deploy
- **Vercel** (proyecto: `dcflow`, org: `dentsucreativecl`)
- **Supabase** (DB + Auth + Storage + Realtime)
- Dominio: `dcflow.vercel.app`

---

## 2. Estructura del Proyecto

```
dcflow/
├── app/
│   ├── layout.tsx                    # Root layout con providers
│   ├── error.tsx                     # Error boundary global
│   ├── login/page.tsx
│   ├── register/page.tsx
│   ├── forgot-password/page.tsx
│   ├── reset-password/page.tsx
│   ├── api/                          # 18 rutas API (ver sección 8)
│   └── (dashboard)/                  # Route group — requiere auth
│       ├── layout.tsx                # Sidebar + VisibilityRefetchProvider
│       ├── dashboard/page.tsx
│       ├── projects/
│       │   ├── page.tsx
│       │   └── [id]/{page,client-page}.tsx
│       ├── clients/
│       │   ├── page.tsx
│       │   └── [id]/{page,client-page}.tsx
│       ├── lists/
│       │   └── [listId]/{page,client-page}.tsx
│       ├── tasks/page.tsx
│       ├── my-tasks/page.tsx
│       ├── calendar/page.tsx
│       ├── inbox/page.tsx
│       ├── settings/page.tsx
│       ├── docs/page.tsx
│       ├── reports/page.tsx
│       ├── team/
│       │   ├── page.tsx
│       │   ├── workload/page.tsx
│       │   └── [id]/{page,client-page}.tsx
│       ├── dm/
│       │   ├── page.tsx
│       │   └── [contactId]/{page,client-page}.tsx
│       └── channels/
│           ├── page.tsx
│           └── [channelId]/{page,client-page}.tsx
│
├── components/
│   ├── ui/                           # ~32 componentes base (shadcn/ui)
│   ├── features/                     # Componentes de feature
│   │   ├── custom-fields/
│   │   ├── list-view/
│   │   ├── notifications/
│   │   └── time/
│   ├── layout/
│   │   ├── sidebar-v2.tsx
│   │   ├── top-header.tsx
│   │   ├── breadcrumbs.tsx
│   │   └── visibility-refetch-provider.tsx
│   └── modals/                       # 18 modales
│       ├── index.tsx                 # ModalProvider — router de modales
│       ├── task-detail-modal-v2.tsx  # Modal más complejo (~130KB)
│       ├── deactivate-member-modal.tsx
│       ├── confirm-delete-modal.tsx
│       └── ...
│
├── contexts/
│   └── auth-context.tsx              # AuthProvider — roles, permisos, sesión
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # Browser client con mutex de auth
│   │   ├── server.ts                 # Server client (SSR/API routes)
│   │   ├── admin.ts                  # Admin client (service role key)
│   │   └── types.ts                  # Tipos generados por Supabase
│   ├── auth/
│   │   └── permissions.ts            # 40+ permisos definidos
│   ├── permissions/
│   │   └── area-permissions.ts       # Permisos por área
│   ├── store.ts                      # Zustand (UI state only)
│   ├── automation-engine.ts
│   ├── dependencies.ts               # Task relations/blocking
│   └── utils.ts
│
├── prisma/
│   └── schema.prisma                 # 30 modelos
├── supabase/
│   ├── config.toml
│   └── migrations/                   # 9 migraciones
├── middleware.ts
└── next.config.js
```

---

## 3. Arquitectura de Auth y Recuperación Post-Inactividad

### Flujo de Auth
1. `middleware.ts` — valida sesión en cada request server-side
2. `AuthProvider` (`contexts/auth-context.tsx`) — inicializa user state, escucha `onAuthStateChange`
3. `createClient()` (`lib/supabase/client.ts`) — singleton browser con `autoRefreshToken: true`

### Recuperación tras inactividad de tab
Cuando el usuario vuelve a un tab después de inactividad:

1. `VisibilityRefetchProvider` detecta `visibilitychange` → `visible`
2. Llama `supabase.auth.refreshSession()` (serializado por mutex)
3. Si éxito → `setAuth()` en Realtime + dispatch `dcflow:refresh`
4. Si falla → fallback a sesión cacheada o redirect a `/login`
5. Todas las páginas escuchan `dcflow:refresh` e incrementan `refreshKey` → re-fetch

### Patrones clave
- **Mutex de auth** en `client.ts` — serializa operaciones de refresh para evitar que `autoRefreshToken` y `refreshSession()` consuman el mismo single-use refresh token
- **Safety timeout de 8s por fetch** — cada ciclo de fetch tiene su propio timeout
- **`onAuthStateChange(TOKEN_REFRESHED)`** NO llama `fetchProfile()` — el perfil no cambia en un token refresh
- **Realtime auto-reconnect** — canales se re-suscriben automáticamente tras `CHANNEL_ERROR`

---

## 4. Modelo de Datos (30 modelos)

### Entidades principales
```
User (UUID PK — desde Supabase Auth)
  ├─ SpaceMember[]      → Space (muchos-a-muchos)
  ├─ TaskAssignment[]   → Task
  ├─ TimeEntry[]
  ├─ Comment[], Activity[], Notification[]
  └─ TeamMember[]       → Team

Space (cliente/proyecto padre)
  ├─ SpaceMember[] → User
  ├─ Folder[] → List[]
  ├─ Status[], CustomField[]
  ├─ Document[], Automation[]
  └─ List[] → Task[]

Task (entidad central)
  ├─ TaskAssignment[] → User
  ├─ Attachment[], Comment[], Activity[]
  ├─ Checklist[] → ChecklistItem[]
  ├─ TimeEntry[], CustomFieldValue[]
  ├─ TaskRelation[] (BLOCKS, BLOCKED_BY, RELATES_TO, etc.)
  └─ Task[] (subtareas via parentId)

Channel → Message[], ChannelMember[]
```

### Enums principales
| Enum | Valores |
|------|---------|
| `UserRole` | SUPER_ADMIN, ADMIN, PM, MEMBER |
| `UserType` | MEMBER, GUEST |
| `StatusType` | TODO, IN_PROGRESS, DONE |
| `Priority` | URGENT, HIGH, NORMAL, LOW |

---

## 5. Roles y Permisos

### Sistema de Roles
| Rol Supabase | Rol Legacy | Acceso |
|-------------|-----------|--------|
| SUPER_ADMIN | admin | Total — puede eliminar cualquier recurso |
| ADMIN | admin | Gestión completa, sin eliminar |
| PM | pm | Gestión de proyectos y equipo |
| MEMBER | member | Acceso a tareas propias |
| (GUEST userType) | client | Acceso restringido al espacio asignado |

### Permisos por área
- `lib/permissions/area-permissions.ts` controla edición por área de usuario
- Usuarios solo pueden editar contenido de espacios asignados a su área
- Super Admin puede editar todo

### Eliminación de recursos (SUPER_ADMIN only)
- **Proyectos** — cascade delete: assignments, time entries, comments, custom fields, tasks
- **Clientes (Spaces)** — cascade delete: todo el contenido del space
- **Miembros** — soft-delete (`isActive: false`) con opción de reasignar tareas
- **Tareas** — individual y bulk delete con cascade
- **Documentos, Canales** — delete directo con cascade de dependencias

---

## 6. Rutas API (18 endpoints)

### Admin
| Ruta | Método | Descripción |
|------|--------|------------|
| `/api/admin/channels/[channelId]` | DELETE | Eliminar canal |
| `/api/admin/channels/[channelId]/archive` | PATCH | Archivar canal |
| `/api/admin/spaces/[spaceId]` | DELETE | Eliminar cliente/space |
| `/api/admin/users/[userId]/gender` | PATCH | Actualizar género |
| `/api/admin/users/[userId]/profile` | PATCH | Actualizar perfil |
| `/api/admin/users/[userId]/role` | PATCH | Cambiar rol |
| `/api/admin/users/[userId]/status` | PATCH | Activar/desactivar |

### Recursos
| Ruta | Método | Descripción |
|------|--------|------------|
| `/api/documents/[id]` | DELETE | Eliminar documento |
| `/api/folders` | POST | Crear folder |
| `/api/folders/[id]` | DELETE | Eliminar folder |
| `/api/projects` | POST | Crear proyecto |
| `/api/projects/[id]` | DELETE | Eliminar proyecto (cascade) |
| `/api/spaces` | GET | Listar spaces + folders + lists |
| `/api/spaces/[spaceId]/areas` | PATCH | Asignar áreas |
| `/api/tasks/[taskId]` | DELETE | Eliminar tarea(s) — soporta bulk via `?ids=` |

### Team
| Ruta | Método | Descripción |
|------|--------|------------|
| `/api/team/[userId]` | PATCH | Actualizar miembro |
| `/api/team/[userId]` | DELETE | Desactivar miembro + reasignar tareas |
| `/api/team/invite` | POST | Invitar miembro |
| `/api/permissions/area` | GET | Permisos por área |

---

## 7. Estado Funcional

### Implementado y funcionando (datos reales de Supabase)
- **Dashboard** — tareas asignadas, métricas por space
- **Projects** — CRUD completo, kanban, lista, calendar, timeline
- **Clients** — CRUD de spaces, avatar, miembros
- **Lists/Tasks** — kanban, lista, calendar, timeline, custom fields, automations, dependencies
- **Team** — perfiles, workload real, desactivación con reasignación
- **Time Tracking** — timer, registro manual, export CSV
- **Calendar** — tareas por due date
- **Inbox** — notificaciones reales desde DB con Realtime
- **Reports** — horas, tareas, equipo, proyectos con datos reales
- **Docs** — CRUD con editor TipTap
- **Channels** — mensajería real con Supabase Realtime
- **Admin** — gestión de usuarios, roles, perfiles con datos reales
- **Settings** — perfil del usuario autenticado
- **Auth** — login, registro, forgot/reset password
- **Automations** — reglas trigger → acción con Supabase
- **Global Search** — command palette (⌘K)

### Parcialmente implementado
- **DMs** — contactos reales, mensajes no persisten en DB (solo estado cliente)
- **Onboarding checklist** — localStorage, sin persistencia servidor

---

## 8. Patrones de Código Importantes

### Data fetching en páginas
```tsx
// Todas las páginas dashboard siguen este patrón:
const [refreshKey, setRefreshKey] = useState(0);
useEffect(() => {
  const handler = () => setRefreshKey(k => k + 1);
  window.addEventListener('dcflow:refresh', handler);
  return () => window.removeEventListener('dcflow:refresh', handler);
}, []);

useEffect(() => {
  if (authLoading) return;
  if (!user) { setLoading(false); return; }

  let cancelled = false;
  const timeoutId = setTimeout(() => {
    if (!cancelled) { cancelled = true; setLoading(false); }
  }, 8000);

  fetchData().finally(() => {
    clearTimeout(timeoutId);
    if (!cancelled) setLoading(false);
  });
  return () => { cancelled = true; clearTimeout(timeoutId); };
}, [user, authLoading, refreshKey]);
```

### Modales
```tsx
// Abrir modal:
openModal("confirm-delete", { title, message, onConfirm });
openModal("deactivate-member", { userId, userName });
openModal("task-detail-v2", { taskId, taskIds });

// Los modales se registran en components/modals/index.tsx
```

### Eventos custom
| Evento | Disparador | Consumidores |
|--------|-----------|-------------|
| `dcflow:refresh` | VisibilityRefetchProvider, modales de delete/create | Todas las páginas dashboard, sidebar, notifications |
| `dcflow:spaces-refresh` | Crear folder/proyecto | Sidebar |
| `dcflow:channels-refresh` | Crear canal | Sidebar |

---

## 9. Variables de Entorno

```env
NEXT_PUBLIC_SUPABASE_URL=          # URL pública del proyecto Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Anon key pública
SUPABASE_SERVICE_ROLE_KEY=         # Service role (solo servidor)
DATABASE_URL=                      # Connection string PostgreSQL para Prisma
```

---

## 10. Notas del Schema
- `Task.id` usa CUID; `TimeEntry.id` usa UUID
- Columnas `order`, `date`, `hours` son SQL reserved words — creadas via `ALTER TABLE` raw
- `Task.id`, `Task.createdAt`, `Task.updatedAt` NO tienen defaults en DB — pasar siempre explícitamente
- RLS habilitado en 27+ tablas
