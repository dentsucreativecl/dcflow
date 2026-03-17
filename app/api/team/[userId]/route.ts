import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { AREAS } from '@/lib/areas';

// Service role client — bypasses RLS for admin operations
function createServiceClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: { userId: string } }
) {
    const { userId } = params;

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

    const callerRole = callerProfile?.role;
    const isAdmin = callerRole === 'SUPER_ADMIN' || callerRole === 'ADMIN';

    if (!isAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const adminClient = createServiceClient();

    // Handle role change — SUPER_ADMIN only
    if ('role' in body) {
        if (callerRole !== 'SUPER_ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const { role } = body as { role: string };
        const validRoles = ['ADMIN', 'PM', 'MEMBER'];
        if (!role || !validRoles.includes(role)) {
            return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
        }
        const { error } = await adminClient.from('User').update({ role }).eq('id', userId);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, role });
    }

    // Handle userAreas change — ADMIN or SUPER_ADMIN
    if ('userAreas' in body) {
        const { userAreas } = body as { userAreas: string[] };
        if (!Array.isArray(userAreas) || userAreas.some((a) => !AREAS.includes(a as typeof AREAS[number]))) {
            return NextResponse.json({ error: 'Invalid userAreas' }, { status: 400 });
        }
        const { error } = await adminClient.from('User').update({ userAreas }).eq('id', userId);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, userAreas });
    }

    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
}

// Soft-delete: deactivate user and optionally reassign their tasks
export async function DELETE(
    request: NextRequest,
    { params }: { params: { userId: string } }
) {
    const { userId } = params;

    const supabase = createServerClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const adminClient = createServiceClient();
    const { data: callerProfile } = await adminClient.from('User').select('role').eq('id', authUser.id).single();
    if (!callerProfile || callerProfile.role !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'Solo el Super Admin puede desactivar miembros' }, { status: 403 });
    }

    // Cannot deactivate yourself
    if (userId === authUser.id) {
        return NextResponse.json({ error: 'No puedes desactivarte a ti mismo' }, { status: 400 });
    }

    // Verify user exists
    const { data: targetUser } = await adminClient.from('User').select('id, name, isActive').eq('id', userId).single();
    if (!targetUser) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

    // Parse optional reassignTo from request body
    let reassignTo: string | null = null;
    try {
        const body = await request.json();
        reassignTo = body.reassignTo || null;
    } catch { /* no body is OK */ }

    // Reassign active tasks if a target user is provided
    if (reassignTo) {
        const { data: assignments } = await adminClient
            .from('TaskAssignment')
            .select('id, taskId')
            .eq('userId', userId);

        if (assignments && assignments.length > 0) {
            for (const a of assignments) {
                // Check if target already assigned to this task
                const { data: existing } = await adminClient
                    .from('TaskAssignment')
                    .select('id')
                    .eq('taskId', a.taskId)
                    .eq('userId', reassignTo)
                    .maybeSingle();

                if (!existing) {
                    await adminClient.from('TaskAssignment').insert({
                        taskId: a.taskId,
                        userId: reassignTo,
                    });
                }
            }
            // Remove original assignments
            await adminClient.from('TaskAssignment').delete().eq('userId', userId);
        }
    }

    // Soft-delete: set isActive = false
    const { error } = await adminClient.from('User').update({ isActive: false }).eq('id', userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, reassigned: !!reassignTo });
}
