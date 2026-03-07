import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { listContacts } from '@/lib/hubspot/client'
import { normalizePhoneNumber } from '@/lib/utils/phone'

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 이전 동기화 시점 조회
    const { data: syncState } = await supabase
      .from('hubspot_sync_state')
      .select('last_sync_at')
      .eq('user_id', user.id)
      .eq('sync_status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const lastSyncAt = syncState?.last_sync_at ? new Date(syncState.last_sync_at) : null

    // HubSpot 전체 연락처 페이지네이션 순회
    let syncedCount = 0
    let totalProcessed = 0
    let after: string | undefined
    const errors: string[] = []
    const properties = ['firstname', 'lastname', 'email', 'phone', 'company', 'lifecyclestage', 'lastmodifieddate']

    while (true) {
      const response = await listContacts(properties, 100, after)
      const contacts = response.results || []

      for (const contact of contacts) {
        totalProcessed++

        // 변경된 연락처만 처리 (첫 동기화 시에는 전부)
        if (lastSyncAt && contact.properties.lastmodifieddate) {
          const modified = new Date(contact.properties.lastmodifieddate)
          if (modified <= lastSyncAt) continue
        }

        try {
          const record = {
            user_id: user.id,
            hubspot_contact_id: contact.id,
            first_name: contact.properties.firstname || '',
            last_name: contact.properties.lastname || '',
            email: contact.properties.email || '',
            phone: contact.properties.phone ? normalizePhoneNumber(contact.properties.phone) : '',
            company: contact.properties.company || '',
            properties: contact.properties,
          }

          // 기존 연락처 확인
          const { data: existing } = await supabase
            .from('contacts')
            .select('id')
            .eq('user_id', user.id)
            .eq('hubspot_contact_id', contact.id)
            .single()

          if (existing) {
            await supabase
              .from('contacts')
              .update({
                first_name: record.first_name,
                last_name: record.last_name,
                email: record.email,
                phone: record.phone,
                company: record.company,
                properties: record.properties,
              })
              .eq('id', existing.id)
          } else {
            await supabase.from('contacts').insert(record)
          }

          syncedCount++
        } catch (err) {
          errors.push(`Contact ${contact.id}: ${err instanceof Error ? err.message : 'Unknown'}`)
        }
      }

      // 다음 페이지 확인
      if (!response.paging?.next?.after) break
      after = response.paging.next.after
    }

    // 동기화 상태 기록
    await supabase.from('hubspot_sync_state').insert({
      user_id: user.id,
      last_sync_at: new Date().toISOString(),
      sync_status: 'completed',
      synced_count: syncedCount,
      error_message: errors.length > 0 ? errors.slice(0, 10).join('; ') : null,
    })

    return NextResponse.json({
      success: true,
      syncedCount,
      totalProcessed,
      errors: errors.length,
      message: `${syncedCount}명 동기화 완료 (전체 ${totalProcessed}명 중)`,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Sync error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
