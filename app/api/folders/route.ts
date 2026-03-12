import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
    const supabase = createServerClient();

    // Authenticate
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, spaceId, color } = await request.json();

    if (!name?.trim()) {
        return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    }
    if (!spaceId) {
        return NextResponse.json({ error: 'spaceId es requerido' }, { status: 400 });
    }

    // Check permissions: ADMIN/SUPER_ADMIN always allowed; others need SpaceMember
    const admin = createAdminClient();

    const { data: caller } = await admin
        .from('User')
        .select('role')
        .eq('id', authUser.id)
        .single();

    const isAdmin = caller?.role === 'ADMIN' || caller?.role === 'SUPER_ADMIN';

    if (!isAdmin) {
        const { data: membership } = await admin
            .from('SpaceMember')
            .select('userId')
            .eq('userId', authUser.id)
            .eq('spaceId', spaceId)
            .maybeSingle();

        if (!membership) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
    }

    const folderData = {
        id: crypto.randomUUID(),
        name: name.trim(),
        spaceId,
        color: color || null,
        useCustomStatus: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    console.log("FOLDER INSERT DATA:", JSON.stringify(folderData, null, 2));

    const { data: folder, error } = await admin
        .from('Folder')
        .insert(folderData)
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ folder }, { status: 201 });
}
