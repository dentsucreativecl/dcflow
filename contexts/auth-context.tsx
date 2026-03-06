"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';

// Role types matching Prisma schema
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MEMBER';
export type UserType = 'MEMBER' | 'GUEST';

// Legacy role type for backwards compatibility with existing components
export type Role = 'admin' | 'pm' | 'member' | 'client';

export interface User {
    id: string;
    name: string;
    email: string;
    role: Role;
    avatar?: string;
    department?: string;
    userAreas?: string[];
    supabaseRole?: UserRole;
    userType?: UserType;
    weeklyCapacity?: number;
    isActive?: boolean;
}

// Permission types
export type Permission =
    | 'view_dashboard'
    | 'view_projects'
    | 'create_project'
    | 'edit_project'
    | 'delete_project'
    | 'view_time_tracking'
    | 'manage_time_entries'
    | 'view_users'
    | 'manage_users'
    | 'view_reports'
    | 'view_settings'
    | 'manage_settings'
    | 'access_admin';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    setUser: (user: User | null) => void;
    setRole: (role: Role) => void;
    login: (email: string, password: string) => Promise<{ error?: string }>;
    logout: () => void;
    hasPermission: (permission: Permission) => boolean;
    canAccessRoute: (path: string) => boolean;
    isAdmin: boolean;
    isPM: boolean;
    isMember: boolean;
    isClient: boolean;
    isSuperAdmin: boolean;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Columns to select from User table (NEVER use select('*') to avoid exposing sensitive data)
const USER_SELECT_COLUMNS = 'id, email, name, role, userType, avatarUrl, weeklyCapacity, isActive, department, userAreas';

// Role to permission mapping
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
    admin: [
        'view_dashboard', 'view_projects', 'create_project', 'edit_project', 'delete_project',
        'view_time_tracking', 'manage_time_entries', 'view_users', 'manage_users',
        'view_reports', 'view_settings', 'manage_settings', 'access_admin'
    ],
    pm: [
        'view_dashboard', 'view_projects', 'create_project', 'edit_project',
        'view_time_tracking', 'manage_time_entries', 'view_users', 'view_reports', 'view_settings'
    ],
    member: [
        'view_dashboard', 'view_projects', 'view_time_tracking', 'manage_time_entries', 'view_settings'
    ],
    client: [
        'view_dashboard', 'view_projects'
    ],
};

// Convert Supabase roles to legacy role system
function mapSupabaseRoleToLegacy(role: UserRole, userType: UserType): Role {
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') return 'admin';
    if (userType === 'GUEST') return 'client';
    return 'member';
}

// Get initials from name
function getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// Public routes that don't require authentication
const publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password'];

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();
    const supabase = createClient();

    // Map database profile to User type
    const mapProfileToUser = useCallback((profile: {
        id: string;
        email: string;
        name: string;
        role: string;
        userType: string;
        avatarUrl?: string | null;
        weeklyCapacity?: number;
        isActive?: boolean;
        department?: string | null;
        userAreas?: string[] | null;
    }): User => {
        const legacyRole = mapSupabaseRoleToLegacy(
            profile.role as UserRole,
            profile.userType as UserType
        );
        return {
            id: profile.id,
            name: profile.name,
            email: profile.email,
            role: legacyRole,
            avatar: getInitials(profile.name),
            supabaseRole: profile.role as UserRole,
            userType: profile.userType as UserType,
            weeklyCapacity: profile.weeklyCapacity ?? 40,
            isActive: profile.isActive ?? true,
            department: profile.department ?? undefined,
            userAreas: profile.userAreas ?? [],
        };
    }, []);

    // Fetch user profile from public.User table
    const fetchProfile = useCallback(async (userId: string): Promise<User | null> => {
        const { data, error } = await supabase
            .from('User')
            .select(USER_SELECT_COLUMNS)
            .eq('id', userId)
            .single();

        if (error || !data) {
            console.error('Error fetching profile:', error?.message);
            return null;
        }

        if (!data.isActive) {
            return null;
        }

        return mapProfileToUser(data);
    }, [supabase, mapProfileToUser]);

    // Initialize auth state from Supabase session
    useEffect(() => {
        const initAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (session?.user) {
                    const profile = await fetchProfile(session.user.id);
                    setUser(profile);
                }
            } catch (error) {
                console.error('Auth initialization error:', error);
            } finally {
                setLoading(false);
            }
        };

        initAuth();

        // Listen for auth state changes (login, logout, token refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (session?.user) {
                    const profile = await fetchProfile(session.user.id);
                    setUser(profile);
                } else {
                    setUser(null);
                }

                if (event === 'SIGNED_OUT') {
                    setUser(null);
                }
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, [supabase, fetchProfile]);

    // Login function using Supabase Auth
    const login = async (email: string, password: string): Promise<{ error?: string }> => {
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                if (error.message === 'Invalid login credentials') {
                    return { error: 'Email o contraseña incorrectos' };
                }
                return { error: error.message };
            }

            router.push('/dashboard');
            return {};
        } catch (e) {
            console.error('Login error:', e);
            return { error: 'Error al iniciar sesión' };
        }
    };

    // Logout function
    const logout = async () => {
        await supabase.auth.signOut();
        setUser(null);
        // Hard redirect so browser sends fresh requests without stale auth cookies
        window.location.href = '/login';
    };

    // Set role (kept for backwards compatibility - does NOT change DB role)
    const setRole = (role: Role) => {
        if (!user) return;
        setUser({ ...user, role });
    };

    // Check permission
    const hasPermission = (permission: Permission): boolean => {
        if (!user) return false;
        return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
    };

    // Check route access
    const canAccessRoute = (path: string): boolean => {
        if (!user) return false;
        if (user.role === 'admin') return true;

        const restrictedRoutes: Record<string, Role[]> = {
            '/settings': ['admin', 'pm'],
            '/admin': ['admin'],
            '/reports': ['admin', 'pm'],
        };

        for (const [route, allowedRoles] of Object.entries(restrictedRoutes)) {
            if (path.startsWith(route) && !allowedRoles.includes(user.role)) {
                return false;
            }
        }

        return true;
    };

    const value: AuthContextType = {
        user,
        loading,
        setUser,
        setRole,
        login,
        logout,
        hasPermission,
        canAccessRoute,
        isAdmin: user?.role === 'admin',
        isPM: user?.role === 'pm',
        isMember: user?.role === 'member',
        isClient: user?.role === 'client',
        isSuperAdmin: user?.supabaseRole === 'SUPER_ADMIN',
        isAuthenticated: !!user,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
