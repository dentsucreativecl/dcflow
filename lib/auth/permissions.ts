import { Role } from './roles';

export type Permission =
    // Project permissions
    | 'view_all_projects'
    | 'view_assigned_projects'
    | 'view_own_projects'
    | 'create_project'
    | 'edit_project'
    | 'delete_project'
    // Client permissions
    | 'view_all_clients'
    | 'create_client'
    | 'edit_client'
    | 'delete_client'
    // Task permissions
    | 'view_all_tasks'
    | 'view_assigned_tasks'
    | 'create_task'
    | 'edit_task'
    | 'delete_task'
    // Team permissions
    | 'view_team'
    | 'manage_team'
    | 'view_workload'
    // Time tracking
    | 'log_time'
    | 'view_all_time_entries'
    | 'view_own_time_entries'
    // Reports
    | 'view_reports'
    | 'export_reports'
    // Admin
    | 'access_admin'
    | 'manage_users'
    | 'bulk_actions'
    | 'import_data'
    // Settings
    | 'edit_profile'
    | 'manage_agency_settings'
    // Client portal
    | 'approve_deliverables'
    | 'submit_feedback';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
    admin: [
        // All permissions
        'view_all_projects',
        'create_project',
        'edit_project',
        'delete_project',
        'view_all_clients',
        'create_client',
        'edit_client',
        'delete_client',
        'view_all_tasks',
        'create_task',
        'edit_task',
        'delete_task',
        'view_team',
        'manage_team',
        'view_workload',
        'log_time',
        'view_all_time_entries',
        'view_reports',
        'export_reports',
        'access_admin',
        'manage_users',
        'bulk_actions',
        'import_data',
        'edit_profile',
        'manage_agency_settings',
    ],
    pm: [
        // Project Manager permissions
        'view_all_projects',
        'create_project',
        'edit_project',
        'view_all_clients',
        'create_client',
        'edit_client',
        'view_all_tasks',
        'create_task',
        'edit_task',
        'view_team',
        'manage_team',
        'view_workload',
        'log_time',
        'view_all_time_entries',
        'view_reports',
        'export_reports',
        'edit_profile',
    ],
    member: [
        // Team Member permissions
        'view_assigned_projects',
        'view_assigned_tasks',
        'edit_task',
        'log_time',
        'view_own_time_entries',
        'edit_profile',
    ],
    client: [
        // Client permissions
        'view_own_projects',
        'approve_deliverables',
        'submit_feedback',
        'edit_profile',
    ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
    return ROLE_PERMISSIONS[role].includes(permission);
}

export function canAccessRoute(role: Role, path: string): boolean {
    // Admin has access to everything
    if (role === 'admin') return true;

    // Define route access rules
    const routePermissions: Record<string, Permission> = {
        '/admin': 'access_admin',
        '/projects': 'view_all_projects',
        '/clients': 'view_all_clients',
        '/team': 'view_team',
        '/team/workload': 'view_workload',
        '/reports': 'view_reports',
    };

    // Check matching route (prefix match)
    for (const [route, permission] of Object.entries(routePermissions)) {
        if (path.startsWith(route)) {
            return hasPermission(role, permission);
        }
    }

    return true; // No specific permission required
}
