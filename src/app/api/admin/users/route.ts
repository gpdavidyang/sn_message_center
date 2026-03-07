import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET: 회원 목록 조회 (admin only)
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check if admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: '관리자만 접근 가능합니다.' }, { status: 403 })
    }

    // Get all profiles with auth info
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    // Get auth users for email info
    const { data: { users: authUsers } } = await getSupabaseAdmin().auth.admin.listUsers()

    const enrichedProfiles = (profiles || []).map(p => {
      const authUser = authUsers?.find(u => u.id === p.id)
      return {
        ...p,
        email: authUser?.email || '',
        last_sign_in: authUser?.last_sign_in_at || null,
        email_confirmed: authUser?.email_confirmed_at ? true : false,
      }
    })

    return NextResponse.json({ users: enrichedProfiles })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST: 사용자 초대 (이메일로 초대 링크 발송)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: '관리자만 접근 가능합니다.' }, { status: 403 })
    }

    const { email, fullName, role } = await request.json()

    if (!email) {
      return NextResponse.json({ error: '이메일은 필수입니다.' }, { status: 400 })
    }

    // Create user via admin API with invite
    const { data, error } = await getSupabaseAdmin().auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName || email, role: role || 'member' },
    })

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: `${email}로 초대 링크가 발송되었습니다.`,
      userId: data.user.id,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PUT: 사용자 역할 변경
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: '관리자만 접근 가능합니다.' }, { status: 403 })
    }

    const { userId, role } = await request.json()

    // Prevent self-demotion
    if (userId === user.id) {
      return NextResponse.json({ error: '자신의 역할은 변경할 수 없습니다.' }, { status: 400 })
    }

    const { error } = await getSupabaseAdmin()
      .from('profiles')
      .update({ role })
      .eq('id', userId)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
