# Agente Fase 0 — Limpieza Código Mock
**Misión:** Eliminar datos simulados del código sin romper las páginas que ya funcionan con Supabase.

---

## Contexto

El store Zustand (`lib/store.ts`) se inicializa con datos falsos de `lib/data.ts`. Hay que vaciar el store pero mantener las interfaces TypeScript que otras partes del código usan.

### Páginas que YA usan Supabase (NO tocar):
- /dashboard, /tasks, /my-tasks, /projects, /clients
- /team, /team/workload, /calendar, /inbox, /reports, /docs

### Lo que hay que limpiar:
1. `lib/store.ts` — inicializar con arrays vacíos
2. `lib/data.ts` — eliminar datos mock, mantener solo interfaces TypeScript
3. Verificar que nada se rompa

---

## Instrucciones paso a paso

### Paso 1 — Leer los archivos actuales
Lee estos archivos completos antes de modificar:
- `lib/store.ts`
- `lib/data.ts`

### Paso 2 — Limpiar lib/store.ts

En el initialState del store, reemplazar todos los arrays con datos mock por arrays vacíos:

```typescript
// ANTES (ejemplo):
projects: initialProjects,
clients: initialClients,
tasks: initialTasks,
teamMembers: initialTeamMembers,
events: initialEvents,

// DESPUÉS:
projects: [],
clients: [],
tasks: [],
teamMembers: [],
events: [],
```

Eliminar los imports de datos mock al inicio del archivo:
```typescript
// Eliminar líneas como estas:
import { initialProjects, initialClients, initialTasks, ... } from './data'
```

**IMPORTANTE:** Mantener todas las funciones del store (addProject, updateTask, etc.) — solo vaciar los datos iniciales.

### Paso 3 — Limpiar lib/data.ts

Mantener SOLO las interfaces/tipos TypeScript. Eliminar los arrays de datos.

```typescript
// MANTENER (interfaces):
export interface Project { ... }
export interface Client { ... }
export interface Task { ... }
export interface TeamMember { ... }
export type UserRole = ...

// ELIMINAR (datos mock):
export const initialProjects: Project[] = [ ... ]
export const initialClients: Client[] = [ ... ]
export const initialTasks: Task[] = [ ... ]
export const initialTeamMembers: TeamMember[] = [ ... ]
```

### Paso 4 — Verificar que no hay imports rotos

Busca en todo el proyecto imports que traigan datos (no tipos) de lib/data.ts:
```bash
grep -r "from.*lib/data" --include="*.ts" --include="*.tsx" /workspaces/dcflow/app
grep -r "from.*lib/data" --include="*.ts" --include="*.tsx" /workspaces/dcflow/components
grep -r "from.*@/lib/data" --include="*.ts" --include="*.tsx" /workspaces/dcflow/app
grep -r "from.*@/lib/data" --include="*.ts" --include="*.tsx" /workspaces/dcflow/components
```

Para cada archivo que importe datos (no tipos), verifica si:
- Ya usa Supabase → eliminar el import de data.ts
- Todavía usa datos mock → reportar en el reporte final (NO modificar aún)

### Paso 5 — Verificar que el build no se rompe
```bash
cd /workspaces/dcflow
npx tsc --noEmit 2>&1 | head -50
```

Si hay errores TypeScript, analízalos. Los errores de "variable no usada" después de eliminar imports son normales y se pueden ignorar. Los errores de "tipo no encontrado" requieren atención.

### Paso 6 — Commit
```bash
cd /workspaces/dcflow
git add -A
git commit -m "feat: vaciar store mock - inicializar con arrays vacíos"
```

---

## Reporte final
Guarda en `/tmp/qa-reports/fase0-codigo.md`:
- Archivos modificados
- Imports eliminados
- Componentes que todavía usan datos de lib/data.ts (listados, no modificados)
- Resultado del check TypeScript
- Cualquier error encontrado
