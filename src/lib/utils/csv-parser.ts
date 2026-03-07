import { normalizePhoneNumber } from './phone'

export interface ParsedContact {
  phone: string
  name?: string
}

export interface CSVParseResult {
  contacts: ParsedContact[]
  errors: string[]
  total: number
}

/**
 * CSV 텍스트를 2D 배열로 파싱
 * 쉼표(,) 및 탭(\t) 구분자 지원, 따옴표 이스케이프 처리
 */
export function parseCSV(csvText: string): string[][] {
  const lines = csvText.trim().split(/\r?\n/)
  const rows: string[][] = []

  // 탭 구분자 감지 (첫 줄 기준)
  const delimiter = lines[0]?.includes('\t') ? '\t' : ','

  for (const line of lines) {
    if (!line.trim()) continue

    const cells: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === delimiter && !inQuotes) {
        cells.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    cells.push(current.trim())
    rows.push(cells)
  }

  return rows
}

/**
 * 헤더 행에서 phone, name 컬럼 인덱스를 자동 감지
 */
function detectColumns(header: string[]): {
  phoneColumn: number | null
  nameColumn: number | null
} {
  const lower = header.map(h => h.toLowerCase().trim().replace(/['"]/g, ''))

  const phoneKeywords = ['phone', 'mobile', 'cell', 'tel', 'telephone', 'number',
    '전화', '전화번호', '휴대폰', '핸드폰', '연락처', '수신번호']
  const nameKeywords = ['name', 'fullname', 'full_name', 'person', 'contact',
    '이름', '성명', '수신자', '수신자명']

  const phoneCol = lower.findIndex(h => phoneKeywords.some(kw => h.includes(kw)))
  const nameCol = lower.findIndex(h => nameKeywords.some(kw => h.includes(kw)))

  // 헤더가 없는 경우: 숫자로만 된 컬럼을 phone으로 추정
  if (phoneCol === -1) {
    // 두 번째 행(데이터 첫 행)이 없으면 감지 불가
    return { phoneColumn: null, nameColumn: null }
  }

  return {
    phoneColumn: phoneCol >= 0 ? phoneCol : null,
    nameColumn: nameCol >= 0 ? nameCol : null,
  }
}

/**
 * 문자열이 전화번호처럼 생겼는지 확인
 */
function looksLikePhone(value: string): boolean {
  const cleaned = value.replace(/[\s\-+()]/g, '')
  return /^\d{10,13}$/.test(cleaned)
}

/**
 * CSV 텍스트에서 연락처 목록 추출
 * 헤더 자동 감지, phone 정규화, 중복 제거
 */
export function parseContactsFromCSV(csvText: string): CSVParseResult {
  const rows = parseCSV(csvText)

  if (rows.length === 0) {
    return { contacts: [], errors: ['빈 데이터입니다.'], total: 0 }
  }

  // 헤더 감지 시도
  let { phoneColumn, nameColumn } = detectColumns(rows[0])
  let dataStartRow = 1

  // 헤더를 감지 못한 경우, 첫 번째 행이 데이터인지 확인
  if (phoneColumn === null) {
    // 모든 컬럼을 검사하여 전화번호 컬럼 추정
    const firstRow = rows[0]
    const phoneIdx = firstRow.findIndex(cell => looksLikePhone(cell))

    if (phoneIdx >= 0) {
      phoneColumn = phoneIdx
      // 이름은 전화번호가 아닌 첫 번째 컬럼
      nameColumn = firstRow.findIndex((cell, i) => i !== phoneIdx && cell && !looksLikePhone(cell))
      if (nameColumn === -1) nameColumn = null
      dataStartRow = 0 // 헤더 없이 바로 데이터
    } else {
      return {
        contacts: [],
        errors: ['전화번호 컬럼을 찾을 수 없습니다. "phone" 또는 "전화번호" 헤더가 포함된 CSV를 사용해주세요.'],
        total: 0,
      }
    }
  }

  const contacts: ParsedContact[] = []
  const errors: string[] = []
  const seenPhones = new Set<string>()

  for (let i = dataStartRow; i < rows.length; i++) {
    const row = rows[i]
    if (row.every(cell => !cell)) continue // 빈 행 스킵

    const rawPhone = row[phoneColumn!]?.trim()
    if (!rawPhone) {
      errors.push(`${i + 1}행: 전화번호 없음`)
      continue
    }

    const normalized = normalizePhoneNumber(rawPhone)
    if (normalized.length < 10) {
      errors.push(`${i + 1}행: 유효하지 않은 번호 "${rawPhone}"`)
      continue
    }

    if (seenPhones.has(normalized)) {
      errors.push(`${i + 1}행: 중복 번호 "${rawPhone}"`)
      continue
    }

    seenPhones.add(normalized)
    const name = nameColumn !== null ? row[nameColumn]?.trim() : undefined
    contacts.push({ phone: normalized, name: name || undefined })
  }

  return {
    contacts,
    errors,
    total: rows.length - dataStartRow,
  }
}
