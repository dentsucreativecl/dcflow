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

    // Prevent deactivating self
    if (userId === authUser.id) {
        return NextResponse.json({ error: 'Cannot deactivate own account' }, { status: 400 });
    }

    const { isActive } = await request.json();
    if (typeof isActive !== 'boolean') {
        return NextResponse.json({ error: 'isActive must be boolean' }, { status: 400 });
    }

    const { error } = await supabase
        .from('User')
        .update({ isActive })
        .eq('id', userId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
