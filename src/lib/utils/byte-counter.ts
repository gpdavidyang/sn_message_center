/**
 * 한글 바이트 수 계산 (EUC-KR 기준)
 * SMS: 90바이트 이하
 * LMS: 2,000바이트 이하
 */
export function getByteLength(str: string): number {
  let byteLength = 0
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i)
    if (charCode <= 0x7f) {
      byteLength += 1
    } else if (charCode <= 0x7ff) {
      byteLength += 2
    } else {
      byteLength += 2 // 한글은 EUC-KR 기준 2바이트
    }
  }
  return byteLength
}

export function getMessageType(text: string): 'SMS' | 'LMS' {
  return getByteLength(text) <= 90 ? 'SMS' : 'LMS'
}
