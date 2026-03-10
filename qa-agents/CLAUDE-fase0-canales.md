# Agente Fase 0 — Crear Canales Reales
**Misión:** Crear el schema de canales en Prisma, migrar a Supabase, y seed de los 7 canales base.

---

## Contexto

Hoy los canales están 100% hardcodeados en el cliente (`app/(dashboard)/channels/[channelId]/client-page.tsx`). No existe modelo `Channel` ni `Message` en `prisma/schema.prisma`. Esta tarea crea la base de datos necesaria para los canales reales.

**Canales a crear:**
1. General
2. Cuentas
3. Estrategia
4. Creatividad
5. Diseño
6. Social Media
7. Producción

---

## Instrucciones paso a paso

### Paso 1 — Leer el schema actual
Lee el archivo completo:
- `prisma/schema.prisma`
- `prisma/prisma.config.ts`
- `app/(dashboard)/channels/[channelId]/client-page.tsx`

### Paso 2 — Agregar modelos al schema

En `prisma/schema.prisma`, agregar después del último modelo existente:

```prisma
model Channel {
  id          String    @id @default(cuid())
  name        String
  slug        String    @unique
  description String?
  isPrivate   Boolean   @default(false)
  isArchived  Boolean   @default(false)
  createdBy   String
  creator     User      @relation("ChannelCreator", fields: [createdBy], references: [id])
  messages    Message[]
  members     ChannelMember[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model ChannelMember {
  id        String   @id @default(cuid())
  channelId String
  userId    String
  channel   Channel  @relation(fields: [channelId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  joinedAt  DateTime @default(now())

  @@unique([channelId, userId])
}

model Message {
  id          String    @id @default(cuid())
  channelId   String
  userId      String
  content     String
  attachments Json?
  isEdited    Boolean   @default(false)
  channel     Channel   @relation(fields: [channelId], references: [id], onDelete: Cascade)
  user        User      @relation(fields: [userId], references: [id])
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
```

También agregar las relaciones inversas en el modelo `User` existente:
```prisma
// Agregar dentro del modelo User:
channelsCreated  Channel[]       @relation("ChannelCreator")
channelMembers   ChannelMember[]
messages         Message[]
```

### Paso 3 — Generar y aplicar migración

```bash
cd /workspaces/dcflow
npx prisma generate
```

Luego aplica el schema a Supabase directamente via SQL Editor.
Genera el SQL de los nuevos modelos:
```bash
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script
```

Copia el SQL generado para las tablas Channel, ChannelMember y Message y ejecútalo en Supabase SQL Editor.

### Paso 4 — Seed de canales base

Una vez creadas las tablas, ejecuta este SQL en Supabase SQL Editor para crear los 7 canales:

```sql
-- Obtener el ID del SUPER_ADMIN para usarlo como creador
DO $$
DECLARE
  admin_id TEXT;
BEGIN
  SELECT id INTO admin_id FROM "User" WHERE role = 'SUPER_ADMIN' LIMIT 1;
  
  INSERT INTO "Channel" (id, name, slug, description, "isPrivate", "isArchived", "createdBy", "createdAt", "updatedAt")
  VALUES
    (gen_random_uuid()::text, 'General', 'general', 'Canal general de la agencia', false, false, admin_id, NOW(), NOW()),
    (gen_random_uuid()::text, 'Cuentas', 'cuentas', 'Canal del equipo de cuentas', false, false, admin_id, NOW(), NOW()),
    (gen_random_uuid()::text, 'Estrategia', 'estrategia', 'Canal del equipo de estrategia', false, false, admin_id, NOW(), NOW()),
    (gen_random_uuid()::text, 'Creatividad', 'creatividad', 'Canal del equipo creativo', false, false, admin_id, NOW(), NOW()),
    (gen_random_uuid()::text, 'Diseño', 'diseno', 'Canal del equipo de diseño', false, false, admin_id, NOW(), NOW()),
    (gen_random_uuid()::text, 'Social Media', 'social-media', 'Canal del equipo de social media', false, false, admin_id, NOW(), NOW()),
    (gen_random_uuid()::text, 'Producción', 'produccion', 'Canal del equipo de producción', false, false, admin_id, NOW(), NOW());
END $$;
```

### Paso 5 — Habilitar Realtime en Supabase

En Supabase → **Database → Replication**, habilitar realtime para la tabla `Message`:
- Ve a Database → Replication
- Busca la tabla `Message`
- Activa el toggle de realtime

Esto es necesario para que los mensajes aparezcan en tiempo real sin recargar.

### Paso 6 — Agregar RLS básico

En Supabase SQL Editor, aplicar políticas RLS básicas:

```sql
-- Habilitar RLS
ALTER TABLE "Channel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChannelMember" ENABLE ROW LEVEL SECURITY;

-- Todos los usuarios autenticados pueden ver canales públicos
CREATE POLICY "Users can view public channels" ON "Channel"
  FOR SELECT USING (auth.role() = 'authenticated' AND "isPrivate" = false AND "isArchived" = false);

-- Todos los usuarios autenticados pueden ver mensajes de canales públicos
CREATE POLICY "Users can view messages" ON "Message"
  FOR SELECT USING (auth.role() = 'authenticated');

-- Usuarios autenticados pueden insertar mensajes
CREATE POLICY "Users can insert messages" ON "Message"
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
```

### Paso 7 — Verificar
```sql
SELECT name, slug FROM "Channel" ORDER BY name;
```
Debe retornar 7 canales.

### Paso 8 — Commit
```bash
cd /workspaces/dcflow
git add prisma/schema.prisma
git commit -m "feat: agregar modelos Channel, ChannelMember y Message al schema"
```

---

## Reporte final
Guarda en `/tmp/qa-reports/fase0-canales.md`:
- Tablas creadas en Supabase
- 7 canales creados con sus IDs
- Realtime habilitado (sí/no)
- RLS aplicado (sí/no)
- Cualquier error encontrado
