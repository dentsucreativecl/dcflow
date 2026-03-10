/**
 * DC Flow — Seed from Excel
 *
 * Reads DC-Flow-Setup-v4.xlsx and loads initial structure into Supabase.
 *
 * Usage:
 *   npm run seed:excel -- --dry-run   # Preview without writing
 *   npm run seed:excel                # Execute real seed
 */

import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as crypto from 'crypto';

// ─── Config ───────────────────────────────────────────────────────────────────

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const DRY_RUN = process.argv.includes('--dry-run');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Constants ────────────────────────────────────────────────────────────────

const SERVICES_ORDER = [
  'Estrategia', 'Cuentas', 'Creatividad', 'Diseño',
  'Social Media', 'Producción', 'PR/Comunicaciones', 'Media/Pauta',
];

const DEMO_TASKS = [
  {
    title: 'Briefing',
    description: 'Recibir y revisar el brief del cliente. Asegúrate de tener claro el objetivo, el público objetivo y los entregables esperados.',
  },
  {
    title: 'Propuesta',
    description: 'Preparar la propuesta creativa o plan de trabajo basado en el brief. Incluye referencias, enfoque y cronograma preliminar.',
  },
  {
    title: 'Producción',
    description: 'Ejecutar el trabajo según lo aprobado. Mantén al cliente informado de avances y registra tus horas en esta tarea.',
  },
  {
    title: 'Revisión',
    description: 'Presentar el trabajo al cliente y recopilar feedback. Documenta los cambios solicitados como comentarios en esta tarea.',
  },
  {
    title: 'Entrega',
    description: 'Entrega final al cliente con todos los archivos en orden. Marca esta tarea como completada cuando el cliente apruebe.',
  },
];

// Service → color mapping for folders
const SERVICE_COLORS: Record<string, string> = {
  'Estrategia': '#6366f1',
  'Cuentas': '#f59e0b',
  'Creatividad': '#ec4899',
  'Diseño': '#8b5cf6',
  'Social Media': '#06b6d4',
  'Producción': '#22c55e',
  'PR/Comunicaciones': '#f97316',
  'Media/Pauta': '#ef4444',
};

function cuid(): string {
  // Simple cuid-like generator
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(8).toString('hex').slice(0, 8);
  return `cl${timestamp}${random}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientSOW {
  name: string;
  services: string[];
}

interface TeamAssignment {
  name: string;
  email: string;
  client: string;
  role: string;
  area: string;
  isLeader: string;
}

interface AreaLeader {
  area: string;
  name: string;
  email: string;
}

interface TransversalRole {
  scope: string;
  name: string;
  email: string;
}

// ─── Counters ─────────────────────────────────────────────────────────────────

const counters = {
  foldersCreated: 0,
  listsCreated: 0,
  tasksCreated: 0,
  spaceMembersAssigned: 0,
};

const warnings = {
  clientsNotFound: [] as string[],
  usersNotFound: [] as string[],
};

// ─── STEP 1: Read Excel ──────────────────────────────────────────────────────

function readExcel(filePath: string) {
  const wb = XLSX.readFile(filePath);

  // Sheet: Clientes y SOW
  const sowSheet = wb.Sheets['🏢 Clientes y SOW'];
  const sowRows = XLSX.utils.sheet_to_json<any[]>(sowSheet, { header: 1 });
  // Row 2 = headers, Row 3+ = data
  const clients: ClientSOW[] = [];
  for (let i = 3; i < sowRows.length; i++) {
    const row = sowRows[i] as any[];
    if (!row || !row[0]) continue;
    const clientName = String(row[0]).trim();
    const services: string[] = [];
    for (let j = 0; j < SERVICES_ORDER.length; j++) {
      const val = row[j + 1];
      if (val && String(val).trim().toUpperCase() === 'X') {
        services.push(SERVICES_ORDER[j]);
      }
    }
    clients.push({ name: clientName, services });
  }

  // Sheet: Equipo y Cuentas
  const teamSheet = wb.Sheets['👥 Equipo y Cuentas'];
  const teamRows = XLSX.utils.sheet_to_json<any[]>(teamSheet, { header: 1 });
  // Row 2 = headers, Row 3+ = data
  const teamAssignments: TeamAssignment[] = [];
  for (let i = 3; i < teamRows.length; i++) {
    const row = teamRows[i] as any[];
    if (!row || !row[0]) continue;
    teamAssignments.push({
      name: String(row[0]).trim(),
      email: String(row[1]).trim().toLowerCase(),
      client: row[2] ? String(row[2]).trim() : '',
      role: row[3] ? String(row[3]).trim() : '',
      area: row[4] ? String(row[4]).trim() : '',
      isLeader: row[6] ? String(row[6]).trim() : 'No',
    });
  }

  // Sheet: Líderes de Área
  const leadersSheet = wb.Sheets['🏆 Líderes de Área'];
  const leadersRows = XLSX.utils.sheet_to_json<any[]>(leadersSheet, { header: 1 });
  // Row 2 = headers, Row 3-8 = area leaders, Row 12 = title, Row 13-14 = transversal
  const areaLeaders: AreaLeader[] = [];
  const transversalRoles: TransversalRole[] = [];

  for (let i = 3; i <= 8; i++) {
    const row = leadersRows[i] as any[];
    if (!row || !row[0]) continue;
    areaLeaders.push({
      area: String(row[0]).trim(),
      name: String(row[1]).trim(),
      email: String(row[2]).trim().toLowerCase(),
    });
  }

  for (let i = 13; i <= 14; i++) {
    const row = leadersRows[i] as any[];
    if (!row || !row[0]) continue;
    transversalRoles.push({
      scope: String(row[0]).trim(),
      name: String(row[1]).trim(),
      email: String(row[2]).trim().toLowerCase(),
    });
  }

  console.log(`📊 Excel leído:`);
  console.log(`   Clientes: ${clients.length}`);
  console.log(`   Asignaciones equipo: ${teamAssignments.length}`);
  console.log(`   Líderes de área: ${areaLeaders.length}`);
  console.log(`   Roles transversales: ${transversalRoles.length}`);
  console.log('');

  return { clients, teamAssignments, areaLeaders, transversalRoles };
}

// ─── DB Helpers ───────────────────────────────────────────────────────────────

async function fetchSpaces() {
  const { data, error } = await supabase
    .from('Space')
    .select('id, name, slug');
  if (error) throw new Error(`Error fetching spaces: ${error.message}`);
  return data || [];
}

async function fetchUsers() {
  const { data, error } = await supabase
    .from('User')
    .select('id, email, name, role');
  if (error) throw new Error(`Error fetching users: ${error.message}`);
  return data || [];
}

async function fetchStatuses(spaceId: string) {
  const { data, error } = await supabase
    .from('Status')
    .select('id, name, type, spaceId')
    .eq('spaceId', spaceId);
  if (error) throw new Error(`Error fetching statuses: ${error.message}`);
  return data || [];
}

async function fetchExistingFolders(spaceId: string) {
  const { data, error } = await supabase
    .from('Folder')
    .select('id, name, spaceId');
  if (error) throw new Error(`Error fetching folders: ${error.message}`);
  return (data || []).filter((f: any) => f.spaceId === spaceId);
}

async function fetchExistingLists(folderId: string) {
  const { data, error } = await supabase
    .from('List')
    .select('id, name, folderId');
  if (error) throw new Error(`Error fetching lists: ${error.message}`);
  return (data || []).filter((l: any) => l.folderId === folderId);
}

async function fetchExistingTasks(listId: string) {
  const { data, error } = await supabase
    .from('Task')
    .select('id, title, listId');
  if (error) throw new Error(`Error fetching tasks: ${error.message}`);
  return (data || []).filter((t: any) => t.listId === listId);
}

async function fetchExistingSpaceMembers(spaceId: string) {
  const { data, error } = await supabase
    .from('SpaceMember')
    .select('spaceId, userId, role');
  if (error) throw new Error(`Error fetching space members: ${error.message}`);
  return (data || []).filter((m: any) => m.spaceId === spaceId);
}

// ─── STEP 2: Create Folders ──────────────────────────────────────────────────

async function createFolders(
  clients: ClientSOW[],
  spaces: { id: string; name: string }[]
) {
  console.log('📁 PASO 2 — Creando Folders por servicio...');

  const spaceMap = new Map<string, { id: string; name: string }>();
  for (const s of spaces) {
    spaceMap.set(s.name.toLowerCase().trim(), s);
  }

  const createdFolders: { id: string; name: string; spaceId: string; spaceName: string }[] = [];

  for (const client of clients) {
    const space = spaceMap.get(client.name.toLowerCase().trim());
    if (!space) {
      warnings.clientsNotFound.push(client.name);
      continue;
    }

    const existingFolders = await fetchExistingFolders(space.id);
    const existingNames = new Set(existingFolders.map(f => f.name.toLowerCase()));

    for (const service of client.services) {
      if (existingNames.has(service.toLowerCase())) {
        // Already exists, get the id
        const existing = existingFolders.find(f => f.name.toLowerCase() === service.toLowerCase())!;
        createdFolders.push({ id: existing.id, name: service, spaceId: space.id, spaceName: space.name });
        console.log(`   ⏭  ${space.name} / ${service} (ya existe)`);
        continue;
      }

      const folderId = cuid();
      const now = new Date().toISOString();
      const folderData = {
        id: folderId,
        name: service,
        spaceId: space.id,
        color: SERVICE_COLORS[service] || null,
        createdAt: now,
        updatedAt: now,
      };

      if (DRY_RUN) {
        console.log(`   🔸 [DRY] Crearía folder: ${space.name} / ${service}`);
      } else {
        const { error } = await supabase.from('Folder').insert(folderData);
        if (error) {
          console.error(`   ❌ Error creando folder ${space.name}/${service}: ${error.message}`);
          continue;
        }
        console.log(`   ✅ ${space.name} / ${service}`);
      }
      counters.foldersCreated++;
      createdFolders.push({ id: folderId, name: service, spaceId: space.id, spaceName: space.name });
    }
  }

  console.log('');
  return createdFolders;
}

// ─── STEP 3: Create Demo Lists ───────────────────────────────────────────────

async function createDemoLists(
  folders: { id: string; name: string; spaceId: string; spaceName: string }[]
) {
  console.log('📋 PASO 3 — Creando Lists demo en cada Folder...');

  const DEMO_LIST_NAME = '[Demo] Primer proyecto';
  const createdLists: { id: string; folderId: string; spaceId: string; spaceName: string; folderName: string }[] = [];

  for (const folder of folders) {
    const existingLists = await fetchExistingLists(folder.id);
    const existing = existingLists.find(l => l.name === DEMO_LIST_NAME);

    if (existing) {
      createdLists.push({
        id: existing.id, folderId: folder.id, spaceId: folder.spaceId,
        spaceName: folder.spaceName, folderName: folder.name,
      });
      console.log(`   ⏭  ${folder.spaceName} / ${folder.name} / ${DEMO_LIST_NAME} (ya existe)`);
      continue;
    }

    const listId = cuid();
    const now = new Date().toISOString();
    const listData = {
      id: listId,
      name: DEMO_LIST_NAME,
      folderId: folder.id,
      spaceId: folder.spaceId,
      description: 'Esta es una lista de demostración. Renómbrala con el nombre de tu primer proyecto real y empieza a crear tareas.',
      createdAt: now,
      updatedAt: now,
    };

    if (DRY_RUN) {
      console.log(`   🔸 [DRY] Crearía list: ${folder.spaceName} / ${folder.name} / ${DEMO_LIST_NAME}`);
    } else {
      const { error } = await supabase.from('List').insert(listData);
      if (error) {
        console.error(`   ❌ Error creando list en ${folder.spaceName}/${folder.name}: ${error.message}`);
        continue;
      }
      console.log(`   ✅ ${folder.spaceName} / ${folder.name} / ${DEMO_LIST_NAME}`);
    }
    counters.listsCreated++;
    createdLists.push({
      id: listId, folderId: folder.id, spaceId: folder.spaceId,
      spaceName: folder.spaceName, folderName: folder.name,
    });
  }

  console.log('');
  return createdLists;
}

// ─── STEP 4: Create Demo Tasks ───────────────────────────────────────────────

async function createDemoTasks(
  lists: { id: string; folderId: string; spaceId: string; spaceName: string; folderName: string }[],
  users: { id: string; email: string; role: string }[]
) {
  console.log('📝 PASO 4 — Creando Tasks demo en cada List...');

  // We need a "system" user for createdById — use the first SUPER_ADMIN
  const adminUser = users.find(u => u.role === 'SUPER_ADMIN') || users.find(u => u.role === 'ADMIN') || users[0];
  if (!adminUser) throw new Error('No users found in DB');

  // Cache statuses per space to avoid repeated queries
  const statusCache = new Map<string, any[]>();

  for (const list of lists) {
    // Get TODO status for this space
    if (!statusCache.has(list.spaceId)) {
      statusCache.set(list.spaceId, await fetchStatuses(list.spaceId));
    }
    const statuses = statusCache.get(list.spaceId)!;
    const todoStatus = statuses.find(s => s.type === 'TODO');
    if (!todoStatus) {
      console.error(`   ❌ No TODO status found for space ${list.spaceName} — skipping tasks`);
      continue;
    }

    const existingTasks = await fetchExistingTasks(list.id);
    const existingTitles = new Set(existingTasks.map(t => t.title.toLowerCase()));

    for (let i = 0; i < DEMO_TASKS.length; i++) {
      const task = DEMO_TASKS[i];

      if (existingTitles.has(task.title.toLowerCase())) {
        console.log(`   ⏭  ${list.spaceName} / ${list.folderName} / ${task.title} (ya existe)`);
        continue;
      }

      const now = new Date().toISOString();
      const taskData = {
        id: cuid(),
        title: task.title,
        description: task.description,
        listId: list.id,
        statusId: todoStatus.id,
        priority: 'NORMAL',
        order: i,
        createdById: adminUser.id,
        createdAt: now,
        updatedAt: now,
      };

      if (DRY_RUN) {
        console.log(`   🔸 [DRY] Crearía task: ${list.spaceName} / ${list.folderName} / ${task.title}`);
      } else {
        const { error } = await supabase.from('Task').insert(taskData);
        if (error) {
          console.error(`   ❌ Error creando task ${task.title} en ${list.spaceName}/${list.folderName}: ${error.message}`);
          continue;
        }
        console.log(`   ✅ ${list.spaceName} / ${list.folderName} / ${task.title}`);
      }
      counters.tasksCreated++;
    }
  }

  console.log('');
}

// ─── STEP 5: Assign SpaceMembers ─────────────────────────────────────────────

async function assignSpaceMembers(
  clients: ClientSOW[],
  teamAssignments: TeamAssignment[],
  areaLeaders: AreaLeader[],
  transversalRoles: TransversalRole[],
  spaces: { id: string; name: string }[],
  users: { id: string; email: string; name: string; role: string }[]
) {
  console.log('👥 PASO 5 — Asignando SpaceMembers...');

  const spaceMap = new Map<string, { id: string; name: string }>();
  for (const s of spaces) spaceMap.set(s.name.toLowerCase().trim(), s);

  const userByEmail = new Map<string, { id: string; email: string; name: string; role: string }>();
  for (const u of users) userByEmail.set(u.email.toLowerCase(), u);

  // Build SOW map: client name → services
  const sowMap = new Map<string, string[]>();
  for (const c of clients) sowMap.set(c.name.toLowerCase().trim(), c.services);

  // Collect all desired memberships: Map<spaceId, Map<userId, role>>
  const memberships = new Map<string, Map<string, string>>();

  function addMembership(spaceId: string, userId: string, role: 'ADMIN' | 'MEMBER') {
    if (!memberships.has(spaceId)) memberships.set(spaceId, new Map());
    const spaceMembers = memberships.get(spaceId)!;
    // ADMIN > MEMBER (don't downgrade)
    const existing = spaceMembers.get(userId);
    if (existing === 'ADMIN') return; // already highest
    spaceMembers.set(userId, role);
  }

  // Regla A — Asignaciones directas del equipo
  const usersNotFoundSet = new Set<string>();
  for (const assignment of teamAssignments) {
    // Skip leaders/transversal rows (they have no specific client or "TODOS")
    if (!assignment.client || assignment.client.startsWith('TODOS')) continue;

    const space = spaceMap.get(assignment.client.toLowerCase().trim());
    if (!space) continue; // client not a space

    const user = userByEmail.get(assignment.email);
    if (!user) {
      usersNotFoundSet.add(assignment.email);
      continue;
    }

    // Skip ADMIN/SUPER_ADMIN — they have global access
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') continue;

    addMembership(space.id, user.id, 'MEMBER');
  }

  // Regla B — Líderes de área automáticos
  for (const leader of areaLeaders) {
    const user = userByEmail.get(leader.email);
    if (!user) {
      usersNotFoundSet.add(leader.email);
      continue;
    }
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') continue;

    // Find all spaces that have this leader's area in their SOW
    for (const [clientNameLower, services] of sowMap) {
      if (services.includes(leader.area)) {
        const space = spaceMap.get(clientNameLower);
        if (space) {
          addMembership(space.id, user.id, 'ADMIN'); // PM → ADMIN in SpaceRole
        }
      }
    }
  }

  // Regla C — Roles transversales
  for (const trans of transversalRoles) {
    const user = userByEmail.get(trans.email);
    if (!user) {
      usersNotFoundSet.add(trans.email);
      continue;
    }
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') continue;

    if (trans.scope === 'Todos los clientes') {
      // Camila → PM in ALL spaces
      for (const space of spaces) {
        addMembership(space.id, user.id, 'ADMIN');
      }
    } else if (trans.scope.includes('Social Media')) {
      // Agustín → PM in all spaces with Social Media
      for (const [clientNameLower, services] of sowMap) {
        if (services.includes('Social Media')) {
          const space = spaceMap.get(clientNameLower);
          if (space) {
            addMembership(space.id, user.id, 'ADMIN');
          }
        }
      }
    }
  }

  warnings.usersNotFound = [...usersNotFoundSet];

  // Now upsert all memberships
  for (const [spaceId, members] of memberships) {
    const existingMembers = await fetchExistingSpaceMembers(spaceId);
    const existingMap = new Map(existingMembers.map(m => [m.userId, m.role]));
    const spaceName = spaces.find(s => s.id === spaceId)?.name || spaceId;

    for (const [userId, role] of members) {
      const existingRole = existingMap.get(userId);
      if (existingRole === role) {
        // Already exists with same role
        continue;
      }

      if (DRY_RUN) {
        const userName = users.find(u => u.id === userId)?.name || userId;
        if (existingRole) {
          console.log(`   🔸 [DRY] Actualizaría: ${spaceName} ← ${userName} (${existingRole} → ${role})`);
        } else {
          console.log(`   🔸 [DRY] Agregaría: ${spaceName} ← ${userName} (${role})`);
        }
      } else {
        if (existingRole) {
          // Update role
          const { error } = await supabase
            .from('SpaceMember')
            .update({ role })
            .eq('spaceId', spaceId)
            .eq('userId', userId);
          if (error) {
            console.error(`   ❌ Error updating member in ${spaceName}: ${error.message}`);
            continue;
          }
          console.log(`   🔄 ${spaceName} ← ${users.find(u => u.id === userId)?.name} (${existingRole} → ${role})`);
        } else {
          // Insert new
          const { error } = await supabase
            .from('SpaceMember')
            .insert({ spaceId, userId, role });
          if (error) {
            console.error(`   ❌ Error adding member to ${spaceName}: ${error.message}`);
            continue;
          }
          console.log(`   ✅ ${spaceName} ← ${users.find(u => u.id === userId)?.name} (${role})`);
        }
      }
      counters.spaceMembersAssigned++;
    }
  }

  console.log('');
}

// ─── STEP 6: Summary ─────────────────────────────────────────────────────────

function printSummary() {
  console.log('═══════════════════════════════════════════════');
  if (DRY_RUN) console.log('🔸 DRY RUN — no se escribió nada a la DB\n');
  console.log(`✅ Folders creados: ${counters.foldersCreated}`);
  console.log(`✅ Lists demo creadas: ${counters.listsCreated}`);
  console.log(`✅ Tasks demo creadas: ${counters.tasksCreated}`);
  console.log(`✅ SpaceMembers asignados: ${counters.spaceMembersAssigned}`);
  if (warnings.clientsNotFound.length > 0) {
    console.log(`⚠️  Clientes no encontrados en DB: [${warnings.clientsNotFound.join(', ')}]`);
  }
  if (warnings.usersNotFound.length > 0) {
    console.log(`⚠️  Usuarios no encontrados en DB: [${warnings.usersNotFound.join(', ')}]`);
  }
  console.log('═══════════════════════════════════════════════');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('🚀 DC Flow — Seed desde Excel');
  if (DRY_RUN) console.log('🔸 MODO DRY RUN — solo preview, sin escritura a DB');
  console.log('═══════════════════════════════════════════════\n');

  // Step 1: Read Excel
  const excelPath = path.resolve(__dirname, '../DC-Flow-Setup-v4.xlsx');
  const { clients, teamAssignments, areaLeaders, transversalRoles } = readExcel(excelPath);

  // Fetch current DB state
  console.log('🔍 Leyendo estado actual de la DB...\n');
  const spaces = await fetchSpaces();
  const users = await fetchUsers();
  console.log(`   Spaces en DB: ${spaces.length}`);
  console.log(`   Users en DB: ${users.length}\n`);

  // Step 2: Create Folders
  const folders = await createFolders(clients, spaces);

  // Step 3: Create Demo Lists
  const lists = await createDemoLists(folders);

  // Step 4: Create Demo Tasks
  await createDemoTasks(lists, users);

  // Step 5: Assign SpaceMembers
  await assignSpaceMembers(clients, teamAssignments, areaLeaders, transversalRoles, spaces, users);

  // Step 6: Summary
  printSummary();
}

main().catch((err) => {
  console.error('💥 Error fatal:', err);
  process.exit(1);
});
