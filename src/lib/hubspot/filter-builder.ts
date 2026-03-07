export interface HubSpotFilter {
  propertyName: string
  operator: string
  value: string
}

export interface AdvancedFilterOptions {
  query?: string           // 이름/이메일 텍스트 검색
  company?: string         // 회사명
  lifecyclestage?: string  // 라이프사이클 단계
  phoneExists?: boolean    // 전화번호 유무
  createdAfter?: string    // 등록일 시작 (ISO date)
  createdBefore?: string   // 등록일 종료 (ISO date)
}

/**
 * 고급 필터 옵션을 HubSpot Search API filterGroups 형식으로 변환
 *
 * HubSpot Search API 구조:
 * {
 *   filterGroups: [
 *     { filters: [ { propertyName, operator, value } ] }  // AND 조건
 *   ]
 * }
 * filterGroups 간에는 OR 조건, filters 내부는 AND 조건
 */
export function buildHubSpotFilters(options: AdvancedFilterOptions): HubSpotFilter[] {
  const filters: HubSpotFilter[] = []

  if (options.query) {
    // 이름 또는 이메일에 포함된 텍스트 검색
    // HubSpot CONTAINS_TOKEN은 토큰 단위로 검색 (부분 일치)
    filters.push({
      propertyName: 'email',
      operator: 'CONTAINS_TOKEN',
      value: `*${options.query}*`,
    })
  }

  if (options.company) {
    filters.push({
      propertyName: 'company',
      operator: 'CONTAINS_TOKEN',
      value: `*${options.company}*`,
    })
  }

  if (options.lifecyclestage) {
    filters.push({
      propertyName: 'lifecyclestage',
      operator: 'EQ',
      value: options.lifecyclestage,
    })
  }

  if (options.phoneExists === true) {
    filters.push({
      propertyName: 'phone',
      operator: 'HAS_PROPERTY',
      value: '',
    })
  } else if (options.phoneExists === false) {
    filters.push({
      propertyName: 'phone',
      operator: 'NOT_HAS_PROPERTY',
      value: '',
    })
  }

  if (options.createdAfter) {
    // HubSpot expects milliseconds since epoch for date filters
    const timestamp = new Date(options.createdAfter).getTime()
    filters.push({
      propertyName: 'createdate',
      operator: 'GTE',
      value: timestamp.toString(),
    })
  }

  if (options.createdBefore) {
    // 종료일의 끝까지 포함하기 위해 다음 날 자정으로 설정
    const date = new Date(options.createdBefore)
    date.setDate(date.getDate() + 1)
    filters.push({
      propertyName: 'createdate',
      operator: 'LTE',
      value: date.getTime().toString(),
    })
  }

  return filters
}

/**
 * 라이프사이클 단계 옵션 목록
 */
export const LIFECYCLE_STAGES = [
  { value: 'subscriber', label: 'Subscriber (구독자)' },
  { value: 'lead', label: 'Lead (리드)' },
  { value: 'marketingqualifiedlead', label: 'MQL (마케팅 적격 리드)' },
  { value: 'salesqualifiedlead', label: 'SQL (영업 적격 리드)' },
  { value: 'opportunity', label: 'Opportunity (기회)' },
  { value: 'customer', label: 'Customer (고객)' },
  { value: 'evangelist', label: 'Evangelist (전도자)' },
  { value: 'other', label: 'Other (기타)' },
]
