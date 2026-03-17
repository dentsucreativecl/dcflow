import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ channelId: string }> }
) {
    const { channelId } = await params;
    const supabase = createServerClient();

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient();
    const { data: caller } = await admin.from('User').select('role').eq('id', authUser.id).single();
    if (!caller || caller.role !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'Solo el Super Admin puede eliminar canales' }, { status: 403 });
    }

    const { data: channel } = await admin.from('Channel').select('id, name').eq('id', channelId).single();
    if (!channel) return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 });

    // Cascade: Messages → ChannelMembers → Channel
    await admin.from('Message').delete().eq('channelId', channelId);
    await admin.from('ChannelMember').delete().eq('channelId', channelId);

    const { error } = await admin.from('Channel').delete().eq('id', channelId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
}
