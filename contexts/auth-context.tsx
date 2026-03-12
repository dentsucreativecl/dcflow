"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import type { User as SupabaseUser } from '@supabase/supabase-js';

// Role types matching Prisma schema
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'PM' | 'MEMBER';
export type UserType = 'MEMBER' | 'GUEST';

// Legacy role type for backwards compatibility with existing components
export type Role = 'admin' | 'pm' | 'member' | 'client';

export interface User {
    id: string;
    name: string;
    email: string;
    role: Role;
    avatar?: string;
    avatarUrl?: string;
    department?: string;
    userAreas?: string[];
    supabaseRole?: UserRole;
    userType?: UserType;
    weeklyCapacity?: number;
    isActive?: boolean;
    gender?: string;
}

// Re-export unified Permission type from lib/auth/permissions
import { Permission, hasPermission as authHasPermission, canAccessRoute as authCanAccessRoute } from '@/lib/auth/permissions';
export type { Permission };

interface AuthContextType {
    user: User | null;
    loading: boolean;
    setUser: (user: User | null) => void;
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
const USER_SELECT_COLUMNS = 'id, email, name, role, userType, avatarUrl, weeklyCapacity, isActive, department, userAreas, gender';

// Convert Supabase roles to legacy role system
function mapSupabaseRoleToLegacy(role: UserRole, userType: UserType): Role {
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') return 'admin';
    if (role === 'PM') return 'pm';
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
        gender?: string | null;
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
            avatarUrl: profile.avatarUrl ?? undefined,
            supabaseRole: profile.role as UserRole,
            userType: profile.userType as UserType,
            weeklyCapacity: profile.weeklyCapacity ?? 40,
            isActive: profile.isActive ?? true,
            department: profile.department ?? undefined,
            userAreas: profile.userAreas ?? [],
            gender: profile.gender ?? 'MASCULINE',
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
                const { data: { user: authUser } } = await supabase.auth.getUser();

                if (authUser) {
                    const profile = await fetchProfile(authUser.id);
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
                if (event === 'SIGNED_OUT' || !session?.user) {
                    setUser(null);
                    return;
                }
                const profile = await fetchProfile(session.user.id);
                // Only update user if profile fetch succeeded.
                // On TOKEN_REFRESHED, a transient fetchProfile error (network hiccup)
                // must NOT set user=null — that causes every page's useEffect([user])
                // to fire with null and get stuck with loading=true permanently.
                if (profile !== null) {
                    setUser(profile);
                }
                // If profile is null (fetch error), keep the existing user state so
                // pages stay functional. The user will be signed out on next hard refresh.
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

    // Check permission using unified auth/permissions.ts
    const hasPermission = (permission: Permission): boolean => {
        if (!user) return false;
        return authHasPermission(user.role, permission);
    };

    // Check route access using unified permissions
    const canAccessRoute = (path: string): boolean => {
        if (!user) return false;
        return authCanAccessRoute(user.role, path);
    };

    const value: AuthContextType = {
        user,
        loading,
        setUser,
        login,
        logout,
        hasPermission,
        canAccessRoute,
        isAdmin: user?.role === 'admin' || user?.supabaseRole === 'ADMIN' || user?.supabaseRole === 'SUPER_ADMIN',
        isPM: user?.role === 'pm' || user?.supabaseRole === 'PM',
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
