import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const supabase = createServerClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient();

    // Get folder to verify it exists and get its spaceId
    const { data: folder } = await admin
        .from('Folder')
        .select('id, spaceId')
        .eq('id', params.id)
        .single();

    if (!folder) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });

    // Check permissions
    const { data: caller } = await admin.from('User').select('role').eq('id', authUser.id).single();
    const isAdmin = caller?.role === 'ADMIN' || caller?.role === 'SUPER_ADMIN';

    if (!isAdmin) {
        const { data: membership } = await admin
            .from('SpaceMember')
            .select('userId')
            .eq('userId', authUser.id)
            .eq('spaceId', folder.spaceId)
            .maybeSingle();
        if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error } = await admin.from('Folder').delete().eq('id', params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
}
