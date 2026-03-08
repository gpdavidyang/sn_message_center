import { NextRequest, NextResponse } from 'next/server'
import { listForms, getFormSubmissions, getFormSubmissionCount, extractContactFromSubmission } from '@/lib/hubspot/forms'

// GET /api/contacts/hubspot-forms?action=forms
// GET /api/contacts/hubspot-forms?action=submissions&formId=xxx
// GET /api/contacts/hubspot-forms?action=counts&formIds=id1,id2,id3
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'forms') {
      try {
        const forms = await listForms()
        return NextResponse.json({
          forms: forms.map(f => ({
            id: f.id,
            name: f.name,
            createdAt: f.createdAt,
            updatedAt: f.updatedAt,
          })),
        })
      } catch (err) {
        // HubSpot Private App에 forms 권한이 없을 수 있음
        const msg = err instanceof Error ? err.message : 'Unknown'
        console.warn('HubSpot Forms API 접근 불가 (권한 확인 필요):', msg)
        return NextResponse.json({
          forms: [],
          warning: 'HubSpot 양식 API에 접근할 수 없습니다. Private App에 "Forms" 스코프를 추가해주세요.',
        })
      }
    }

    if (action === 'submissions') {
      const formId = searchParams.get('formId')
      if (!formId) {
        return NextResponse.json({ error: 'formId 파라미터가 필요합니다' }, { status: 400 })
      }

      const submissions = await getFormSubmissions(formId)

      const contacts = submissions.map((sub, idx) => {
        const info = extractContactFromSubmission(sub)
        return {
          id: `form-sub-${idx}`,
          properties: {
            firstname: info.firstName || '',
            lastname: info.lastName || '',
            email: info.email || '',
            phone: info.phone || '',
            company: '',
            lifecyclestage: '',
          },
          submittedAt: sub.submittedAt,
        }
      })

      return NextResponse.json({ contacts, total: submissions.length })
    }

    if (action === 'counts') {
      const formIds = searchParams.get('formIds')?.split(',').filter(Boolean) || []
      if (formIds.length === 0) return NextResponse.json({ counts: {} })

      const results = await Promise.all(
        formIds.map(async (id) => {
          const count = await getFormSubmissionCount(id)
          return [id, count] as [string, number]
        })
      )
      return NextResponse.json({ counts: Object.fromEntries(results) })
    }

    return NextResponse.json({ error: 'action 파라미터가 필요합니다 (forms, submissions, counts)' }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('HubSpot Forms error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
