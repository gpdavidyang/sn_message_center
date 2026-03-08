import { NextRequest, NextResponse } from 'next/server'
import { searchContactsMultiField } from '@/lib/hubspot/client'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') || '').trim()

  if (q.length < 2) {
    return NextResponse.json({ contacts: [] })
  }

  try {
    const result = await searchContactsMultiField(q, 10)
    const contacts = (result.results || [])
      .map((c) => ({
        id: c.id,
        name: [c.properties.firstname, c.properties.lastname].filter(Boolean).join(' '),
        phone: c.properties.phone || '',
        email: c.properties.email || '',
        company: c.properties.company || '',
      }))
      .filter((c) => c.phone)

    return NextResponse.json({ contacts })
  } catch (error: unknown) {
    return NextResponse.json(
      { contacts: [], error: error instanceof Error ? error.message : '검색 실패' },
      { status: 500 }
    )
  }
}
