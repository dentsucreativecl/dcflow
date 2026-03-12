import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
    const supabase = createServerClient();

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, spaceId, folderId, description, startDate, endDate } = await request.json();

    if (!name?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    if (!spaceId) return NextResponse.json({ error: 'spaceId es requerido' }, { status: 400 });

    // Verify access: ADMIN/SUPER_ADMIN or SpaceMember
    const admin = createAdminClient();
    const { data: caller } = await admin.from('User').select('role').eq('id', authUser.id).single();
    const isAdmin = caller?.role === 'ADMIN' || caller?.role === 'SUPER_ADMIN';

    if (!isAdmin) {
        const { data: membership } = await admin
            .from('SpaceMember').select('userId')
            .eq('userId', authUser.id).eq('spaceId', spaceId).maybeSingle();
        if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const { error } = await admin.from('List').insert({
        id,
        name: name.trim(),
        spaceId,
        folderId: folderId || null,
        description: description || null,
        startDate: startDate || null,
        endDate: endDate || null,
        isPitch: false,
        createdAt: now,
        updatedAt: now,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ id }, { status: 201 });
}
