import { NextResponse } from 'next/server'
import { getKakaoTemplates } from '@/lib/solapi/client'

export async function GET() {
  try {
    const pfId = process.env.KAKAO_PFID
    if (!pfId) {
      return NextResponse.json(
        { error: 'KAKAO_PFID가 설정되지 않았습니다.', templates: [] },
        { status: 400 }
      )
    }

    const data = await getKakaoTemplates()
    console.log('SOLAPI kakao templates raw response:', JSON.stringify(data).slice(0, 500))

    // SOLAPI returns { templateList: [...] } or similar structure
    const templates = data?.templateList || data?.templates || (Array.isArray(data) ? data : [])

    return NextResponse.json({ templates, pfId })
  } catch (error: unknown) {
    console.error('Kakao templates error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '템플릿 조회 실패', templates: [] },
      { status: 500 }
    )
  }
}
