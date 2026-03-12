import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const supabase = createServerClient()

  // Get current user
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const includeFolders = request.nextUrl.searchParams.get('include') === 'all'

  // Get user's role from DB
  const { data: dbUser } = await admin
    .from('User')
    .select('id, role')
    .eq('id', authUser.id)
    .single()

  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const isAdminRole = dbUser.role === 'ADMIN' || dbUser.role === 'SUPER_ADMIN'

  let spaceIds: string[]

  if (isAdminRole) {
    // Admins see all spaces
    const { data: allSpaces } = await admin
      .from('Space')
      .select('id')
    spaceIds = (allSpaces || []).map(s => s.id)
  } else {
    // Non-admins: get spaces via SpaceMember
    const { data: memberships } = await admin
      .from('SpaceMember')
      .select('spaceId')
      .eq('userId', dbUser.id)
    spaceIds = (memberships || []).map(m => m.spaceId)
  }

  if (spaceIds.length === 0) {
    if (includeFolders) {
      return NextResponse.json({ spaces: [], folders: [], lists: [] })
    }
    return NextResponse.json([])
  }

  // Fetch spaces
  const { data: spaces } = await admin
    .from('Space')
    .select('id, name, color, icon, isArchived, avatarUrl')
    .in('id', spaceIds)
    .order('name')

  if (!includeFolders) {
    return NextResponse.json(spaces || [])
  }

  // Also fetch folders and lists for these spaces
  const [foldersRes, listsRes] = await Promise.all([
    admin.from('Folder').select('id, name, spaceId').in('spaceId', spaceIds).order('name'),
    admin.from('List').select('id, name, folderId, spaceId, description, isPitch, pitchResult, createdAt').in('spaceId', spaceIds).order('name'),
  ])

  return NextResponse.json({
    spaces: spaces || [],
    folders: foldersRes.data || [],
    lists: listsRes.data || [],
  })
}
