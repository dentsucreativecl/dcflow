# QA Rutas/Auth - Reporte de Auditoria DC Flow

**Fecha:** 2026-03-10
**Agente:** QA Rutas/Auth
**Alcance:** middleware.ts, sistema de permisos, flujo de auth, exposicion de datos

---

## Resumen Ejecutivo

Se encontraron **4 issues criticos**, **5 moderados** y **3 menores**. Los hallazgos mas graves son: rutas publicas declaradas sin implementacion (404 garantizado), imposibilidad de asignar el rol `pm` desde Supabase, paginas sensibles sin proteccion de permisos, y uso de `getSession()` en lugar de `getUser()` para inicializar auth.

---

## Hallazgos

### [CRITICO] Rutas /forgot-password y /reset-password no existen
- **Archivo:** `middleware.ts` linea 4; no existen `app/forgot-password/` ni `app/reset-password/`
- **Descripcion:** El middleware declara `/forgot-password` y `/reset-password` como rutas publicas, pero no existe ninguna pagina implementada para esas rutas. No hay carpeta `app/forgot-password/`, `app/reset-password/`, ni variantes dentro de `app/(auth)/`.
- **Impacto:** Cualquier usuario que intente recuperar su contrasena recibira un 404. No hay flujo de recuperacion de password funcional. Esto tambien significa que un usuario que olvide su contrasena queda permanentemente bloqueado.
- **Fix sugerido:** Implementar `app/forgot-password/page.tsx` y `app/reset-password/page.tsx` usando `supabase.auth.resetPasswordForEmail()` y `supabase.auth.updateUser()`. Alternativamente, remover estas rutas de la lista publica hasta que se implementen para evitar confusion.

---

### [CRITICO] Rol `pm` (Project Manager) inalcanzable desde Supabase
- **Archivo:** `contexts/auth-context.tsx` lineas 87-91
- **Descripcion:** La funcion `mapSupabaseRoleToLegacy()` solo mapea: `SUPER_ADMIN`/`ADMIN` -> `admin`, `GUEST` -> `client`, todo lo demas -> `member`. No existe ningun camino para que un usuario obtenga el rol legacy `pm`. Sin embargo, el sistema de permisos define permisos especificos para `pm` en `lib/auth/permissions.ts` (lineas 74-93) y en `contexts/auth-context.tsx` (lineas 74-77). Las restricciones de ruta en `canAccessRoute` (lineas 248-251) permiten acceso a `/settings` y `/reports` solo para `admin` y `pm`.
- **Impacto:** El rol `pm` es un rol fantasma: tiene permisos definidos pero nunca se asigna. Ningun usuario real puede obtener los permisos de PM. Las rutas `/settings` y `/reports` solo son accesibles para admins, no para PMs como se pretende.
- **Fix sugerido:** Agregar logica en `mapSupabaseRoleToLegacy()` para mapear algun valor de Supabase a `pm` (por ejemplo, un campo adicional en la tabla User como `legacyRole`, o un nuevo valor en el enum `UserRole`).

---

### [CRITICO] Pagina /reports sin verificacion de permisos
- **Archivo:** `app/(dashboard)/reports/page.tsx`
- **Linea aproximada:** 69-224
- **Descripcion:** La pagina de reportes no tiene ninguna verificacion de permisos. No usa `PermissionGate`, `withPermission`, `hasPermission`, ni `canAccessRoute`. Cualquier usuario autenticado (incluyendo `member` y `client`) puede acceder a `/reports` y ver datos sensibles: horas de todos los miembros del equipo, estadisticas de todos los proyectos, rendimiento individual de cada miembro. La funcion `canAccessRoute` en auth-context.tsx (linea 251) restringe `/reports` a `admin` y `pm`, pero **nadie la invoca** en la pagina de reportes.
- **Impacto:** Filtracion de datos sensibles. Un usuario con rol `member` o `client` puede ver horas trabajadas, carga de trabajo y rendimiento de todos los miembros del equipo, ademas de estadisticas de todos los proyectos.
- **Fix sugerido:** Agregar verificacion de permisos al inicio de `ReportsPage`: `if (!hasPermission('view_reports')) redirect('/dashboard');` o envolver con `PermissionGate`.

---

### [CRITICO] Uso de getSession() en lugar de getUser() para inicializacion
- **Archivo:** `contexts/auth-context.tsx` linea 164
- **Descripcion:** La inicializacion de auth usa `supabase.auth.getSession()` que lee datos del almacenamiento local sin validar con el servidor. La documentacion oficial de Supabase advierte explicitamente: "getSession() lee del storage y is NOT guaranteed to be validated. Use getUser() for security-sensitive operations."
- **Impacto:** Un atacante podria manipular los datos de sesion en localStorage para obtener un ID de usuario diferente, lo cual se usaria luego en `fetchProfile()` para cargar el perfil de otro usuario. Aunque el middleware usa `getUser()` correctamente (linea 37), el contexto de auth del cliente no lo hace.
- **Fix sugerido:** Cambiar linea 164 de `supabase.auth.getSession()` a `supabase.auth.getUser()` y ajustar el destructuring correspondiente.

---

### [MODERADO] Pagina /settings accesible para todos los roles autenticados
- **Archivo:** `app/(dashboard)/settings/page.tsx`
- **Linea aproximada:** 29-40
- **Descripcion:** La pagina de settings solo verifica `if (!user) return null;` pero no comprueba el rol. Aunque `canAccessRoute` en auth-context.tsx restringe `/settings` a `admin` y `pm`, la pagina no invoca esta funcion. La pagina muestra componentes sensibles como `PurgeDataCard`, `CsvImportCard`, y `AreaManagementCard` condicionados a `user.role === "admin"`, pero la pagina misma es accesible para cualquier rol.
- **Impacto:** Un usuario con rol `member` o `client` puede ver la pagina de settings, incluyendo su informacion de perfil completa y la lista de todos los roles del sistema. Aunque los componentes admin estan condicionados, la pagina no deberia ser accesible.
- **Fix sugerido:** Agregar verificacion de rol o usar `canAccessRoute('/settings')` con redirect.

---

### [MODERADO] Funcion setRole() permite cambio de rol en cliente sin validacion
- **Archivo:** `contexts/auth-context.tsx` lineas 232-235
- **Descripcion:** La funcion `setRole()` permite cambiar el rol del usuario en el estado del cliente sin ninguna validacion ni llamada al servidor. Aunque el comentario dice "does NOT change DB role", cualquier componente que importe `useAuth()` puede llamar `setRole('admin')` para obtener todos los permisos del lado del cliente.
- **Impacto:** Un usuario podria manipular el rol desde la consola del navegador (`useAuth().setRole('admin')`) y obtener acceso visual a todas las funciones admin en la UI. Aunque no afecta la seguridad server-side (RLS en Supabase sigue aplicando), permite bypass de todas las restricciones de UI.
- **Fix sugerido:** Eliminar `setRole()` o agregar validacion que solo permita cambios si el usuario tiene permisos de admin. Si se mantiene por compatibilidad, al menos registrar un warning en consola.

---

### [MODERADO] Dos sistemas de permisos paralelos desincronizados
- **Archivo:** `lib/auth/permissions.ts` vs `contexts/auth-context.tsx`
- **Descripcion:** Existen dos definiciones de `Permission` y `ROLE_PERMISSIONS` completamente diferentes:
  - `lib/auth/permissions.ts`: 31 permisos (view_all_projects, create_project, etc.)
  - `contexts/auth-context.tsx`: 13 permisos (view_dashboard, view_projects, etc.)
  Los tipos no son compatibles y los nombres difieren. Ademas, existe un tercer sistema en `lib/permissions/resolver.ts` basado en niveles ACL (FULL_ACCESS, EDIT, COMMENT, READ_ONLY).
- **Impacto:** Confision para desarrolladores. Dependiendo de que sistema use un componente, los permisos efectivos seran diferentes. Un componente podria verificar `hasPermission('view_reports')` del auth-context pero otro verificar `hasPermission('view_reports')` de permissions.ts, dando resultados distintos segun el rol.
- **Fix sugerido:** Unificar en un solo sistema de permisos. El resolver ACL (`lib/permissions/resolver.ts`) parece ser el mas maduro; migrar todo hacia ese sistema.

---

### [MODERADO] Middleware no protege rutas API de forma explicita
- **Archivo:** `middleware.ts` lineas 60-64
- **Descripcion:** El matcher del middleware excluye `_next/static`, `_next/image`, favicon y archivos estaticos, pero NO excluye `/api/` routes explicitamente. Esto significa que las rutas API SI pasan por el middleware y se verifica la sesion. Sin embargo, el middleware solo redirige a `/login` (HTML redirect), lo cual no es util para llamadas API que esperan JSON. Las API routes implementan su propia verificacion de auth, pero si una API route nueva se crea sin verificacion, el middleware la "protege" con un redirect HTML inutil.
- **Impacto:** Bajo en la configuracion actual porque las API routes existentes verifican auth internamente. Pero el patron es fragil: un developer podria crear una API route asumiendo que el middleware la protege, cuando en realidad solo hace redirect HTML.
- **Fix sugerido:** En el middleware, detectar rutas `/api/` y retornar `NextResponse.json({ error: 'Unauthorized' }, { status: 401 })` en lugar de redirect.

---

### [MODERADO] startsWith() en middleware permite match de prefijo no intencionado
- **Archivo:** `middleware.ts` lineas 39-41
- **Descripcion:** La verificacion `publicRoutes.some(route => request.nextUrl.pathname.startsWith(route))` usa `startsWith`. Esto significa que cualquier ruta que comience con `/login`, `/register`, `/forgot-password`, o `/reset-password` sera tratada como publica. Por ejemplo: `/login-as-admin`, `/register-premium`, `/reset-password-admin/steal-tokens`.
- **Impacto:** Si en el futuro se crean rutas que empiecen con estos prefijos, seran automaticamente publicas sin intencion. Actualmente no hay rutas con estos prefijos, asi que el impacto es bajo pero es un bug latente.
- **Fix sugerido:** Usar comparacion exacta o verificar que el pathname sea exactamente la ruta o que continue con `/`: `pathname === route || pathname.startsWith(route + '/')`.

---

### [MENOR] Login page no tiene enlace a forgot-password
- **Archivo:** `app/login/page.tsx`
- **Descripcion:** La pagina de login no incluye ningun enlace a `/forgot-password`. Incluso si se implementara la pagina de recuperacion, los usuarios no tendrian forma de descubrirla desde el login.
- **Impacto:** UX incompleto. Los usuarios no pueden recuperar su contrasena.
- **Fix sugerido:** Agregar un enlace "Olvidaste tu contrasena?" debajo del formulario de login.

---

### [MENOR] Registro abierto sin restricciones
- **Archivo:** `app/register/page.tsx` lineas 56-98
- **Descripcion:** Cualquier persona puede registrarse y obtener automaticamente el rol `MEMBER` con `userType: 'MEMBER'`. No hay restriccion por dominio de email, invitacion previa, ni aprobacion de admin. El nuevo usuario obtiene inmediatamente acceso al dashboard con permisos de member.
- **Impacto:** En un contexto empresarial (agencia creativa), cualquier persona externa puede crear una cuenta y acceder a informacion interna: proyectos asignados, tareas, time tracking. Si RLS no esta perfectamente configurado, podria ver datos de otros usuarios.
- **Fix sugerido:** Implementar al menos una de: restriccion por dominio de email, sistema de invitaciones, o aprobacion manual por admin. Alternativamente, crear usuarios con `isActive: false` y requerir activacion por admin.

---

### [MENOR] Variable isPM en auth-context nunca sera true
- **Archivo:** `contexts/auth-context.tsx` linea 273
- **Descripcion:** `isPM: user?.role === 'pm'` nunca sera `true` porque `mapSupabaseRoleToLegacy()` nunca retorna `'pm'` (como se documenta en el issue critico sobre el rol pm).
- **Impacto:** Cualquier componente que use `isPM` para mostrar/ocultar funcionalidad tendra esa funcionalidad permanentemente oculta.
- **Fix sugerido:** Resolver el issue del mapeo de rol `pm` primero.

---

## Resumen de Hallazgos por Severidad

| Severidad | Cantidad | Issues |
|-----------|----------|--------|
| CRITICO   | 4        | Rutas 404, rol pm inalcanzable, /reports sin permisos, getSession() inseguro |
| MODERADO  | 5        | /settings accesible, setRole() sin validacion, permisos duplicados, API redirect, startsWith prefix |
| MENOR     | 3        | Sin link forgot-password, registro abierto, isPM muerto |

---

## Archivos Auditados

- `middleware.ts`
- `lib/auth/permissions.ts`
- `lib/auth/roles.ts`
- `contexts/auth-context.tsx`
- `lib/permissions/resolver.ts`
- `components/auth/permission-gate.tsx`
- `app/login/page.tsx`
- `app/register/page.tsx`
- `lib/supabase/client.ts`
- `lib/supabase/server.ts`
- `app/(dashboard)/admin/page.tsx`
- `app/(dashboard)/settings/page.tsx`
- `app/(dashboard)/reports/page.tsx`
- `app/api/team/[userId]/route.ts`
- `app/api/spaces/[spaceId]/areas/route.ts`
- `app/api/permissions/area/route.ts`
