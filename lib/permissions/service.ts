import { createClient } from '@/lib/supabase/client';
import {
    ResourcePermission,
    SpaceMember,
    ResourceHierarchy,
    PermissionUser,
    PermissionLevel,
    resolvePermission
} from './resolver';

/**
 * Permission Service - Fetches and caches permissions from Supabase
 */

// Create Supabase client
function getSupabase() {
    return createClient();
}

// Cache for permissions (simple in-memory cache)
const permissionCache = new Map<string, { data: ResourcePermission[]; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute

/**
 * Fetch all permissions for a user
 */
export async function fetchUserPermissions(userId: string): Promise<ResourcePermission[]> {
    const cacheKey = `user_${userId}`;
    const cached = permissionCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    const supabase = getSupabase();

    // Get direct permissions
    const { data: directPerms, error: directError } = await supabase
        .from('ResourcePermission')
        .select('id, userId, teamId, resourceType, resourceId, permissionLevel, grantedById, createdAt, updatedAt')
        .eq('userId', userId);

    if (directError) {
        console.error('Error fetching direct permissions:', directError);
        return [];
    }

    // Get user's teams
    const { data: teams, error: teamError } = await supabase
        .from('TeamMember')
        .select('teamId')
        .eq('userId', userId);

    if (teamError) {
        console.error('Error fetching teams:', teamError);
        return directPerms || [];
    }

    const teamIds = teams?.map(t => t.teamId) || [];

    // Get team permissions
    let teamPerms: ResourcePermission[] = [];
    if (teamIds.length > 0) {
        const { data: teamPermData, error: teamPermError } = await supabase
            .from('ResourcePermission')
            .select('id, userId, teamId, resourceType, resourceId, permissionLevel, grantedById, createdAt, updatedAt')
            .in('teamId', teamIds);

        if (!teamPermError && teamPermData) {
            teamPerms = teamPermData;
        }
    }

    const allPermissions = [...(directPerms || []), ...teamPerms];

    // Cache the result
    permissionCache.set(cacheKey, { data: allPermissions, timestamp: Date.now() });

    return allPermissions;
}

/**
 * Fetch space memberships for a user
 */
export async function fetchSpaceMemberships(userId: string): Promise<SpaceMember[]> {
    const cacheKey = `spaces_${userId}`;
    const cached = permissionCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data as SpaceMember[];
    }

    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('SpaceMember')
        .select('spaceId, userId, role')
        .eq('userId', userId);

    if (error) {
        console.error('Error fetching space memberships:', error);
        return [];
    }

    const memberships = data || [];

    // Cache the result
    permissionCache.set(cacheKey, { data: memberships, timestamp: Date.now() });

    return memberships;
}

/**
 * Fetch team IDs for a user
 */
export async function fetchUserTeams(userId: string): Promise<string[]> {
    const cacheKey = `teams_${userId}`;
    const cached = permissionCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data as string[];
    }

    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('TeamMember')
        .select('teamId')
        .eq('userId', userId);

    if (error) {
        console.error('Error fetching user teams:', error);
        return [];
    }

    const teamIds = data?.map(t => t.teamId) || [];

    // Cache the result
    permissionCache.set(cacheKey, { data: teamIds, timestamp: Date.now() });

    return teamIds;
}

/**
 * Get resource hierarchy from a task/list/folder ID
 */
export async function fetchResourceHierarchy(
    resourceType: 'task' | 'list' | 'folder' | 'space',
    resourceId: string
): Promise<ResourceHierarchy> {
    const supabase = getSupabase();
    const hierarchy: ResourceHierarchy = {};

    switch (resourceType) {
        case 'task': {
            const { data: task } = await supabase
                .from('Task')
                .select('id, listId, list:listId(id, folderId, spaceId, folder:folderId(spaceId))')
                .eq('id', resourceId)
                .single();

            if (task) {
                hierarchy.taskId = task.id;
                hierarchy.listId = task.listId;
                const list = task.list as { folderId: string | null; spaceId: string | null } | null;
                if (list) {
                    hierarchy.folderId = list.folderId;
                    hierarchy.spaceId = list.spaceId;
                }
            }
            break;
        }

        case 'list': {
            const { data: list } = await supabase
                .from('List')
                .select('id, folderId, spaceId')
                .eq('id', resourceId)
                .single();

            if (list) {
                hierarchy.listId = list.id;
                hierarchy.folderId = list.folderId;
                hierarchy.spaceId = list.spaceId;
            }
            break;
        }

        case 'folder': {
            const { data: folder } = await supabase
                .from('Folder')
                .select('id, spaceId')
                .eq('id', resourceId)
                .single();

            if (folder) {
                hierarchy.folderId = folder.id;
                hierarchy.spaceId = folder.spaceId;
            }
            break;
        }

        case 'space': {
            hierarchy.spaceId = resourceId;
            break;
        }
    }

    return hierarchy;
}

/**
 * Check user permission on a specific resource
 */
export async function checkResourcePermission(
    user: PermissionUser,
    resourceType: 'task' | 'list' | 'folder' | 'space',
    resourceId: string
): Promise<PermissionLevel> {
    // Get all required data
    const [permissions, spaceMemberships, hierarchy, teamIds] = await Promise.all([
        fetchUserPermissions(user.id),
        fetchSpaceMemberships(user.id),
        fetchResourceHierarchy(resourceType, resourceId),
        fetchUserTeams(user.id),
    ]);

    // Add team IDs to user
    const userWithTeams: PermissionUser = {
        ...user,
        teamIds,
    };

    // Resolve permission
    return resolvePermission(userWithTeams, hierarchy, permissions, spaceMemberships);
}

/**
 * Clear permission cache (call after permission changes)
 */
export function clearPermissionCache(userId?: string) {
    if (userId) {
        permissionCache.delete(`user_${userId}`);
        permissionCache.delete(`spaces_${userId}`);
        permissionCache.delete(`teams_${userId}`);
    } else {
        permissionCache.clear();
    }
}
