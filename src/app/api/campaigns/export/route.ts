import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const campaignId = request.nextUrl.searchParams.get('campaignId')
    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId required' }, { status: 400 })
    }

    // Verify ownership
    const { data: campaign } = await supabase
      .from('message_campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single()

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Get logs
    const { data: logs } = await supabase
      .from('message_logs')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true })

    // Build CSV
    const headers = ['수신번호', '유형', '상태', '발송시각', '에러메시지']
    const rows = (logs || []).map(log => [
      log.recipient_phone,
      log.type,
      log.status,
      log.sent_at ? new Date(log.sent_at).toLocaleString('ko-KR') : '',
      log.error_message || '',
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')

    // Add BOM for Excel Korean compatibility
    const bom = '\uFEFF'

    return new NextResponse(bom + csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="campaign_${campaignId}.csv"`,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
