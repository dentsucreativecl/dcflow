import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ channelId: string }> }
) {
    const { channelId } = await params;
    const supabase = createServerClient();

    // Authenticate
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify SUPER_ADMIN or ADMIN
    const { data: caller } = await supabase
        .from('User')
        .select('role')
        .eq('id', authUser.id)
        .single();

    if (caller?.role !== 'SUPER_ADMIN' && caller?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { isArchived } = await request.json();
    if (typeof isArchived !== 'boolean') {
        return NextResponse.json({ error: 'isArchived must be boolean' }, { status: 400 });
    }

    const { error } = await supabase
        .from('Channel')
        .update({ isArchived })
        .eq('id', channelId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
