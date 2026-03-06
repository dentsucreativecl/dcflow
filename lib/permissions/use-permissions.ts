'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import {
    PermissionLevel,
    PermissionUser,
    SpaceMember,
    canView,
    canComment,
    canEdit,
    canDelete,
    canManagePermissions,
    canInvite,
    formatPermissionLevel,
    getPermissionIcon,
} from './resolver';
import {
    checkResourcePermission,
    fetchUserPermissions,
    fetchSpaceMemberships,
    fetchUserTeams,
    clearPermissionCache,
} from './service';

interface UsePermissionsOptions {
    resourceType?: 'task' | 'list' | 'folder' | 'space';
    resourceId?: string;
}

interface PermissionState {
    level: PermissionLevel;
    loading: boolean;
    error: string | null;
}

/**
 * Hook to check permissions for the current user on a resource
 */
export function usePermissions(options: UsePermissionsOptions = {}) {
    const { user } = useAuth();
    const [state, setState] = useState<PermissionState>({
        level: 'NONE',
        loading: true,
        error: null,
    });

    // Create permission user from auth user
    const permissionUser: PermissionUser | null = useMemo(() => {
        if (!user) return null;
        return {
            id: user.id,
            role: user.supabaseRole || 'MEMBER',
            userType: user.userType || 'MEMBER',
        };
    }, [user]);

    // Check permission for specific resource
    const checkPermission = useCallback(async () => {
        if (!permissionUser) {
            setState({ level: 'NONE', loading: false, error: null });
            return;
        }

        // If no resource specified, assume SUPER_ADMIN check only
        if (!options.resourceType || !options.resourceId) {
            const level = permissionUser.role === 'SUPER_ADMIN' ? 'FULL_ACCESS' : 'NONE';
            setState({ level, loading: false, error: null });
            return;
        }

        setState(prev => ({ ...prev, loading: true, error: null }));

        try {
            const level = await checkResourcePermission(
                permissionUser,
                options.resourceType,
                options.resourceId
            );
            setState({ level, loading: false, error: null });
        } catch (error) {
            console.error('Permission check error:', error);
            setState({ level: 'NONE', loading: false, error: 'Error checking permissions' });
        }
    }, [permissionUser, options.resourceType, options.resourceId]);

    // Check permission on mount and when dependencies change
    useEffect(() => {
        checkPermission();
    }, [checkPermission]);

    // Refresh permissions
    const refresh = useCallback(() => {
        if (permissionUser) {
            clearPermissionCache(permissionUser.id);
        }
        checkPermission();
    }, [permissionUser, checkPermission]);

    // Permission capability helpers
    const capabilities = useMemo(() => ({
        canView: canView(state.level),
        canComment: canComment(state.level),
        canEdit: canEdit(state.level),
        canDelete: canDelete(state.level),
        canManagePermissions: canManagePermissions(state.level),
        canInvite: canInvite(state.level),
    }), [state.level]);

    return {
        ...state,
        ...capabilities,
        refresh,
        label: formatPermissionLevel(state.level),
        icon: getPermissionIcon(state.level),
        // Also expose the user role helpers
        isSuperAdmin: permissionUser?.role === 'SUPER_ADMIN',
        isAdmin: permissionUser?.role === 'ADMIN' || permissionUser?.role === 'SUPER_ADMIN',
        isGuest: permissionUser?.userType === 'GUEST',
    };
}

/**
 * Hook to check if user can access a specific action
 */
export function useCanAccess(
    action: 'view' | 'comment' | 'edit' | 'delete' | 'manage' | 'invite',
    resourceType?: 'task' | 'list' | 'folder' | 'space',
    resourceId?: string
) {
    const { level, loading } = usePermissions({ resourceType, resourceId });

    const canAccess = useMemo(() => {
        switch (action) {
            case 'view':
                return canView(level);
            case 'comment':
                return canComment(level);
            case 'edit':
                return canEdit(level);
            case 'delete':
            case 'manage':
            case 'invite':
                return canDelete(level);
            default:
                return false;
        }
    }, [action, level]);

    return { canAccess, loading };
}

/**
 * Hook to get user's space memberships
 */
export function useSpaceMemberships() {
    const { user } = useAuth();
    const [memberships, setMemberships] = useState<SpaceMember[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setMemberships([]);
            setLoading(false);
            return;
        }

        fetchSpaceMemberships(user.id)
            .then(setMemberships)
            .finally(() => setLoading(false));
    }, [user]);

    return { memberships, loading };
}

/**
 * Hook to get user's teams
 */
export function useUserTeams() {
    const { user } = useAuth();
    const [teams, setTeams] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setTeams([]);
            setLoading(false);
            return;
        }

        fetchUserTeams(user.id)
            .then(setTeams)
            .finally(() => setLoading(false));
    }, [user]);

    return { teams, loading };
}
