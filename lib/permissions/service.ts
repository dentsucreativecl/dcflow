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
 *
 * ResourcePermission DB columns: id, userId, teamId, spaceId, folderId, listId, taskId, level, grantedById, grantedAt
 */

function getSupabase() {
    return createClient();
}

// Cache for permissions (simple in-memory cache)
const permissionCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute

/**
 * Fetch all permissions for a user
 */
export async function fetchUserPermissions(userId: string): Promise<ResourcePermission[]> {
    const cacheKey = `user_${userId}`;
    const cached = permissionCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data as ResourcePermission[];
    }

    const supabase = getSupabase();

    // Get direct permissions
    const { data: directPerms, error: directError } = await supabase
        .from('ResourcePermission')
        .select('id, userId, teamId, spaceId, folderId, listId, taskId, level, grantedById, grantedAt')
        .eq('userId', userId);

    if (directError) {
        return [];
    }

    // Get user's teams
    const { data: teams, error: teamError } = await supabase
        .from('TeamMember')
        .select('teamId')
        .eq('userId', userId);

    if (teamError) {
        return (directPerms || []) as ResourcePermission[];
    }

    const teamIds = teams?.map(t => t.teamId) || [];

    // Get team permissions
    let teamPerms: ResourcePermission[] = [];
    if (teamIds.length > 0) {
        const { data: teamPermData, error: teamPermError } = await supabase
            .from('ResourcePermission')
            .select('id, userId, teamId, spaceId, folderId, listId, taskId, level, grantedById, grantedAt')
            .in('teamId', teamIds);

        if (!teamPermError && teamPermData) {
            teamPerms = teamPermData as ResourcePermission[];
        }
    }

    const allPermissions = [...((directPerms || []) as ResourcePermission[]), ...teamPerms];

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
        return [];
    }

    const memberships = (data || []) as SpaceMember[];

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
        return [];
    }

    const teamIds = data?.map(t => t.teamId) || [];

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
                .select('id, listId')
                .eq('id', resourceId)
                .single();

            if (task) {
                hierarchy.taskId = task.id;
                hierarchy.listId = task.listId;

                // Fetch list to get folder/space
                const { data: list } = await supabase
                    .from('List')
                    .select('folderId, spaceId')
                    .eq('id', task.listId)
                    .single();

                if (list) {
                    hierarchy.folderId = list.folderId ?? undefined;
                    hierarchy.spaceId = list.spaceId ?? undefined;
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
                hierarchy.folderId = list.folderId ?? undefined;
                hierarchy.spaceId = list.spaceId ?? undefined;
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
                hierarchy.spaceId = folder.spaceId ?? undefined;
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
    const [permissions, spaceMemberships, hierarchy, teamIds] = await Promise.all([
        fetchUserPermissions(user.id),
        fetchSpaceMemberships(user.id),
        fetchResourceHierarchy(resourceType, resourceId),
        fetchUserTeams(user.id),
    ]);

    const userWithTeams: PermissionUser = {
        ...user,
        teamIds,
    };

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
