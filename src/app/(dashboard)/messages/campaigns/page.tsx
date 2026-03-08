'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  MessageSquare, MessageCircle, Loader2, Search, Filter, X,
  PenLine, Send,
} from 'lucide-react'
import Link from 'next/link'

interface Campaign {
  id: string
  name: string
  type: string
  status: string
  total_count: number
  success_count: number
  fail_count: number
  sent_at: string | null
  scheduled_at: string | null
  created_at: string
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sending: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  scheduled: 'bg-purple-100 text-purple-700',
}

const statusLabels: Record<string, string> = {
  draft: '초안',
  sending: '발송 중',
  completed: '완료',
  failed: '실패',
  scheduled: '예약됨',
}

function TypeBadge({ type }: { type: string }) {
  switch (type) {
    case 'SMS':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
          <MessageSquare className="h-3 w-3" /> SMS
        </span>
      )
    case 'LMS':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
          <MessageSquare className="h-3 w-3" /> LMS
        </span>
      )
    case 'KAKAO':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
          <MessageCircle className="h-3 w-3" /> 알림톡
        </span>
      )
    default:
      return <span className="text-xs text-gray-500">{type}</span>
  }
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [filtered, setFiltered] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const fetchCampaigns = async () => {
      const { data } = await supabase
        .from('message_campaigns')
        .select('*')
        .order('created_at', { ascending: false })
      setCampaigns(data || [])
      setFiltered(data || [])
      setLoading(false)
    }
    fetchCampaigns()
  }, [supabase])

  useEffect(() => {
    let result = [...campaigns]
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(c => c.name.toLowerCase().includes(q))
    }
    if (statusFilter !== 'all') result = result.filter(c => c.status === statusFilter)
    if (typeFilter !== 'all') result = result.filter(c => c.type === typeFilter)
    if (dateFrom) result = result.filter(c => (c.sent_at || c.created_at) >= dateFrom)
    if (dateTo) result = result.filter(c => (c.sent_at || c.created_at) <= dateTo + 'T23:59:59')
    setFiltered(result)
  }, [campaigns, searchQuery, statusFilter, typeFilter, dateFrom, dateTo])

  const activeFilterCount = [
    statusFilter !== 'all',
    typeFilter !== 'all',
    !!dateFrom,
    !!dateTo,
  ].filter(Boolean).length

  const clearFilters = () => {
    setSearchQuery(''); setStatusFilter('all'); setTypeFilter('all'); setDateFrom(''); setDateTo('')
  }

  const formatDate = (c: Campaign) => {
    if (c.status === 'scheduled' && c.scheduled_at) {
      return `📅 ${new Date(c.scheduled_at).toLocaleString('ko-KR')}`
    }
    if (c.sent_at) return new Date(c.sent_at).toLocaleDateString('ko-KR')
    return new Date(c.created_at).toLocaleDateString('ko-KR')
  }

  if (loading) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div>
      {/* Quick action buttons */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link
          href="/messages/compose"
          className="flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
        >
          <PenLine className="h-4 w-4" /> 문자(SMS/LMS) 작성
        </Link>
        <Link
          href="/kakao/send"
          className="flex items-center gap-1.5 rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm font-medium text-yellow-700 hover:bg-yellow-100"
        >
          <Send className="h-4 w-4" /> 알림톡 발송
        </Link>
      </div>

      {/* Search & Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="캠페인 이름으로 검색..."
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
            showFilters || activeFilterCount > 0
              ? 'border-blue-300 bg-blue-50 text-blue-700'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Filter className="h-4 w-4" />
          필터
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-xs text-white">{activeFilterCount}</span>
          )}
        </button>
        {activeFilterCount > 0 && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-500">
            <X className="h-3.5 w-3.5" /> 초기화
          </button>
        )}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">상태</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">전체</option>
              <option value="completed">완료</option>
              <option value="sending">발송 중</option>
              <option value="scheduled">예약됨</option>
              <option value="failed">실패</option>
              <option value="draft">초안</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">유형</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">전체</option>
              <option value="SMS">SMS</option>
              <option value="LMS">LMS</option>
              <option value="KAKAO">카카오 알림톡</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">시작일</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">종료일</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Stats row */}
      {campaigns.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
          <span>총 {filtered.length}건{filtered.length !== campaigns.length && ` (전체 ${campaigns.length}건 중)`}</span>
          <span className="text-gray-300">|</span>
          <span className="text-blue-600">SMS {campaigns.filter(c => c.type === 'SMS').length}</span>
          <span className="text-indigo-600">LMS {campaigns.filter(c => c.type === 'LMS').length}</span>
          <span className="text-yellow-600">알림톡 {campaigns.filter(c => c.type === 'KAKAO').length}</span>
        </div>
      )}

      {campaigns.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-12 text-center shadow-sm">
          <div className="flex items-center justify-center gap-3">
            <MessageSquare className="h-8 w-8 text-gray-300" />
            <MessageCircle className="h-8 w-8 text-gray-300" />
          </div>
          <p className="mt-3 text-gray-500">아직 발송 내역이 없습니다.</p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Link href="/messages/compose" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              문자 작성하기
            </Link>
            <Link href="/kakao/send" className="rounded-lg bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600">
              알림톡 발송하기
            </Link>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-12 text-center shadow-sm">
          <Search className="mx-auto h-10 w-10 text-gray-400" />
          <p className="mt-2 text-gray-500">검색 결과가 없습니다.</p>
        </div>
      ) : (
        <>
          {/* Mobile: Card layout */}
          <div className="space-y-3 sm:hidden">
            {filtered.map((c) => (
              <Link
                key={c.id}
                href={`/messages/campaigns/${c.id}`}
                className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:bg-gray-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-medium text-gray-900">{c.name}</p>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusColors[c.status] || ''}`}>
                    {statusLabels[c.status] || c.status}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <TypeBadge type={c.type} />
                  <span className="text-xs text-gray-500">{c.total_count}건</span>
                  <span className="text-xs text-green-600">✓ {c.success_count}</span>
                  <span className="text-xs text-red-500">✗ {c.fail_count}</span>
                </div>
                <p className="mt-1 text-xs text-gray-400">{formatDate(c)}</p>
              </Link>
            ))}
          </div>

          {/* Desktop: Table layout */}
          <div className="hidden rounded-xl border border-gray-200 bg-white shadow-sm sm:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 font-medium text-gray-600">캠페인명</th>
                    <th className="px-4 py-3 font-medium text-gray-600">유형</th>
                    <th className="px-4 py-3 font-medium text-gray-600">상태</th>
                    <th className="px-4 py-3 font-medium text-gray-600">발송</th>
                    <th className="hidden px-4 py-3 font-medium text-gray-600 md:table-cell">성공 / 실패</th>
                    <th className="hidden px-4 py-3 font-medium text-gray-600 lg:table-cell">발송일</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/messages/campaigns/${c.id}`} className="font-medium text-blue-600 hover:underline">
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <TypeBadge type={c.type} />
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusColors[c.status] || ''}`}>
                          {statusLabels[c.status] || c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{c.total_count}건</td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <span className="text-green-600">{c.success_count}</span>
                        <span className="mx-1 text-gray-300">/</span>
                        <span className="text-red-500">{c.fail_count}</span>
                      </td>
                      <td className="hidden px-4 py-3 text-sm text-gray-500 lg:table-cell">
                        {formatDate(c)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
