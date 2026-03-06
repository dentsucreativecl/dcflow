'use client';

import { ReactNode } from 'react';
import { usePermissions, useCanAccess } from '@/lib/permissions';

interface PermissionGateProps {
    /**
     * The action the user needs to perform
     */
    action: 'view' | 'comment' | 'edit' | 'delete' | 'manage' | 'invite';

    /**
     * Resource type to check permissions for
     */
    resourceType?: 'task' | 'list' | 'folder' | 'space';

    /**
     * Resource ID to check permissions for
     */
    resourceId?: string;

    /**
     * Content to show when user has permission
     */
    children: ReactNode;

    /**
     * Content to show when user doesn't have permission (optional)
     */
    fallback?: ReactNode;

    /**
     * Content to show while loading (optional)
     */
    loading?: ReactNode;
}

/**
 * Component to conditionally render children based on user permissions
 * 
 * @example
 * <PermissionGate action="edit" resourceType="task" resourceId={taskId}>
 *   <EditButton />
 * </PermissionGate>
 */
export function PermissionGate({
    action,
    resourceType,
    resourceId,
    children,
    fallback = null,
    loading = null,
}: PermissionGateProps) {
    const { canAccess, loading: isLoading } = useCanAccess(action, resourceType, resourceId);

    if (isLoading) {
        return <>{loading}</>;
    }

    if (!canAccess) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}

/**
 * Hook variant for more complex permission logic
 */
export function usePermissionGate(
    action: 'view' | 'comment' | 'edit' | 'delete' | 'manage' | 'invite',
    resourceType?: 'task' | 'list' | 'folder' | 'space',
    resourceId?: string
) {
    return useCanAccess(action, resourceType, resourceId);
}

/**
 * Component to show different content based on permission level
 * 
 * @example
 * <PermissionSwitch resourceType="task" resourceId={taskId}>
 *   <PermissionSwitch.FullAccess>
 *     <AdminControls />
 *   </PermissionSwitch.FullAccess>
 *   <PermissionSwitch.Edit>
 *     <EditButton />
 *   </PermissionSwitch.Edit>
 *   <PermissionSwitch.ReadOnly>
 *     <ViewOnlyBadge />
 *   </PermissionSwitch.ReadOnly>
 * </PermissionSwitch>
 */
interface PermissionSwitchProps {
    resourceType?: 'task' | 'list' | 'folder' | 'space';
    resourceId?: string;
    children: ReactNode;
}

export function PermissionSwitch({ resourceType, resourceId, children }: PermissionSwitchProps) {
    const { level, loading } = usePermissions({ resourceType, resourceId });

    if (loading) {
        return null;
    }

    // Find matching child based on permission level
    const childArray = Array.isArray(children) ? children : [children];

    for (const child of childArray) {
        if (typeof child === 'object' && child !== null && 'type' in child) {
            const childType = (child as React.ReactElement).type;

            // Check each permission level slot
            if (childType === PermissionSwitch.FullAccess && level === 'FULL_ACCESS') {
                return <>{child}</>;
            }
            if (childType === PermissionSwitch.Edit && (level === 'EDIT' || level === 'FULL_ACCESS')) {
                return <>{child}</>;
            }
            if (childType === PermissionSwitch.Comment && (level === 'COMMENT' || level === 'EDIT' || level === 'FULL_ACCESS')) {
                return <>{child}</>;
            }
            if (childType === PermissionSwitch.ReadOnly && level !== 'NONE') {
                return <>{child}</>;
            }
            if (childType === PermissionSwitch.None && level === 'NONE') {
                return <>{child}</>;
            }
        }
    }

    return null;
}

// Slot components for PermissionSwitch
PermissionSwitch.FullAccess = function FullAccess({ children }: { children: ReactNode }) {
    return <>{children}</>;
};

PermissionSwitch.Edit = function Edit({ children }: { children: ReactNode }) {
    return <>{children}</>;
};

PermissionSwitch.Comment = function Comment({ children }: { children: ReactNode }) {
    return <>{children}</>;
};

PermissionSwitch.ReadOnly = function ReadOnly({ children }: { children: ReactNode }) {
    return <>{children}</>;
};

PermissionSwitch.None = function None({ children }: { children: ReactNode }) {
    return <>{children}</>;
};

/**
 * Higher-order component to protect entire pages
 */
export function withPermission<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    requiredAction: 'view' | 'comment' | 'edit' | 'delete' | 'manage' | 'invite',
    getResourceInfo?: (props: P) => { resourceType: 'task' | 'list' | 'folder' | 'space'; resourceId: string }
) {
    return function WithPermissionComponent(props: P) {
        const resourceInfo = getResourceInfo?.(props);
        const { canAccess, loading } = useCanAccess(
            requiredAction,
            resourceInfo?.resourceType,
            resourceInfo?.resourceId
        );

        if (loading) {
            return (
                <div className="flex items-center justify-center min-h-[200px]">
                    <div className="animate-pulse text-muted-foreground">Verificando permisos...</div>
                </div>
            );
        }

        if (!canAccess) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[200px] text-center">
                    <span className="text-4xl mb-4">🔒</span>
                    <h3 className="text-lg font-medium">Acceso Restringido</h3>
                    <p className="text-muted-foreground mt-1">
                        No tienes permiso para acceder a este contenido.
                    </p>
                </div>
            );
        }

        return <WrappedComponent {...props} />;
    };
}
