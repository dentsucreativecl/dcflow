import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const { userId } = await params;
    const supabase = createServerClient();

    // Authenticate via cookie session
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use admin client to bypass RLS for reading/writing roles
    const admin = createAdminClient();

    const { data: caller } = await admin
        .from('User')
        .select('role')
        .eq('id', authUser.id)
        .single();

    if (!caller || !['ADMIN', 'SUPER_ADMIN'].includes(caller.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { role } = await request.json();

    console.log('ROLE CHANGE REQUEST', { requestingUserRole: caller.role, targetRole: role, targetUserId: userId });

    if (!['MEMBER', 'PM', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Only SUPER_ADMIN can assign SUPER_ADMIN role
    if (role === 'SUPER_ADMIN' && caller.role !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'Only SUPER_ADMIN can assign SUPER_ADMIN role' }, { status: 403 });
    }

    // Prevent changing own role
    if (userId === authUser.id) {
        return NextResponse.json({ error: 'Cannot change own role' }, { status: 400 });
    }

    const { error } = await admin
        .from('User')
        .update({ role })
        .eq('id', userId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
