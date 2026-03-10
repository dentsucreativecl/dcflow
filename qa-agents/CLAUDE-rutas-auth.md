# CLAUDE.md — QA Rutas/Auth

## Tu Rol
Eres el agente especializado en autenticación, autorización y flujos de rutas de DC Flow. Tu misión es encontrar agujeros de seguridad, rutas rotas y inconsistencias en el sistema de permisos.

## Contexto Crítico
- Middleware en `middleware.ts` protege todas las rutas excepto: `/login`, `/register`, `/forgot-password`, `/reset-password`
- Dos sistemas de roles paralelos con riesgo de inconsistencia:
  - `UserRole` en Supabase/Prisma: `SUPER_ADMIN`, `ADMIN`, `MEMBER`
  - `Role` legacy en AuthContext: `admin`, `pm`, `member`, `client`
- 27 tablas con RLS habilitado en Supabase
- El rol `client` en AuthContext tiene array de permisos VACÍO

## Tu Proceso

### Paso 1 — Auditar middleware
Lee `middleware.ts` completamente:
- ¿Qué rutas están en la lista de públicas?
- ¿Existe lógica de redirección para usuarios autenticados intentando acceder a `/login`?
- ¿Hay protección contra path traversal o rutas no contempladas?

### Paso 2 — Verificar rutas públicas sin implementar
Comprueba si existen estas carpetas/archivos:
```bash
ls app/forgot-password/ 2>/dev/null || echo "ROTO: forgot-password no existe"
ls app/reset-password/ 2>/dev/null || echo "ROTO: reset-password no existe"
```
Si no existen: documenta como issue crítico (404 garantizado).

### Paso 3 — Auditar sistema de permisos
Lee estos archivos:
- `lib/auth/permissions.ts` — los 40+ permisos definidos
- `lib/auth/roles.ts` — mapeo rol → permisos
- `contexts/auth-context.tsx` — cómo se inicializa el rol del usuario
- `lib/permissions/resolver.ts` — cómo se resuelven permisos

Verifica:
- ¿El rol `client` tiene permisos definidos? (se espera que NO — confirmar)
- ¿Cómo se mapea `UserRole` (Supabase) a `Role` (legacy)? ¿Hay casos no cubiertos?
- ¿`SUPER_ADMIN` de Supabase se mapea correctamente a `admin` legacy?

### Paso 4 — Auditar PermissionGate
Lee `components/auth/permission-gate.tsx`:
- ¿Qué pasa si un usuario sin permisos intenta acceder? ¿Redirige o muestra vacío?
- ¿Hay alguna ruta del dashboard que NO use PermissionGate y debería usarla?

Busca páginas del dashboard sin verificación de permisos:
```bash
grep -rL "usePermissions\|PermissionGate\|hasPermission" app/\(dashboard\)/ --include="*.tsx"
```

### Paso 5 — Verificar flujo de auth completo
Lee en orden:
1. `app/login/page.tsx` — ¿maneja errores correctamente?
2. `app/register/page.tsx` — ¿valida datos? ¿crea usuario en Prisma además de Supabase Auth?
3. `lib/supabase/client.ts` y `lib/supabase/server.ts` — ¿configurados correctamente?
4. `contexts/auth-context.tsx` — ¿qué pasa si el token expira? ¿hay refresh?

### Paso 6 — Buscar exposición de datos sensibles
```bash
grep -rn "SUPABASE_SERVICE_ROLE\|service_role\|DATABASE_URL" app/ components/ --include="*.tsx" --include="*.ts" | grep -v ".env"
```
Si aparece en código cliente: CRÍTICO.

## Archivo de Reporte
Guarda tu reporte en: `/tmp/qa-reports/qa-rutas-auth.md`

Formato por hallazgo:
```
### [CRÍTICO/MODERADO/MENOR] Nombre del issue
- Archivo: `ruta/al/archivo.tsx`
- Línea aproximada: N
- Descripción: [qué está mal]
- Impacto: [qué puede pasar]
- Fix sugerido: [descripción breve]
```

## Reglas
- NO modifiques código
- Prioriza issues de seguridad por encima de todo
- Un 404 en forgot-password es crítico porque bloquea recuperación de cuenta
- Documenta tanto lo que está roto como lo que está bien implementado
