/**
 * DC Flow — QA Permissions Report
 *
 * Verifies permission consistency for every user:
 *  - MEMBER: should have ≥1 SpaceMember AND ≥1 TaskAssignment
 *  - PM: should have SpaceMember in at least 1 Space
 *  - ADMIN: no SpaceMember required (full access), should have ADMIN role in Supabase
 *  - SUPER_ADMIN: total access
 *
 * Usage:
 *   npx ts-node --project tsconfig.json scripts/qa-permissions-report.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  userType: string;
  isActive: boolean;
  department: string | null;
  userAreas: string[] | null;
}

async function run() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('  DC Flow — QA Permissions Report');
  console.log('══════════════════════════════════════════════════\n');

  // ── Fetch all data ────────────────────────────────────────────────────────
  const [usersRes, spaceMembersRes, taskAssignmentsRes, spacesRes] = await Promise.all([
    supabase.from('User').select('id, name, email, role, userType, isActive, department, userAreas').order('role').order('name'),
    supabase.from('SpaceMember').select('userId, spaceId, role'),
    supabase.from('TaskAssignment').select('userId, taskId'),
    supabase.from('Space').select('id, name, isArchived'),
  ]);

  if (usersRes.error) { console.error('Error fetching users:', usersRes.error.message); process.exit(1); }

  const users: UserRow[] = usersRes.data || [];
  const spaceMembers: Array<{ userId: string; spaceId: string; role: string }> = spaceMembersRes.data || [];
  const taskAssignments: Array<{ userId: string; taskId: string }> = taskAssignmentsRes.data || [];
  const spaces: Array<{ id: string; name: string; isArchived: boolean }> = spacesRes.data || [];
  const activeSpaces = spaces.filter(s => !s.isArchived);

  // Build lookup maps
  const spaceMembersByUser = new Map<string, string[]>();
  for (const sm of spaceMembers) {
    if (!spaceMembersByUser.has(sm.userId)) spaceMembersByUser.set(sm.userId, []);
    spaceMembersByUser.get(sm.userId)!.push(sm.spaceId);
  }

  const tasksByUser = new Map<string, number>();
  for (const ta of taskAssignments) {
    tasksByUser.set(ta.userId, (tasksByUser.get(ta.userId) || 0) + 1);
  }

  // ── Summary stats ─────────────────────────────────────────────────────────
  const byRole = new Map<string, UserRow[]>();
  for (const u of users) {
    if (!byRole.has(u.role)) byRole.set(u.role, []);
    byRole.get(u.role)!.push(u);
  }

  console.log('📊 RESUMEN POR ROL:');
  for (const [role, list] of byRole) {
    const active = list.filter(u => u.isActive).length;
    const inactive = list.length - active;
    console.log(`   ${role.padEnd(12)} ${list.length} usuarios  (${active} activos, ${inactive} inactivos)`);
  }
  console.log(`\n   Total usuarios: ${users.length}`);
  console.log(`   Spaces activos: ${activeSpaces.length}`);
  console.log(`   SpaceMembers:   ${spaceMembers.length}`);
  console.log(`   TaskAssignments: ${taskAssignments.length}`);

  // ── Issues ────────────────────────────────────────────────────────────────
  const issues: Array<{ severity: 'ERROR' | 'WARN' | 'INFO'; user: string; role: string; issue: string }> = [];

  for (const u of users) {
    if (!u.isActive) continue; // skip inactive users

    const userSpaces = spaceMembersByUser.get(u.id) || [];
    const userTasks = tasksByUser.get(u.id) || 0;

    if (u.role === 'MEMBER' || (u.role === 'PM' && u.userType === 'MEMBER')) {
      if (userSpaces.length === 0) {
        issues.push({ severity: 'ERROR', user: u.name, role: u.role, issue: 'No tiene SpaceMember en ningún espacio — no puede ver proyectos' });
      }
      if (u.role === 'MEMBER' && userTasks === 0) {
        issues.push({ severity: 'WARN', user: u.name, role: u.role, issue: 'No tiene TaskAssignment en ninguna tarea' });
      }
      if (!u.department) {
        issues.push({ severity: 'INFO', user: u.name, role: u.role, issue: 'Sin cargo (department) asignado' });
      }
    }

    if (u.role === 'PM') {
      if (userSpaces.length === 0) {
        issues.push({ severity: 'ERROR', user: u.name, role: u.role, issue: 'PM sin SpaceMember en ningún espacio' });
      }
    }

    if (u.role === 'ADMIN' || u.role === 'SUPER_ADMIN') {
      // ADMINs don't need SpaceMembers but warn if they have areas set but no overlap check possible
      if (u.role === 'ADMIN' && u.userAreas && u.userAreas.length > 0) {
        issues.push({ severity: 'INFO', user: u.name, role: u.role, issue: `Tiene áreas asignadas [${u.userAreas.join(', ')}] — tiene acceso completo por ser ADMIN` });
      }
    }

    if (u.userType === 'GUEST') {
      // Clients (GUEST) should have SpaceMember in at least 1 space
      if (userSpaces.length === 0) {
        issues.push({ severity: 'WARN', user: u.name, role: 'GUEST', issue: 'Cliente sin SpaceMember — no puede ver ningún proyecto' });
      }
    }
  }

  // ── Print issues ──────────────────────────────────────────────────────────
  const errors = issues.filter(i => i.severity === 'ERROR');
  const warnings = issues.filter(i => i.severity === 'WARN');
  const infos = issues.filter(i => i.severity === 'INFO');

  if (errors.length > 0) {
    console.log(`\n🔴 ERRORES (${errors.length}) — requieren acción inmediata:`);
    for (const e of errors) {
      console.log(`   [${e.role}] ${e.user}: ${e.issue}`);
    }
  }

  if (warnings.length > 0) {
    console.log(`\n🟡 ADVERTENCIAS (${warnings.length}):`);
    for (const w of warnings) {
      console.log(`   [${w.role}] ${w.user}: ${w.issue}`);
    }
  }

  if (infos.length > 0) {
    console.log(`\n🔵 INFO (${infos.length}):`);
    for (const i of infos) {
      console.log(`   [${i.role}] ${i.user}: ${i.issue}`);
    }
  }

  if (issues.length === 0) {
    console.log('\n✅ Sin inconsistencias detectadas.');
  }

  // ── Per-role detail tables ─────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════');
  console.log('  DETALLE POR USUARIO (activos)');
  console.log('══════════════════════════════════════════════════');

  for (const u of users.filter(u => u.isActive)) {
    const userSpaces = spaceMembersByUser.get(u.id) || [];
    const userTasks = tasksByUser.get(u.id) || 0;
    const spaceNames = userSpaces
      .map(sid => spaces.find(s => s.id === sid)?.name || sid.slice(0, 8))
      .join(', ') || '—';

    const line = [
      u.name.padEnd(28),
      u.role.padEnd(12),
      `spaces:${userSpaces.length}`.padEnd(10),
      `tasks:${userTasks}`.padEnd(9),
      u.department ? `cargo:${u.department}` : 'sin cargo',
    ].join(' ');
    console.log(`   ${line}`);
  }

  console.log(`\n══════════════════════════════════════════════════`);
  console.log(`  RESUMEN: ${errors.length} errores, ${warnings.length} advertencias, ${infos.length} info`);
  console.log(`══════════════════════════════════════════════════\n`);
}

run().catch(e => { console.error(e); process.exit(1); });
