import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { sendMessage, sendManyMessages } from '@/lib/solapi/client'
import { normalizePhoneNumber } from '@/lib/utils/phone'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const pfId = process.env.KAKAO_PFID
    if (!pfId) {
      return NextResponse.json({ error: 'KAKAO_PFID가 설정되지 않았습니다.' }, { status: 400 })
    }

    const { content, senderNumber, recipients, buttons, scheduledAt } = await request.json()

    if (!content?.trim() || !senderNumber || !recipients?.length) {
      return NextResponse.json({ error: '필수 항목을 모두 입력해주세요.' }, { status: 400 })
    }

    const isScheduled = !!scheduledAt
    const { data: campaign, error: campaignError } = await supabase
      .from('message_campaigns')
      .insert({
        user_id: user.id,
        name: `카카오 친구톡 ${new Date().toLocaleDateString('ko-KR')}`,
        type: 'KAKAO_FRT',
        content: content.trim(),
        sender_number: senderNumber,
        status: isScheduled ? 'scheduled' : 'sending',
        scheduled_at: scheduledAt || null,
        total_count: recipients.length,
      })
      .select()
      .single()

    if (campaignError) throw campaignError

    if (isScheduled) {
      const logs = recipients.map((r: { phone: string }) => ({
        campaign_id: campaign.id,
        recipient_phone: normalizePhoneNumber(r.phone),
        type: 'FRT',
        content: content.trim(),
        status: 'pending',
      }))
      await supabase.from('message_logs').insert(logs)
      return NextResponse.json({ success: true, campaignId: campaign.id, scheduled: true, scheduledAt })
    }

    const kakaoButtons = buttons?.filter((b: { name: string; linkMo: string }) => b.name && b.linkMo) || []
    const messages = recipients.map((r: { phone: string }) => ({
      to: normalizePhoneNumber(r.phone),
      from: normalizePhoneNumber(senderNumber),
      text: content.trim(),
      type: 'FRT' as const,
      kakaoOptions: {
        pfId,
        ...(kakaoButtons.length > 0 ? { buttons: kakaoButtons } : {}),
      },
    }))

    let result
    if (messages.length === 1) {
      result = await sendMessage(messages[0])
    } else {
      result = await sendManyMessages(messages)
    }

    const logs = recipients.map((r: { phone: string }) => ({
      campaign_id: campaign.id,
      recipient_phone: normalizePhoneNumber(r.phone),
      type: 'FRT',
      content: content.trim(),
      status: 'sent',
      sent_at: new Date().toISOString(),
    }))
    await supabase.from('message_logs').insert(logs)

    await supabase
      .from('message_campaigns')
      .update({
        status: 'completed',
        sent_at: new Date().toISOString(),
        success_count: recipients.length,
        solapi_group_id: 'groupId' in result ? result.groupId : undefined,
      })
      .eq('id', campaign.id)

    return NextResponse.json({ success: true, campaignId: campaign.id, result })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
