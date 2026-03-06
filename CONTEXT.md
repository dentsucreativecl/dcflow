# DC Flow — Documento de Contexto del Proyecto
> Generado: 2026-03-04 | Uso: contexto para agentes de IA

---

## 1. Stack Técnico Completo

### Framework y Runtime
- **Next.js 14.1.0** (App Router, no Pages Router)
- **React 18.2.0**
- **TypeScript 5.3.3** (strict mode, pero `ignoreBuildErrors: true` en next.config — TypeScript NO bloquea builds)
- **Node.js** (runtime)

### Base de Datos y ORM
- **PostgreSQL** (alojado en Supabase)
- **Prisma 7.3.0** con `@prisma/adapter-pg` (adaptador pg directo)
- **`pg` 8.18.0** (driver PostgreSQL nativo)
- `DATABASE_URL` en `.env.local` para conexión directa

### Autenticación
- **Supabase Auth** (`@supabase/supabase-js 2.94.1`, `@supabase/ssr 0.8.0`, `@supabase/auth-helpers-nextjs 0.15.0`)
- Middleware en `middleware.ts` protege todas las rutas excepto `/login`, `/register`, `/forgot-password`, `/reset-password`
- El User ID de Supabase Auth es UUID; el modelo `User` en Prisma lo usa como PK
- JWT expiry: 3600 segundos; refresh token rotation habilitado

### UI
- **Tailwind CSS 3.4.1** (dark mode por clase, colores custom, fuentes Geist y JetBrains Mono)
- **Radix UI** (conjunto completo: Dialog, Dropdown, Select, Toast, Tabs, Switch, Popover, etc.)
- **shadcn/ui** (patrón — componentes en `components/ui/`)
- **lucide-react 0.323.0** (iconos)
- **next-themes 0.2.1** (theme switching)
- **class-variance-authority**, **clsx**, **tailwind-merge**

### Estado Global
- **Zustand 5.0.11** (store en `lib/store.ts`) — ADVERTENCIA: inicializado con mock data, solo persiste `sidebarCollapsed` en localStorage

### Formularios y Validación
- **react-hook-form 7.50.1** + **@hookform/resolvers 3.3.4**
- **Zod 3.22.4** (schemas de validación)

### Componentes Especializados
- **TipTap 3.x** (editor rich text con extensiones: link, mention, placeholder)
- **react-big-calendar 1.19.4** (vista calendario)
- **@dnd-kit** (drag & drop en kanban/listas)
- **recharts 2.12.0** (gráficas)
- **@tanstack/react-table 8.11.8** (tablas)
- **react-day-picker 8.10.0** (date picker)
- **react-dropzone 14.4.0** (carga de archivos)
- **cmdk 1.1.1** (command palette)

### Export
- **jspdf 4.1.0** (exportar PDF)
- **xlsx 0.18.5** (exportar Excel)
- **date-fns 3.6.0** (utilidades de fecha)

### Deploy / Hosting Configurado
- **Supabase** (DB + Auth + Storage + Realtime) — configuración local en `supabase/config.toml`
- **No hay configuración de deploy cloud** (Vercel, Railway, etc.) en el repositorio
- `next.config.js` tiene `images.unoptimized: true` (flag de desarrollo, no productivo)
- No hay `Dockerfile`, `railway.toml`, `vercel.json` ni equivalente

---

## 2. Estructura del Proyecto

```
dc-flow-app/
├── app/
│   ├── layout.tsx                    # Root layout con providers
│   ├── error.tsx                     # Error boundary global
│   ├── login/page.tsx
│   ├── register/page.tsx
│   └── (dashboard)/                  # Route group — requiere auth
│       ├── layout.tsx                # Sidebar + shell
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
│       ├── time/page.tsx
│       ├── inbox/page.tsx
│       ├── admin/page.tsx
│       ├── settings/page.tsx
│       ├── docs/page.tsx
│       ├── reports/page.tsx
│       ├── team/
│       │   ├── page.tsx
│       │   ├── workload/page.tsx
│       │   └── [id]/{page,client-page}.tsx
│       ├── dm/[contactId]/{page,client-page}.tsx
│       └── channels/[channelId]/page.tsx
│
├── components/
│   ├── ui/                           # 32 componentes base (shadcn/ui pattern)
│   ├── features/                     # Componentes de feature
│   │   ├── custom-fields/
│   │   ├── list-view/
│   │   ├── notifications/
│   │   ├── time/
│   │   ├── keyboard-shortcuts.tsx
│   │   ├── onboarding-checklist.tsx  # localStorage only, sin DB
│   │   └── purge-data-card.tsx
│   ├── layout/
│   │   ├── sidebar-v2.tsx
│   │   ├── breadcrumbs.tsx
│   │   ├── icon-bar.tsx
│   │   ├── docs-sidebar-content.tsx
│   │   ├── reports-sidebar-content.tsx
│   │   ├── team-sidebar-content.tsx
│   │   └── time-sidebar-content.tsx
│   ├── modals/                       # 15 modales
│   │   ├── index.tsx                 # Router/dispatcher de modales
│   │   ├── task-detail-modal-v2.tsx  # 127KB — modal más complejo
│   │   ├── new-task-modal-v2.tsx
│   │   ├── new-project-modal.tsx
│   │   ├── new-client-modal.tsx
│   │   ├── new-member-modal.tsx
│   │   ├── new-event-modal.tsx
│   │   ├── log-time-modal.tsx
│   │   ├── bulk-assign-modal.tsx
│   │   ├── bulk-import-modal.tsx
│   │   ├── bulk-status-change-modal.tsx
│   │   ├── client-detail-modal.tsx
│   │   ├── project-detail-modal.tsx
│   │   ├── event-detail-modal.tsx
│   │   └── confirm-delete-modal.tsx
│   ├── auth/
│   │   ├── index.ts
│   │   └── permission-gate.tsx
│   └── providers/
│       └── theme-provider.tsx
│
├── contexts/
│   └── auth-context.tsx              # AuthContext con roles y permisos
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # Browser client
│   │   ├── server.ts                 # Server client (SSR)
│   │   └── types.ts                  # Tipos generados por Supabase
│   ├── auth/
│   │   ├── permissions.ts            # 40+ permisos definidos
│   │   └── roles.ts                  # Definición de roles
│   ├── permissions/
│   │   ├── resolver.ts
│   │   ├── service.ts
│   │   └── use-permissions.ts
│   ├── store.ts                      # Zustand store (CON MOCK DATA)
│   ├── data.ts                       # Mock data inicial
│   ├── automation-engine.ts          # Motor de automatizaciones
│   ├── export.ts                     # Utilidades PDF/CSV
│   ├── notifications.ts
│   ├── time-tracking.ts
│   ├── dependencies.ts
│   ├── favorites-store.ts
│   ├── date-utils.ts
│   └── utils.ts
│
├── prisma/
│   ├── schema.prisma                 # 24 modelos, 14+ enums
│   ├── seed-supabase.ts
│   └── seed-real.ts                  # Seed real: 33 users, 302 tasks, etc.
│
├── supabase/
│   └── config.toml                   # Configuración local Supabase
│
├── middleware.ts                     # Auth guard
├── next.config.js
├── tailwind.config.ts
└── prisma.config.ts
```

### Módulos/Áreas Implementadas
| Área | Descripción |
|------|-------------|
| Auth | Login, registro, sesión, guard middleware |
| Projects/Clients | Espacios de trabajo por cliente, listas dentro |
| Tasks | CRUD completo, kanban, lista, subtareas, dependencias, custom fields |
| Time Tracking | Registro manual y timer, agrupación por fecha |
| Docs | Editor TipTap, creación/edición de documentos |
| Calendar | Vista mensual con tareas por due date |
| Team | Perfiles, roles, workload (parcial) |
| Inbox | Notificaciones de actividad real desde DB |
| Reports | Resumen de horas, tareas, equipo, proyectos |
| Messaging | DMs (parcial), Channels (placeholder) |
| Admin | Panel (parcial — data mock) |
| Automations | Motor de reglas trigger→acción con Supabase |
| Export | PDF y CSV desde datos reales |

---

## 3. Estado Funcional

### Implementado y Funcionando (Supabase real)
- **Dashboard** (`/dashboard`) — queries reales de TaskAssignment, Status, Space
- **Projects** (`/projects`, `/projects/[id]`) — CRUD real
- **Clients** (`/clients`, `/clients/[id]`) — CRUD real
- **Lists** (`/lists/[listId]`) — kanban y lista real
- **Tasks** (`/tasks`, `/my-tasks`) — queries reales, filtros, estados
- **Time Tracking** (`/time`) — timer funcional, inserts a DB, export CSV
- **Calendar** (`/calendar`) — tareas con due date desde Supabase
- **Inbox** (`/inbox`) — actividades reales desde tabla `Activity`
- **Reports** (`/reports`) — 4 tabs con datos reales (horas, tareas, equipo, proyectos)
- **Docs** (`/docs`) — CRUD de documentos desde tabla `Document`
- **Settings** (`/settings`) — datos reales del usuario autenticado
- **DMs** (`/dm/[contactId]`) — mensajería directa (verificar grado de completitud)
- **Modales** (15 total) — mayormente con integración Supabase real
- **Automation Engine** — reglas trigger→acción con Supabase
- **Middleware** — protección de rutas completa

### Parcialmente Implementado
- **Team Workload** (`/team/workload`) — UI real, data desde `useAppStore()` (mock), NO conectado a Supabase
- **Admin** (`/admin`) — UI real, stats desde store mock, actividad reciente hardcodeada ("2 hours ago", "+8%")
- **Team** (`/team`, `/team/[id]`) — verificar grado de integración DB

### Placeholder / No Implementado / Roto
- **Channels** (`/channels/[channelId]`) — mensajes 100% hardcodeados en el cliente, ninguna persistencia en DB; `generateStaticParams()` retorna array vacío
- **`lib/store.ts`** — Zustand store inicializado con mock data de `lib/data.ts`; páginas que lo consumen (Admin, Workload) muestran datos falsos
- **Onboarding checklist** — usa localStorage, no DB
- **No existe `/app/api/`** — sin rutas API personalizadas (todo directo a Supabase)
- **`/forgot-password`** y **`/reset-password`** — listadas como públicas en middleware pero no tienen carpetas en `app/`
- **`next.config.js`** tiene `images.unoptimized: true` — no apto para producción

---

## 4. Modelo de Datos

### Enums
| Enum | Valores |
|------|---------|
| `UserRole` | SUPER_ADMIN, ADMIN, MEMBER |
| `UserType` | MEMBER, GUEST |
| `SpaceRole` | OWNER, ADMIN, MEMBER, VIEWER |
| `StatusType` | TODO, IN_PROGRESS, DONE |
| `Priority` | URGENT, HIGH, NORMAL, LOW |
| `PitchResult` | PENDING, WON, LOST, CANCELLED |
| `PermissionLevel` | FULL_EDIT, EDIT, COMMENT, READ_ONLY |
| `TeamRole` | LEAD, MEMBER |
| `ActivityType` | CREATED, STATUS_CHANGED, ASSIGNED, UNASSIGNED, DUE_DATE_CHANGED, PRIORITY_CHANGED, COMMENT_ADDED, ATTACHMENT_ADDED, DESCRIPTION_UPDATED |
| `NotificationType` | MENTION, TASK_ASSIGNED, TASK_UNASSIGNED, COMMENT_ADDED, STATUS_CHANGED, DUE_DATE_SOON, DUE_DATE_OVERDUE, TASK_COMPLETED, APPROVAL_NEEDED, APPROVAL_RECEIVED, INVITATION |
| `TaskRelationType` | BLOCKS, BLOCKED_BY, RELATES_TO, DUPLICATES, PARENT_OF, CHILD_OF |
| `CustomFieldType` | TEXT, NUMBER, DATE, SELECT, MULTI_SELECT, CHECKBOX, URL, EMAIL, PHONE, CURRENCY, RATING, PROGRESS, USER, LABEL |
| `AutoTrigger` | STATUS_CHANGED, TASK_CREATED, DUE_DATE_APPROACHING, DUE_DATE_PASSED, ASSIGNEE_ADDED, PRIORITY_CHANGED |
| `AutoAction` | CHANGE_STATUS, CHANGE_PRIORITY, ADD_ASSIGNEE, REMOVE_ASSIGNEE, SEND_NOTIFICATION, MOVE_TO_LIST, ADD_COMMENT |

### Entidades Principales y Relaciones Clave

```
User (UUID PK — desde Supabase Auth)
  ├─ SpaceMember[]      → Space (muchos-a-muchos)
  ├─ TaskAssignment[]   → Task
  ├─ TimeEntry[]
  ├─ Comment[]
  ├─ Activity[]
  ├─ Notification[]
  ├─ NotificationPreference
  ├─ TeamMember[]       → Team
  └─ Document[]

Space (cliente/proyecto padre)
  ├─ SpaceMember[]      → User
  ├─ Folder[]
  ├─ List[]
  ├─ Status[]
  ├─ Document[]
  └─ Automation[]

Folder (dentro de Space)
  └─ List[]

List (dentro de Space o Folder — soporte pitch tracking)
  ├─ Task[]
  ├─ Status[]
  └─ Document[]

Task (entidad central)
  ├─ TaskAssignment[]   → User
  ├─ Attachment[]
  ├─ Comment[]
  ├─ Activity[]
  ├─ Checklist[]
  ├─ TimeEntry[]
  ├─ CustomFieldValue[]
  ├─ TaskRelation[]     (BLOCKS, BLOCKED_BY, RELATES_TO, DUPLICATES, PARENT_OF, CHILD_OF)
  ├─ Task? (parent — subtareas)
  └─ Task[] (children — subtareas)

Status (custom por Space o List)
TimeEntry (hours, date, startTime nullable, endTime — columnas legacy: duration)
Automation (trigger + acción configurable)
CustomField + CustomFieldValue (campos custom por space)
Notification + NotificationPreference
Team + TeamMember
ResourcePermission (permisos granulares por recurso)
Invitation (tokens de invitación)
Annotation (comentarios en Attachment — proofing)
Template (LIST, FOLDER, TASK)
```

### Notas Críticas del Schema
- `Task.id` usa CUID; `TimeEntry.id` usa UUID (no poner ID explícito al insertar)
- Columnas `order`, `date`, `hours` en Task/TimeEntry son SQL reserved words — Prisma `db push` falló silenciosamente; se crearon vía `ALTER TABLE` raw
- `Task.id`, `Task.createdAt`, `Task.updatedAt` NO tienen defaults en DB aunque el schema los declare — pasar siempre explícitamente
- `TimeEntry.startTime` es nullable (legacy)

---

## 5. Roles y Permisos

### Sistema de Roles (Dos capas — inconsistencia existente)

**Capa 1 — Prisma/Supabase (`UserRole`):**
```
SUPER_ADMIN  → acceso total
ADMIN        → gestión completa de la agencia
MEMBER       → acceso estándar
```

**Capa 2 — AuthContext (`Role`, legacy para compatibilidad):**
```
admin   → todos los permisos (ver tabla abajo)
pm      → gestión de proyectos y equipo
member  → acceso básico a tareas propias
client  → acceso restringido al portal (sin permisos definidos actualmente)
```

**SpaceRole (por espacio/proyecto):**
```
OWNER → ADMIN → MEMBER → VIEWER
```

### Permisos Definidos (40+ en `lib/auth/permissions.ts`)
| Categoría | Permisos |
|-----------|---------|
| Proyectos | view_all_projects, view_assigned_projects, view_own_projects, create_project, edit_project, delete_project |
| Clientes | view_all_clients, create_client, edit_client, delete_client |
| Tareas | view_all_tasks, view_assigned_tasks, create_task, edit_task, delete_task |
| Equipo | view_team, manage_team, view_workload |
| Tiempo | log_time, view_all_time_entries, view_own_time_entries |
| Reportes | view_reports, export_reports |
| Admin | access_admin, manage_users, bulk_actions, import_data |
| Settings | edit_profile, manage_agency_settings |
| Portal cliente | approve_deliverables, submit_feedback |

### Mapeo Rol → Permisos
| Permiso clave | admin | pm | member | client |
|---------------|-------|----|--------|--------|
| view_all_projects | ✅ | ✅ | ❌ | ❌ |
| create_project | ✅ | ✅ | ❌ | ❌ |
| delete_project | ✅ | ❌ | ❌ | ❌ |
| manage_users | ✅ | ❌ | ❌ | ❌ |
| access_admin | ✅ | ❌ | ❌ | ❌ |
| view_workload | ✅ | ✅ | ❌ | ❌ |
| log_time | ✅ | ✅ | ✅ | ❌ |
| view_all_time_entries | ✅ | ✅ | ❌ | ❌ |
| approve_deliverables | ❌ | ❌ | ❌ | ✅ |

### RLS
- 27 tablas tienen Row Level Security habilitado en Supabase (implementado en Fase 1)
- Implementación vía `ResourcePermission` model para permisos granulares por recurso

---

## 6. Issues Conocidos

### TODOs / FIXMEs en Código
**Resultado real:** `grep` no encontró comentarios `TODO`, `FIXME`, o `HACK` de carácter técnico/arquitectónico en archivos `.ts`/`.tsx`. Los únicos matches de "TODO" son la constante de status `StatusType.TODO` (valor de enum, no deuda técnica).

### Issues Identificados por Análisis de Código

**CRÍTICO — Datos falsos visibles al usuario:**
1. **`/admin`** — Stats (proyectos activos, clientes, utilización) vienen de `useAppStore()` con mock data, no de Supabase. "Recent Activity" tiene timestamps hardcodeados ("2 hours ago", "5 hours ago"). Trends (+8%, +12%) son constantes.
2. **`/team/workload`** — Utilización, horas y tareas por miembro vienen del store mock, no de Supabase.
3. **`/channels/[channelId]`** — Mensajes 100% hardcodeados; `generateStaticParams()` retorna `[]`.

**CRÍTICO — Rutas públicas definidas sin implementar:**
4. `/forgot-password` y `/reset-password` — declaradas en `middleware.ts` como rutas públicas pero no existen carpetas en `app/`. Un usuario navegando ahí recibirá 404.

**MODERADO — Config no apta para producción:**
5. `next.config.js`: `typescript.ignoreBuildErrors: true` y `eslint.ignoreDuringBuilds: true` — errores no bloquean build.
6. `next.config.js`: `images.unoptimized: true` — desactiva optimización de imágenes.
7. No hay configuración de deploy (Vercel, Railway, Docker, etc.)

**MODERADO — Inconsistencia de roles:**
8. Dos sistemas de roles paralelos (`UserRole` en Supabase vs `Role` legacy en AuthContext) que deben mantenerse sincronizados manualmente. El rol `client` en AuthContext no tiene permisos definidos en la implementación real (array vacío en `ROLE_PERMISSIONS`).

**MENOR — Features incompletas:**
9. **`/dm/[contactId]`** — Implementación de mensajería directa, verificar si persiste en DB o es solo estado cliente.
10. **Onboarding checklist** — usa localStorage, no DB; no hay manera de trackear progreso por usuario en servidor.
11. **`lib/store.ts`** — Inicializado con `initialProjects`, `initialClients`, `initialTeamMembers`, `initialTasks` de `lib/data.ts` (mock). Cualquier componente que consuma este store sin hacer fetch propio a Supabase muestra datos falsos.

---

## 7. Próximos Pasos Evidentes

Ordenados por impacto para llegar a una beta funcional con datos reales:

### P0 — Bloqueante para beta real
1. **Conectar Admin y Workload a Supabase** — reemplazar `useAppStore()` con queries reales en `/admin` y `/team/workload`
2. **Implementar `/forgot-password` y `/reset-password`** — rutas declaradas en middleware sin páginas
3. **Implementar Channels con persistencia** — la mensajería de canales no persiste nada; necesita tabla en DB (no existe en schema actual) o integración con Supabase Realtime

### P1 — Para una beta robusta
4. **Remover `ignoreBuildErrors` y `ignoreDuringBuilds`** de `next.config.js` — encontrar y corregir errores TypeScript/ESLint existentes
5. **Remover `images.unoptimized: true`** para producción
6. **Configurar pipeline de deploy** (Vercel es la opción natural para Next.js + Supabase)
7. **Resolver inconsistencia de roles** — unificar el sistema legacy `Role` con `UserRole` de Supabase o documentar el mapeo explícitamente

### P2 — Para completitud funcional
8. **Portal cliente** — el rol `client` existe pero sin permisos definidos ni vistas específicas
9. **Mensajería DM** — verificar si persiste en DB; si no, conectar a Supabase Realtime o tabla `Message`
10. **Onboarding con DB** — mover estado del checklist a tabla de usuario en Supabase
11. **Limpiar `lib/store.ts`** — el store Zustand debería ser solo UI state (sidebar, modales, timer), NO fuente de datos de negocio

### P3 — Polish
12. **`task-detail-modal-v2.tsx` (127KB)** — candidato a refactorizar/dividir
13. **`generateStaticParams()` en channels** — retorna `[]`, considerar eliminar o implementar correctamente
14. **Tabla de mensajes** — no existe en `schema.prisma`; si se va a implementar mensajería real, agregar modelo `Message`/`Channel` al schema

---

## Apéndice — Variables de Entorno Requeridas

```env
NEXT_PUBLIC_SUPABASE_URL=          # URL pública del proyecto Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Anon key pública
SUPABASE_SERVICE_ROLE_KEY=         # Service role (solo servidor, NO exponer)
DATABASE_URL=                      # Connection string PostgreSQL para Prisma
```
