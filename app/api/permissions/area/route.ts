import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { resolveAreaPermission } from '@/lib/permissions/area-permissions';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const spaceId = searchParams.get('spaceId');

    if (!spaceId) {
        return NextResponse.json({ error: 'spaceId is required' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Get current user
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
        .from('User')
        .select('role, userAreas')
        .eq('id', authUser.id)
        .single() as { data: { role: string; userAreas: string[] | null } | null };

    const { data: space } = await supabase
        .from('Space')
        .select('areas')
        .eq('id', spaceId)
        .single() as { data: { areas: string[] | null } | null };

    const spaceAreas = space?.areas ?? [];
    const effectiveRole = profile?.role?.toUpperCase() ?? null;

    const canEdit =
        resolveAreaPermission(effectiveRole, profile?.userAreas, spaceAreas) === 'EDIT';

    return NextResponse.json({
        canEdit,
        areas: spaceAreas,
        userAreas: profile?.userAreas ?? [],
    });
}
