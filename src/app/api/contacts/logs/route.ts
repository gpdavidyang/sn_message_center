import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { normalizePhoneNumber } from '@/lib/utils/phone'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rawPhone = request.nextUrl.searchParams.get('phone')
    if (!rawPhone) return NextResponse.json({ logs: [] })

    const phone = normalizePhoneNumber(rawPhone)

    const { data: logs, error } = await supabase
      .from('message_logs')
      .select(`
        id,
        type,
        content,
        status,
        status_code,
        error_message,
        sent_at,
        delivered_at,
        created_at,
        message_campaigns (
          id,
          name,
          type
        )
      `)
      .eq('recipient_phone', phone)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error

    return NextResponse.json({ logs: logs || [] })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error', logs: [] },
      { status: 500 }
    )
  }
}
