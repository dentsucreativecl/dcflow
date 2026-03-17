import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: projectId } = await params;
    const supabase = createServerClient();

    // Verify authenticated user
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Only SUPER_ADMIN can delete projects
    const admin = createAdminClient();
    const { data: caller } = await admin.from('User').select('role').eq('id', authUser.id).single();
    if (!caller || caller.role !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'Solo el Super Admin puede eliminar proyectos' }, { status: 403 });
    }

    // Verify project exists
    const { data: project } = await admin.from('List').select('id, name').eq('id', projectId).single();
    if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

    // Cascade delete: Tasks (and their children via DB cascades) → CustomFields → List
    // Documents get listId set to null (onDelete: SetNull in schema)
    const { data: tasks } = await admin.from('Task').select('id').eq('listId', projectId);
    const taskIds = (tasks || []).map(t => t.id);

    if (taskIds.length > 0) {
        // Delete task children that might not cascade automatically via RLS
        await admin.from('TaskAssignment').delete().in('taskId', taskIds);
        await admin.from('TimeEntry').delete().in('taskId', taskIds);
        await admin.from('Comment').delete().in('taskId', taskIds);
        await admin.from('CustomFieldValue').delete().in('taskId', taskIds);
        await admin.from('Notification').delete().in('taskId', taskIds);
        await admin.from('Activity').delete().in('taskId', taskIds);
        await admin.from('Checklist').delete().in('taskId', taskIds);

        // Delete attachments (and their annotations via cascade)
        const { data: attachments } = await admin.from('Attachment').select('id').in('taskId', taskIds);
        if (attachments && attachments.length > 0) {
            await admin.from('Annotation').delete().in('attachmentId', attachments.map(a => a.id));
            await admin.from('Attachment').delete().in('taskId', taskIds);
        }

        // Delete task relations
        await admin.from('TaskRelation').delete().in('sourceTaskId', taskIds);
        await admin.from('TaskRelation').delete().in('targetTaskId', taskIds);

        // Delete tasks themselves
        await admin.from('Task').delete().in('id', taskIds);
    }

    // Delete custom fields scoped to this list
    await admin.from('CustomField').delete().eq('listId', projectId);

    // Delete the project (List)
    const { error } = await admin.from('List').delete().eq('id', projectId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
}
