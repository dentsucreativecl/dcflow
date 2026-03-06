import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseServiceKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required for seeding.')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
})

const userIds: Record<string, string> = {}

async function createAuthUser(email: string, password: string, name: string, key: string): Promise<string> {
    const { data, error } = await supabase.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { name }
    })
    if (error) {
        if (error.message.includes('already been registered') || error.message.includes('already exists')) {
            const { data: { users } } = await supabase.auth.admin.listUsers()
            const existing = users?.find(u => u.email === email)
            if (existing) {
                console.log(`   ℹ️  ${email} ya existe, reusando UUID`)
                userIds[key] = existing.id
                return existing.id
            }
        }
        throw new Error(`Failed to create auth user ${email}: ${error.message}`)
    }
    const userId = data.user.id
    userIds[key] = userId
    return userId
}

// Helper to create slug from name
function slugify(name: string): string {
    return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

// Helper to pick random items from array
function pick<T>(arr: T[], n: number): T[] {
    const shuffled = [...arr].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, n)
}

// Helper to pick random item
function pickOne<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]
}

// Random date in range
function randomDate(start: string, end: string): string {
    const s = new Date(start).getTime()
    const e = new Date(end).getTime()
    return new Date(s + Math.random() * (e - s)).toISOString()
}

// ============================================
// DATA DEFINITIONS
// ============================================

type Access = 'SUPER_ADMIN' | 'ADMIN' | 'MEMBER'

interface TeamMemberData {
    key: string; nombre: string; apellido: string; email: string;
    access: Access; cargo: string; area: string; manager: string | null;
}

const teamData: TeamMemberData[] = [
    { key: 'esteban-ibarra', nombre: 'Esteban', apellido: 'Ibarra', email: 'esteban.ibarra@dentsu.com', access: 'SUPER_ADMIN', cargo: 'Gerente General', area: 'Director', manager: null },
    // Admins (Directors)
    { key: 'jorge-martinez', nombre: 'Jorge', apellido: 'Martínez', email: 'jorge.martinez@dentsu.com', access: 'ADMIN', cargo: 'Director Diseño y Producción', area: 'Diseño', manager: 'esteban-ibarra' },
    { key: 'rebeca-sottorff', nombre: 'Rebeca', apellido: 'Sottorff', email: 'rebecca.sottorff@dentsu.com', access: 'ADMIN', cargo: 'Directora de Cuentas', area: 'Cuentas', manager: 'esteban-ibarra' },
    { key: 'zacha-martinez', nombre: 'Zacha', apellido: 'Martínez González', email: 'zacha.martinez@dentsu.com', access: 'ADMIN', cargo: 'Directora Social Media', area: 'Social Media', manager: 'esteban-ibarra' },
    { key: 'camila-wilton', nombre: 'Camila', apellido: 'Wilton', email: 'camila.wilton@dentsu.com', access: 'ADMIN', cargo: 'Supervisora de Cuentas', area: 'Cuentas', manager: 'rebeca-sottorff' },
    // Creatividad
    { key: 'jose-rojas', nombre: 'José', apellido: 'Rojas', email: 'jose.rojas@dentsu.com', access: 'MEMBER', cargo: 'Director Creativo', area: 'Creatividad', manager: 'esteban-ibarra' },
    { key: 'cristian-flores', nombre: 'Cristian', apellido: 'Flores', email: 'cristian.flores@dentsu.com', access: 'MEMBER', cargo: 'Art Director', area: 'Creatividad', manager: 'jose-rojas' },
    { key: 'matias-moris', nombre: 'Matías', apellido: 'Moris', email: 'matias.moris@dentsu.com', access: 'MEMBER', cargo: 'Art Director', area: 'Creatividad', manager: 'jose-rojas' },
    { key: 'mauricio-aravena', nombre: 'Mauricio', apellido: 'Aravena', email: 'mauricio.aravena@dentsu.com', access: 'MEMBER', cargo: 'Redactor Creativo', area: 'Creatividad', manager: 'jose-rojas' },
    // Diseño
    { key: 'ana-flores', nombre: 'Ana', apellido: 'Flores', email: 'ana.flores@dentsu.com', access: 'MEMBER', cargo: 'Diseñadora', area: 'Diseño', manager: 'jorge-martinez' },
    { key: 'araceli-uribe', nombre: 'Araceli', apellido: 'Uribe', email: 'araceli.uribe@dentsu.com', access: 'MEMBER', cargo: 'Diseñadora', area: 'Diseño', manager: 'jorge-martinez' },
    { key: 'bastian-victoriano', nombre: 'Bastián', apellido: 'Victoriano', email: 'bastian.victoriano@dentsu.com', access: 'MEMBER', cargo: 'Diseñador', area: 'Diseño', manager: 'jorge-martinez' },
    { key: 'benjamin-collio', nombre: 'Benjamín', apellido: 'Collio', email: 'benjamin.collio@dentsu.com', access: 'MEMBER', cargo: 'Diseñador Jr.', area: 'Diseño', manager: 'jorge-martinez' },
    { key: 'felipe-pavez', nombre: 'Felipe', apellido: 'Pavez', email: 'felipe.pavez@dentsu.com', access: 'MEMBER', cargo: 'Diseñador', area: 'Diseño', manager: 'jorge-martinez' },
    { key: 'leswy-borges', nombre: 'Leswy', apellido: 'Borges', email: 'leswy.borges@dentsu.com', access: 'MEMBER', cargo: 'Diseñadora', area: 'Diseño', manager: 'jorge-martinez' },
    { key: 'lorena-rojas', nombre: 'Lorena', apellido: 'Rojas', email: 'lorena.rojas@dentsu.com', access: 'MEMBER', cargo: 'Diseñadora', area: 'Diseño', manager: 'jorge-martinez' },
    { key: 'marialy-barrios', nombre: 'Marialy', apellido: 'Barrios', email: 'mari.barrios@dentsu.com', access: 'MEMBER', cargo: 'Diseñadora', area: 'Diseño', manager: 'jorge-martinez' },
    { key: 'natalia-castillo', nombre: 'Natalia', apellido: 'Castillo', email: 'natalia.castillo@dentsu.com', access: 'MEMBER', cargo: 'Diseñadora', area: 'Diseño', manager: 'jorge-martinez' },
    { key: 'paz-uribe', nombre: 'Paz', apellido: 'Uribe', email: 'paz.uribe@dentsu.com', access: 'MEMBER', cargo: 'Diseñadora', area: 'Diseño', manager: 'jorge-martinez' },
    { key: 'sofia-fierro', nombre: 'Sofía', apellido: 'Fierro', email: 'sofia.fierro@dentsu.com', access: 'MEMBER', cargo: 'Practicante Diseño', area: 'Diseño', manager: 'jorge-martinez' },
    { key: 'sofia-letelier', nombre: 'Sofía', apellido: 'Letelier', email: 'sofia.letelier@dentsu.com', access: 'MEMBER', cargo: 'Diseñadora', area: 'Diseño', manager: 'jorge-martinez' },
    // Social Media
    { key: 'agustin-ubillo', nombre: 'Agustín', apellido: 'Ubillo', email: 'agustin.ubillo@dentsu.com', access: 'MEMBER', cargo: 'Social Media Manager', area: 'Social Media', manager: 'zacha-martinez' },
    { key: 'alvaro-flores', nombre: 'Álvaro', apellido: 'Flores', email: 'alvaro.flores@dentsu.com', access: 'MEMBER', cargo: 'Community Manager', area: 'Social Media', manager: 'zacha-martinez' },
    { key: 'barbara-cartes', nombre: 'Bárbara', apellido: 'Cartes', email: 'barbara.cartes@dentsu.com', access: 'MEMBER', cargo: 'Content Manager', area: 'Social Media', manager: 'zacha-martinez' },
    { key: 'estefania-ramos', nombre: 'Estefanía', apellido: 'Ramos', email: 'estefania.ramos@dentsu.com', access: 'MEMBER', cargo: 'Community Manager', area: 'Social Media', manager: 'zacha-martinez' },
    { key: 'oriana-goris', nombre: 'Oriana', apellido: 'Goris', email: 'oriana.goris@dentsu.com', access: 'MEMBER', cargo: 'Community Manager', area: 'Social Media', manager: 'zacha-martinez' },
    { key: 'maria-lafertt', nombre: 'María José', apellido: 'Lafertt', email: 'maria.lafertt@dentsu.com', access: 'MEMBER', cargo: 'Community Manager Jr.', area: 'Social Media', manager: 'zacha-martinez' },
    { key: 'sofia-cifuentes', nombre: 'Sofía', apellido: 'Cifuentes', email: 'sofia.cifuentes@dentsu.com', access: 'MEMBER', cargo: 'Community Manager Jr.', area: 'Social Media', manager: 'zacha-martinez' },
    // Cuentas
    { key: 'claudia-araya', nombre: 'Claudia', apellido: 'Araya', email: 'claudia.araya@dentsu.com', access: 'MEMBER', cargo: 'Ejecutiva de Cuentas Sr', area: 'Cuentas', manager: 'rebeca-sottorff' },
    { key: 'francisco-venegas', nombre: 'Francisco', apellido: 'Venegas', email: 'francisco.venegas@dentsu.com', access: 'MEMBER', cargo: 'Supervisor de Cuentas', area: 'Cuentas', manager: 'rebeca-sottorff' },
    // Producción
    { key: 'andres-garat', nombre: 'Andrés', apellido: 'Garat', email: 'andres.garat@dentsu.com', access: 'MEMBER', cargo: 'Productor Audiovisual', area: 'Producción', manager: 'jose-rojas' },
    { key: 'rafael-farrera', nombre: 'Rafael', apellido: 'Farrera', email: 'rafael.farrera@dentsu.com', access: 'MEMBER', cargo: 'Motion Graphics Designer', area: 'Producción', manager: 'jose-rojas' },
    // Estrategia
    { key: 'sebastian-henriquez', nombre: 'Sebastián', apellido: 'Henríquez', email: 'sebastian.henriquez@dentsu.com', access: 'MEMBER', cargo: 'Brand Strategist', area: 'Estrategia', manager: 'esteban-ibarra' },
]

interface ClientData {
    name: string; services: string[];
}

const clientsData: ClientData[] = [
    { name: 'abc', services: ['Diseño', 'Social Media'] },
    { name: 'Kranf Heinz', services: ['Diseño'] },
    { name: 'CCU Catadores', services: ['Creatividad', 'Diseño', 'Social Media'] },
    { name: 'CCU Manantial', services: ['Creatividad', 'Diseño', 'Social Media'] },
    { name: 'CCU La Barra', services: ['Creatividad', 'Diseño', 'Social Media'] },
    { name: 'Dentaid', services: ['Social Media'] },
    { name: 'GM', services: ['Diseño'] },
    { name: 'Gourmet Marketing', services: ['Diseño', 'Social Media', 'Producción', 'Estrategia'] },
    { name: 'Gourmet B2B', services: ['Diseño', 'Social Media'] },
    { name: 'Gourmet Comunicaciones Internas', services: ['Diseño', 'Social Media'] },
    { name: 'Hoteles Explora', services: ['Diseño', 'Social Media'] },
    { name: 'Mastercard', services: ['Social Media', 'Diseño'] },
    { name: 'AFP PlanVital', services: ['Creatividad', 'Diseño', 'Social Media', 'Estrategia'] },
    { name: 'Transbank', services: ['Creatividad', 'Diseño', 'Social Media', 'Estrategia'] },
    { name: 'Toyota', services: ['Diseño'] },
    { name: 'U. Andes', services: ['Social Media'] },
    { name: 'UAHC', services: ['Diseño'] },
]

// Colors for client spaces
const spaceColors = [
    '#E67E22', '#9B59B6', '#2980B9', '#27AE60', '#E74C3C',
    '#1ABC9C', '#F39C12', '#8E44AD', '#2C3E50', '#D35400',
    '#16A085', '#C0392B', '#3498DB', '#7F8C8D', '#2ECC71',
    '#E91E63', '#00BCD4',
]

// Task templates per service
const taskTemplatesByService: Record<string, string[]> = {
    'Diseño': [
        'Diseño de key visual', 'Adaptaciones para RRSS', 'Diseño de banner web',
        'Diseño de pieza para email marketing', 'Diseño de presentación corporativa',
        'Adaptación formato stories', 'Retoque fotográfico', 'Diseño de infografía',
        'Maqueta de landing page', 'Diseño de flyer/afiche',
    ],
    'Social Media': [
        'Planificación parrilla mensual', 'Creación contenido Instagram', 'Redacción de copies',
        'Diseño de stories', 'Programación de publicaciones', 'Reporte mensual de métricas',
        'Gestión de comunidad', 'Creación de reels', 'Análisis de engagement',
        'Monitoreo de menciones y comentarios',
    ],
    'Creatividad': [
        'Concepto creativo de campaña', 'Guión para spot digital', 'Storyboard de pieza audiovisual',
        'Propuesta de key visual', 'Brainstorming de ideas', 'Presentación creativa a cliente',
        'Redacción de manifiesto de marca', 'Conceptualización de activación BTL',
    ],
    'Producción': [
        'Pre-producción de video', 'Filmación en locación', 'Edición de video',
        'Post-producción y colorización', 'Motion graphics para RRSS',
        'Fotografía de producto', 'Producción de audio/locutor',
    ],
    'Estrategia': [
        'Análisis de mercado', 'Benchmark competitivo', 'Plan estratégico trimestral',
        'Definición de KPIs', 'Research de audiencia', 'Informe de resultados',
        'Mapeo de customer journey', 'Análisis de tendencias del sector',
    ],
}

// Members grouped by area for task assignment
function getMembersByArea(area: string): string[] {
    return teamData.filter(t => t.area === area).map(t => t.key)
}

// Statuses per space (universal set)
const statusDefs = [
    { name: 'Por Hacer', color: '#DFE1E6', order: 1, type: 'TODO' as const },
    { name: 'En Proceso', color: '#4A90D9', order: 2, type: 'IN_PROGRESS' as const },
    { name: 'En Revisión', color: '#F5A623', order: 3, type: 'IN_PROGRESS' as const },
    { name: 'Completado', color: '#27AE60', order: 4, type: 'DONE' as const },
]

const priorities: Array<'URGENT' | 'HIGH' | 'NORMAL' | 'LOW'> = ['URGENT', 'HIGH', 'NORMAL', 'LOW']
const priorityWeights = [0.1, 0.25, 0.5, 0.15] // 10% urgent, 25% high, 50% normal, 15% low

function weightedPriority(): 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW' {
    const r = Math.random()
    let cumulative = 0
    for (let i = 0; i < priorities.length; i++) {
        cumulative += priorityWeights[i]
        if (r <= cumulative) return priorities[i]
    }
    return 'NORMAL'
}

// List name templates per service
const listNameTemplates: Record<string, string[]> = {
    'Diseño': ['Diseño Gráfico', 'Piezas Digitales', 'Branding'],
    'Social Media': ['Contenido RRSS', 'Community Management', 'Parrilla Social'],
    'Creatividad': ['Campaña Creativa', 'Concepto de Marca', 'Activaciones'],
    'Producción': ['Producción Audiovisual', 'Motion Graphics', 'Fotografía'],
    'Estrategia': ['Estrategia Digital', 'Research & Insights', 'Plan Estratégico'],
}

// ============================================
// MAIN SEED FUNCTION
// ============================================

async function main() {
    console.log('🌱 Starting DC Flow REAL seed...')
    console.log(`📡 Connecting to: ${supabaseUrl}`)

    // ── CLEAN ──
    console.log('\n🗑️  Limpiando datos existentes...')
    const tablesToClean = [
        'Annotation', 'Attachment', 'ChecklistItem', 'Checklist',
        'CustomFieldValue', 'CustomField', 'TaskRelation',
        'Comment', 'Activity', 'TaskAssignment', 'Task',
        'Automation', 'Status', 'List', 'Folder',
        'ResourcePermission', 'Invitation', 'Document', 'Template',
        'Notification', 'NotificationPreference',
        'TeamMember', 'Team', 'SpaceMember', 'Space', 'User'
    ]
    // TimeEntry has UUID id, clean separately
    await supabase.from('TimeEntry').delete().neq('taskId', '___none___')
    for (const table of tablesToClean) {
        const { error } = await supabase.from(table).delete().neq('id', '___none___')
        if (error && !error.message.includes('does not exist')) {
            console.warn(`   ⚠️  ${table}: ${error.message}`)
        }
    }
    await supabase.from('SpaceMember').delete().neq('spaceId', '___none___')
    await supabase.from('TeamMember').delete().neq('teamId', '___none___')
    console.log('   ✅ Datos limpiados')

    // ── 1. USERS ──
    console.log('\n👥 Creando usuarios en Supabase Auth...')
    for (const member of teamData) {
        const fullName = `${member.nombre} ${member.apellido}`
        const userId = await createAuthUser(member.email, 'dcflow2025', fullName, member.key)
        const { error } = await supabase.from('User').upsert({
            id: userId,
            email: member.email,
            name: fullName,
            role: member.access,
            userType: 'MEMBER',
            weeklyCapacity: 40,
            isActive: true,
            jobTitle: member.cargo,
            department: member.area,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }, { onConflict: 'id' })
        if (error) console.error(`   ❌ ${member.email}: ${error.message}`)
        else console.log(`   ✅ ${fullName} (${member.access}) → ${userId.slice(0, 8)}...`)
    }
    console.log(`✅ ${teamData.length} usuarios creados`)

    // ── 2. TEAMS (áreas internas) ──
    console.log('\n🏢 Creando equipos por área...')
    const areas = ['Diseño', 'Social Media', 'Creatividad', 'Producción', 'Estrategia', 'Cuentas']
    const teamColors: Record<string, string> = {
        'Diseño': '#F2A6A6', 'Social Media': '#17385C', 'Creatividad': '#E67E22',
        'Producción': '#2C3E50', 'Estrategia': '#9B59B6', 'Cuentas': '#0F4036',
    }
    const teamLeads: Record<string, string> = {
        'Diseño': 'jorge-martinez', 'Social Media': 'zacha-martinez', 'Creatividad': 'jose-rojas',
        'Producción': 'andres-garat', 'Estrategia': 'sebastian-henriquez', 'Cuentas': 'rebeca-sottorff',
    }

    for (const area of areas) {
        const teamId = `team-${slugify(area)}`
        await supabase.from('Team').upsert({
            id: teamId, name: area, description: `Equipo de ${area}`,
            color: teamColors[area], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        })
        const members = teamData.filter(t => t.area === area)
        for (const m of members) {
            const isLead = m.key === teamLeads[area]
            await supabase.from('TeamMember').upsert({
                teamId, userId: userIds[m.key], role: isLead ? 'LEAD' : 'MEMBER',
                joinedAt: new Date().toISOString(),
            }, { onConflict: 'teamId,userId' })
        }
    }
    console.log(`✅ ${areas.length} equipos creados`)

    // ── 3. SPACES (one per client) ──
    console.log('\n🏷️  Creando espacios (clientes)...')
    const spaceIds: Record<string, string> = {}
    for (let i = 0; i < clientsData.length; i++) {
        const client = clientsData[i]
        const spaceId = `space-${slugify(client.name)}`
        const spaceSlug = slugify(client.name)
        spaceIds[client.name] = spaceId
        await supabase.from('Space').upsert({
            id: spaceId, name: client.name, slug: spaceSlug,
            color: spaceColors[i % spaceColors.length],
            icon: '🏢', description: `Cliente: ${client.name}`,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        }, { onConflict: 'slug' })
    }
    console.log(`✅ ${clientsData.length} espacios creados`)

    // ── 4. STATUSES per space ──
    console.log('\n📊 Creando estados por espacio...')
    const statusIdMap: Record<string, Record<string, string>> = {} // spaceId -> statusName -> statusId
    for (const client of clientsData) {
        const spaceId = spaceIds[client.name]
        statusIdMap[spaceId] = {}
        for (const sd of statusDefs) {
            const statusId = `status-${slugify(client.name)}-${slugify(sd.name)}`
            statusIdMap[spaceId][sd.name] = statusId
            await supabase.from('Status').upsert({
                id: statusId, name: sd.name, color: sd.color, order: sd.order,
                type: sd.type, spaceId,
            })
        }
    }
    console.log(`✅ ${clientsData.length * statusDefs.length} estados creados`)

    // ── 5. FOLDERS (services within each client space) ──
    console.log('\n📁 Creando carpetas (servicios)...')
    const folderIds: Record<string, string> = {} // "clientName-service" -> folderId
    let folderCount = 0
    const serviceColors: Record<string, string> = {
        'Diseño': '#F2A6A6', 'Social Media': '#17385C', 'Creatividad': '#E67E22',
        'Producción': '#2C3E50', 'Estrategia': '#9B59B6',
    }
    for (const client of clientsData) {
        const spaceId = spaceIds[client.name]
        for (const service of client.services) {
            const folderId = `folder-${slugify(client.name)}-${slugify(service)}`
            folderIds[`${client.name}-${service}`] = folderId
            await supabase.from('Folder').upsert({
                id: folderId, name: service, spaceId,
                color: serviceColors[service] || '#666',
                useCustomStatus: false,
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            })
            folderCount++
        }
    }
    console.log(`✅ ${folderCount} carpetas creadas`)

    // ── 6. SPACE MEMBERS ──
    console.log('\n👥 Asignando miembros a espacios...')
    let memberCount = 0
    // Director/SuperAdmin gets access to all spaces
    const globalAccess = teamData.filter(t => t.area === 'Director' || t.area === 'Cuentas')
    // Service area members get access based on matching services
    const serviceAreaMap: Record<string, string> = {
        'Diseño': 'Diseño', 'Social Media': 'Social Media', 'Creatividad': 'Creatividad',
        'Producción': 'Producción', 'Estrategia': 'Estrategia',
    }

    for (const client of clientsData) {
        const spaceId = spaceIds[client.name]
        const addedUsers = new Set<string>()

        // Global access users (Director + Cuentas)
        for (const ga of globalAccess) {
            if (!userIds[ga.key]) continue
            addedUsers.add(ga.key)
            const role = ga.access === 'SUPER_ADMIN' ? 'OWNER' : (ga.access === 'ADMIN' ? 'ADMIN' : 'MEMBER')
            await supabase.from('SpaceMember').upsert(
                { spaceId, userId: userIds[ga.key], role },
                { onConflict: 'spaceId,userId' }
            )
            memberCount++
        }

        // Service-area members
        for (const service of client.services) {
            const area = serviceAreaMap[service]
            if (!area) continue
            const areaMembers = teamData.filter(t => t.area === area)
            for (const am of areaMembers) {
                if (addedUsers.has(am.key)) continue
                if (!userIds[am.key]) continue
                addedUsers.add(am.key)
                const role = am.access === 'ADMIN' ? 'ADMIN' : 'MEMBER'
                await supabase.from('SpaceMember').upsert(
                    { spaceId, userId: userIds[am.key], role },
                    { onConflict: 'spaceId,userId' }
                )
                memberCount++
            }
        }
    }
    console.log(`✅ ${memberCount} membresías creadas`)

    // ── 7. LISTS (projects per client/service) ──
    console.log('\n📋 Creando listas (proyectos)...')
    interface ListRecord { id: string; name: string; spaceId: string; folderId: string; service: string; clientName: string }
    const allLists: ListRecord[] = []
    for (const client of clientsData) {
        const spaceId = spaceIds[client.name]
        for (const service of client.services) {
            const folderId = folderIds[`${client.name}-${service}`]
            const templates = listNameTemplates[service] || ['Proyecto']
            // 1-2 lists per service per client
            const numLists = Math.min(templates.length, service === client.services[0] ? 2 : 1)
            for (let i = 0; i < numLists; i++) {
                const listId = `list-${slugify(client.name)}-${slugify(service)}-${i}`
                const listName = `${templates[i]} ${client.name}`
                allLists.push({ id: listId, name: listName, spaceId, folderId, service, clientName: client.name })
                await supabase.from('List').upsert({
                    id: listId, name: listName,
                    description: `Proyecto de ${service} para ${client.name}`,
                    spaceId, folderId, isPitch: false,
                    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
                })
            }
        }
    }
    console.log(`✅ ${allLists.length} listas creadas`)

    // ── 8. TASKS ──
    console.log('\n✅ Creando tareas...')
    interface TaskRecord { id: string; listId: string; statusId: string; service: string; clientName: string }
    const allTasks: TaskRecord[] = []
    let taskCounter = 0

    for (const list of allLists) {
        const spaceId = list.spaceId
        const statuses = statusIdMap[spaceId]
        const templates = taskTemplatesByService[list.service] || []
        // 4-7 tasks per list
        const numTasks = 4 + Math.floor(Math.random() * 4)
        const selectedTemplates = pick(templates, Math.min(numTasks, templates.length))

        // Pick creator from area members or directors
        const areaMembers = getMembersByArea(list.service)
        const creatorKey = areaMembers.length > 0 ? pickOne(areaMembers) : 'esteban-ibarra'

        for (let i = 0; i < selectedTemplates.length; i++) {
            taskCounter++
            const taskId = `task-${taskCounter}`
            const priority = weightedPriority()

            // Distribute statuses: ~25% done, ~30% in progress, ~20% review, ~25% todo
            const statusRoll = Math.random()
            let statusName: string
            if (statusRoll < 0.25) statusName = 'Completado'
            else if (statusRoll < 0.55) statusName = 'En Proceso'
            else if (statusRoll < 0.75) statusName = 'En Revisión'
            else statusName = 'Por Hacer'

            const statusId = statuses[statusName]
            const isDone = statusName === 'Completado'

            // Due dates: done tasks in past, active tasks in near future
            const dueDate = isDone
                ? randomDate('2026-01-05', '2026-02-15')
                : randomDate('2026-02-18', '2026-03-30')
            const completedAt = isDone ? randomDate(dueDate, new Date(new Date(dueDate).getTime() + 2 * 86400000).toISOString()) : null

            const estimatedHours = [2, 4, 6, 8, 10, 12, 16][Math.floor(Math.random() * 7)]

            const { error: taskErr } = await supabase.from('Task').upsert({
                id: taskId, title: selectedTemplates[i],
                description: `${selectedTemplates[i]} para el cliente ${list.clientName}`,
                listId: list.id, statusId, priority,
                dueDate, completedAt, estimatedHours,
                createdById: userIds[creatorKey],
                createdAt: randomDate('2026-01-01', '2026-02-15'),
                updatedAt: new Date().toISOString(),
            })
            if (taskErr) console.error(`   ❌ Task ${taskId}: ${taskErr.message}`)
            allTasks.push({ id: taskId, listId: list.id, statusId, service: list.service, clientName: list.clientName })
        }
    }
    console.log(`✅ ${allTasks.length} tareas creadas`)

    // ── 9. TASK ASSIGNMENTS ──
    console.log('\n👤 Asignando tareas a miembros...')
    let assignCount = 0
    for (const task of allTasks) {
        const areaMembers = getMembersByArea(task.service)
        if (areaMembers.length === 0) continue
        // 1-2 assignees per task
        const numAssignees = Math.random() < 0.3 ? 2 : 1
        const assignees = pick(areaMembers, Math.min(numAssignees, areaMembers.length))
        for (const assigneeKey of assignees) {
            if (!userIds[assigneeKey]) continue
            assignCount++
            await supabase.from('TaskAssignment').upsert({
                id: `assign-${assignCount}`, taskId: task.id, userId: userIds[assigneeKey],
                assignedAt: new Date().toISOString(),
            })
        }
    }
    console.log(`✅ ${assignCount} asignaciones creadas`)

    // ── 10. TIME ENTRIES ──
    console.log('\n⏱️  Creando registros de tiempo...')
    let timeCount = 0
    // Generate time entries for ~40% of tasks
    for (const task of allTasks) {
        if (Math.random() > 0.4) continue
        const areaMembers = getMembersByArea(task.service)
        if (areaMembers.length === 0) continue
        const worker = pickOne(areaMembers)
        if (!userIds[worker]) continue
        const hours = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8][Math.floor(Math.random() * 9)]
        const date = randomDate('2026-01-15', '2026-02-18').split('T')[0]
        timeCount++
        const { error: teErr } = await supabase.from('TimeEntry').insert({
            taskId: task.id, userId: userIds[worker],
            hours, date, description: `Trabajo en ${task.service}`,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        })
        if (teErr) console.error(`   ❌ TimeEntry: ${teErr.message}`)
    }
    console.log(`✅ ${timeCount} registros de tiempo`)

    // ── 11. COMMENTS ──
    console.log('\n💬 Creando comentarios...')
    const commentTemplates = [
        'Listo el primer avance, subo los archivos en un rato',
        'Necesito feedback sobre esta versión',
        'El cliente aprobó la propuesta, podemos avanzar',
        'Hay que ajustar los colores según la guía de marca',
        'Quedó muy bien, solo falta el copy final',
        'Revisé con el cliente y pidió algunos cambios menores',
        'Ya está programado para publicación',
        'Excelente trabajo, aprobado para producción',
        'Necesitamos las fotos en alta resolución',
        'La versión final está en la carpeta compartida',
        'Coordiné con el equipo de diseño para los ajustes',
        'El deadline se movió una semana, tenemos más tiempo',
    ]
    let commentCount = 0
    for (const task of allTasks) {
        if (Math.random() > 0.35) continue
        const areaMembers = getMembersByArea(task.service)
        if (areaMembers.length === 0) continue
        const numComments = Math.random() < 0.3 ? 2 : 1
        for (let c = 0; c < numComments; c++) {
            const commenter = pickOne(areaMembers)
            if (!userIds[commenter]) continue
            commentCount++
            await supabase.from('Comment').upsert({
                id: `comment-${commentCount}`, taskId: task.id, userId: userIds[commenter],
                content: pickOne(commentTemplates),
                createdAt: randomDate('2026-01-20', '2026-02-18'),
                updatedAt: new Date().toISOString(),
            })
        }
    }
    console.log(`✅ ${commentCount} comentarios`)

    // ── 12. ACTIVITIES ──
    console.log('\n📝 Creando actividades...')
    let actCount = 0
    for (const task of allTasks) {
        const areaMembers = getMembersByArea(task.service)
        if (areaMembers.length === 0) continue
        const actor = pickOne(areaMembers)
        if (!userIds[actor]) continue
        // CREATED activity for every task
        actCount++
        await supabase.from('Activity').upsert({
            id: `act-${actCount}`, taskId: task.id, userId: userIds[actor],
            type: 'CREATED', createdAt: randomDate('2026-01-05', '2026-02-10'),
        })
        // STATUS_CHANGED for ~60% of tasks
        if (Math.random() < 0.6) {
            actCount++
            await supabase.from('Activity').upsert({
                id: `act-${actCount}`, taskId: task.id, userId: userIds[actor],
                type: 'STATUS_CHANGED', field: 'status',
                oldValue: 'Por Hacer', newValue: 'En Proceso',
                createdAt: randomDate('2026-02-01', '2026-02-18'),
            })
        }
        // COMMENT_ADDED for ~30%
        if (Math.random() < 0.3) {
            actCount++
            const commenter = pickOne(areaMembers)
            await supabase.from('Activity').upsert({
                id: `act-${actCount}`, taskId: task.id, userId: userIds[commenter] || userIds[actor],
                type: 'COMMENT_ADDED',
                createdAt: randomDate('2026-02-05', '2026-02-18'),
            })
        }
    }
    console.log(`✅ ${actCount} actividades`)

    // ── 13. DOCUMENTS ──
    console.log('\n📄 Creando documentos...')
    const docTemplates = [
        { title: 'Brief Creativo', emoji: '📝' },
        { title: 'Reporte Mensual', emoji: '📊' },
        { title: 'Guía de Marca', emoji: '✦' },
        { title: 'Plan de Contenidos', emoji: '📱' },
        { title: 'Propuesta Estratégica', emoji: '🎯' },
    ]
    let docCount = 0
    // Create ~1 doc per 3 lists
    for (let i = 0; i < allLists.length; i += 3) {
        const list = allLists[i]
        const template = docTemplates[docCount % docTemplates.length]
        const areaMembers = getMembersByArea(list.service)
        const creator = areaMembers.length > 0 ? pickOne(areaMembers) : 'esteban-ibarra'
        docCount++
        await supabase.from('Document').upsert({
            id: `doc-${docCount}`,
            title: `${template.title} - ${list.clientName}`,
            content: JSON.stringify({
                type: 'doc', content: [
                    { type: 'heading', content: `${template.title} - ${list.clientName}` },
                    { type: 'paragraph', content: `Documento de ${list.service} para el cliente ${list.clientName}.` },
                    { type: 'paragraph', content: 'Contenido del documento aquí...' },
                ]
            }),
            emoji: template.emoji,
            listId: list.id, spaceId: list.spaceId,
            isPublic: false, isFavorite: Math.random() < 0.2, isArchived: false,
            createdById: userIds[creator],
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        })
    }
    console.log(`✅ ${docCount} documentos`)

    // ── 14. NOTIFICATIONS ──
    console.log('\n🔔 Creando notificaciones...')
    let notifCount = 0
    // Generate notifications for recent activities
    const recentTasks = allTasks.slice(-20)
    for (const task of recentTasks) {
        const areaMembers = getMembersByArea(task.service)
        if (areaMembers.length < 2) continue
        const actor = pickOne(areaMembers)
        const recipient = areaMembers.find(m => m !== actor) || actor
        if (!userIds[actor] || !userIds[recipient]) continue
        notifCount++
        const types: Array<'TASK_ASSIGNED' | 'COMMENT_ADDED' | 'STATUS_CHANGED' | 'DUE_DATE_SOON'> = ['TASK_ASSIGNED', 'COMMENT_ADDED', 'STATUS_CHANGED', 'DUE_DATE_SOON']
        const notifType = pickOne(types)
        await supabase.from('Notification').upsert({
            id: `notif-${notifCount}`, type: notifType,
            userId: userIds[recipient], actorId: userIds[actor], taskId: task.id,
            title: notifType === 'TASK_ASSIGNED' ? 'Nueva tarea asignada'
                : notifType === 'COMMENT_ADDED' ? 'Nuevo comentario'
                : notifType === 'STATUS_CHANGED' ? 'Cambio de estado'
                : 'Fecha límite próxima',
            message: `Actividad en tarea de ${task.service} - ${task.clientName}`,
            isRead: Math.random() < 0.3,
            createdAt: randomDate('2026-02-10', '2026-02-18'),
        })
    }
    console.log(`✅ ${notifCount} notificaciones`)

    // ── SUMMARY ──
    console.log('\n🎉 Seed completado exitosamente!')
    console.log('\n📊 Resumen:')
    console.log(`   👥 ${teamData.length} usuarios del equipo`)
    console.log(`   🏢 ${areas.length} equipos por área`)
    console.log(`   🏷️  ${clientsData.length} espacios (clientes)`)
    console.log(`   📊 ${clientsData.length * statusDefs.length} estados`)
    console.log(`   📁 ${folderCount} carpetas (servicios)`)
    console.log(`   📋 ${allLists.length} listas (proyectos)`)
    console.log(`   ✅ ${allTasks.length} tareas`)
    console.log(`   👤 ${assignCount} asignaciones`)
    console.log(`   ⏱️  ${timeCount} registros de tiempo`)
    console.log(`   💬 ${commentCount} comentarios`)
    console.log(`   📝 ${actCount} actividades`)
    console.log(`   📄 ${docCount} documentos`)
    console.log(`   🔔 ${notifCount} notificaciones`)
    console.log('\n🔑 Credenciales:')
    console.log('   Password: dcflow2025 (igual para todos)')
    console.log('\n👤 Login como:')
    console.log('   Super Admin: esteban.ibarra@dentsu.com')
    console.log('   Dir. Diseño: jorge.martinez@dentsu.com')
    console.log('   Dir. Cuentas: rebecca.sottorff@dentsu.com')
    console.log('   Dir. Social: zacha.martinez@dentsu.com')
    console.log('   Dir. Creativo: jose.rojas@dentsu.com')
}

main().catch((e) => {
    console.error('❌ Error durante el seed:', e)
    process.exit(1)
})
