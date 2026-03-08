import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { sendMessage, sendManyMessages } from '@/lib/solapi/client'
import { normalizePhoneNumber } from '@/lib/utils/phone'

async function updateFriendStatuses(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, phones: string[], isFriend: boolean) {
  const rows = phones.map(phone => ({
    phone,
    is_friend: isFriend,
    last_checked_at: new Date().toISOString(),
  }))
  await supabase.from('kakao_channel_friends').upsert(rows, { onConflict: 'phone' })
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const pfId = process.env.KAKAO_PFID
    if (!pfId) {
      return NextResponse.json({ error: 'KAKAO_PFID가 설정되지 않았습니다.' }, { status: 400 })
    }

    const { content, senderNumber, recipients, buttons, scheduledAt, disableSms } = await request.json()

    if (!content?.trim() || !senderNumber || !recipients?.length) {
      return NextResponse.json({ error: '필수 항목을 모두 입력해주세요.' }, { status: 400 })
    }

    const normalizedPhones = recipients.map((r: { phone: string }) => normalizePhoneNumber(r.phone))
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
      const logs = normalizedPhones.map((phone: string) => ({
        campaign_id: campaign.id,
        recipient_phone: phone,
        type: 'CTA',
        content: content.trim(),
        status: 'pending',
      }))
      await supabase.from('message_logs').insert(logs)
      return NextResponse.json({ success: true, campaignId: campaign.id, scheduled: true, scheduledAt })
    }

    const kakaoButtons = buttons?.filter((b: { name: string; linkMo: string }) => b.name && b.linkMo) || []
    const messages = normalizedPhones.map((phone: string) => ({
      to: phone,
      from: normalizePhoneNumber(senderNumber),
      text: content.trim(),
      type: 'CTA' as const,
      kakaoOptions: {
        pfId,
        ...(disableSms ? { disableSms: true } : {}),
        ...(kakaoButtons.length > 0 ? { buttons: kakaoButtons } : {}),
      },
    }))

    let result
    try {
      if (messages.length === 1) {
        result = await sendMessage(messages[0])
      } else {
        result = await sendManyMessages(messages)
      }

      // 발송 성공 → 친구 상태 업데이트 (disableSms 모드일 때만 신뢰할 수 있음)
      if (disableSms) {
        await updateFriendStatuses(supabase, normalizedPhones, true)
      }
    } catch (sendError: unknown) {
      const errMsg = sendError instanceof Error ? sendError.message : 'Send failed'

      // disableSms 모드에서 발송 실패 → 카카오 채널 친구가 아님
      if (disableSms) {
        await updateFriendStatuses(supabase, normalizedPhones, false)
      }

      // 캠페인 실패 처리
      const failLogs = normalizedPhones.map((phone: string) => ({
        campaign_id: campaign.id,
        recipient_phone: phone,
        type: 'CTA',
        content: content.trim(),
        status: 'failed',
        error_message: errMsg,
        sent_at: new Date().toISOString(),
      }))
      await supabase.from('message_logs').insert(failLogs)
      await supabase.from('message_campaigns').update({ status: 'failed', sent_at: new Date().toISOString() }).eq('id', campaign.id)

      const friendMsg = disableSms ? ' (카카오 채널 친구가 아닌 수신자가 포함되어 있을 수 있습니다.)' : ''
      return NextResponse.json({ error: errMsg + friendMsg, campaignId: campaign.id }, { status: 500 })
    }

    const logs = normalizedPhones.map((phone: string) => ({
      campaign_id: campaign.id,
      recipient_phone: phone,
      type: 'CTA',
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
