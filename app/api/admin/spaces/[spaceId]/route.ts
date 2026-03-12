import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ spaceId: string }> }
) {
    const { spaceId } = await params;
    const supabase = createServerClient();

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient();
    const { data: caller } = await admin.from('User').select('role').eq('id', authUser.id).single();

    if (!caller || !['ADMIN', 'SUPER_ADMIN'].includes(caller.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only allow deleting archived spaces
    const { data: space } = await admin.from('Space').select('id, isArchived').eq('id', spaceId).single();
    if (!space) return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    if (!space.isArchived) return NextResponse.json({ error: 'Solo se pueden eliminar clientes archivados' }, { status: 400 });

    // Cascade: delete Tasks inside Lists inside Folders and direct Lists, then Folders, then Space
    const { data: folders } = await admin.from('Folder').select('id').eq('spaceId', spaceId);
    const folderIds = (folders || []).map(f => f.id);

    const { data: allLists } = await admin.from('List').select('id').eq('spaceId', spaceId);
    const listIds = (allLists || []).map(l => l.id);

    if (listIds.length > 0) {
        await admin.from('Task').delete().in('listId', listIds);
    }
    if (listIds.length > 0) {
        await admin.from('List').delete().in('id', listIds);
    }
    if (folderIds.length > 0) {
        await admin.from('Folder').delete().in('id', folderIds);
    }

    const { error } = await admin.from('Space').delete().eq('id', spaceId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
}
