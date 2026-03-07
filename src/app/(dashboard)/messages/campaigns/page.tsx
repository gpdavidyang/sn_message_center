'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageSquare, Loader2, Search, Filter, X } from 'lucide-react'
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
  }, [])

  // Apply filters
  useEffect(() => {
    let result = [...campaigns]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(c => c.name.toLowerCase().includes(q))
    }
    if (statusFilter !== 'all') {
      result = result.filter(c => c.status === statusFilter)
    }
    if (typeFilter !== 'all') {
      result = result.filter(c => c.type === typeFilter)
    }
    if (dateFrom) {
      result = result.filter(c => {
        const d = c.sent_at || c.created_at
        return d >= dateFrom
      })
    }
    if (dateTo) {
      result = result.filter(c => {
        const d = c.sent_at || c.created_at
        return d <= dateTo + 'T23:59:59'
      })
    }
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

  if (loading) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div>
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

      {/* Results count */}
      <div className="mb-3 text-sm text-gray-500">
        총 {filtered.length}개 캠페인
        {filtered.length !== campaigns.length && ` (전체 ${campaigns.length}개 중)`}
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-12 text-center shadow-sm">
          <MessageSquare className="mx-auto h-10 w-10 text-gray-400" />
          <p className="mt-2 text-gray-500">아직 캠페인이 없습니다.</p>
          <Link href="/messages/compose" className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            메시지 작성하기
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-12 text-center shadow-sm">
          <Search className="mx-auto h-10 w-10 text-gray-400" />
          <p className="mt-2 text-gray-500">검색 결과가 없습니다.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-600">캠페인명</th>
                <th className="px-4 py-3 font-medium text-gray-600">유형</th>
                <th className="px-4 py-3 font-medium text-gray-600">상태</th>
                <th className="px-4 py-3 font-medium text-gray-600">발송</th>
                <th className="px-4 py-3 font-medium text-gray-600">성공/실패</th>
                <th className="px-4 py-3 font-medium text-gray-600">발송일</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/messages/campaigns/${c.id}`} className="font-medium text-blue-600 hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.type}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusColors[c.status] || ''}`}>
                      {statusLabels[c.status] || c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.total_count}건</td>
                  <td className="px-4 py-3 text-gray-600">
                    <span className="text-green-600">{c.success_count}</span>
                    {' / '}
                    <span className="text-red-600">{c.fail_count}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {c.status === 'scheduled' && c.scheduled_at
                      ? `📅 ${new Date(c.scheduled_at).toLocaleString('ko-KR')}`
                      : c.sent_at
                        ? new Date(c.sent_at).toLocaleDateString('ko-KR')
                        : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
