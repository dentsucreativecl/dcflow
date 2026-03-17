import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: docId } = await params;
    const supabase = createServerClient();

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient();
    const { data: caller } = await admin.from('User').select('role').eq('id', authUser.id).single();
    if (!caller || caller.role !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'Solo el Super Admin puede eliminar documentos' }, { status: 403 });
    }

    const { data: doc } = await admin.from('Document').select('id').eq('id', docId).single();
    if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });

    const { error } = await admin.from('Document').delete().eq('id', docId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
}
