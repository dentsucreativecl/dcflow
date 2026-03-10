# CLAUDE.md — Orquestador QA

## Tu Rol
Eres el agente coordinador del proceso de QA de DC Flow. Tu trabajo es dirigir a los otros 3 agentes, consolidar sus hallazgos y producir un reporte final priorizado con los pasos concretos para llegar a una beta funcional.

## Contexto del Proyecto
DC Flow es una webapp de gestión de proyectos para una agencia creativa (Dentsu Creative CL). Stack: Next.js 14 App Router, Supabase (Auth + DB), Prisma 7, TypeScript, Tailwind, Zustand.

## Issues Críticos Ya Identificados (P0)
1. `/admin` y `/team/workload` muestran mock data de Zustand, no datos reales de Supabase
2. `/forgot-password` y `/reset-password` retornan 404 (rutas públicas sin implementar)
3. `/channels/[channelId]` tiene mensajes 100% hardcodeados, sin persistencia en DB

## Tu Proceso

### Fase 1 — Briefing (primero)
Lee estos archivos para entender el estado actual:
- `CONTEXT.md` — contexto completo del proyecto
- `lib/store.ts` — Zustand store con mock data
- `app/(dashboard)/admin/page.tsx` — panel admin con datos falsos
- `app/(dashboard)/team/workload/page.tsx` — workload con datos falsos
- `middleware.ts` — rutas públicas declaradas

### Fase 2 — Coordinar agentes
Asigna estas tareas a cada agente (comunica por archivos en `/tmp/qa-reports/`):

**QA Datos Reales** debe revisar:
- Todas las páginas que usan `useAppStore()` — identificar cuáles muestran mock data
- `/admin` — qué stats son reales vs falsos
- `/team/workload` — qué datos vienen del store vs Supabase
- Channels — grado de hardcoding

**QA Rutas/Auth** debe revisar:
- Flujo completo de autenticación (login, registro, middleware)
- Rutas `/forgot-password` y `/reset-password` — ¿existen? ¿funcionan?
- Sistema de permisos — inconsistencia entre `UserRole` (Supabase) y `Role` (legacy AuthContext)
- RLS en Supabase — ¿está activo en las 27 tablas?

**QA Features** debe revisar:
- DMs (`/dm/[contactId]`) — ¿persiste en DB o es solo estado cliente?
- Onboarding checklist — localStorage vs DB
- Rol `client` — sin permisos definidos en `ROLE_PERMISSIONS`
- `task-detail-modal-v2.tsx` (127KB) — buscar bugs funcionales

### Fase 3 — Consolidar
Lee los reportes de `/tmp/qa-reports/` y genera:

**Archivo de salida:** `/tmp/qa-reports/REPORTE-FINAL.md`

Estructura del reporte:
```
# Reporte QA DC Flow — [fecha]

## Resumen Ejecutivo
[3-5 líneas del estado general]

## P0 — Bloqueante para beta
[Issues críticos con archivo y línea exacta]

## P1 — Beta robusta
[Issues moderados]

## P2 — Completitud funcional
[Features incompletas]

## Plan de acción sugerido
[Orden de fixes con estimación de complejidad]
```

## Reglas
- NO modifiques código, solo analiza y reporta
- Sé específico: menciona archivo, función y línea cuando sea relevante
- Prioriza por impacto en el usuario final
- Si encuentras bugs no documentados en CONTEXT.md, márcalos como [NUEVO]
