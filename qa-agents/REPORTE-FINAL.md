# Reporte QA DC Flow — 2026-03-10

## Resumen Ejecutivo

DC Flow tiene una base sólida: las páginas principales (dashboard, tasks, projects, clients, team, calendar, inbox, reports, docs) ya están conectadas a Supabase con datos reales. Sin embargo, existen **13 issues críticos** que bloquean una beta funcional, concentrados en 4 áreas: (1) páginas admin/channels con datos 100% falsos, (2) rutas de recuperación de contraseña inexistentes, (3) modales críticos (log time, bulk import, new member) que solo escriben en el store local sin persistir en DB, y (4) vulnerabilidades de auth como `getSession()` inseguro y `/reports` sin protección de permisos. El task detail modal (127KB) es sorprendentemente completo y funcional.

**Conteo total: 13 críticos | 13 moderados | 8 menores**

---

## P0 — Bloqueante para beta

### 1. [DATOS] Admin Dashboard — 100% datos mock
- **Archivo:** `app/(dashboard)/admin/page.tsx:23-226`
- **Problema:** Todas las stats (Active Projects, Clients, Team Members, Utilization Rate, Revenue, Budget) vienen del store Zustand con datos de `lib/data.ts`. Los porcentajes de cambio (`+12%`, `+8%`, `+2`, `+5%`) están hardcodeados. "Recent Activity" tiene timestamps inventados ("2 hours ago", "5 hours ago").
- **Fix:** Reemplazar `useAppStore()` con queries a Supabase (List, Space, User, TimeEntry, Activity).

### 2. [DATOS] Channels — sin backend, mensajes 100% hardcodeados
- **Archivo:** `app/(dashboard)/channels/[channelId]/client-page.tsx:22-45`
- **Problema:** Mensajes inventados (Rebecca Sottorff, Jose Rojas, etc.). No existen tablas `Channel` ni `Message` en `prisma/schema.prisma`. `generateStaticParams()` retorna placeholder.
- **Fix:** Crear modelos Channel/Message en schema, o reemplazar con estado "Coming soon".

### 3. [AUTH] Rutas /forgot-password y /reset-password — 404
- **Archivo:** `middleware.ts:4` (declaradas pero sin páginas en `app/`)
- **Problema:** Usuario que olvida contraseña queda permanentemente bloqueado. No hay flujo de recuperación.
- **Fix:** Implementar `app/forgot-password/page.tsx` con `supabase.auth.resetPasswordForEmail()` y `app/reset-password/page.tsx` con `supabase.auth.updateUser()`.

### 4. [AUTH] getSession() inseguro para inicialización
- **Archivo:** `contexts/auth-context.tsx:164`
- **Problema:** Usa `getSession()` que lee de localStorage sin validar con servidor. Un atacante puede manipular datos de sesión para cargar perfil de otro usuario.
- **Fix:** Cambiar a `supabase.auth.getUser()`.

### 5. [AUTH] /reports sin verificación de permisos
- **Archivo:** `app/(dashboard)/reports/page.tsx`
- **Problema:** Cualquier usuario autenticado (incluyendo member/client) puede ver horas, rendimiento y estadísticas de todos los miembros. `canAccessRoute` está definido pero nadie lo invoca.
- **Fix:** Agregar `PermissionGate` o verificación de `view_reports`.

### 6. [AUTH] Rol `pm` inalcanzable
- **Archivo:** `contexts/auth-context.tsx:87-91`
- **Problema:** `mapSupabaseRoleToLegacy()` nunca retorna `'pm'`. El rol tiene permisos definidos en 2 archivos pero ningún usuario real puede obtenerlo. `isPM` siempre es `false`.
- **Fix:** Agregar mapeo en `mapSupabaseRoleToLegacy()` o eliminar el rol pm si no se necesita.

### 7. [FEATURES] DMs — mensajes NO persisten en DB
- **Archivo:** `app/(dashboard)/dm/[contactId]/client-page.tsx:68-84`
- **Problema:** `sendMessage()` solo hace `setMessages([...messages, newMsg])` — estado local React. No existe modelo `Message` en schema. Adjuntos tampoco se suben a Storage. Todo se pierde al recargar.
- **Fix:** Crear modelo Message en schema.prisma, implementar insert + realtime subscription.

### 8. [FEATURES] LogTimeModal — NO inserta TimeEntry en DB
- **Archivo:** `components/modals/log-time-modal.tsx:93-118`
- **Problema:** `onSubmit` solo actualiza `loggedHours` en store local. No hay llamada a Supabase. La página `/time` (que sí lee de Supabase) no muestra las entradas.
- **Fix:** Insertar en `supabase.from("TimeEntry")` con taskId, userId, hours, date.

### 9. [FEATURES] BulkImportModal — usa store local, no persiste
- **Archivo:** `components/modals/bulk-import-modal.tsx:57-123`
- **Problema:** Importación CSV llama `addProject()`/`addTask()`/`addClient()` del store Zustand. Datos desaparecen al recargar.
- **Fix:** Reemplazar con inserts a Supabase siguiendo schema Prisma real.

### 10. [FEATURES] NewMemberModal — NO crea usuario real
- **Archivo:** `components/modals/new-member-modal.tsx:90-117`
- **Problema:** Solo llama `addTeamMember()` del store local. No crea User en Supabase, no envía invitación, no crea Invitation en DB.
- **Fix:** Implementar flujo real con `inviteUserByEmail()` de Supabase Auth.

### 11. [DATOS] Project Detail Modal — lee del store mock
- **Archivo:** `components/modals/project-detail-modal.tsx:54-60`
- **Problema:** Detalles de proyecto (nombre, cliente, equipo, budget, tareas) provienen del store Zustand con datos inventados.
- **Fix:** Refactorizar para fetch a Supabase usando `projectId`.

### 12. [DATOS] Project Tabs (Activity, Timeline, Files, Budget) — hardcodeados
- **Archivos:** `components/features/project-activity-tab.tsx:27-80`, `project-timeline-tab.tsx:21-50`, `project-files-tab.tsx:28-70`, `project-budget-tab.tsx:27-70`
- **Problema:** Actividades con usuarios falsos, milestones inventados, archivos ficticios, presupuesto con porcentajes hardcodeados.
- **Fix:** Hacer queries a Activity, Task, Attachment, TimeEntry por proyecto real.

### 13. [AUTH] setRole() permite cambio de rol en cliente
- **Archivo:** `contexts/auth-context.tsx:232-235`
- **Problema:** `setRole('admin')` desde consola del navegador da acceso visual a todas las funciones admin (bypass de UI). No afecta server-side RLS pero rompe toda restricción de interfaz.
- **Fix:** Eliminar `setRole()` público o agregar validación server-side.

---

## P1 — Beta robusta

### 14. [AUTH] Tres sistemas de permisos paralelos desincronizados
- **Archivos:** `lib/auth/permissions.ts` (31 permisos), `contexts/auth-context.tsx` (13 permisos), `lib/permissions/resolver.ts` (ACL levels)
- **Problema:** Nombres diferentes, tipos incompatibles. Un componente puede verificar permisos en un sistema y otro componente en otro, dando resultados distintos.
- **Fix:** Unificar en un solo sistema. El resolver ACL parece ser el más maduro.

### 15. [AUTH] /settings accesible para todos los roles
- **Archivo:** `app/(dashboard)/settings/page.tsx:29-40`
- **Problema:** Solo verifica `if (!user)` pero no el rol. Componentes admin están condicionados pero la página es accesible.
- **Fix:** Agregar `canAccessRoute('/settings')` con redirect.

### 16. [AUTH] Middleware startsWith() — match de prefijo vulnerable
- **Archivo:** `middleware.ts:39-41`
- **Problema:** `/login-as-admin`, `/reset-password-steal-tokens` serían tratadas como públicas. Bug latente.
- **Fix:** Usar comparación exacta: `pathname === route || pathname.startsWith(route + '/')`.

### 17. [AUTH] Middleware no retorna JSON para rutas API
- **Archivo:** `middleware.ts:60-64`
- **Problema:** API routes reciben redirect HTML en vez de 401 JSON. Patrón frágil si se crean nuevas API routes.
- **Fix:** Detectar `/api/` y retornar `NextResponse.json({ error: 'Unauthorized' }, { status: 401 })`.

### 18. [AUTH] Registro abierto sin restricciones
- **Archivo:** `app/register/page.tsx:56-98`
- **Problema:** Cualquier persona puede registrarse como MEMBER y acceder a información interna de la agencia.
- **Fix:** Implementar restricción por dominio de email o sistema de invitaciones.

### 19. [FEATURES] Timer no persiste al recargar página
- **Archivo:** `app/(dashboard)/time/page.tsx:54-56, 174-199`
- **Problema:** Timer es `useState` puro. `lib/time-tracking.ts` tiene funciones DB-backed (startTimer/stopTimer/getActiveTimer) pero la página NO las usa.
- **Fix:** Usar las funciones existentes de `lib/time-tracking.ts`.

### 20. [FEATURES] Discrepancia de schema entre lib/time-tracking.ts y Prisma
- **Archivo:** `lib/time-tracking.ts` vs `prisma/schema.prisma`
- **Problema:** La lib inserta campos (startTime, endTime, duration, isManual) que no existen en el modelo TimeEntry real (solo tiene hours, date, description). Causará errores 400.
- **Fix:** Alinear schema Prisma o reescribir lib para usar campos reales.

### 21. [FEATURES] Time Page — insert sin UUID explícito
- **Archivo:** `app/(dashboard)/time/page.tsx:185-191`
- **Problema:** Insert de TimeEntry sin `id` — defaults de Prisma no aplican vía Supabase directo.
- **Fix:** Agregar `id: crypto.randomUUID()` al insert.

### 22. [FEATURES] LogTimeModal — campo `billable` sin columna en DB
- **Archivo:** `components/modals/log-time-modal.tsx:43`
- **Problema:** Checkbox "Tiempo facturable" decorativo, no hay columna `billable` en TimeEntry.
- **Fix:** Agregar `billable Boolean @default(true)` al modelo.

### 23. [FEATURES] Automation Engine — catch vacío + no reactivo
- **Archivo:** `lib/automation-engine.ts:65-67`
- **Problema:** Errores tragados silenciosamente. Automatizaciones solo se ejecutan cuando se llaman manualmente desde puntos específicos del código, no reactivamente.
- **Fix:** Agregar logging de errores. Considerar Supabase Database Triggers.

### 24. [FEATURES] Onboarding Checklist — solo localStorage
- **Archivo:** `components/features/onboarding-checklist.tsx:23-36`
- **Problema:** Progreso se pierde al limpiar caché o cambiar dispositivo. Catch vacío en parse de JSON.
- **Fix:** Guardar en tabla de Supabase. Detectar pasos completados consultando DB.

### 25. [FEATURES] Portal Cliente — sin UI implementada
- **Archivos:** `lib/auth/permissions.ts`, `lib/auth/roles.ts`
- **Problema:** Rol `client` con permisos definidos (approve_deliverables, submit_feedback) pero sin ninguna vista o componente que los implemente.
- **Fix:** Crear vistas dedicadas para el portal cliente.

### 26. [DATOS] Store Zustand inicializado con mock data
- **Archivo:** `lib/store.ts:111-121`
- **Problema:** Sigue importando datos de `lib/data.ts`. Cualquier componente no migrado muestra datos falsos.
- **Fix:** Inicializar con arrays vacíos. Eliminar import de `lib/data.ts`.

---

## P2 — Completitud funcional

### 27. [AUTH] Login page sin enlace a forgot-password
- **Archivo:** `app/login/page.tsx`
- **Fix:** Agregar enlace "¿Olvidaste tu contraseña?" al formulario.

### 28. [FEATURES] Task Detail Modal — botón "Compartir" sin funcionalidad
- **Archivo:** `components/modals/task-detail-modal-v2.tsx:1280-1282`
- **Fix:** Implementar copiar link al portapapeles.

### 29. [FEATURES] Task Detail Modal — 10+ console.error en producción
- **Archivo:** `components/modals/task-detail-modal-v2.tsx` (múltiples líneas)
- **Fix:** Usar logger centralizado desactivable en producción.

### 30. [FEATURES] New Task Modal — Activity insert sin await
- **Archivo:** `components/modals/new-task-modal-v2.tsx:217-225`
- **Fix:** Agregar manejo de error al insert de Activity.

### 31. [FEATURES] New Task Modal — self.crypto inconsistente
- **Archivo:** `components/modals/new-task-modal-v2.tsx:189`
- **Fix:** Cambiar a `crypto.randomUUID()` para consistencia.

### 32. [FEATURES] Bulk Import Modal — textos mezclados español/inglés
- **Archivo:** `components/modals/bulk-import-modal.tsx:147-196`
- **Fix:** Unificar idioma.

### 33. [AUTH] isPM nunca será true
- **Archivo:** `contexts/auth-context.tsx:273`
- **Fix:** Resolver junto con el issue del rol pm (#6).

---

## Plan de acción sugerido

| Orden | Issue(s) | Complejidad | Descripción |
|-------|----------|-------------|-------------|
| **1** | #4, #13 | Baja | Fix seguridad auth: cambiar getSession→getUser, eliminar setRole() público |
| **2** | #5, #15 | Baja | Agregar PermissionGate a /reports y /settings |
| **3** | #6, #33 | Baja | Resolver mapeo rol pm o eliminar rol fantasma |
| **4** | #3, #27 | Media | Implementar /forgot-password y /reset-password |
| **5** | #8, #22 | Media | Reescribir LogTimeModal para persistir en Supabase |
| **6** | #10 | Media | Conectar NewMemberModal con Supabase Auth + Invitation |
| **7** | #9 | Media | Reescribir BulkImportModal para insertar en Supabase |
| **8** | #1, #12 | Media | Migrar Admin + Project Tabs a queries Supabase |
| **9** | #11, #26 | Media | Migrar ProjectDetailModal a Supabase, limpiar store mock |
| **10** | #7 | Alta | Crear modelo Message, implementar DMs con persistencia + realtime |
| **11** | #2 | Alta | Crear modelos Channel/Message, implementar chat real o eliminar |
| **12** | #14 | Alta | Unificar 3 sistemas de permisos en uno solo |
| **13** | #16, #17 | Baja | Fix middleware: comparación exacta + JSON response para API |
| **14** | #19, #20, #21 | Media | Alinear time tracking: usar lib existente, fix schema, agregar UUID |
| **15** | #18 | Media | Implementar restricción de registro (dominio/invitación) |
| **16** | #23, #24, #25 | Alta | Automation engine reactivo, onboarding en DB, portal cliente |

**Estimación general:** Los pasos 1-3 son fixes rápidos de seguridad (~1-2h). Los pasos 4-9 son migraciones de datos mock a Supabase (~2-3 días). Los pasos 10-16 son features nuevas o refactors mayores (~1-2 semanas).

---

*Reportes individuales disponibles en:*
- `/tmp/qa-reports/qa-datos-reales.md`
- `/tmp/qa-reports/qa-rutas-auth.md`
- `/tmp/qa-reports/qa-features.md`
