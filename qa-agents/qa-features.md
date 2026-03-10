# QA Features Report - DC Flow
**Fecha:** 2026-03-10
**Agente:** QA Features
**Alcance:** DMs, Time Tracking, Task Detail Modal, Formularios Criticos, Onboarding, Portal Cliente, Automation Engine, Errores Silenciosos

---

## Resumen Ejecutivo

| Severidad | Cantidad |
|-----------|----------|
| CRITICO   | 5        |
| MODERADO  | 8        |
| MENOR     | 5        |

---

## Hallazgos

### [CRITICO] DMs: mensajes NO se persisten en base de datos
- Feature: Mensajes Directos (DM)
- Archivo: `app/(dashboard)/dm/[contactId]/client-page.tsx`
- Linea aproximada: 68-84
- Descripcion: La funcion `sendMessage()` solo agrega el mensaje al estado local via `setMessages([...messages, newMsg])`. No hay ningun `supabase.from("Message").insert(...)` ni llamada a API. Ademas, NO existe un modelo `Message` en `prisma/schema.prisma`. Los mensajes se pierden completamente al recargar la pagina.
- Impacto en usuario: El usuario escribe mensajes, cree que se enviaron, recarga la pagina y todos desaparecen. El otro usuario NUNCA ve los mensajes. La feature es 100% no funcional como sistema de comunicacion.
- Fix sugerido: Crear modelo `Message` en schema.prisma con campos (id, senderId, receiverId, content, attachment, createdAt). Implementar insert en Supabase al enviar y realtime subscription para recibir.

### [CRITICO] DMs: archivos adjuntos no se suben a Storage
- Feature: Mensajes Directos (DM) - Adjuntos
- Archivo: `app/(dashboard)/dm/[contactId]/client-page.tsx`
- Linea aproximada: 86-89
- Descripcion: El `handleFileSelect` captura el archivo en estado local, y `sendMessage` solo genera metadatos del adjunto en el mensaje local. No hay upload a Supabase Storage ni persistencia alguna.
- Impacto en usuario: El usuario "adjunta" un archivo, parece que se envio, pero no se almacena en ningun lado.
- Fix sugerido: Implementar upload a Supabase Storage similar a `components/features/file-upload-zone.tsx`.

### [CRITICO] LogTimeModal: NO inserta TimeEntry en base de datos
- Feature: Registro de Tiempo (modal)
- Archivo: `components/modals/log-time-modal.tsx`
- Linea aproximada: 93-118
- Descripcion: El `onSubmit` solo actualiza `loggedHours` en el store local via `updateTask()`. No hay llamada a Supabase para insertar un `TimeEntry`. Usa datos del store (`useAppStore().projects/tasks`) que son datos mock/locales, no de Supabase.
- Impacto en usuario: El usuario registra tiempo desde el modal, ve confirmacion de exito, pero la entrada NO se guarda en DB. La pagina `/time` (que si lee de Supabase) no muestra la entrada.
- Fix sugerido: Insertar en `supabase.from("TimeEntry")` con taskId, userId, hours, date, description. Usar datos reales de Supabase en vez del store local.

### [CRITICO] BulkImportModal: usa store local, no inserta en Supabase
- Feature: Importacion masiva CSV
- Archivo: `components/modals/bulk-import-modal.tsx`
- Linea aproximada: 57-123
- Descripcion: Toda la importacion usa `addProject()`, `addTask()` y `addClient()` del store local (`useAppStore`). Estos son funciones de estado cliente (Zustand), no insertan nada en Supabase/Prisma. Ademas, usa interfaces locales `Project`, `Task` de `@/lib/data` que no corresponden al schema real.
- Impacto en usuario: El usuario importa un CSV, ve mensaje de exito, pero los datos no llegan a la base de datos y desaparecen al recargar.
- Fix sugerido: Reemplazar llamadas al store con inserts a Supabase (`Task`, `List`, etc.) siguiendo el schema Prisma real.

### [CRITICO] NewMemberModal: NO crea usuario en Supabase/Prisma
- Feature: Agregar miembro del equipo
- Archivo: `components/modals/new-member-modal.tsx`
- Linea aproximada: 90-117
- Descripcion: El `onSubmit` solo llama `addTeamMember()` del store local. No crea registro en la tabla `User` de Supabase, no envia invitacion por Supabase Auth, no crea `Invitation` en DB.
- Impacto en usuario: Admin agrega un miembro, ve confirmacion, pero el usuario no existe en la DB, no puede hacer login, no aparece en queries de Supabase.
- Fix sugerido: Implementar flujo real: crear `Invitation` en DB, enviar email via Supabase Auth `inviteUserByEmail()`, y crear registro `User` cuando acepte la invitacion.

---

### [MODERADO] Time Tracking: timer no persiste al recargar pagina
- Feature: Timer en pagina de tiempo
- Archivo: `app/(dashboard)/time/page.tsx`
- Linea aproximada: 54-56, 174-199
- Descripcion: El estado del timer (`isTimerRunning`, `timerSeconds`, `timerTaskId`) es solo `useState`. No se guarda en localStorage ni en Supabase. El archivo `lib/time-tracking.ts` tiene funciones `startTimer`/`stopTimer`/`getActiveTimer` que SÍ persisten en DB, pero la pagina `/time` NO las usa. La pagina usa su propio timer basado en `setInterval`.
- Impacto en usuario: Si el usuario inicia un timer y recarga la pagina o navega a otra seccion, pierde todo el tiempo trackeado en esa sesion.
- Fix sugerido: Usar las funciones de `lib/time-tracking.ts` (startTimer/stopTimer/getActiveTimer) en la pagina. Al cargar, verificar si hay un timer activo con `getActiveTimer()`.

### [MODERADO] Time Tracking: discrepancia de schema entre lib y DB
- Feature: Time Tracking
- Archivo: `lib/time-tracking.ts` vs `prisma/schema.prisma`
- Linea aproximada: lib/time-tracking.ts:1-23
- Descripcion: `lib/time-tracking.ts` define un `TimeEntry` con campos `startTime`, `endTime`, `duration`, `isManual`, pero el modelo `TimeEntry` en Prisma solo tiene `hours`, `date`, `description`. Las funciones `startTimer()`, `logManualTime()` etc. insertan campos que NO existen en la tabla real (startTime, endTime, duration, isManual), lo que causara errores 400 de Supabase.
- Impacto en usuario: Las funciones avanzadas de time tracking (timer DB-backed, manual time log desde lib) fallan silenciosamente o con error.
- Fix sugerido: Alinear el schema Prisma con las necesidades reales: agregar `startTime DateTime?`, `endTime DateTime?`, `duration Int?`, `isManual Boolean @default(false)` al modelo TimeEntry, o actualizar lib/time-tracking.ts para usar el schema actual (hours/date).

### [MODERADO] Time Page: insert de TimeEntry sin UUID explicito
- Feature: Timer stop en pagina de tiempo
- Archivo: `app/(dashboard)/time/page.tsx`
- Linea aproximada: 185-191
- Descripcion: `handleStopTimer` inserta en TimeEntry sin pasar `id` explicito. El schema Prisma tiene `@default(cuid())` pero como se usa Supabase directamente (no Prisma client), los defaults de Prisma no aplican. Supabase necesita que el id sea generado por el cliente o tener un default en la tabla SQL.
- Impacto en usuario: Podria fallar al insertar si la columna `id` no tiene default en la DB de Supabase (depende de la migracion SQL aplicada).
- Fix sugerido: Agregar `id: crypto.randomUUID()` al insert, similar a como se hace en otros modales.

### [MODERADO] LogTimeModal: campo `billable` no existe en schema
- Feature: Registro de Tiempo (modal)
- Archivo: `components/modals/log-time-modal.tsx`
- Linea aproximada: 43
- Descripcion: El formulario tiene un campo `billable: z.boolean()` con checkbox, pero el modelo `TimeEntry` en Prisma no tiene columna `billable`. Si se corrigiera el modal para insertar en Supabase, este campo no tendria donde guardarse.
- Impacto en usuario: La opcion "Tiempo facturable" es decorativa, no se guarda.
- Fix sugerido: Agregar campo `billable Boolean @default(true)` al modelo TimeEntry en schema.prisma.

### [MODERADO] Onboarding Checklist: datos solo en localStorage
- Feature: Onboarding Checklist
- Archivo: `components/features/onboarding-checklist.tsx`
- Linea aproximada: 23-36
- Descripcion: Confirmado: el progreso del onboarding se guarda unicamente en localStorage bajo la key `dcflow-onboarding`. No hay sincronizacion con Supabase. Ademas, el catch en linea 31 esta completamente vacio (`catch {}`), tragandose errores de parse.
- Impacto en usuario: Si el usuario limpia cache, cambia de navegador o dispositivo, pierde todo su progreso de onboarding. El checklist no detecta automaticamente si las acciones ya fueron realizadas (ej. si ya creo un proyecto).
- Fix sugerido: Guardar progreso en tabla de Supabase (ej. campo JSON en User o tabla dedicada). Detectar automaticamente pasos completados consultando la DB.

### [MODERADO] Portal Cliente: sin vistas ni UI implementadas
- Feature: Portal Cliente
- Archivo: `lib/auth/permissions.ts`, `lib/auth/roles.ts`
- Linea aproximada: N/A
- Descripcion: El rol `client` esta definido con permisos `approve_deliverables`, `submit_feedback`, `view_own_projects`, `edit_profile`. Sin embargo, no existe ninguna vista, pagina o componente que implemente estas funcionalidades. No hay ruta `/portal` ni `/client`. Las permissions estan definidas pero sin UI que las consuma.
- Impacto en usuario: Un usuario con rol `client` puede hacer login pero no tiene ninguna interfaz especifica para aprobar entregables o dar feedback.
- Fix sugerido: Crear vistas dedicadas para el portal cliente: pagina de proyectos asignados, interfaz de aprobacion de entregables, formulario de feedback.

### [MODERADO] Automation Engine: catch vacio en nivel superior
- Feature: Motor de Automatizaciones
- Archivo: `lib/automation-engine.ts`
- Linea aproximada: 65-67
- Descripcion: El `catch` externo de `runAutomations` esta vacio (`catch { }`). Si falla la query inicial de reglas, el error se traga silenciosamente y se retorna un resultado vacio sin ninguna indicacion de fallo.
- Impacto en usuario: Si las automatizaciones dejan de funcionar (ej. por cambio de schema, error de permisos RLS), no hay forma de detectarlo. Las automatizaciones simplemente no se ejecutan sin avisar.
- Fix sugerido: Loggear el error al menos con `console.error`. Considerar un sistema de monitoreo de ejecucion de automatizaciones.

### [MODERADO] Automation Engine: no conectado a eventos Supabase Realtime
- Feature: Motor de Automatizaciones
- Archivo: `lib/automation-engine.ts`
- Linea aproximada: N/A (archivo completo)
- Descripcion: `runAutomations()` se llama manualmente desde el codigo (ej. en `new-task-modal-v2.tsx` linea 228). No hay triggers de Supabase (Database Functions, Realtime subscriptions, Edge Functions) que ejecuten automatizaciones de forma reactiva. Si un cambio de estado se hace desde otra interfaz o directamente en DB, las automatizaciones no se disparan.
- Impacto en usuario: Las automatizaciones solo funcionan cuando el cambio se hace desde puntos especificos del codigo que llaman `runAutomations()` explicitamente.
- Fix sugerido: Implementar Supabase Database Triggers o Edge Functions para ejecutar automatizaciones de forma reactiva.

---

### [MENOR] Task Detail Modal: multiples console.error en produccion
- Feature: Task Detail Modal
- Archivo: `components/modals/task-detail-modal-v2.tsx`
- Linea aproximada: 447, 588, 753, 785, 852, 902, 952, 993, 1026, 1236
- Descripcion: Hay 10+ llamadas a `console.error` y 1 `console.warn` distribuidas por el archivo. En produccion estos logs son visibles en la consola del navegador y pueden exponer informacion interna.
- Impacto en usuario: No afecta funcionalidad directamente, pero es ruido en consola y potencial fuga de informacion.
- Fix sugerido: Usar un logger centralizado que se pueda desactivar en produccion, o eliminar los logs y depender del error handling de UI (toasts).

### [MENOR] Task Detail Modal: boton "Compartir" sin funcionalidad
- Feature: Task Detail Modal - Compartir
- Archivo: `components/modals/task-detail-modal-v2.tsx`
- Linea aproximada: 1280-1282
- Descripcion: El boton "Compartir" en el header del modal no tiene handler `onClick` asignado. Es un `<Button>` sin accion.
- Impacto en usuario: El usuario ve el boton, hace clic, y no pasa nada.
- Fix sugerido: Implementar funcionalidad de copiar link al portapapeles o mostrar opciones de compartir.

### [MENOR] New Task Modal: usa `self.crypto.randomUUID()` en vez de `crypto.randomUUID()`
- Feature: Creacion de tarea
- Archivo: `components/modals/new-task-modal-v2.tsx`
- Linea aproximada: 189
- Descripcion: Usa `self.crypto.randomUUID()` para generar el ID de la tarea. Aunque funciona en browsers modernos, `self` no esta disponible en server-side rendering. Sin embargo, el componente es `"use client"` asi que funciona, pero es inconsistente con el resto del codebase que usa `crypto.randomUUID()`.
- Impacto en usuario: Ninguno en la practica, pero es inconsistencia de codigo.
- Fix sugerido: Cambiar a `crypto.randomUUID()` para consistencia.

### [MENOR] New Task Modal: Activity insert sin await
- Feature: Creacion de tarea - Log de actividad
- Archivo: `components/modals/new-task-modal-v2.tsx`
- Linea aproximada: 217-225
- Descripcion: El insert de Activity al crear tarea no tiene `await` ni `.then()`. Es fire-and-forget sin verificacion de error. Si falla, el activity log queda incompleto.
- Impacto en usuario: La actividad "tarea creada" podria no aparecer en el historial de la tarea sin que nadie lo note.
- Fix sugerido: Agregar al menos un `.then(({error}) => { if (error) console.error(...) })` o usar `await`.

### [MENOR] Bulk Import Modal: textos mezclados espanol/ingles
- Feature: Importacion masiva
- Archivo: `components/modals/bulk-import-modal.tsx`
- Linea aproximada: 147-196
- Descripcion: La UI mezcla espanol e ingles: "Importacion Masiva from CSV", "Choose file...", "CSV Format Requirements:", "Cancel", etc.
- Impacto en usuario: Inconsistencia visual y de idioma en la interfaz.
- Fix sugerido: Traducir todos los textos al espanol para consistencia con el resto de la app.

---

## Resumen por Feature

| Feature | Estado | Issues |
|---------|--------|--------|
| DMs | NO FUNCIONAL | Mensajes no persisten, no hay modelo Message, adjuntos no se suben |
| Time Tracking (pagina) | PARCIAL | Timer no persiste, insert sin UUID, schema desalineado con lib |
| Time Tracking (modal) | NO FUNCIONAL | No inserta en DB, campo billable fantasma |
| Task Detail Modal | FUNCIONAL | Subtareas, checklists, custom fields, dependencias, attachments TODOS persisten en DB correctamente. Activity log funciona. Boton compartir sin accion. |
| New Task Modal | FUNCIONAL | Genera id, createdAt, updatedAt correctamente. Activity log fire-and-forget. |
| Bulk Import | NO FUNCIONAL | Solo modifica store local |
| New Member | NO FUNCIONAL | Solo modifica store local |
| Onboarding | LIMITADO | Solo localStorage, no detecta acciones reales |
| Portal Cliente | NO IMPLEMENTADO | Permisos definidos, sin UI |
| Automation Engine | PARCIAL | Funciona cuando se llama manualmente, catch vacio, no reactivo |

---

## Prioridad de Fix Recomendada

1. **DMs** - Feature critica completamente rota. Crear modelo Message y persistir.
2. **LogTimeModal** - Reescribir para usar Supabase en vez de store local.
3. **NewMemberModal** - Conectar con Supabase Auth e Invitation.
4. **BulkImportModal** - Reescribir para insertar en Supabase.
5. **Time Tracking schema** - Alinear lib/time-tracking.ts con schema Prisma real.
6. **Timer persistencia** - Usar getActiveTimer/startTimer de lib existente.
7. **Portal Cliente** - Disenar e implementar vistas para rol client.
8. **Automation Engine** - Agregar error logging y considerar triggers reactivos.
