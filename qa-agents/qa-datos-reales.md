# QA Datos Reales - DC Flow
**Fecha:** 2026-03-10
**Agente:** QA Datos Reales
**Alcance:** Detectar donde la app muestra datos mock en lugar de datos reales de Supabase

---

## Resumen Ejecutivo

El store Zustand (`lib/store.ts`) se inicializa con datos mock de `lib/data.ts` (proyectos, clientes, tareas, equipo, eventos, milestones falsos). **La mayoria de paginas principales YA fueron migradas a Supabase**, pero quedan **focos criticos de datos falsos** en la pagina de Admin, los tabs de detalle de proyecto, y los canales de chat.

### Clasificacion rapida

| Pagina | Fuente de datos | Estado |
|--------|----------------|--------|
| `/dashboard` | Supabase (TaskAssignment) | REAL |
| `/tasks` | Supabase (Task) | REAL |
| `/my-tasks` | Supabase (TaskAssignment) | REAL |
| `/projects` | Supabase (List/Task) | REAL |
| `/clients` | Supabase (Space/SpaceMember) | REAL |
| `/team` | Supabase (User/TimeEntry) | REAL |
| `/team/workload` | Supabase (User/TaskAssignment) | REAL |
| `/calendar` | Supabase (Task) | REAL |
| `/inbox` | Supabase (Activity) | REAL |
| `/reports` | Supabase (TimeEntry/Task/User) | REAL |
| `/docs` | Supabase (Document) | REAL |
| `/admin` | **MOCK** (store Zustand) | FALSO |
| `/channels/[id]` | **HARDCODED** en cliente | FALSO |
| Project Detail Modal | **MOCK** (store Zustand) | PARCIAL |
| Project Activity Tab | **MOCK** (hardcoded) | FALSO |
| Project Timeline Tab | **MOCK** (hardcoded) | FALSO |
| Project Files Tab | **MOCK** (hardcoded) | FALSO |
| Project Budget Tab | **MOCK parcial** | PARCIAL |

---

## Hallazgos

### [CRITICO] Admin Dashboard usa store mock completo
- Archivo: `app/(dashboard)/admin/page.tsx`
- Linea: 23-39
- Que ve el usuario: Estadisticas calculadas a partir de `projects`, `clients`, `teamMembers` y `tasks` del store Zustand (datos de `lib/data.ts` — 6 proyectos mock, 6 clientes mock, 8 miembros mock, 8 tareas mock).
- Valores falsos mostrados:
  - "Active Projects": cuenta proyectos mock (no los reales de tabla `List`)
  - "Active Clients": cuenta clientes mock (no los reales de tabla `Space`)
  - "Team Members": cuenta miembros mock (no los reales de tabla `User`)
  - "Utilization Rate": calcula con `hoursThisWeek`/`capacity` mock
  - "Total Revenue" y "Total Budget": suma `spent` y `budget` mock de proyectos
  - **`+12%`**, **`+8%`**, **`+2`**, **`+5%`**: cambios hardcodeados (lineas 46, 53, 60, 69)
- Que deberia ver: Metricas calculadas desde Supabase (List, Space, User, TaskAssignment, TimeEntry)
- Fix sugerido: Reemplazar `useAppStore()` con `useEffect` + queries a Supabase como hacen `/dashboard` y `/reports`. Eliminar strings de cambio hardcodeados o calcularlos con datos historicos reales.

### [CRITICO] Admin Dashboard - Actividad reciente hardcodeada
- Archivo: `app/(dashboard)/admin/page.tsx`
- Linea: 198-226
- Que ve el usuario: 3 items de actividad completamente inventados:
  - "New project created" — "2 hours ago"
  - "Team member added" — "5 hours ago"
  - "Report exported" — "1 day ago"
- Que deberia ver: Actividades reales de la tabla `Activity` de Supabase
- Fix sugerido: Hacer query a `Activity` ordenado por `createdAt DESC` con limit 5, similar a como lo hace `/inbox`.

### [CRITICO] Canales de chat — mensajes 100% hardcodeados
- Archivo: `app/(dashboard)/channels/[channelId]/client-page.tsx`
- Linea: 22-45
- Que ve el usuario: Mensajes inventados de "Rebecca Sottorff", "Jose Rojas", "Zacha Martinez", "Valentina Espinoza" en canales `general`, `creatividad`, `produccion`. Tambien info de canal hardcodeada (nombre, descripcion, cantidad de miembros).
- Que deberia ver: Mensajes reales de una tabla de mensajes en Supabase.
- Problema adicional: No existen tablas `Channel` ni `Message` en `prisma/schema.prisma`. La funcionalidad de chat no tiene backend.
- `generateStaticParams()` retorna `[{ channelId: '_' }]` (placeholder, no datos reales).
- Fix sugerido: Crear modelos `Channel` y `Message` en el schema Prisma. Migrar a Supabase. Mientras tanto, mostrar un estado "Coming soon" en lugar de mensajes falsos que confunden al usuario.

### [CRITICO] Project Detail Modal — usa store mock
- Archivo: `components/modals/project-detail-modal.tsx`
- Linea: 54-60
- Que ve el usuario: Detalles de proyecto (nombre, cliente, equipo, budget, progress, tareas) provenientes del store Zustand. Cuando el usuario abre el modal de detalle desde la lista de proyectos, ve datos inventados de "Acme Brand Refresh", "TechCorp Website", etc.
- Que deberia ver: Datos del proyecto real (List + Tasks + Assignments de Supabase)
- Fix sugerido: Refactorizar el modal para hacer fetch a Supabase usando el `projectId` recibido via `modalData`, en lugar de buscar en `state.projects`.

### [MODERADO] Project Activity Tab — actividad 100% mock
- Archivo: `components/features/project-activity-tab.tsx`
- Linea: 27-80
- Que ve el usuario: Lista de actividades inventadas con usuarios falsos ("Sarah Chen", "Mike Johnson", "Rachel Green", etc.) y timestamps de marzo 2024.
- Que deberia ver: Actividades reales desde la tabla `Activity` filtradas por `taskId` de las tareas del proyecto.
- Fix sugerido: Recibir `listId` como prop, hacer query de Activity via Task -> List, renderizar datos reales.

### [MODERADO] Project Timeline Tab — milestones 100% mock
- Archivo: `components/features/project-timeline-tab.tsx`
- Linea: 21-50+
- Que ve el usuario: Milestones inventados ("Project Kickoff", "Discovery Phase Complete", etc.) con fechas de 2024. Tambien usa `useAppStore()` para tareas y milestones.
- Que deberia ver: Tareas reales con fechas del proyecto, o milestones reales si se implementa esa funcionalidad.
- Fix sugerido: Eliminar datos mock. Hacer query de tareas del proyecto desde Supabase y mostrar timeline basado en fechas reales.

### [MODERADO] Project Files Tab — archivos 100% mock
- Archivo: `components/features/project-files-tab.tsx`
- Linea: 28-70+
- Que ve el usuario: Lista de archivos inventados ("Brand Guidelines v2.pdf", "Hero Banner Final.png", "Logo Variations.ai") con nombres de equipo mock.
- Que deberia ver: Archivos reales desde la tabla `Attachment` vinculados a tareas del proyecto.
- Fix sugerido: Query `Attachment` via `Task.listId` y mostrar archivos reales de Supabase Storage.

### [MODERADO] Project Budget Tab — datos parcialmente mock
- Archivo: `components/features/project-budget-tab.tsx`
- Linea: 27-70
- Que ve el usuario: Recibe `project` y `tasks` como props (del store mock). El desglose de presupuesto por categoria (linea 58-63) usa porcentajes inventados (40% Design, 35% Dev, etc.). El gasto mensual (linea 66-70) es completamente hardcodeado.
- Que deberia ver: Datos de TimeEntry reales agrupados por categoria/mes.
- Fix sugerido: Calcular budget breakdown real desde TimeEntry. Eliminar datos mock de `monthlySpending`.

### [MENOR] DM (Mensajes Directos) — sin persistencia
- Archivo: `app/(dashboard)/dm/[contactId]/client-page.tsx`
- Linea: 38, 68-80
- Que ve el usuario: El contacto se carga desde Supabase (tabla `User`), pero los mensajes solo viven en estado local React. Al recargar la pagina, se pierden todos los mensajes.
- Que deberia ver: Mensajes persistidos en Supabase.
- Problema: No existe tabla de mensajes directos en `prisma/schema.prisma`.
- Fix sugerido: Crear modelo `DirectMessage` en el schema. Mientras tanto, el estado actual no muestra datos falsos (comienza vacio), por lo que es un issue de funcionalidad, no de datos mock.

### [MENOR] Store mock aun inicializado en memoria
- Archivo: `lib/store.ts`
- Linea: 111-121
- Que ve el usuario: Aunque la mayoria de paginas ya no usan los datos del store para renderizar, el store sigue inicializandose con `initialProjects`, `initialClients`, etc. Esto significa que componentes como modales de creacion/edicion que leen del store (ej: `ProjectDetailModal`, dropdowns que listan proyectos/clientes) muestran datos falsos.
- Fix sugerido: Inicializar el store con arrays vacios (`projects: []`, etc.) y eliminar el import de `lib/data.ts`. Los componentes que necesiten datos deben hacer fetch a Supabase.

### [MENOR] Global Search — funciona correctamente con Supabase
- Archivo: `components/features/global-search.tsx`
- Linea: 68-89
- Nota positiva: La busqueda global ya usa queries a Supabase (Task, List, Space, User). No muestra datos mock.

---

## Paginas verificadas como REALES (Paso 3)

### `/dashboard` — REAL
- Usa `createClient()` de Supabase directamente (linea 46)
- Query a `TaskAssignment` con joins a `Task`, `Status`, `List`, `Space` (linea 51-58)
- Query a `List`, `User`, `Space` para conteos (linea 60-63)
- `HoursCard` tambien usa Supabase: query a `TimeEntry` con joins (linea 45-60 de `hours-card.tsx`)
- Unico uso del store: `openModal` (UI only)
- **Veredicto: 100% datos reales**

### `/reports` — REAL (4 tabs)
- Tab "overview": horas mensuales desde `TimeEntry`, conteo de tareas desde `Task` con `Status(type)` — REAL
- Tab "projects": lista de proyectos desde `List` con conteo de tareas — REAL
- Tab "team": rendimiento de equipo desde `User` + `TimeEntry` + `TaskAssignment` — REAL
- Tab "time": horas por mes desde `TimeEntry` — REAL
- **Veredicto: 100% datos reales**

### `/inbox` — REAL
- Query a tabla `Activity` con joins a `Task` y `User` (linea 69-73)
- Usa `formatDistanceToNow` de date-fns para timestamps relativos (no hardcodeados)
- **Veredicto: 100% datos reales**

### `/team` — REAL
- Query a `User` con filtro `userType: MEMBER`, `isActive: true` (linea 39-43)
- Query a `TeamMember` y `TimeEntry` para horas semanales (linea 44-46)
- Nota: importa `type TeamMember from "@/lib/data"` pero solo para la interfaz TypeScript, no para datos mock.
- **Veredicto: 100% datos reales**

### `/team/workload` — REAL
- Query a `User` y `TaskAssignment` con joins a `Task`, `Status`, `List` (linea 39-51)
- Calcula utilizacion basada en tareas activas reales
- **Veredicto: 100% datos reales**

---

## Resumen de impacto

| Severidad | Cantidad | Paginas afectadas |
|-----------|----------|-------------------|
| CRITICO | 4 | Admin, Channels, Project Detail Modal |
| MODERADO | 3 | Project Activity/Timeline/Files/Budget Tabs |
| MENOR | 3 | DM, Store initialization, misc |

## Accion recomendada prioritaria

1. **Admin page**: Migrar a Supabase (alta visibilidad, pagina de administradores)
2. **Channels**: Decidir si se implementa chat real o se elimina la funcionalidad mock
3. **Project Detail Modal + Tabs**: Migrar modal a fetch Supabase y reescribir tabs de Activity, Timeline, Files
4. **Limpiar store**: Inicializar con arrays vacios para evitar que cualquier componente no-migrado muestre datos falsos
