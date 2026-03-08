import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { normalizePhoneNumber } from '@/lib/utils/phone'

// GET /api/kakao/channel-friends?phones=01012345678,01087654321
// 여러 전화번호의 카카오 채널 친구 상태를 반환합니다.
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const phonesParam = request.nextUrl.searchParams.get('phones') || ''
    if (!phonesParam) return NextResponse.json({ statuses: {} })

    const phones = phonesParam.split(',').map(p => normalizePhoneNumber(p.trim())).filter(Boolean)
    if (phones.length === 0) return NextResponse.json({ statuses: {} })

    const { data } = await supabase
      .from('kakao_channel_friends')
      .select('phone, is_friend, last_checked_at')
      .in('phone', phones)

    const statuses: Record<string, boolean | null> = {}
    for (const row of data || []) {
      statuses[row.phone] = row.is_friend
    }

    return NextResponse.json({ statuses })
  } catch (error: unknown) {
    return NextResponse.json({ statuses: {}, error: error instanceof Error ? error.message : 'Unknown error' })
  }
}

// POST /api/kakao/channel-friends
// body: { updates: [{ phone: string, is_friend: boolean }] }
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { updates } = await request.json()
    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: '업데이트 데이터가 없습니다.' }, { status: 400 })
    }

    const rows = updates.map((u: { phone: string; is_friend: boolean }) => ({
      phone: normalizePhoneNumber(u.phone),
      is_friend: u.is_friend,
      last_checked_at: new Date().toISOString(),
    })).filter(r => r.phone.length >= 10)

    await supabase
      .from('kakao_channel_friends')
      .upsert(rows, { onConflict: 'phone' })

    return NextResponse.json({ success: true, updated: rows.length })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
