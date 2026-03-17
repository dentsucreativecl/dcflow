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

    // SUPER_ADMIN can delete any space; ADMIN can only delete archived spaces
    const { data: space } = await admin.from('Space').select('id, name, isArchived').eq('id', spaceId).single();
    if (!space) return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    if (!space.isArchived && caller.role !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'Solo se pueden eliminar clientes archivados' }, { status: 400 });
    }

    // Cascade: Tasks children → Tasks → Lists → Folders → SpaceMembers → Space
    const { data: allLists } = await admin.from('List').select('id').eq('spaceId', spaceId);
    const listIds = (allLists || []).map(l => l.id);

    if (listIds.length > 0) {
        const { data: tasks } = await admin.from('Task').select('id').in('listId', listIds);
        const taskIds = (tasks || []).map(t => t.id);

        if (taskIds.length > 0) {
            await admin.from('TaskAssignment').delete().in('taskId', taskIds);
            await admin.from('TimeEntry').delete().in('taskId', taskIds);
            await admin.from('Comment').delete().in('taskId', taskIds);
            await admin.from('CustomFieldValue').delete().in('taskId', taskIds);
            await admin.from('Notification').delete().in('taskId', taskIds);
            await admin.from('Activity').delete().in('taskId', taskIds);
            await admin.from('Checklist').delete().in('taskId', taskIds);
            const { data: attachments } = await admin.from('Attachment').select('id').in('taskId', taskIds);
            if (attachments && attachments.length > 0) {
                await admin.from('Annotation').delete().in('attachmentId', attachments.map(a => a.id));
                await admin.from('Attachment').delete().in('taskId', taskIds);
            }
            await admin.from('TaskRelation').delete().in('sourceTaskId', taskIds);
            await admin.from('TaskRelation').delete().in('targetTaskId', taskIds);
            await admin.from('Task').delete().in('id', taskIds);
        }

        await admin.from('CustomField').delete().in('listId', listIds);
        await admin.from('List').delete().in('id', listIds);
    }

    const { data: folders } = await admin.from('Folder').select('id').eq('spaceId', spaceId);
    const folderIds = (folders || []).map(f => f.id);
    if (folderIds.length > 0) {
        await admin.from('CustomField').delete().in('folderId', folderIds);
        await admin.from('Folder').delete().in('id', folderIds);
    }

    await admin.from('CustomField').delete().eq('spaceId', spaceId);
    await admin.from('SpaceMember').delete().eq('spaceId', spaceId);

    const { error } = await admin.from('Space').delete().eq('id', spaceId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
}
