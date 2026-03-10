/**
 * DC Flow — Seed Channel Members
 *
 * Auto-assigns users to channels based on their department/area.
 *
 * Usage:
 *   npm run seed:channels -- --dry-run   # Preview without writing
 *   npm run seed:channels                # Execute real seed
 */

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
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Channel-to-Area mapping ─────────────────────────────────────────────────

// Each entry: [channel name pattern (lowercase), area name to match]
const CHANNEL_AREA_MAP: Array<{ patterns: string[]; area: string }> = [
  { patterns: ['diseño'], area: 'Diseño' },
  { patterns: ['cuentas'], area: 'Cuentas' },
  { patterns: ['creatividad'], area: 'Creatividad' },
  { patterns: ['social-media', 'social media'], area: 'Social Media' },
  { patterns: ['producción', 'produccion'], area: 'Producción' },
  { patterns: ['estrategia'], area: 'Estrategia' },
  { patterns: ['pr-comunicaciones'], area: 'PR/Comunicaciones' },
  { patterns: ['media-pauta'], area: 'Media/Pauta' },
];

function cuid(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(8).toString('hex').slice(0, 8);
  return `cl${timestamp}${random}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Channel {
  id: string;
  name: string;
  slug: string;
  isArchived: boolean;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  userAreas: string[];
  isActive: boolean;
}

// ─── Counters ─────────────────────────────────────────────────────────────────

const counters = {
  membersCreated: 0,
  membersSkipped: 0,
  channelsProcessed: 0,
};

// ─── DB Helpers ───────────────────────────────────────────────────────────────

async function fetchChannels(): Promise<Channel[]> {
  const { data, error } = await supabase
    .from('Channel')
    .select('id, name, slug, isArchived')
    .eq('isArchived', false);
  if (error) throw new Error(`Error fetching channels: ${error.message}`);
  return data || [];
}

async function fetchUsers(): Promise<User[]> {
  const { data, error } = await supabase
    .from('User')
    .select('id, name, email, role, department, userAreas, isActive')
    .eq('isActive', true);
  if (error) throw new Error(`Error fetching users: ${error.message}`);
  return data || [];
}

async function fetchExistingMembers(channelId: string): Promise<{ channelId: string; userId: string }[]> {
  const { data, error } = await supabase
    .from('ChannelMember')
    .select('channelId, userId')
    .eq('channelId', channelId);
  if (error) throw new Error(`Error fetching channel members: ${error.message}`);
  return data || [];
}

// ─── Matching Logic ───────────────────────────────────────────────────────────

function getAreaForChannel(channelName: string): string | 'ALL' | null {
  const lower = channelName.toLowerCase().trim();

  if (lower === 'general') return 'ALL';

  for (const mapping of CHANNEL_AREA_MAP) {
    for (const pattern of mapping.patterns) {
      if (lower === pattern || lower.includes(pattern)) {
        return mapping.area;
      }
    }
  }

  return null;
}

function userMatchesArea(user: User, area: string): boolean {
  // Check department
  if (user.department && user.department.toLowerCase() === area.toLowerCase()) {
    return true;
  }

  // Check userAreas array
  if (user.userAreas && Array.isArray(user.userAreas)) {
    return user.userAreas.some(
      (ua) => ua.toLowerCase() === area.toLowerCase()
    );
  }

  return false;
}

function isAdminUser(user: User): boolean {
  return user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('DC Flow — Seed Channel Members');
  if (DRY_RUN) console.log('[DRY RUN] Preview only, no writes to DB');
  console.log('===============================================\n');

  // Fetch data
  console.log('Fetching channels and users...\n');
  const channels = await fetchChannels();
  const users = await fetchUsers();
  console.log(`  Channels (non-archived): ${channels.length}`);
  console.log(`  Active users: ${users.length}\n`);

  if (channels.length === 0) {
    console.log('No channels found. Nothing to do.');
    return;
  }
  if (users.length === 0) {
    console.log('No active users found. Nothing to do.');
    return;
  }

  // Identify admin users (go to ALL channels)
  const adminUsers = users.filter(isAdminUser);
  const nonAdminUsers = users.filter((u) => !isAdminUser(u));

  console.log(`  Admin/SuperAdmin users (all channels): ${adminUsers.length}`);
  console.log(`  Regular users: ${nonAdminUsers.length}\n`);

  // Process each channel
  for (const channel of channels) {
    const area = getAreaForChannel(channel.name);

    if (area === null) {
      console.log(`[SKIP] #${channel.name} — no area mapping found`);
      continue;
    }

    counters.channelsProcessed++;

    // Determine which users should be in this channel
    let targetUsers: User[];
    if (area === 'ALL') {
      targetUsers = users; // All active users
    } else {
      // Area-matched non-admins + all admins
      const matchedNonAdmins = nonAdminUsers.filter((u) => userMatchesArea(u, area));
      targetUsers = [...adminUsers, ...matchedNonAdmins];
    }

    // Deduplicate by user id
    const targetUserIds = new Set(targetUsers.map((u) => u.id));

    // Fetch existing members
    const existingMembers = await fetchExistingMembers(channel.id);
    const existingUserIds = new Set(existingMembers.map((m) => m.userId));

    // Determine new members to add
    const newUserIds = [...targetUserIds].filter((id) => !existingUserIds.has(id));

    console.log(`#${channel.name} (area: ${area}) — ${targetUserIds.size} target, ${existingUserIds.size} existing, ${newUserIds.length} new`);

    for (const userId of newUserIds) {
      const user = users.find((u) => u.id === userId);
      const memberData = {
        id: cuid(),
        channelId: channel.id,
        userId,
        joinedAt: new Date().toISOString(),
      };

      if (DRY_RUN) {
        console.log(`  [DRY] Would add: ${user?.name || userId}`);
      } else {
        const { error } = await supabase.from('ChannelMember').upsert(memberData, {
          onConflict: 'channelId,userId',
        });
        if (error) {
          console.error(`  Error adding ${user?.name || userId}: ${error.message}`);
          continue;
        }
        console.log(`  + ${user?.name || userId}`);
      }
      counters.membersCreated++;
    }

    counters.membersSkipped += existingUserIds.size;
  }

  // Summary
  console.log('\n===============================================');
  if (DRY_RUN) console.log('[DRY RUN] No data was written to the DB\n');
  console.log(`Channels processed: ${counters.channelsProcessed}`);
  console.log(`Members added: ${counters.membersCreated}`);
  console.log(`Members already existing (skipped): ${counters.membersSkipped}`);
  console.log('===============================================');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
