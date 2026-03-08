'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, Download, Users, Loader2, ChevronLeft, ChevronRight,
  MessageSquare, MessageCircle, X, RefreshCw, Filter,
  Phone as PhoneIcon, ArrowUpDown, ArrowUp, ArrowDown, Calendar,
  LayoutGrid, List, FileText, ChevronRight as ChevronRightIcon,
  Mail, Building2, Tag, CheckCircle, Clock, XCircle, AlertCircle,
} from 'lucide-react'
import { LIFECYCLE_STAGES, buildHubSpotFilters, type AdvancedFilterOptions } from '@/lib/hubspot/filter-builder'
import { formatPhoneDisplay, normalizePhoneNumber } from '@/lib/utils/phone'

interface MessageLog {
  id: string
  type: string
  content?: string
  status: string
  status_code?: string
  error_message?: string
  sent_at?: string
  delivered_at?: string
  created_at: string
  message_campaigns?: {
    id: string
    name: string
    type: string
  }
}

interface HubSpotContact {
  id: string
  properties: {
    firstname?: string
    lastname?: string
    email?: string
    phone?: string
    company?: string
    lifecyclestage?: string
    createdate?: string
  }
}

interface HubSpotForm {
  id: string
  name: string
  createdAt?: string
}

export default function HubSpotContactsPage() {
  const router = useRouter()

  // 뷰 모드
  const [pageView, setPageView] = useState<'contacts' | 'forms'>('contacts')

  // 연락처 상세 드로어
  const [drawerContact, setDrawerContact] = useState<HubSpotContact | null>(null)
  const [drawerLogs, setDrawerLogs] = useState<MessageLog[]>([])
  const [drawerLogsLoading, setDrawerLogsLoading] = useState(false)

  const openDrawer = useCallback(async (contact: HubSpotContact) => {
    setDrawerContact(contact)
    setDrawerLogs([])
    const phone = contact.properties.phone
    if (!phone) return
    setDrawerLogsLoading(true)
    try {
      const res = await fetch(`/api/contacts/logs?phone=${encodeURIComponent(phone)}`)
      const data = await res.json()
      setDrawerLogs(data.logs || [])
    } catch {
      // silent
    } finally {
      setDrawerLogsLoading(false)
    }
  }, [])

  const closeDrawer = useCallback(() => setDrawerContact(null), [])

  const [contacts, setContacts] = useState<HubSpotContact[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [after, setAfter] = useState<string | undefined>()
  const [hasNext, setHasNext] = useState(false)
  const [message, setMessage] = useState('')
  const [showSendModal, setShowSendModal] = useState(false)
  const [importedContacts, setImportedContacts] = useState<HubSpotContact[]>([])

  // 카카오 친구 상태
  const [kakaoFriendStatuses, setKakaoFriendStatuses] = useState<Record<string, boolean | null>>({})
  const [kakaoFriendFilter, setKakaoFriendFilter] = useState<'all' | 'friend' | 'non_friend'>('all')

  // 필터 상태
  const [showFilters, setShowFilters] = useState(true)
  const [query, setQuery] = useState('')
  const [company, setCompany] = useState('')
  const [lifecyclestage, setLifecyclestage] = useState('')
  const [phoneExists, setPhoneExists] = useState<boolean | undefined>(undefined)
  const [createdAfter, setCreatedAfter] = useState('')
  const [createdBefore, setCreatedBefore] = useState('')
  const activeFilterCount = [company, lifecyclestage, phoneExists !== undefined ? 'x' : '', createdAfter, createdBefore, kakaoFriendFilter !== 'all' ? 'x' : ''].filter(Boolean).length

  // 정렬 상태
  type SortKey = 'name' | 'email' | 'phone' | 'company' | 'lifecyclestage' | 'createdate'
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const getSortValue = (contact: HubSpotContact, key: SortKey): string => {
    const p = contact.properties
    switch (key) {
      case 'name': return `${p.firstname || ''} ${p.lastname || ''}`.trim().toLowerCase()
      case 'email': return (p.email || '').toLowerCase()
      case 'phone': return p.phone || ''
      case 'company': return (p.company || '').toLowerCase()
      case 'lifecyclestage': return (p.lifecyclestage || '').toLowerCase()
      case 'createdate': return p.createdate || ''
    }
  }

  const sortedContacts = (() => {
    let result = sortKey
      ? [...contacts].sort((a, b) => {
          const aVal = getSortValue(a, sortKey)
          const bVal = getSortValue(b, sortKey)
          const cmp = aVal.localeCompare(bVal, 'ko')
          return sortDir === 'asc' ? cmp : -cmp
        })
      : contacts

    if (kakaoFriendFilter !== 'all') {
      result = result.filter(c => {
        const phone = c.properties.phone ? normalizePhoneNumber(c.properties.phone) : ''
        const status = kakaoFriendStatuses[phone]
        if (kakaoFriendFilter === 'friend') return status === true
        if (kakaoFriendFilter === 'non_friend') return status === false
        return true
      })
    }
    return result
  })()

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="ml-1 inline h-3 w-3 text-gray-400" />
    return sortDir === 'asc'
      ? <ArrowUp className="ml-1 inline h-3 w-3 text-blue-600" />
      : <ArrowDown className="ml-1 inline h-3 w-3 text-blue-600" />
  }

  // 동기화 상태
  const [syncing, setSyncing] = useState(false)

  // 폼 필터 상태
  const [forms, setForms] = useState<HubSpotForm[]>([])
  const [formCounts, setFormCounts] = useState<Record<string, number>>({})
  const [loadingCounts, setLoadingCounts] = useState(false)
  const [selectedForm, setSelectedForm] = useState('')
  const [selectedFormName, setSelectedFormName] = useState('')
  const [formMode, setFormMode] = useState(false)
  const [loadingForms, setLoadingForms] = useState(true)
  const [formsWarning, setFormsWarning] = useState('')

  // 양식별 보기 전용 상태
  const [formsViewMode, setFormsViewMode] = useState<'card' | 'list'>('card')
  const [formsSearch, setFormsSearch] = useState('')
  type FormSortKey = 'name' | 'count' | 'date'
  const [formsSortKey, setFormsSortKey] = useState<FormSortKey>('name')
  const [formsSortDir, setFormsSortDir] = useState<'asc' | 'desc'>('asc')

  const handleFormsSort = (key: FormSortKey) => {
    if (formsSortKey === key) setFormsSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setFormsSortKey(key); setFormsSortDir(key === 'date' ? 'desc' : 'asc') }
  }

  const filteredSortedForms = forms
    .filter(f => f.name.toLowerCase().includes(formsSearch.toLowerCase()))
    .sort((a, b) => {
      let cmp = 0
      if (formsSortKey === 'name') cmp = a.name.localeCompare(b.name, 'ko')
      else if (formsSortKey === 'count') cmp = (formCounts[a.id] ?? 0) - (formCounts[b.id] ?? 0)
      else cmp = (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
      return formsSortDir === 'asc' ? cmp : -cmp
    })

  const formatFormDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const FormsSortIcon = ({ col }: { col: FormSortKey }) => {
    if (formsSortKey !== col) return <ArrowUpDown className="ml-1 inline h-3 w-3 text-gray-400" />
    return formsSortDir === 'asc'
      ? <ArrowUp className="ml-1 inline h-3 w-3 text-blue-600" />
      : <ArrowDown className="ml-1 inline h-3 w-3 text-blue-600" />
  }

  // 폼 목록 로드
  useEffect(() => {
    const fetchForms = async () => {
      setLoadingForms(true)
      try {
        const res = await fetch('/api/contacts/hubspot-forms?action=forms')
        const data = await res.json()
        if (data.forms) {
          setForms(data.forms)
          // 카운트 병렬 조회
          if (data.forms.length > 0) {
            setLoadingCounts(true)
            const ids = data.forms.map((f: HubSpotForm) => f.id).join(',')
            fetch(`/api/contacts/hubspot-forms?action=counts&formIds=${ids}`)
              .then(r => r.json())
              .then(d => { if (d.counts) setFormCounts(d.counts) })
              .catch(() => {/* silent */})
              .finally(() => setLoadingCounts(false))
          }
        }
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

      const loadedContacts = result.results || []
      setContacts(loadedContacts)
      setAfter(result.paging?.next?.after)
      setHasNext(!!result.paging?.next)

      // 친구 상태 조회
      fetchKakaoFriendStatuses(loadedContacts)
    } catch (err: unknown) {
      setMessage(`❌ ${err instanceof Error ? err.message : '연락처를 불러오지 못했습니다.'}`)
    } finally {
      setLoading(false)
    }
  }

  const fetchKakaoFriendStatuses = async (contactList: HubSpotContact[]) => {
    const phones = contactList
      .map(c => c.properties.phone ? normalizePhoneNumber(c.properties.phone) : '')
      .filter(p => p.length >= 10)
    if (phones.length === 0) return
    try {
      const res = await fetch(`/api/kakao/channel-friends?phones=${encodeURIComponent(phones.join(','))}`)
      const data = await res.json()
      setKakaoFriendStatuses(prev => ({ ...prev, ...(data.statuses || {}) }))
    } catch { /* silent */ }
  }

  // 폼 제출자 조회
  const fetchFormSubmissions = async (formId: string, formName?: string) => {
    setLoading(true)
    setFormMode(true)
    setSelectedForm(formId)
    setSelectedFormName(formName || forms.find(f => f.id === formId)?.name || '')
    setPageView('contacts')
    try {
      const res = await fetch(`/api/contacts/hubspot-forms?action=submissions&formId=${formId}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const loadedContacts = data.contacts || []
      setContacts(loadedContacts)
      setAfter(undefined)
      setHasNext(false)
      fetchKakaoFriendStatuses(loadedContacts)
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
    setSelectedFormName('')
    setFormMode(false)
    setKakaoFriendFilter('all')
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

  const handleGoToFriendtalk = () => {
    const phones = importedContacts.map((c) => c.properties.phone).filter(Boolean).join(',')
    const names = importedContacts
      .map((c) => `${c.properties.firstname || ''} ${c.properties.lastname || ''}`.trim())
      .filter(Boolean)
      .join(',')
    router.push(`/kakao/friendtalk?phones=${encodeURIComponent(phones)}&names=${encodeURIComponent(names)}`)
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
  }

  return (
    <div>
      {/* Top Bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {pageView === 'contacts' && (
          <form onSubmit={handleSearch} className="flex flex-1 gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="이름, 이메일로 검색..."
                className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button type="submit" className="rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200">
              검색
            </button>
          </form>
        )}

        {pageView === 'forms' && (
          <div className="flex-1">
            <p className="text-sm text-gray-500">HubSpot 양식을 선택하면 해당 양식 제출자 연락처를 조회합니다.</p>
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* 뷰 토글 */}
          <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            <button
              onClick={() => { setPageView('contacts'); if (formMode) { setFormMode(false); fetchContacts() } }}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                pageView === 'contacts'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <List className="h-4 w-4" />
              전체 연락처
            </button>
            <button
              onClick={() => setPageView('forms')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                pageView === 'forms'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              양식별 보기
            </button>
          </div>

          {pageView === 'contacts' && (
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
          )}

          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{syncing ? '동기화 중...' : '전체 동기화'}</span>
            <span className="sm:hidden">{syncing ? '...' : '동기화'}</span>
          </button>

          {pageView === 'contacts' && (
            <button
              onClick={handleImport}
              disabled={selected.size === 0 || importing}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 sm:px-4"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              <span className="hidden sm:inline">선택 가져오기</span> ({selected.size})
            </button>
          )}
        </div>
      </div>

      {/* ── 양식별 보기 ── */}
      {pageView === 'forms' && (
        <div>
          {/* 양식별 보기 툴바 */}
          {!loadingForms && forms.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {/* 검색 */}
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={formsSearch}
                  onChange={e => setFormsSearch(e.target.value)}
                  placeholder="양식명 검색..."
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {formsSearch && (
                  <button onClick={() => setFormsSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* 정렬 (카드뷰 전용 — 리스트뷰는 헤더 클릭) */}
              {formsViewMode === 'card' && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500">정렬:</span>
                  <button
                    onClick={() => handleFormsSort('name')}
                    className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      formsSortKey === 'name' ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    양식명 <FormsSortIcon col="name" />
                  </button>
                  <button
                    onClick={() => handleFormsSort('count')}
                    className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      formsSortKey === 'count' ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    제출 수 <FormsSortIcon col="count" />
                  </button>
                  <button
                    onClick={() => handleFormsSort('date')}
                    className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      formsSortKey === 'date' ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    생성일 <FormsSortIcon col="date" />
                  </button>
                </div>
              )}

              {/* 리스트/카드 토글 */}
              <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                <button
                  onClick={() => setFormsViewMode('card')}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    formsViewMode === 'card' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <LayoutGrid className="h-4 w-4" />
                  카드
                </button>
                <button
                  onClick={() => setFormsViewMode('list')}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    formsViewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <List className="h-4 w-4" />
                  리스트
                </button>
              </div>
            </div>
          )}

          {loadingForms ? (
            <div className="rounded-xl border border-gray-200 bg-white py-12 text-center shadow-sm">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" />
              <p className="mt-3 text-sm text-gray-500">양식 목록을 불러오는 중...</p>
            </div>
          ) : forms.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white py-12 text-center shadow-sm">
              <FileText className="mx-auto h-10 w-10 text-gray-300" />
              <h3 className="mt-4 text-base font-semibold text-gray-900">등록된 HubSpot 양식이 없습니다</h3>
              <p className="mt-2 text-sm text-gray-500">
                {formsWarning || 'HubSpot Private App에 "Forms" 스코프를 추가해주세요.'}
              </p>
            </div>
          ) : filteredSortedForms.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white py-8 text-center shadow-sm">
              <p className="text-sm text-gray-500">검색 결과가 없습니다.</p>
            </div>
          ) : formsViewMode === 'card' ? (
            /* 카드뷰 */
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredSortedForms.map((form) => (
                <button
                  key={form.id}
                  onClick={() => fetchFormSubmissions(form.id, form.name)}
                  className="group flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="rounded-lg bg-blue-50 p-2.5 group-hover:bg-blue-100">
                      <FileText className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex items-center gap-1">
                      {loadingCounts && formCounts[form.id] === undefined ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-300" />
                      ) : formCounts[form.id] !== undefined ? (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                          {formCounts[form.id].toLocaleString()}명
                        </span>
                      ) : null}
                      <ChevronRightIcon className="h-4 w-4 text-gray-300 group-hover:text-blue-400" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900 leading-snug">{form.name}</p>
                    {form.createdAt && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                        <Calendar className="h-3 w-3" />
                        {formatFormDate(form.createdAt)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-blue-600 group-hover:text-blue-700">
                    <Users className="h-3.5 w-3.5" />
                    제출자 연락처 보기
                  </div>
                </button>
              ))}
            </div>
          ) : (
            /* 리스트뷰 */
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 font-medium text-gray-600">
                      <button onClick={() => handleFormsSort('name')} className="inline-flex items-center hover:text-gray-900">
                        양식명 <FormsSortIcon col="name" />
                      </button>
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-600">
                      <button onClick={() => handleFormsSort('count')} className="inline-flex items-center hover:text-gray-900">
                        제출자 수 <FormsSortIcon col="count" />
                      </button>
                    </th>
                    <th className="hidden px-4 py-3 font-medium text-gray-600 sm:table-cell">
                      <button onClick={() => handleFormsSort('date')} className="inline-flex items-center hover:text-gray-900">
                        생성일 <FormsSortIcon col="date" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredSortedForms.map((form) => (
                    <tr key={form.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="rounded-lg bg-blue-50 p-1.5">
                            <FileText className="h-4 w-4 text-blue-600" />
                          </div>
                          <span className="font-medium text-gray-900">{form.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {loadingCounts && formCounts[form.id] === undefined ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
                        ) : formCounts[form.id] !== undefined ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                            <Users className="h-3 w-3" />
                            {formCounts[form.id].toLocaleString()}명
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 text-sm text-gray-500 sm:table-cell">
                        {formatFormDate(form.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => fetchFormSubmissions(form.id, form.name)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          <Users className="h-3.5 w-3.5" />
                          연락처 보기
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-gray-100 px-4 py-2.5 text-xs text-gray-500">
                총 {filteredSortedForms.length}개 양식
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 전체 연락처 뷰 ── */}
      {pageView === 'contacts' && (
        <>
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
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">라이프사이클 단계</label>
                  <select
                    value={lifecyclestage}
                    onChange={(e) => setLifecyclestage(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
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
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">등록일 (종료)</label>
                  <input
                    type="date"
                    value={createdBefore}
                    onChange={(e) => setCreatedBefore(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
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

                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-gray-600">카카오 친구:</span>
                  <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs">
                    {(['all', 'friend', 'non_friend'] as const).map(v => (
                      <button
                        key={v}
                        onClick={() => setKakaoFriendFilter(v)}
                        className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                          kakaoFriendFilter === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {v === 'all' ? '전체' : v === 'friend' ? '🟢 친구' : '🔴 비친구'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-gray-600">HubSpot 양식:</label>
                  {loadingForms ? (
                    <span className="text-xs text-gray-400">로딩 중...</span>
                  ) : forms.length > 0 ? (
                    <select
                      value={selectedForm}
                      onChange={(e) => handleFormSelect(e.target.value)}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
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
                  {selectedFormName || forms.find(f => f.id === selectedForm)?.name} 제출자를 표시하고 있습니다
                  <button onClick={() => handleFormSelect('')} className="ml-auto text-purple-500 underline hover:text-purple-700">해제</button>
                </div>
              )}
            </div>
          )}

          {/* 양식 모드 breadcrumb (필터 닫혀있을 때도 표시) */}
          {formMode && !showFilters && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-sm text-purple-700">
              <button
                onClick={() => setPageView('forms')}
                className="flex items-center gap-1 text-purple-500 hover:text-purple-700"
              >
                ← 양식 목록
              </button>
              <span className="text-purple-300">/</span>
              <span className="font-medium">{selectedFormName}</span>
              <button onClick={() => handleFormSelect('')} className="ml-auto text-purple-400 underline hover:text-purple-600">해제</button>
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
                      <p className="text-xs text-gray-500">승인된 템플릿으로 발송합니다</p>
                    </div>
                  </button>
                  <button onClick={handleGoToFriendtalk} className="flex w-full items-center gap-3 rounded-xl border-2 border-green-100 bg-green-50 px-4 py-3 text-left transition-colors hover:border-green-300 hover:bg-green-100">
                    <div className="rounded-lg bg-green-600 p-2"><MessageCircle className="h-5 w-5 text-white" /></div>
                    <div>
                      <p className="font-semibold text-gray-900">카카오 친구톡</p>
                      <p className="text-xs text-gray-500">채널 친구에게 자유 텍스트로 발송합니다</p>
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
                    <th className="px-4 py-3 font-medium text-gray-600">
                      <button onClick={() => handleSort('name')} className="inline-flex items-center hover:text-gray-900">
                        이름 <SortIcon column="name" />
                      </button>
                    </th>
                    <th className="hidden px-4 py-3 font-medium text-gray-600 sm:table-cell">
                      <button onClick={() => handleSort('email')} className="inline-flex items-center hover:text-gray-900">
                        이메일 <SortIcon column="email" />
                      </button>
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-600">
                      <button onClick={() => handleSort('phone')} className="inline-flex items-center hover:text-gray-900">
                        전화번호 <SortIcon column="phone" />
                      </button>
                    </th>
                    <th className="hidden px-4 py-3 font-medium text-gray-600 md:table-cell">
                      <button onClick={() => handleSort('company')} className="inline-flex items-center hover:text-gray-900">
                        회사 <SortIcon column="company" />
                      </button>
                    </th>
                    <th className="hidden px-4 py-3 font-medium text-gray-600 lg:table-cell">
                      <button onClick={() => handleSort('lifecyclestage')} className="inline-flex items-center hover:text-gray-900">
                        단계 <SortIcon column="lifecyclestage" />
                      </button>
                    </th>
                    <th className="hidden px-4 py-3 font-medium text-gray-600 sm:table-cell">
                      카카오
                    </th>
                    <th className="hidden px-4 py-3 font-medium text-gray-600 md:table-cell">
                      <button onClick={() => handleSort('createdate')} className="inline-flex items-center hover:text-gray-900">
                        <Calendar className="mr-1 h-3.5 w-3.5" />
                        등록일 <SortIcon column="createdate" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" />
                        <p className="mt-2 text-gray-500">
                          {syncing ? 'HubSpot 전체 동기화 중...' : formMode ? '양식 제출 데이터 불러오는 중...' : 'HubSpot 연락처를 불러오는 중...'}
                        </p>
                      </td>
                    </tr>
                  ) : contacts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center">
                        <Users className="mx-auto h-8 w-8 text-gray-400" />
                        <p className="mt-2 text-gray-500">{formMode ? '이 양식에 제출된 연락처가 없습니다.' : '조건에 맞는 연락처가 없습니다.'}</p>
                      </td>
                    </tr>
                  ) : (
                    sortedContacts.map((contact) => (
                      <tr key={contact.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={selected.has(contact.id)} onChange={() => toggleSelect(contact.id)} className="rounded border-gray-300" />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => openDrawer(contact)}
                            className="font-medium text-blue-600 hover:underline text-left"
                          >
                            {contact.properties.firstname || ''} {contact.properties.lastname || ''}
                          </button>
                        </td>
                        <td className="hidden px-4 py-3 text-gray-600 sm:table-cell">{contact.properties.email || '-'}</td>
                        <td className="px-4 py-3 text-gray-600">{contact.properties.phone || '-'}</td>
                        <td className="hidden px-4 py-3 text-gray-600 md:table-cell">{contact.properties.company || '-'}</td>
                        <td className="hidden px-4 py-3 lg:table-cell">
                          {contact.properties.lifecyclestage && (
                            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">{contact.properties.lifecyclestage}</span>
                          )}
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          {(() => {
                            const phone = contact.properties.phone ? normalizePhoneNumber(contact.properties.phone) : ''
                            const status = phone ? kakaoFriendStatuses[phone] : undefined
                            if (status === true) return <span className="text-sm" title="카카오 채널 친구">🟢</span>
                            if (status === false) return <span className="text-sm" title="카카오 채널 비친구">🔴</span>
                            return <span className="text-xs text-gray-300">-</span>
                          })()}
                        </td>
                        <td className="hidden px-4 py-3 text-xs text-gray-500 md:table-cell">
                          {formatDate(contact.properties.createdate)}
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
        </>
      )}

      {/* ── 연락처 상세 드로어 ── */}
      {drawerContact && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={closeDrawer}
          />
          {/* Panel */}
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                  {(drawerContact.properties.firstname?.[0] || drawerContact.properties.lastname?.[0] || '?').toUpperCase()}
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900">
                    {drawerContact.properties.firstname || ''} {drawerContact.properties.lastname || ''}
                  </h2>
                  <p className="text-xs text-gray-500">{drawerContact.properties.email || '이메일 없음'}</p>
                </div>
              </div>
              <button onClick={closeDrawer} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto">
              {/* Contact Info */}
              <div className="border-b border-gray-100 px-5 py-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">연락처 정보</h3>
                <dl className="space-y-2.5">
                  {drawerContact.properties.phone && (
                    <div className="flex items-center gap-2.5">
                      <PhoneIcon className="h-4 w-4 shrink-0 text-gray-400" />
                      <span className="text-sm text-gray-800">{formatPhoneDisplay(drawerContact.properties.phone)}</span>
                    </div>
                  )}
                  {drawerContact.properties.email && (
                    <div className="flex items-center gap-2.5">
                      <Mail className="h-4 w-4 shrink-0 text-gray-400" />
                      <span className="text-sm text-gray-800 break-all">{drawerContact.properties.email}</span>
                    </div>
                  )}
                  {drawerContact.properties.company && (
                    <div className="flex items-center gap-2.5">
                      <Building2 className="h-4 w-4 shrink-0 text-gray-400" />
                      <span className="text-sm text-gray-800">{drawerContact.properties.company}</span>
                    </div>
                  )}
                  {drawerContact.properties.lifecyclestage && (
                    <div className="flex items-center gap-2.5">
                      <Tag className="h-4 w-4 shrink-0 text-gray-400" />
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                        {drawerContact.properties.lifecyclestage}
                      </span>
                    </div>
                  )}
                  {drawerContact.properties.createdate && (
                    <div className="flex items-center gap-2.5">
                      <Calendar className="h-4 w-4 shrink-0 text-gray-400" />
                      <span className="text-sm text-gray-500">
                        {new Date(drawerContact.properties.createdate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} 등록
                      </span>
                    </div>
                  )}
                </dl>
              </div>

              {/* Kakao friend status */}
              {drawerContact.properties.phone && (() => {
                const phone = normalizePhoneNumber(drawerContact.properties.phone)
                const status = kakaoFriendStatuses[phone]
                if (status === undefined) return null
                return (
                  <div className="border-b border-gray-100 px-5 py-3">
                    <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                      status === true ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                      <span>{status === true ? '🟢' : '🔴'}</span>
                      <span className="font-medium">
                        {status === true ? '카카오 채널 친구' : '카카오 채널 비친구'}
                      </span>
                    </div>
                  </div>
                )
              })()}

              {/* Action Buttons */}
              <div className="border-b border-gray-100 px-5 py-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">메시지 발송</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const phone = drawerContact.properties.phone || ''
                      const name = `${drawerContact.properties.firstname || ''} ${drawerContact.properties.lastname || ''}`.trim()
                      router.push(`/messages/compose?phones=${encodeURIComponent(phone)}&names=${encodeURIComponent(name)}`)
                    }}
                    disabled={!drawerContact.properties.phone}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
                  >
                    <MessageSquare className="h-4 w-4" />
                    문자 발송
                  </button>
                  <button
                    onClick={() => {
                      const phone = drawerContact.properties.phone || ''
                      router.push(`/kakao/send?phones=${encodeURIComponent(phone)}`)
                    }}
                    disabled={!drawerContact.properties.phone}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-yellow-500 px-3 py-2.5 text-sm font-medium text-white hover:bg-yellow-600 disabled:opacity-40"
                  >
                    <MessageCircle className="h-4 w-4" />
                    알림톡
                  </button>
                  <button
                    onClick={() => {
                      const phone = drawerContact.properties.phone || ''
                      const name = `${drawerContact.properties.firstname || ''} ${drawerContact.properties.lastname || ''}`.trim()
                      router.push(`/kakao/friendtalk?phones=${encodeURIComponent(phone)}&names=${encodeURIComponent(name)}`)
                    }}
                    disabled={!drawerContact.properties.phone}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40"
                  >
                    <MessageCircle className="h-4 w-4" />
                    친구톡
                  </button>
                </div>
              </div>

              {/* Message History */}
              <div className="px-5 py-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  발송 내역
                  {drawerLogs.length > 0 && (
                    <span className="ml-2 rounded-full bg-gray-200 px-1.5 py-0.5 text-xs font-normal text-gray-600">{drawerLogs.length}</span>
                  )}
                </h3>

                {drawerLogsLoading ? (
                  <div className="py-6 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" />
                    <p className="mt-2 text-xs text-gray-500">발송 내역 조회 중...</p>
                  </div>
                ) : !drawerContact.properties.phone ? (
                  <p className="py-4 text-sm text-gray-400">전화번호가 없어 발송 내역을 조회할 수 없습니다.</p>
                ) : drawerLogs.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 py-6 text-center">
                    <MessageSquare className="mx-auto h-6 w-6 text-gray-300" />
                    <p className="mt-2 text-sm text-gray-400">발송 내역이 없습니다.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {drawerLogs.map((log) => {
                      const isKakao = log.type === 'KAKAO'
                      const statusIcon = log.status === 'delivered' ? CheckCircle
                        : log.status === 'sent' ? CheckCircle
                        : log.status === 'failed' ? XCircle
                        : log.status === 'pending' ? Clock
                        : AlertCircle
                      const StatusIcon = statusIcon
                      const statusColor = log.status === 'delivered' ? 'text-green-600'
                        : log.status === 'sent' ? 'text-blue-600'
                        : log.status === 'failed' ? 'text-red-500'
                        : 'text-gray-400'
                      const date = log.sent_at || log.created_at
                      return (
                        <div key={log.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${isKakao ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                                {isKakao ? '알림톡' : log.type}
                              </span>
                              {log.message_campaigns?.name && (
                                <span className="truncate text-xs text-gray-500">{log.message_campaigns.name}</span>
                              )}
                            </div>
                            <div className={`flex items-center gap-1 text-xs font-medium ${statusColor}`}>
                              <StatusIcon className="h-3.5 w-3.5" />
                              {log.status}
                            </div>
                          </div>
                          {log.content && (
                            <p className="mb-1.5 line-clamp-2 text-xs text-gray-700">{log.content}</p>
                          )}
                          {log.error_message && (
                            <p className="mb-1 text-xs text-red-500">{log.error_message}</p>
                          )}
                          <p className="text-right text-xs text-gray-400">
                            {new Date(date).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
