import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { normalizePhoneNumber } from '@/lib/utils/phone'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { contacts, groupId } = await request.json()

    // Map HubSpot contacts to our schema
    const contactRecords = contacts.map((c: {
      id: string
      properties: {
        firstname?: string
        lastname?: string
        email?: string
        phone?: string
        company?: string
        [key: string]: string | undefined
      }
    }) => ({
      user_id: user.id,
      hubspot_contact_id: c.id,
      first_name: c.properties.firstname || '',
      last_name: c.properties.lastname || '',
      email: c.properties.email || '',
      phone: c.properties.phone ? normalizePhoneNumber(c.properties.phone) : '',
      company: c.properties.company || '',
      properties: c.properties,
    }))

    // Insert contacts one by one to handle duplicates gracefully
    let importedCount = 0
    const importedIds: string[] = []

    for (const record of contactRecords) {
      // Check if contact already exists
      const { data: existing } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', user.id)
        .eq('hubspot_contact_id', record.hubspot_contact_id)
        .single()

      if (existing) {
        // Update existing contact
        const { data: updated } = await supabase
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
          .select('id')
          .single()

        if (updated) importedIds.push(updated.id)
      } else {
        // Insert new contact
        const { data: inserted } = await supabase
          .from('contacts')
          .insert(record)
          .select('id')
          .single()

        if (inserted) importedIds.push(inserted.id)
      }
      importedCount++
    }

    // Add to group if specified
    if (groupId && importedIds.length > 0) {
      const groupMembers = importedIds.map((contactId) => ({
        group_id: groupId,
        contact_id: contactId,
      }))

      await supabase
        .from('contact_group_members')
        .upsert(groupMembers, { onConflict: 'group_id,contact_id' })

      const { count } = await supabase
        .from('contact_group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId)

      await supabase
        .from('contact_groups')
        .update({ contact_count: count || 0 })
        .eq('id', groupId)
    }

    return NextResponse.json({
      success: true,
      imported: importedCount,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Import error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
