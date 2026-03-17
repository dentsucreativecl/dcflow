import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ taskId: string }> }
) {
    const { taskId } = await params;
    const supabase = createServerClient();

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient();
    const { data: caller } = await admin.from('User').select('role').eq('id', authUser.id).single();
    if (!caller || caller.role !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'Solo el Super Admin puede eliminar tareas' }, { status: 403 });
    }

    // Support bulk delete: ?ids=id1,id2,id3
    const url = new URL(request.url);
    const idsParam = url.searchParams.get('ids');
    const taskIds = idsParam ? idsParam.split(',') : [taskId];

    // Verify tasks exist
    const { data: tasks } = await admin.from('Task').select('id').in('id', taskIds);
    if (!tasks || tasks.length === 0) {
        return NextResponse.json({ error: 'Tareas no encontradas' }, { status: 404 });
    }
    const foundIds = tasks.map(t => t.id);

    // Cascade delete children
    await admin.from('TaskAssignment').delete().in('taskId', foundIds);
    await admin.from('TimeEntry').delete().in('taskId', foundIds);
    await admin.from('Comment').delete().in('taskId', foundIds);
    await admin.from('CustomFieldValue').delete().in('taskId', foundIds);
    await admin.from('Notification').delete().in('taskId', foundIds);
    await admin.from('Activity').delete().in('taskId', foundIds);
    await admin.from('Checklist').delete().in('taskId', foundIds);

    const { data: attachments } = await admin.from('Attachment').select('id').in('taskId', foundIds);
    if (attachments && attachments.length > 0) {
        await admin.from('Annotation').delete().in('attachmentId', attachments.map(a => a.id));
        await admin.from('Attachment').delete().in('taskId', foundIds);
    }

    await admin.from('TaskRelation').delete().in('sourceTaskId', foundIds);
    await admin.from('TaskRelation').delete().in('targetTaskId', foundIds);

    // Delete subtasks first (they reference parent)
    await admin.from('Task').delete().in('parentId', foundIds);

    // Delete the tasks
    const { error } = await admin.from('Task').delete().in('id', foundIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, deleted: foundIds.length });
}
