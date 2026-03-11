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

    // Verify ADMIN or SUPER_ADMIN
    const { data: caller } = await supabase
        .from('User')
        .select('role')
        .eq('id', authUser.id)
        .single();

    if (!caller || !['ADMIN', 'SUPER_ADMIN'].includes(caller.role)) {
        return NextResponse.json({ error: 'Forbidden — only ADMIN or SUPER_ADMIN' }, { status: 403 });
    }

    const { gender } = await request.json();
    if (!['MASCULINE', 'FEMININE', 'NEUTRAL'].includes(gender)) {
        return NextResponse.json({ error: 'Invalid gender value' }, { status: 400 });
    }

    const { error } = await supabase
        .from('User')
        .update({ gender })
        .eq('id', userId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
