/**
 * DC Flow - Permission Resolver System
 * 
 * Implements a cascading ACL (Access Control List) with:
 * - 4 permission levels: FULL_ACCESS, EDIT, COMMENT, READ_ONLY
 * - Inheritance: Space → Folder → List → Task
 * - Specificity: More specific permissions override inherited ones
 * - GUEST restrictions: Maximum COMMENT level
 */

// Permission levels in order of privilege (highest to lowest)
export const PERMISSION_LEVELS = {
    FULL_ACCESS: 4,
    EDIT: 3,
    COMMENT: 2,
    READ_ONLY: 1,
    NONE: 0,
} as const;

export type PermissionLevel = keyof typeof PERMISSION_LEVELS;

// Resource types that can have permissions
export type ResourceType = 'space' | 'folder' | 'list' | 'task';

// User roles from database
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'PM' | 'MEMBER';
export type UserType = 'MEMBER' | 'GUEST';

// Permission source (where the permission comes from)
export interface PermissionSource {
    level: PermissionLevel;
    resourceType: ResourceType;
    resourceId: string;
    isInherited: boolean;
}

// User with permissions context
export interface PermissionUser {
    id: string;
    role: UserRole;
    userType: UserType;
    teamIds?: string[];
}

// Resource hierarchy
export interface ResourceHierarchy {
    spaceId?: string;
    folderId?: string;
    listId?: string;
    taskId?: string;
}

// Permission record from database
export interface ResourcePermission {
    id: string;
    userId?: string;
    teamId?: string;
    spaceId?: string;
    folderId?: string;
    listId?: string;
    taskId?: string;
    level: PermissionLevel;
}

// Space member record
export interface SpaceMember {
    spaceId: string;
    userId: string;
    role: 'OWNER' | 'ADMIN' | 'MEMBER';
}

/**
 * Resolve the effective permission level for a user on a resource
 * 
 * Algorithm:
 * 1. Check if user is SUPER_ADMIN (full access to everything)
 * 2. Get all applicable permissions (user + team) for the resource hierarchy
 * 3. Apply specificity rule (most specific wins)
 * 4. Apply highest privilege rule (if multiple at same level)
 * 5. Apply GUEST restriction (max COMMENT)
 */
export function resolvePermission(
    user: PermissionUser,
    hierarchy: ResourceHierarchy,
    permissions: ResourcePermission[],
    spaceMemberships?: SpaceMember[]
): PermissionLevel {
    // SUPER_ADMIN has full access to everything
    if (user.role === 'SUPER_ADMIN') {
        return 'FULL_ACCESS';
    }

    // Check space membership first
    if (hierarchy.spaceId && spaceMemberships) {
        const membership = spaceMemberships.find(
            m => m.spaceId === hierarchy.spaceId && m.userId === user.id
        );

        if (membership) {
            // Space OWNER/ADMIN has FULL_ACCESS
            if (membership.role === 'OWNER' || membership.role === 'ADMIN') {
                return applyGuestRestriction('FULL_ACCESS', user.userType);
            }
            // Space MEMBER has EDIT by default
            if (membership.role === 'MEMBER') {
                // Still need to check for more specific permissions below
            }
        }
    }

    // Get all applicable permissions
    const applicablePermissions = getApplicablePermissions(user, hierarchy, permissions);

    if (applicablePermissions.length === 0) {
        // Check if user is a space member with default access
        if (hierarchy.spaceId && spaceMemberships) {
            const membership = spaceMemberships.find(
                m => m.spaceId === hierarchy.spaceId && m.userId === user.id
            );
            if (membership) {
                return applyGuestRestriction('EDIT', user.userType);
            }
        }
        return 'NONE';
    }

    // Sort by specificity (most specific first)
    const sorted = sortBySpecificity(applicablePermissions);

    // Get the most specific permission
    const mostSpecific = sorted[0];

    // If there are multiple at the same specificity level, take highest privilege
    const sameSpecificity = sorted.filter(
        p => getResourceSpecificity(p) === getResourceSpecificity(mostSpecific)
    );

    const highestLevel = sameSpecificity.reduce((highest, current) => {
        const currentValue = PERMISSION_LEVELS[current.level];
        const highestValue = PERMISSION_LEVELS[highest.level];
        return currentValue > highestValue ? current : highest;
    }, sameSpecificity[0]);

    // Apply GUEST restriction
    return applyGuestRestriction(highestLevel.level, user.userType);
}

/**
 * Get all permissions that apply to the user for this resource hierarchy
 */
function getApplicablePermissions(
    user: PermissionUser,
    hierarchy: ResourceHierarchy,
    permissions: ResourcePermission[]
): ResourcePermission[] {
    return permissions.filter(permission => {
        // Check if permission applies to this user or their teams
        const appliesToUser = permission.userId === user.id;
        const appliesToTeam = user.teamIds?.includes(permission.teamId || '');

        if (!appliesToUser && !appliesToTeam) {
            return false;
        }

        // Check if permission is in the resource hierarchy
        if (permission.taskId && permission.taskId === hierarchy.taskId) return true;
        if (permission.listId && permission.listId === hierarchy.listId) return true;
        if (permission.folderId && permission.folderId === hierarchy.folderId) return true;
        if (permission.spaceId && permission.spaceId === hierarchy.spaceId) return true;

        return false;
    });
}

/**
 * Sort permissions by specificity (most specific first)
 * Task > List > Folder > Space
 */
function sortBySpecificity(permissions: ResourcePermission[]): ResourcePermission[] {
    return [...permissions].sort((a, b) => {
        return getResourceSpecificity(b) - getResourceSpecificity(a);
    });
}

/**
 * Get the specificity value of a permission
 * Higher = more specific
 */
function getResourceSpecificity(permission: ResourcePermission): number {
    if (permission.taskId) return 4;
    if (permission.listId) return 3;
    if (permission.folderId) return 2;
    if (permission.spaceId) return 1;
    return 0;
}

/**
 * Apply GUEST restriction (max COMMENT level)
 */
function applyGuestRestriction(level: PermissionLevel, userType: UserType): PermissionLevel {
    if (userType === 'GUEST') {
        const levelValue = PERMISSION_LEVELS[level];
        const maxGuestValue = PERMISSION_LEVELS.COMMENT;

        if (levelValue > maxGuestValue) {
            return 'COMMENT';
        }
    }
    return level;
}

/**
 * Check if user has at least a certain permission level
 */
export function hasPermissionLevel(
    userLevel: PermissionLevel,
    requiredLevel: PermissionLevel
): boolean {
    return PERMISSION_LEVELS[userLevel] >= PERMISSION_LEVELS[requiredLevel];
}

/**
 * Check specific capabilities based on permission level
 */
export function canView(level: PermissionLevel): boolean {
    return hasPermissionLevel(level, 'READ_ONLY');
}

export function canComment(level: PermissionLevel): boolean {
    return hasPermissionLevel(level, 'COMMENT');
}

export function canEdit(level: PermissionLevel): boolean {
    return hasPermissionLevel(level, 'EDIT');
}

export function canDelete(level: PermissionLevel): boolean {
    return hasPermissionLevel(level, 'FULL_ACCESS');
}

export function canManagePermissions(level: PermissionLevel): boolean {
    return hasPermissionLevel(level, 'FULL_ACCESS');
}

export function canInvite(level: PermissionLevel): boolean {
    return hasPermissionLevel(level, 'FULL_ACCESS');
}

/**
 * Format permission level for display
 */
export function formatPermissionLevel(level: PermissionLevel): string {
    const labels: Record<PermissionLevel, string> = {
        FULL_ACCESS: 'Acceso completo',
        EDIT: 'Puede editar',
        COMMENT: 'Puede comentar',
        READ_ONLY: 'Solo lectura',
        NONE: 'Sin acceso',
    };
    return labels[level];
}

/**
 * Get permission level icon
 */
export function getPermissionIcon(level: PermissionLevel): string {
    const icons: Record<PermissionLevel, string> = {
        FULL_ACCESS: '👑',
        EDIT: '✏️',
        COMMENT: '💬',
        READ_ONLY: '👁️',
        NONE: '🚫',
    };
    return icons[level];
}
