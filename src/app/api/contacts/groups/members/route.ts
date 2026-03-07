import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// GET: 그룹 멤버 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const groupId = request.nextUrl.searchParams.get('groupId')
    if (!groupId) return NextResponse.json({ error: 'groupId required' }, { status: 400 })

    // Verify group ownership
    const { data: group } = await supabase
      .from('contact_groups')
      .select('id')
      .eq('id', groupId)
      .eq('user_id', user.id)
      .single()

    if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })

    const { data: members } = await supabase
      .from('contact_group_members')
      .select('contact_id, contacts(id, first_name, last_name, phone, email, company)')
      .eq('group_id', groupId)

    return NextResponse.json({ members: members || [] })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE: 그룹에서 멤버 제거
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { groupId, contactIds } = await request.json()

    // Verify group ownership
    const { data: group } = await supabase
      .from('contact_groups')
      .select('id')
      .eq('id', groupId)
      .eq('user_id', user.id)
      .single()

    if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })

    const { error } = await supabase
      .from('contact_group_members')
      .delete()
      .eq('group_id', groupId)
      .in('contact_id', contactIds)

    if (error) throw error

    // Update count
    const { count } = await supabase
      .from('contact_group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId)

    await supabase
      .from('contact_groups')
      .update({ contact_count: count || 0 })
      .eq('id', groupId)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
