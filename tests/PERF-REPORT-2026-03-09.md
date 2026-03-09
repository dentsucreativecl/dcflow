# Performance Report — DC Flow
**Fecha:** 2026-03-09
**Método:** Análisis estático de código (análisis de data-fetching, imports, query patterns)
**Nota:** Métricas de runtime (TTFB, Load Complete) no disponibles — el sistema de permisos bloqueó la ejecución de Playwright durante esta sesión. Las métricas estimadas se basan en análisis de código y conocimiento del stack (Next.js 14 + Supabase).

---

## Métricas por Ruta (Estimadas por análisis de código)

| Ruta | Queries Supabase | Queries Paralelas | Queries Secuenciales | Riesgo Perf |
|------|-----------------|-------------------|---------------------|-------------|
| /dashboard | 4 (assignments, lists, users, spaces) | ✅ Promise.all | 0 | Bajo |
| /projects/ | 4-7 (lists, tasks, dueTasks, + admin: assignments+teams+teamMembers) | ✅ Parcial (admin queries en Promise.all) | ⚠️ lists → tasks → dueTasks son secuenciales | Medio |
| /clients/ | 3 (spaces, lists, members) | ❌ Secuenciales | 3 | Medio |
| /team/ | 3 (users, memberships, timeEntries) | ❌ Secuenciales | 3 | Medio |
| /inbox/ | 1 (activities con joins) | N/A | 0 | Bajo |
| /settings/ | 0 en mount | N/A | 0 | Bajo |
| /lists/[id] | 6-10 (list, statuses, customFields, tasks, cfValues, relations×2, externalTasks) | ✅ Parcial (relations en Promise.all) | ⚠️ Cascada: list → statuses+cf → tasks → cfValues → relations | Alto |

---

## Problemas de Performance Encontrados

### PERF-P1: /lists/[id] — Cascade de queries secuenciales en fetchData()
**Archivo:** `app/(dashboard)/lists/[listId]/client-page.tsx`
**Descripción:** `fetchData()` ejecuta queries en cascada:
1. `await` List data
2. `await` Statuses (depende del spaceId del step 1 — justificado)
3. `await` CustomFields (podría ir en parallel con statuses)
4. `await` Tasks
5. `await` CustomFieldValues (si hay tasks y customFields)
6. `await` TaskRelations×2 (en `Promise.all` — correcto)
7. `await` External task titles (condicional)

**Impacto estimado:** 4-5 roundtrips secuenciales = 400-800ms extra en redes con latencia
**Fix posible:** Paralelizar los steps 2+3 (statuses + customFields) con `Promise.all`:
```typescript
const [statusData, cfData] = await Promise.all([
  supabase.from("Status").select(...).eq("spaceId", listData.spaceId).order("order"),
  supabase.from("CustomField").select(...).eq("spaceId", listData.spaceId).order("createdAt"),
]);
```

### PERF-P1: /team/ — 3 queries secuenciales sin necesidad
**Archivo:** `app/(dashboard)/team/page.tsx`
**Descripción:** `fetchTeam()` hace 3 queries secuenciales:
1. `await` Users (isActive, MEMBER)
2. `await` TeamMember memberships
3. `await` TimeEntries (semana actual)

Ninguna de las 3 depende de las otras — todas pueden correr en `Promise.all`.
**Impacto estimado:** ~200-400ms extra
**Fix posible:**
```typescript
const [{ data: users }, { data: memberships }, { data: timeEntries }] = await Promise.all([
  supabase.from("User").select(...).eq("userType", "MEMBER").eq("isActive", true).order("name"),
  supabase.from("TeamMember").select("userId, role, Team(id, name)"),
  supabase.from("TimeEntry").select("userId, hours").gte("date", mondayStr),
]);
```

### PERF-P1: /clients/ — 3 queries secuenciales sin necesidad
**Archivo:** `app/(dashboard)/clients/page.tsx`
**Descripción:** `fetchClients()` hace 3 queries secuenciales:
1. `await` Spaces
2. `await` Lists (para conteo)
3. `await` SpaceMembers (con User join)

Ninguna depende de las otras antes de empezar.
**Impacto estimado:** ~200-400ms extra
**Fix posible:** `Promise.all([spaces query, lists query, members query])`

### PERF-P1: /projects/ — Queries lists → tasks → dueTasks secuenciales
**Archivo:** `app/(dashboard)/projects/page.tsx`
**Descripción:** La query de lists (con filtro de espacios para no-admin) espera al `allowedSpaceIds` fetch. Luego tasks y dueTasks son secuenciales aunque podrían correr en `Promise.all`. Para admin: sí usa `Promise.all` para las queries de filtros adicionales.
**Impacto estimado:** ~200ms extra en la segunda y tercera query

### PERF-P2: /lists/[id] — handleReorderTasks con N queries en loop
**Archivo:** `app/(dashboard)/lists/[listId]/client-page.tsx` líneas 239-244
**Descripción:**
```typescript
for (const update of updates) {
    await supabase.from("Task").update({ order: update.order }).eq("id", update.id);
}
```
Ejecuta una query por tarea al reordenar. Con 50 tareas = 50 roundtrips secuenciales.
**Impacto:** Bloquea UI por varios segundos en listas grandes
**Fix posible:** Usar `Promise.all(updates.map(u => supabase...))` o un RPC batch update

### PERF-P2: recharts sin next/dynamic en project-budget-tab
**Archivos:**
- `components/features/project-budget-tab.tsx` — import directo de recharts
- `components/features/reports-charts.tsx` — import directo de recharts
**Descripción:** `recharts` pesa ~300KB minificado. Se importa directamente sin `next/dynamic`, lo que lo incluye en el bundle de las rutas `/projects/[id]` y `/reports/`. Sin embargo, estas rutas son específicas (no afectan a /dashboard, /projects/, /clients/, /team/).
**Impacto:** Bundle de `/projects/[id]` aumentado en ~300KB vs si usara dynamic import con ssr:false
**Fix recomendado (arquitectura mayor):** Wrappear los chart components con `dynamic(() => import(...), { ssr: false })` en los archivos de página

### PERF-P2: jsPDF importado estáticamente en lib/export.ts
**Archivo:** `lib/export.ts`
**Descripción:** `import jsPDF from "jspdf"` es un import top-level. jsPDF pesa ~250KB. Si `export.ts` es importado en alguna página que se renderiza frecuentemente, infla el bundle.
**Diagnóstico:** Verificar si `export-menu.tsx` se incluye en rutas críticas (layout o dashboard).

### PERF-WARN: Breadcrumbs hace queries Supabase en cada navegación
**Archivo:** `components/layout/breadcrumbs.tsx`
**Descripción:** En cada cambio de pathname, el componente `Breadcrumbs` (montado en el dashboard layout = todas las rutas) ejecuta queries a `List`, `Space`, o `User` para resolver nombres de UUIDs. Sin caché.
**Impacto:** Cada navegación a /lists/[id], /spaces/[id], /team/[id] genera 1 extra Supabase call
**Fix recomendado:** Memoizar resultados en un Map o usar SWR/React Query con caché. La función `resolveNames()` ya usa `setResolvedNames(prev => ({...prev, ...resolved}))` — agregar verificación de si el ID ya está resuelto antes de hacer la query.

### PERF-P1: window.location.href en /projects/ (full page reload)
**Archivo:** `app/(dashboard)/projects/page.tsx` línea 441
**Descripción:**
```typescript
onClick={() => { window.location.href = `/lists/${project.id}`; }}
```
Causa un full-page reload al hacer click en un proyecto, perdiendo el estado de React y forzando re-fetch de todos los providers del dashboard (incluido auth context).
**Fix recomendado:** Usar `router.push('/lists/${project.id}')` del hook `useRouter` de Next.js (ya está importado en el archivo de clientes — falta en proyectos).

---

## Análisis de Bundle / Imports

### Imports que podrían inflar el bundle inicial

| Librería | Tamaño estimado | Ruta afectada | ¿Dynamic? | Riesgo |
|----------|-----------------|---------------|-----------|--------|
| recharts | ~300KB | /projects/[id], /reports/ | ❌ No | Medio |
| jsPDF | ~250KB | Dependiente de export-menu.tsx | ❌ No | Medio |
| date-fns | ~75KB (solo módulos usados) | /inbox/ (formatDistanceToNow) | N/A (named imports) | Bajo |
| lucide-react | Named imports ✅ | Múltiples rutas | N/A | Bajo |
| @radix-ui/* | Named imports ✅ | Múltiples rutas | N/A | Bajo |
| zod | Named import ✅ | Modals | N/A | Bajo |

**Nota positiva:** Los imports de `lucide-react`, `@radix-ui/*`, `zod` y `date-fns` usan named imports correctamente — tree shaking funciona para estas librerías.

### import * as z from "zod" — análisis
Los archivos `new-member-modal.tsx` y `new-client-modal.tsx` usan `import * as z from "zod"`. Zod soporta named imports (`import { z } from "zod"`) — el namespace import `* as z` puede impedir tree-shaking en algunos bundlers. **Impacto bajo** porque el módulo completo de zod es pequeño (~14KB).

---

## Fixes Implementados

Ningún fix implementado durante esta sesión (los fixes de performance requieren análisis de regresión antes de aplicar para no romper funcionalidades existentes — se documentan como recomendaciones).

---

## Recomendaciones Pendientes (por orden de impacto)

### Alta Prioridad

1. **[/team/ + /clients/ + /projects/] Paralelizar queries con Promise.all**
   - `/team/page.tsx`: Ejecutar users + memberships + timeEntries en paralelo
   - `/clients/page.tsx`: Ejecutar spaces + lists + members en paralelo
   - `/projects/page.tsx`: Ejecutar tasks + dueTasks en paralelo (después de obtener lists/allowedSpaceIds)
   - **Ganancia estimada:** 200-400ms por ruta (reducción de 2-3 RTTs a 1)
   - **Riesgo:** Bajo — las queries son independientes

2. **[/projects/] Reemplazar window.location.href por router.push**
   - `projects/page.tsx` L441: `window.location.href = '/lists/...'` → `router.push('/lists/...')`
   - **Ganancia:** Elimina full-page reload, mantiene estado del dashboard, elimina re-fetch de auth
   - **Riesgo:** Muy bajo

3. **[/lists/[id]] Paralelizar statuses + customFields en fetchData()**
   - Ambas queries dependen de `spaceId` del list data — ejecutar en `Promise.all`
   - **Ganancia estimada:** ~100-200ms por apertura de lista
   - **Riesgo:** Bajo

### Media Prioridad

4. **[/lists/[id]] handleReorderTasks: usar Promise.all en lugar de loop secuencial**
   - `for (const update of updates) { await supabase.from("Task").update(...) }` → `await Promise.all(updates.map(u => ...))`
   - **Ganancia:** N×100ms → 100ms para N tareas reordenadas
   - **Riesgo:** Bajo (Supabase maneja concurrencia)

5. **[Breadcrumbs] Agregar verificación de caché antes de query**
   - En `resolveNames()`, skip fetch si `resolvedNames[id]` ya existe
   - **Ganancia:** Elimina queries redundantes en back-navigation
   - **Riesgo:** Muy bajo

6. **[/projects/[id]] Usar next/dynamic para recharts (ProjectBudgetTab)**
   - `const ProjectBudgetTab = dynamic(() => import('@/components/features/project-budget-tab'), { ssr: false })`
   - **Ganancia:** ~300KB menos en bundle inicial de /projects/[id]
   - **Riesgo:** Requiere manejo de loading state en el tab

### Baja Prioridad (Arquitectura Mayor)

7. **Implementar SWR o React Query para data fetching**
   - Actualmente cada página hace fetch en mount sin caché compartida entre rutas
   - SWR añadiría: deduplicación de requests, revalidación en focus, caché entre navegaciones
   - **Ganancia:** Elimina refetches al navegar de vuelta a una ruta ya visitada
   - **Riesgo:** Alto (requiere refactoring de todos los `useEffect` con fetch)

8. **Supabase realtime subscriptions — revisión de canales activos**
   - `/lists/[id]` abre canal Supabase con `postgres_changes` en mount y lo cierra en cleanup
   - Verificar que no se acumulen canales si el componente se re-monta frecuentemente
   - **Riesgo:** Bajo con cleanup correcto (ya implementado)

---

## Contexto de Medición

Para obtener métricas reales de runtime ejecutar:
```bash
cd "/Users/eibarr01/Library/CloudStorage/OneDrive-dentsu/Documentos/DC Flow/dc-flow-app"
npx playwright test tests/qa-exploratory-temp.spec.ts --project=superadmin --reporter=list
```
El script de Playwright en `tests/qa-exploratory-temp.spec.ts` captura TTFB, domInteractive, loadComplete, supabaseFetchCount, slowestFetch y totalJSKB para cada ruta.
