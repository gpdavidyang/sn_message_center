const HUBSPOT_BASE_URL = 'https://api.hubapi.com'

function getHeaders() {
  return {
    Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

export interface HubSpotForm {
  id: string
  name: string
  createdAt?: string
  updatedAt?: string
  fieldGroups?: Array<{
    fields: Array<{
      name: string
      label: string
      fieldType: string
    }>
  }>
}

export interface HubSpotFormSubmission {
  submittedAt: string
  values: Array<{
    name: string
    value: string
    objectTypeId?: string
  }>
}

/**
 * HubSpot 마케팅 폼 목록 조회
 */
export async function listForms(): Promise<HubSpotForm[]> {
  const response = await fetch(
    `${HUBSPOT_BASE_URL}/marketing/v3/forms?limit=50`,
    { headers: getHeaders(), cache: 'no-store' }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`HubSpot Forms Error: ${error.message || response.statusText}`)
  }

  const data = await response.json()
  return data.results || []
}

/**
 * 특정 폼의 제출 데이터 조회
 */
export async function getFormSubmissions(formId: string, limit: number = 50): Promise<HubSpotFormSubmission[]> {
  const response = await fetch(
    `${HUBSPOT_BASE_URL}/form-integrations/v1/submissions/forms/${formId}?limit=${limit}`,
    { headers: getHeaders(), cache: 'no-store' }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`HubSpot Form Submissions Error: ${error.message || response.statusText}`)
  }

  const data = await response.json()
  return data.results || []
}

/**
 * 폼 제출 데이터에서 연락처 정보 추출
 */
export function extractContactFromSubmission(submission: HubSpotFormSubmission): {
  email?: string
  phone?: string
  firstName?: string
  lastName?: string
} {
  const fields: Record<string, string> = {}

  for (const field of submission.values) {
    const name = field.name.toLowerCase()
    fields[name] = field.value
  }

  return {
    email: fields.email || fields.e_mail || undefined,
    phone: fields.phone || fields.mobilephone || fields.phonenumber || fields['phone_number'] || undefined,
    firstName: fields.firstname || fields['first_name'] || fields.name || undefined,
    lastName: fields.lastname || fields['last_name'] || undefined,
  }
}
