import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const { userId } = await params;
    const supabase = createServerClient();

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: caller } = await supabase
        .from('User')
        .select('role')
        .eq('id', authUser.id)
        .single();

    if (!caller || !['ADMIN', 'SUPER_ADMIN'].includes(caller.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name, department, userAreas, gender } = await request.json();

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (department !== undefined) updates.department = department;
    if (userAreas !== undefined) updates.userAreas = userAreas;
    if (gender !== undefined) updates.gender = gender;

    const { error } = await supabase
        .from('User')
        .update(updates)
        .eq('id', userId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
