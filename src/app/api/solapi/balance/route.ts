import { NextResponse } from 'next/server'
import { getBalance } from '@/lib/solapi/client'

export async function GET() {
  try {
    const balance = await getBalance()
    return NextResponse.json(balance)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
