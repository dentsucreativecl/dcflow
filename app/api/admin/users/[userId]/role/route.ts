import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const { userId } = await params;
    const supabase = createServerClient();

    // Authenticate
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify SUPER_ADMIN
    const { data: caller } = await supabase
        .from('User')
        .select('role')
        .eq('id', authUser.id)
        .single();

    if (caller?.role !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'Forbidden — only SUPER_ADMIN' }, { status: 403 });
    }

    const { role } = await request.json();
    if (!['MEMBER', 'ADMIN'].includes(role)) {
        return NextResponse.json({ error: 'Role must be MEMBER or ADMIN' }, { status: 400 });
    }

    // Prevent changing own role
    if (userId === authUser.id) {
        return NextResponse.json({ error: 'Cannot change own role' }, { status: 400 });
    }

    const { error } = await supabase
        .from('User')
        .update({ role })
        .eq('id', userId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
