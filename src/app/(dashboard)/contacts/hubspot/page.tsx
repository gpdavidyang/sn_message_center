'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, Download, Users, Loader2, ChevronLeft, ChevronRight,
  MessageSquare, MessageCircle, X, RefreshCw, Filter,
  Phone as PhoneIcon
} from 'lucide-react'
import { LIFECYCLE_STAGES, buildHubSpotFilters, type AdvancedFilterOptions } from '@/lib/hubspot/filter-builder'

interface HubSpotContact {
  id: string
  properties: {
    firstname?: string
    lastname?: string
    email?: string
    phone?: string
    company?: string
    lifecyclestage?: string
  }
}

interface HubSpotForm {
  id: string
  name: string
}

export default function HubSpotContactsPage() {
  const router = useRouter()
  const [contacts, setContacts] = useState<HubSpotContact[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [after, setAfter] = useState<string | undefined>()
  const [hasNext, setHasNext] = useState(false)
  const [message, setMessage] = useState('')
  const [showSendModal, setShowSendModal] = useState(false)
  const [importedContacts, setImportedContacts] = useState<HubSpotContact[]>([])

  // 필터 상태
  const [showFilters, setShowFilters] = useState(false)
  const [query, setQuery] = useState('')
  const [company, setCompany] = useState('')
  const [lifecyclestage, setLifecyclestage] = useState('')
  const [phoneExists, setPhoneExists] = useState<boolean | undefined>(undefined)
  const [createdAfter, setCreatedAfter] = useState('')
  const [createdBefore, setCreatedBefore] = useState('')
  const activeFilterCount = [company, lifecyclestage, phoneExists !== undefined ? 'x' : '', createdAfter, createdBefore].filter(Boolean).length

  // 동기화 상태
  const [syncing, setSyncing] = useState(false)

  // 폼 필터 상태
  const [forms, setForms] = useState<HubSpotForm[]>([])
  const [selectedForm, setSelectedForm] = useState('')
  const [formMode, setFormMode] = useState(false)
  const [loadingForms, setLoadingForms] = useState(true)
  const [formsWarning, setFormsWarning] = useState('')

  // 폼 목록 로드
  useEffect(() => {
    const fetchForms = async () => {
      setLoadingForms(true)
      try {
        const res = await fetch('/api/contacts/hubspot-forms?action=forms')
        const data = await res.json()
        if (data.forms) setForms(data.forms)
        if (data.warning) setFormsWarning(data.warning)
      } catch (err) {
        console.error('폼 목록 조회 실패:', err)
      } finally {
        setLoadingForms(false)
      }
    }
    fetchForms()
  }, [])

  // 연락처 조회 (HubSpot API)
  const fetchContacts = async (cursor?: string) => {
    setLoading(true)
    setFormMode(false)
    try {
      const filterOptions: AdvancedFilterOptions = {
        query: query || undefined,
        company: company || undefined,
        lifecyclestage: lifecyclestage || undefined,
        phoneExists,
        createdAfter: createdAfter || undefined,
        createdBefore: createdBefore || undefined,
      }

      const filters = buildHubSpotFilters(filterOptions)

      let result
      if (filters.length > 0) {
        const res = await fetch('/api/contacts/hubspot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filters, limit: 20, after: cursor }),
        })
        result = await res.json()
      } else {
        const params = new URLSearchParams({ limit: '20' })
        if (cursor) params.set('after', cursor)
        const res = await fetch(`/api/contacts/hubspot?${params}`)
        result = await res.json()
      }

      if (result.error) throw new Error(result.error)

      setContacts(result.results || [])
      setAfter(result.paging?.next?.after)
      setHasNext(!!result.paging?.next)
    } catch (err: unknown) {
      setMessage(`❌ ${err instanceof Error ? err.message : '연락처를 불러오지 못했습니다.'}`)
    } finally {
      setLoading(false)
    }
  }

  // 폼 제출자 조회
  const fetchFormSubmissions = async (formId: string) => {
    setLoading(true)
    setFormMode(true)
    try {
      const res = await fetch(`/api/contacts/hubspot-forms?action=submissions&formId=${formId}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setContacts(data.contacts || [])
      setAfter(undefined)
      setHasNext(false)
    } catch (err: unknown) {
      setMessage(`❌ ${err instanceof Error ? err.message : '폼 데이터를 불러오지 못했습니다.'}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchContacts()
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSelected(new Set())
    fetchContacts()
  }

  const handleApplyFilters = () => {
    setSelected(new Set())
    fetchContacts()
  }

  const handleClearFilters = () => {
    setQuery('')
    setCompany('')
    setLifecyclestage('')
    setPhoneExists(undefined)
    setCreatedAfter('')
    setCreatedBefore('')
    setSelectedForm('')
    setFormMode(false)
    setSelected(new Set())
    setTimeout(() => fetchContacts(), 0)
  }

  const handleFormSelect = (formId: string) => {
    setSelectedForm(formId)
    setSelected(new Set())
    if (formId) {
      fetchFormSubmissions(formId)
    } else {
      setFormMode(false)
      fetchContacts()
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    setMessage('')
    try {
      const res = await fetch('/api/contacts/sync-hubspot', { method: 'POST' })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setMessage(`✅ ${data.message}`)
      fetchContacts()
    } catch (err: unknown) {
      setMessage(`❌ ${err instanceof Error ? err.message : '동기화 실패'}`)
    } finally {
      setSyncing(false)
    }
  }

  const toggleSelect = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const toggleAll = () => {
    if (selected.size === contacts.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(contacts.map((c) => c.id)))
    }
  }

  const handleImport = async () => {
    if (selected.size === 0) return
    setImporting(true)

    const selectedContacts = contacts.filter((c) => selected.has(c.id))

    try {
      const res = await fetch('/api/contacts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: selectedContacts }),
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      setImportedContacts(selectedContacts)
      setSelected(new Set())
      setShowSendModal(true)
    } catch (err: unknown) {
      setMessage(`❌ ${err instanceof Error ? err.message : '가져오기에 실패했습니다.'}`)
    } finally {
      setImporting(false)
    }
  }

  const handleGoToSMS = () => {
    const phones = importedContacts.map((c) => c.properties.phone).filter(Boolean).join(',')
    const names = importedContacts
      .map((c) => `${c.properties.firstname || ''} ${c.properties.lastname || ''}`.trim())
      .filter(Boolean)
      .join(',')
    router.push(`/messages/compose?phones=${encodeURIComponent(phones)}&names=${encodeURIComponent(names)}`)
  }

  const handleGoToKakao = () => {
    const phones = importedContacts.map((c) => c.properties.phone).filter(Boolean).join(',')
    router.push(`/kakao/send?phones=${encodeURIComponent(phones)}`)
  }

  return (
    <div>
      {/* Top Bar: Search + Actions */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름, 이메일로 검색..."
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button type="submit" className="rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200">
            검색
          </button>
        </form>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
            showFilters || activeFilterCount > 0
              ? 'border-blue-300 bg-blue-50 text-blue-700'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Filter className="h-4 w-4" />
          필터
          {activeFilterCount > 0 && (
            <span className="ml-1 rounded-full bg-blue-600 px-1.5 py-0.5 text-xs text-white">{activeFilterCount}</span>
          )}
        </button>

        <div className="flex gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{syncing ? '동기화 중...' : '전체 동기화'}</span>
            <span className="sm:hidden">{syncing ? '...' : '동기화'}</span>
          </button>

          <button
            onClick={handleImport}
            disabled={selected.size === 0 || importing}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 sm:px-4"
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span className="hidden sm:inline">선택 가져오기</span> ({selected.size})
          </button>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">회사명</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="회사 검색..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">라이프사이클 단계</label>
              <select
                value={lifecyclestage}
                onChange={(e) => setLifecyclestage(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              >
                <option value="">전체</option>
                {LIFECYCLE_STAGES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">등록일 (시작)</label>
              <input
                type="date"
                value={createdAfter}
                onChange={(e) => setCreatedAfter(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">등록일 (종료)</label>
              <input
                type="date"
                value={createdBefore}
                onChange={(e) => setCreatedBefore(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-4">
            <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <input
                type="checkbox"
                checked={phoneExists === true}
                onChange={(e) => setPhoneExists(e.target.checked ? true : undefined)}
                className="rounded border-gray-300 text-blue-600"
              />
              <PhoneIcon className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-700">전화번호 있는 연락처만</span>
            </label>

            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600">HubSpot 양식:</label>
              {loadingForms ? (
                <span className="text-xs text-gray-400">로딩 중...</span>
              ) : forms.length > 0 ? (
                <select
                  value={selectedForm}
                  onChange={(e) => handleFormSelect(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">전체 연락처</option>
                  {forms.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-orange-600">
                  {formsWarning || '양식 없음 — HubSpot Private App에 "Forms" 스코프를 추가해주세요'}
                </span>
              )}
            </div>

            <div className="ml-auto flex gap-2">
              <button
                onClick={handleClearFilters}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                초기화
              </button>
              <button
                onClick={handleApplyFilters}
                disabled={formMode}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                필터 적용
              </button>
            </div>
          </div>

          {formMode && selectedForm && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-purple-50 px-3 py-2 text-sm text-purple-700">
              <span className="font-medium">양식 모드:</span>
              {forms.find(f => f.id === selectedForm)?.name} 제출자를 표시하고 있습니다
              <button onClick={() => handleFormSelect('')} className="ml-auto text-purple-500 underline hover:text-purple-700">해제</button>
            </div>
          )}
        </div>
      )}

      {/* Message */}
      {message && (
        <div className={`mb-4 rounded-lg p-4 text-sm font-medium ${
          message.startsWith('✅')
            ? 'border border-green-200 bg-green-50 text-green-800'
            : message.startsWith('❌')
              ? 'border border-red-200 bg-red-50 text-red-800'
              : 'border border-blue-200 bg-blue-50 text-blue-800'
        }`}>
          {message}
          <button onClick={() => setMessage('')} className="ml-3 font-bold underline">닫기</button>
        </div>
      )}

      {/* Send Modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">연락처를 가져왔습니다!</h3>
              <button onClick={() => setShowSendModal(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-2 text-sm text-gray-600">
              <strong>{importedContacts.length}명</strong>의 연락처를 성공적으로 가져왔습니다.
            </p>
            <div className="mb-5 max-h-32 overflow-y-auto rounded-lg bg-gray-50 p-3">
              {importedContacts.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-1 text-sm">
                  <span className="text-gray-700">{c.properties.firstname || ''} {c.properties.lastname || ''}</span>
                  <span className="text-gray-500">{c.properties.phone || '번호 없음'}</span>
                </div>
              ))}
            </div>
            <p className="mb-4 text-sm font-medium text-gray-700">어떤 메시지를 보내시겠습니까?</p>
            <div className="space-y-3">
              <button onClick={handleGoToSMS} className="flex w-full items-center gap-3 rounded-xl border-2 border-blue-100 bg-blue-50 px-4 py-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-100">
                <div className="rounded-lg bg-blue-600 p-2"><MessageSquare className="h-5 w-5 text-white" /></div>
                <div>
                  <p className="font-semibold text-gray-900">문자 메시지 (SMS/LMS)</p>
                  <p className="text-xs text-gray-500">SOLAPI를 통해 문자 메시지를 발송합니다</p>
                </div>
              </button>
              <button onClick={handleGoToKakao} className="flex w-full items-center gap-3 rounded-xl border-2 border-yellow-100 bg-yellow-50 px-4 py-3 text-left transition-colors hover:border-yellow-300 hover:bg-yellow-100">
                <div className="rounded-lg bg-yellow-500 p-2"><MessageCircle className="h-5 w-5 text-white" /></div>
                <div>
                  <p className="font-semibold text-gray-900">카카오 알림톡</p>
                  <p className="text-xs text-gray-500">카카오톡 알림톡 템플릿으로 발송합니다</p>
                </div>
              </button>
              <button onClick={() => setShowSendModal(false)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                나중에 보내기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3">
                  <input type="checkbox" checked={contacts.length > 0 && selected.size === contacts.length} onChange={toggleAll} className="rounded border-gray-300" />
                </th>
                <th className="px-4 py-3 font-medium text-gray-600">이름</th>
                <th className="hidden px-4 py-3 font-medium text-gray-600 sm:table-cell">이메일</th>
                <th className="px-4 py-3 font-medium text-gray-600">전화번호</th>
                <th className="hidden px-4 py-3 font-medium text-gray-600 md:table-cell">회사</th>
                <th className="hidden px-4 py-3 font-medium text-gray-600 lg:table-cell">단계</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" />
                    <p className="mt-2 text-gray-500">
                      {syncing ? 'HubSpot 전체 동기화 중...' : formMode ? '양식 제출 데이터 불러오는 중...' : 'HubSpot 연락처를 불러오는 중...'}
                    </p>
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Users className="mx-auto h-8 w-8 text-gray-400" />
                    <p className="mt-2 text-gray-500">{formMode ? '이 양식에 제출된 연락처가 없습니다.' : '조건에 맞는 연락처가 없습니다.'}</p>
                  </td>
                </tr>
              ) : (
                contacts.map((contact) => (
                  <tr key={contact.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(contact.id)} onChange={() => toggleSelect(contact.id)} className="rounded border-gray-300" />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{contact.properties.firstname || ''} {contact.properties.lastname || ''}</td>
                    <td className="hidden px-4 py-3 text-gray-600 sm:table-cell">{contact.properties.email || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{contact.properties.phone || '-'}</td>
                    <td className="hidden px-4 py-3 text-gray-600 md:table-cell">{contact.properties.company || '-'}</td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      {contact.properties.lifecyclestage && (
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">{contact.properties.lifecyclestage}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!formMode && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <p className="text-sm text-gray-600">{contacts.length}건 표시 중</p>
            <div className="flex gap-2">
              <button disabled className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                <ChevronLeft className="h-4 w-4" /> 이전
              </button>
              <button onClick={() => hasNext && fetchContacts(after)} disabled={!hasNext} className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                다음 <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
