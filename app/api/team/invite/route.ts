import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

function createServiceClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

export async function POST(request: NextRequest) {
    // 1. Authenticate caller
    const supabase = createServerClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Verify caller is ADMIN or SUPER_ADMIN
    const { data: callerProfile } = await supabase
        .from('User')
        .select('role')
        .eq('id', authUser.id)
        .single() as { data: { role: string } | null };

    const callerRole = callerProfile?.role;
    if (callerRole !== 'SUPER_ADMIN' && callerRole !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 3. Parse and validate body
    const body = await request.json();
    const { email, name, role, department, weeklyCapacity } = body as {
        email: string;
        name: string;
        role?: string;
        department?: string;
        weeklyCapacity?: number;
    };

    if (!email || !name) {
        return NextResponse.json({ error: 'email and name are required' }, { status: 400 });
    }

    const adminClient = createServiceClient();

    // 4. Check if user already exists
    const { data: existingUser } = await adminClient
        .from('User')
        .select('id, email')
        .eq('email', email.toLowerCase().trim())
        .maybeSingle();

    if (existingUser) {
        return NextResponse.json(
            { error: 'Ya existe un usuario con este correo' },
            { status: 409 }
        );
    }

    // 5. Create Invitation record
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7-day expiry

    const { error: invError } = await adminClient
        .from('Invitation')
        .insert({
            id: crypto.randomUUID(),
            email: email.toLowerCase().trim(),
            token,
            level: 'EDIT',
            invitedById: authUser.id,
            expiresAt: expiresAt.toISOString(),
            createdAt: new Date().toISOString(),
        });

    if (invError) {
        return NextResponse.json(
            { error: 'Error al crear invitación: ' + invError.message },
            { status: 500 }
        );
    }

    // 6. Invite user via Supabase Auth (sends magic link email)
    const { error: authError } = await adminClient.auth.admin.inviteUserByEmail(
        email.toLowerCase().trim(),
        {
            data: {
                name,
                role: role || 'MEMBER',
                department: department || null,
                weeklyCapacity: weeklyCapacity || 40,
                invitationToken: token,
            },
        }
    );

    if (authError) {
        // Clean up invitation if auth invite fails
        await adminClient.from('Invitation').delete().eq('token', token);
        return NextResponse.json(
            { error: 'Error al enviar invitación: ' + authError.message },
            { status: 500 }
        );
    }

    // 7. Create User record in public.User table so it's ready when they accept
    const { error: userError } = await adminClient
        .from('User')
        .insert({
            id: crypto.randomUUID(),
            email: email.toLowerCase().trim(),
            name,
            role: 'MEMBER',
            userType: 'MEMBER',
            weeklyCapacity: weeklyCapacity || 40,
            department: department || null,
            isActive: false, // Activated when they accept the invitation
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });

    if (userError) {
        console.error('Warning: User record creation failed:', userError.message);
        // Non-fatal — the invitation was sent successfully
    }

    return NextResponse.json({
        success: true,
        message: `Invitación enviada a ${email}`,
    });
}
