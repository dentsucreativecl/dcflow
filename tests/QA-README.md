# DC Flow — Sistema de Sub-Agentes QA con Playwright

## Estructura

```
tests/
├── setup-auth.ts              # Ya existente — genera sesiones autenticadas
├── qa-nav.spec.ts             # Navegación global, breadcrumbs, links rotos
├── qa-projects.spec.ts        # Módulo Proyectos
├── qa-lists.spec.ts           # Módulo Listas
├── qa-clients.spec.ts         # Módulo Clientes
├── qa-team.spec.ts            # Módulo Equipo
├── qa-tasks.spec.ts           # Tareas + Bandeja de Entrada
└── qa-dashboard-settings.spec.ts  # Dashboard + Settings
```

## Setup inicial (solo una vez)

```bash
# 1. Asegurarse que la app corre en localhost:3000
npm run dev

# 2. Generar sesiones autenticadas para todos los roles
npx playwright test --project=setup

# Esto crea:
# .playwright/auth/superadmin.json     → esteban.ibarra@dentsu.com
# .playwright/auth/admin-area.json     → jorge.martinez@dentsu.com
# .playwright/auth/director-proyecto.json → jose.rojas@dentsu.com
# .playwright/auth/miembro.json        → oriana.goris@dentsu.com
```

## Ejecutar todos los agentes

```bash
# Correr todos los specs en paralelo (modo headless)
npm run pw:test

# Con UI visual (modo interactivo para debug)
npm run pw:ui

# Solo un agente específico
npx playwright test qa-nav.spec.ts
npx playwright test qa-projects.spec.ts
npx playwright test qa-team.spec.ts --headed   # ver el browser

# Solo tests de un rol específico
npx playwright test --project=superadmin
npx playwright test --project=miembro
```

## Bugs conocidos que cada agente detecta

| Agente | Bug | Descripción |
|--------|-----|-------------|
| `qa-nav` | BUG-09 | Breadcrumb "Proyectos" → 404 |
| `qa-nav` | BUG-09 | `/lists/` sin ID → 404 sin layout |
| `qa-lists` | BUG-04 | Skeleton infinito lista A → lista B |
| `qa-clients` | BUG-05 regresión | Click tarjeta → debe ir a `/clients/[id]` |
| `qa-clients` | BUG-06 regresión | Modal acumula instancias |
| `qa-team` | BUG-08 | Búsqueda standalone no filtra |
| `qa-team` | MEJORA | Modal "Añadir Miembro" en inglés |
| `qa-tasks` | MEJORA | Badge "UNASSIGNED" en inglés |

## Ver reporte

```bash
# Después de correr los tests, abrir reporte HTML
npx playwright show-report
```

## Agregar nuevos casos

Cada spec sigue el patrón:
1. `test.use({ storageState: '.playwright/auth/[rol].json' })` al tope del archivo
2. Tests con nombres descriptivos que identifican el bug o feature
3. Tests de permisos en `test.describe('[módulo] como [rol]', () => { test.use(...) })`
