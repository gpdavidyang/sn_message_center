import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { sendMessage, sendManyMessages, type SendMessageParams } from '@/lib/solapi/client'
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

    const {
      templateId,
      content,
      senderNumber,
      recipients,
      variables,
      scheduledAt,
    } = await request.json()

    if (!templateId || !senderNumber || !recipients?.length) {
      return NextResponse.json({ error: '필수 항목을 모두 입력해주세요.' }, { status: 400 })
    }

    // 1. Create campaign record
    const isScheduled = !!scheduledAt
    const { data: campaign, error: campaignError } = await supabase
      .from('message_campaigns')
      .insert({
        user_id: user.id,
        name: `카카오 알림톡 ${new Date().toLocaleDateString('ko-KR')}`,
        type: 'KAKAO',
        content: content || `[알림톡] 템플릿ID: ${templateId}`,
        sender_number: senderNumber,
        status: isScheduled ? 'scheduled' : 'sending',
        scheduled_at: scheduledAt || null,
        total_count: recipients.length,
      })
      .select()
      .single()

    if (campaignError) throw campaignError

    // If scheduled, just save
    if (isScheduled) {
      const logs = recipients.map((r: { phone: string }) => ({
        campaign_id: campaign.id,
        recipient_phone: normalizePhoneNumber(r.phone),
        type: 'KAKAO',
        content: content || templateId,
        status: 'pending',
      }))
      await supabase.from('message_logs').insert(logs)

      return NextResponse.json({
        success: true,
        campaignId: campaign.id,
        scheduled: true,
        scheduledAt,
      })
    }

    // 2. Send via SOLAPI with kakaoOptions
    const messages: SendMessageParams[] = recipients.map(
      (r: { phone: string }) => ({
        to: normalizePhoneNumber(r.phone),
        from: normalizePhoneNumber(senderNumber),
        text: content || '',
        kakaoOptions: {
          pfId,
          templateId,
          variables: variables || {},
        },
      })
    )

    let result
    if (messages.length === 1) {
      result = await sendMessage(messages[0])
    } else {
      result = await sendManyMessages(messages)
    }

    // 3. Create message logs
    const logs = recipients.map((r: { phone: string }) => ({
      campaign_id: campaign.id,
      recipient_phone: normalizePhoneNumber(r.phone),
      type: 'KAKAO',
      content: content || templateId,
      status: 'sent',
      sent_at: new Date().toISOString(),
    }))
    await supabase.from('message_logs').insert(logs)

    // 4. Update campaign status
    await supabase
      .from('message_campaigns')
      .update({
        status: 'completed',
        sent_at: new Date().toISOString(),
        success_count: recipients.length,
        solapi_group_id: 'groupId' in result ? result.groupId : undefined,
      })
      .eq('id', campaign.id)

    return NextResponse.json({
      success: true,
      campaignId: campaign.id,
      result,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
