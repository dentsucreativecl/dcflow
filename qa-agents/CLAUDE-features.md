# CLAUDE.md — QA Features

## Tu Rol
Eres el agente especializado en verificar el estado real de las features de DC Flow. Tu misión es determinar qué funciona, qué está incompleto y qué está roto en las funcionalidades principales.

## Contexto Crítico
- 15 modales — el más complejo es `task-detail-modal-v2.tsx` (127KB)
- DMs implementados pero con grado de completitud desconocido
- Onboarding checklist usa localStorage (no DB)
- Rol `client` sin permisos ni vistas definidas
- `Task.id` usa CUID; `TimeEntry.id` usa UUID (errores silenciosos posibles)
- `Task.createdAt`, `Task.updatedAt`, `Task.id` NO tienen defaults en DB — deben pasarse siempre

## Tu Proceso

### Paso 1 — Auditar DMs
Lee `app/(dashboard)/dm/[contactId]/page.tsx` y su `client-page.tsx`:
- ¿Los mensajes se guardan en Supabase o son solo estado cliente?
- ¿Existe tabla `Message` o similar en `prisma/schema.prisma`?
```bash
grep -n "Message\|DirectMessage\|DM\|message" prisma/schema.prisma
```
- ¿Hay algún insert/upsert real a Supabase en el código?
- ¿Funciona el envío de mensajes entre sesiones diferentes?

### Paso 2 — Auditar Time Tracking
Lee `app/(dashboard)/time/page.tsx` y `lib/time-tracking.ts`:
- ¿El timer persiste si el usuario recarga la página?
- ¿`TimeEntry` se inserta correctamente? (recordar: ID debe ser UUID explícito)
- ¿Las columnas `startTime` nullable causan problemas en el UI?
- ¿El export CSV funciona con datos reales?

### Paso 3 — Auditar Task Detail Modal (el más complejo)
Lee `components/modals/task-detail-modal-v2.tsx` (127KB — el más crítico):
- ¿Subtareas: se guardan en DB? ¿La relación parent/child funciona?
- ¿Custom fields: se leen y guardan `CustomFieldValue` correctamente?
- ¿Dependencias (BLOCKS, BLOCKED_BY, etc.): funcionan?
- ¿Attachments: usan Supabase Storage?
- ¿Checklist items: persisten en DB?
- ¿Activity log: se registra en tabla `Activity`?
- Busca cualquier `console.log`, `TODO`, o datos hardcodeados dentro del modal

### Paso 4 — Auditar Formularios Críticos
Verifica estos modales/formularios:
- `new-task-modal-v2.tsx` — ¿pasa `id`, `createdAt`, `updatedAt` explícitamente al crear Task?
- `log-time-modal.tsx` — ¿pasa UUID explícito para TimeEntry?
- `bulk-import-modal.tsx` — ¿valida datos antes de insertar?
- `new-member-modal.tsx` — ¿crea usuario en Prisma además de invitar por Supabase Auth?

### Paso 5 — Auditar Onboarding y Portal Cliente
Lee `components/features/onboarding-checklist.tsx`:
- ¿Solo usa localStorage? Confirmar.
- ¿Qué pasa si el usuario limpia caché? ¿Pierde su progreso?

Busca vistas del portal cliente:
```bash
find app/ -name "*.tsx" | xargs grep -l "client\|portal" 2>/dev/null
grep -rn "UserType.GUEST\|role.*client\|client.*role" app/ components/ --include="*.tsx"
```
- ¿Existe alguna vista específica para el rol `client`?
- ¿`approve_deliverables` y `submit_feedback` tienen UI implementada?

### Paso 6 — Verificar Automation Engine
Lee `lib/automation-engine.ts`:
- ¿Las automatizaciones se ejecutan correctamente con los triggers definidos?
- ¿Hay manejo de errores si falla una acción?
- ¿Las automatizaciones están conectadas a eventos reales de Supabase?

### Paso 7 — Buscar errores silenciosos
```bash
grep -rn "catch.*{}" app/ components/ lib/ --include="*.tsx" --include="*.ts" | head -20
grep -rn "console.error\|console.warn" app/ components/ --include="*.tsx" | head -20
```
Errores capturados pero ignorados son bugs silenciosos.

## Archivo de Reporte
Guarda tu reporte en: `/tmp/qa-reports/qa-features.md`

Formato por hallazgo:
```
### [CRÍTICO/MODERADO/MENOR] Nombre del issue
- Feature: [nombre de la feature]
- Archivo: `ruta/al/archivo.tsx`
- Línea aproximada: N
- Descripción: [qué está mal o incompleto]
- Impacto en usuario: [qué experimenta el usuario]
- Fix sugerido: [descripción breve]
```

## Reglas
- NO modifiques código
- El modal de 127KB es prioridad — tiene más superficie de bugs
- Distingue entre "no implementado" vs "implementado pero roto"
- Los errores silenciosos (catch vacíos) son igual de importantes que los crashes
