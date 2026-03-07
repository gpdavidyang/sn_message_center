import { NextResponse } from 'next/server'
import { getSenderNumbers } from '@/lib/solapi/client'

export async function GET() {
  try {
    const rawData = await getSenderNumbers()

    // SOLAPI response format: { senderIds: [{ phoneNumber, status, handleKey, ... }], ... }
    const senderIds = rawData?.senderIds || []

    const numbers = senderIds
      .filter((s: { status: string }) => s.status === 'ACTIVE')
      .map((s: { phoneNumber: string; handleKey?: string; dateCreated?: string }) => ({
        phoneNumber: s.phoneNumber,
        handleKey: s.handleKey,
        dateCreated: s.dateCreated,
      }))

    return NextResponse.json({ numbers })
  } catch (error: unknown) {
    console.error('Sender numbers error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '발신번호 조회 실패', numbers: [] },
      { status: 500 }
    )
  }
}
