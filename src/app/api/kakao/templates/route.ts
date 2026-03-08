import { NextRequest, NextResponse } from 'next/server'
import {
  getKakaoTemplates,
  createKakaoTemplate,
  updateKakaoTemplate,
  deleteKakaoTemplate,
  requestKakaoTemplateApproval,
} from '@/lib/solapi/client'

function getPfId() {
  const pfId = process.env.KAKAO_PFID
  if (!pfId) throw new Error('KAKAO_PFID가 설정되지 않았습니다.')
  return pfId
}

export async function GET() {
  try {
    const pfId = getPfId()
    const data = await getKakaoTemplates()
    const templates = data?.templateList || data?.templates || (Array.isArray(data) ? data : [])
    return NextResponse.json({ templates, pfId })
  } catch (error: unknown) {
    console.error('Kakao templates GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '템플릿 조회 실패', templates: [] },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const pfId = getPfId()
    const body = await request.json()
    const { action, templateId, ...rest } = body

    // action=request: 검수 요청
    if (action === 'request') {
      if (!templateId) return NextResponse.json({ error: 'templateId 필요' }, { status: 400 })
      const result = await requestKakaoTemplateApproval(templateId)
      return NextResponse.json({ ok: true, result })
    }

    // Default: create new template
    const { name, content, categoryCode, buttons } = rest
    if (!name || !content || !categoryCode) {
      return NextResponse.json({ error: '이름, 내용, 카테고리는 필수입니다.' }, { status: 400 })
    }
    const result = await createKakaoTemplate({ pfId, name, content, categoryCode, buttons: buttons || [] })
    return NextResponse.json({ ok: true, template: result })
  } catch (error: unknown) {
    console.error('Kakao templates POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '처리 실패' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { templateId, name, content, categoryCode, buttons } = body
    if (!templateId) return NextResponse.json({ error: 'templateId 필요' }, { status: 400 })
    if (!name || !content || !categoryCode) {
      return NextResponse.json({ error: '이름, 내용, 카테고리는 필수입니다.' }, { status: 400 })
    }
    const result = await updateKakaoTemplate(templateId, { name, content, categoryCode, buttons: buttons || [] })
    return NextResponse.json({ ok: true, template: result })
  } catch (error: unknown) {
    console.error('Kakao templates PUT error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '수정 실패' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { templateId } = body
    if (!templateId) return NextResponse.json({ error: 'templateId 필요' }, { status: 400 })
    await deleteKakaoTemplate(templateId)
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    console.error('Kakao templates DELETE error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '삭제 실패' },
      { status: 500 }
    )
  }
}
