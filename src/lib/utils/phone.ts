/**
 * 국제 전화번호를 국내(한국) 로컬 번호로 변환
 *
 * HubSpot은 +82 국가번호 형식을 사용하지만,
 * SOLAPI는 국내 로컬 번호(010-xxxx-xxxx)만 지원합니다.
 *
 * 예시:
 *   +821089550804  → 01089550804
 *   +82-10-8955-0804 → 01089550804
 *   821089550804   → 01089550804
 *   01089550804    → 01089550804
 *   010-8955-0804  → 01089550804
 */
export function normalizePhoneNumber(phone: string): string {
  // 숫자와 + 기호만 남기기
  let cleaned = phone.replace(/[\s\-()]/g, '')

  // +82 또는 82로 시작하는 경우 → 0으로 교체
  if (cleaned.startsWith('+82')) {
    cleaned = '0' + cleaned.slice(3)
  } else if (cleaned.startsWith('82') && cleaned.length >= 11) {
    cleaned = '0' + cleaned.slice(2)
  }

  // 나머지 비숫자 제거 (혹시 남아있을 경우)
  cleaned = cleaned.replace(/[^0-9]/g, '')

  return cleaned
}

/**
 * 전화번호를 보기 좋은 형식으로 포맷팅
 * 01089550804 → 010-8955-0804
 */
export function formatPhoneDisplay(phone: string): string {
  const cleaned = normalizePhoneNumber(phone)
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`
  }
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  return phone
}
