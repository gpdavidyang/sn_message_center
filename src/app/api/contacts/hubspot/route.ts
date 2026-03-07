import { NextRequest, NextResponse } from 'next/server'
import { listContacts, searchContacts, type HubSpotFilter } from '@/lib/hubspot/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const after = searchParams.get('after') || undefined
    const limit = parseInt(searchParams.get('limit') || '100')
    const query = searchParams.get('query') || ''

    let result

    if (query) {
      // Simple search by name/email
      const filters: HubSpotFilter[] = [
        {
          propertyName: 'email',
          operator: 'CONTAINS_TOKEN',
          value: `*${query}*`,
        },
      ]
      result = await searchContacts(filters, undefined, limit, after)
    } else {
      result = await listContacts(undefined, limit, after)
    }

    return NextResponse.json(result)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Advanced search with filters
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { filters, properties, limit, after } = body

    const result = await searchContacts(
      filters || [],
      properties,
      limit || 100,
      after
    )

    return NextResponse.json(result)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
