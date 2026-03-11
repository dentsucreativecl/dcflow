'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { createClient } from '@/lib/supabase/client';

/**
 * Resolve whether a user can edit a Space based on area-based rules.
 *
 * Rules:
 * - SUPER_ADMIN → always EDIT
 * - ADMIN with no userAreas assigned → EDIT (Global Admin)
 * - userAreas includes 'Cuentas' → EDIT (cross-area access)
 * - Space has no areas assigned → EDIT (open fallback)
 * - user.userAreas overlaps with space.areas → EDIT
 * - otherwise → READ_ONLY
 */
export function resolveAreaPermission(
    userRole: string | null | undefined,
    userAreas: string[] | null | undefined,
    spaceAreas: string[] | null | undefined
): 'EDIT' | 'READ_ONLY' {
    if (userRole === 'SUPER_ADMIN') return 'EDIT';
    // ADMIN always has full edit access regardless of assigned areas
    if (userRole === 'ADMIN') return 'EDIT';
    // Cuentas has cross-area edit access
    if (userAreas?.includes('Cuentas')) return 'EDIT';
    // Space with no areas = open for everyone
    if (!spaceAreas || spaceAreas.length === 0) return 'EDIT';
    // User has no areas assigned = no edit access to area-restricted spaces
    if (!userAreas || userAreas.length === 0) return 'READ_ONLY';
    // Area overlap: user can edit if they share at least one area with the space
    if (spaceAreas.some(a => userAreas.includes(a))) return 'EDIT';
    return 'READ_ONLY';
}

// Simple cache: spaceId → { areas, timestamp }
const spaceAreasCache = new Map<string, { areas: string[]; timestamp: number }>();
const CACHE_TTL = 60_000; // 1 minute

/**
 * Hook that resolves whether the current user can edit a given Space.
 */
export function useSpaceAreaPermission(spaceId: string | null | undefined): {
    canEdit: boolean;
    loading: boolean;
} {
    const { user } = useAuth();
    const [spaceAreas, setSpaceAreas] = useState<string[] | null | undefined>(undefined);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!spaceId) {
            // spaceId not yet available (parent component still loading) — stay in loading state
            // so canEdit stays false until the real spaceId arrives and is verified against DB.
            setSpaceAreas(undefined);
            setLoading(true);
            return;
        }

        const cached = spaceAreasCache.get(spaceId);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            setSpaceAreas(cached.areas);
            setLoading(false);
            return;
        }

        // Reset to avoid stale spaceAreas giving a false canEdit=true during the async fetch
        setSpaceAreas(undefined);
        setLoading(true);

        const supabase = createClient();
        supabase
            .from('Space')
            .select('areas')
            .eq('id', spaceId)
            .single()
            .then(({ data }: { data: { areas: string[] | null } | null }) => {
                const areas = data?.areas ?? [];
                spaceAreasCache.set(spaceId, { areas, timestamp: Date.now() });
                setSpaceAreas(areas);
                setLoading(false);
            });
    }, [spaceId]);

    if (!user || loading || spaceAreas === undefined) {
        return { canEdit: false, loading: true };
    }

    // Combine supabaseRole (SUPER_ADMIN) with app role (admin) into a single effective role
    // so resolveAreaPermission can match both 'SUPER_ADMIN' and 'ADMIN' checks correctly.
    const effectiveRole = user.supabaseRole === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : (user.role?.toUpperCase() ?? null);

    const canEdit =
        resolveAreaPermission(effectiveRole, user.userAreas, spaceAreas) === 'EDIT';

    return { canEdit, loading: false };
}

/**
 * Invalidate cached areas for a space (call after admin updates space.areas)
 */
export function clearSpaceAreaCache(spaceId?: string) {
    if (spaceId) {
        spaceAreasCache.delete(spaceId);
    } else {
        spaceAreasCache.clear();
    }
}
