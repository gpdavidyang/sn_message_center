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

    const {
      campaignName,
      type,
      content,
      senderNumber,
      recipients,
      groupId,
      scheduledAt,
    } = await request.json()

    // 1. Create campaign record
    const isScheduled = !!scheduledAt
    const { data: campaign, error: campaignError } = await supabase
      .from('message_campaigns')
      .insert({
        user_id: user.id,
        name: campaignName || `캠페인 ${new Date().toLocaleDateString('ko-KR')}`,
        type: type || 'SMS',
        content,
        sender_number: senderNumber,
        contact_group_id: groupId || null,
        status: isScheduled ? 'scheduled' : 'sending',
        scheduled_at: scheduledAt || null,
        total_count: recipients.length,
      })
      .select()
      .single()

    if (campaignError) throw campaignError

    // If scheduled, just save — don't send yet
    if (isScheduled) {
      // Create pending logs
      const logs = recipients.map((r: { phone: string; contactId?: string }) => ({
        campaign_id: campaign.id,
        contact_id: r.contactId || null,
        recipient_phone: normalizePhoneNumber(r.phone),
        type: type || 'SMS',
        content,
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

    // 2. Send messages via SOLAPI immediately
    const messages: SendMessageParams[] = recipients.map(
      (r: { phone: string }) => ({
        to: normalizePhoneNumber(r.phone),
        from: normalizePhoneNumber(senderNumber),
        text: content,
        type: type || 'SMS',
      })
    )

    let result
    if (messages.length === 1) {
      result = await sendMessage(messages[0])
    } else {
      result = await sendManyMessages(messages)
    }

    // 3. Create message logs
    const logs = recipients.map((r: { phone: string; contactId?: string }) => ({
      campaign_id: campaign.id,
      contact_id: r.contactId || null,
      recipient_phone: normalizePhoneNumber(r.phone),
      type: type || 'SMS',
      content,
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
