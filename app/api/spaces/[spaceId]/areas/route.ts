import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { AREAS } from '@/lib/areas';

function createServiceClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: { spaceId: string } }
) {
    const { spaceId } = params;

    const supabase = createServerClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: callerProfile } = await supabase
        .from('User')
        .select('role')
        .eq('id', authUser.id)
        .single() as { data: { role: string } | null };

    if (callerProfile?.role !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { areas } = body as { areas: string[] };

    if (!Array.isArray(areas) || areas.some((a) => !AREAS.includes(a as typeof AREAS[number]))) {
        return NextResponse.json({ error: 'Invalid areas' }, { status: 400 });
    }

    const adminClient = createServiceClient();
    const { error } = await adminClient
        .from('Space')
        .update({ areas })
        .eq('id', spaceId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, areas });
}
