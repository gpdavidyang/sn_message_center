import { generateSolapiAuth } from './auth'

const SOLAPI_BASE_URL = 'https://api.solapi.com'

function getHeaders() {
  return {
    ...generateSolapiAuth(),
    'Content-Type': 'application/json',
  }
}

// ============================================
// SMS / LMS / MMS 발송
// ============================================

export interface SendMessageParams {
  to: string
  from: string
  text: string
  type?: 'SMS' | 'LMS' | 'MMS' | 'FRT'
  subject?: string       // LMS/MMS용
  imageId?: string       // MMS용
  kakaoOptions?: {
    pfId: string
    templateId?: string   // 알림톡 필수, 친구톡 불필요
    variables?: Record<string, string>
    buttons?: Array<{ type: string; name: string; linkMo?: string; linkPc?: string }>
    disableSms?: boolean
  }
}

export interface SendMessageResponse {
  groupId: string
  messageId: string
  statusCode: string
  statusMessage: string
  to: string
  type: string
  from: string
}

// 단건 발송
export async function sendMessage(params: SendMessageParams): Promise<SendMessageResponse> {
  const response = await fetch(`${SOLAPI_BASE_URL}/messages/v4/send`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ message: params }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`SOLAPI Send Error: ${JSON.stringify(error)}`)
  }

  return response.json()
}

// 대량 발송
export async function sendManyMessages(
  messages: SendMessageParams[]
): Promise<{ groupId: string; messageIds: string[] }> {
  const response = await fetch(`${SOLAPI_BASE_URL}/messages/v4/send-many`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ messages }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`SOLAPI Send Many Error: ${JSON.stringify(error)}`)
  }

  return response.json()
}

// ============================================
// 카카오 알림톡 발송
// ============================================

export interface SendKakaoParams {
  to: string
  from: string
  text?: string
  kakaoOptions: {
    pfId: string
    templateId: string
    variables?: Record<string, string>
    disableSms?: boolean
  }
}

export async function sendKakaoAlimtalk(params: SendKakaoParams) {
  return sendMessage(params as SendMessageParams)
}

// ============================================
// 카카오 알림톡 템플릿 목록 조회
// ============================================

export interface KakaoTemplate {
  templateId: string
  name: string
  content: string
  buttons?: Array<{
    type: string
    name: string
    linkMo?: string
    linkPc?: string
  }>
  status: string
  inspectionStatus?: string
  comments?: string[]
  dateCreated?: string
  dateUpdated?: string
}

export async function getKakaoTemplates(_pfId?: string) {
  const response = await fetch(
    `${SOLAPI_BASE_URL}/kakao/v2/templates`,
    { headers: getHeaders(), cache: 'no-store' }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`SOLAPI Kakao Templates Error: ${JSON.stringify(error)}`)
  }

  return response.json()
}

// ============================================
// 카카오 알림톡 템플릿 CRUD
// ============================================

export interface KakaoTemplateParams {
  pfId: string
  name: string
  content: string
  categoryCode: string
  buttons?: Array<{
    type: string
    name: string
    linkMo?: string
    linkPc?: string
  }>
}

export async function createKakaoTemplate(params: KakaoTemplateParams) {
  const response = await fetch(`${SOLAPI_BASE_URL}/kakao/v2/templates`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(params),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error?.errorMessage || error?.message || JSON.stringify(error))
  }
  return response.json()
}

export async function updateKakaoTemplate(templateId: string, params: Partial<KakaoTemplateParams>) {
  const response = await fetch(`${SOLAPI_BASE_URL}/kakao/v2/templates/${templateId}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(params),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error?.errorMessage || error?.message || JSON.stringify(error))
  }
  return response.json()
}

export async function deleteKakaoTemplate(templateId: string) {
  const response = await fetch(`${SOLAPI_BASE_URL}/kakao/v2/templates/${templateId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error?.errorMessage || error?.message || JSON.stringify(error))
  }
  return true
}

export async function requestKakaoTemplateApproval(templateId: string) {
  const response = await fetch(`${SOLAPI_BASE_URL}/kakao/v2/templates/${templateId}/request`, {
    method: 'POST',
    headers: getHeaders(),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error?.errorMessage || error?.message || JSON.stringify(error))
  }
  return response.json()
}

// ============================================
// 잔액 조회
// ============================================

export interface BalanceResponse {
  balance: number
  point: number
}

export async function getBalance(): Promise<BalanceResponse> {
  const response = await fetch(`${SOLAPI_BASE_URL}/cash/v1/balance`, {
    headers: getHeaders(),
    cache: 'no-store',
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`SOLAPI Balance Error: ${JSON.stringify(error)}`)
  }

  return response.json()
}

// ============================================
// 메시지 조회
// ============================================

export async function getMessageList(params?: {
  startDate?: string
  endDate?: string
  limit?: number
  startKey?: string
}) {
  const searchParams = new URLSearchParams()
  if (params?.startDate) searchParams.set('startDate', params.startDate)
  if (params?.endDate) searchParams.set('endDate', params.endDate)
  if (params?.limit) searchParams.set('limit', params.limit.toString())
  if (params?.startKey) searchParams.set('startKey', params.startKey)

  const response = await fetch(
    `${SOLAPI_BASE_URL}/messages/v4/list?${searchParams}`,
    { headers: getHeaders(), cache: 'no-store' }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`SOLAPI List Error: ${JSON.stringify(error)}`)
  }

  return response.json()
}

// ============================================
// 발신번호 목록 조회
// ============================================

export async function getSenderNumbers() {
  const response = await fetch(
    `${SOLAPI_BASE_URL}/senderid/v1/numbers`,
    { headers: getHeaders(), cache: 'no-store' }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`SOLAPI SenderID Error: ${JSON.stringify(error)}`)
  }

  return response.json()
}
