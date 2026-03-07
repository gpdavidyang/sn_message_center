'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  MessageSquare,
  CheckCircle,
  XCircle,
  Wallet,
  Users,
  Clock,
  TrendingUp,
  Loader2,
  Send,
} from 'lucide-react'

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

interface DailyStats {
  date: string
  count: number
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [totalCampaigns, setTotalCampaigns] = useState(0)
  const [totalSent, setTotalSent] = useState(0)
  const [totalFailed, setTotalFailed] = useState(0)
  const [totalContacts, setTotalContacts] = useState(0)
  const [scheduledCount, setScheduledCount] = useState(0)
  const [recentCampaigns, setRecentCampaigns] = useState<Campaign[]>([])
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
  const [balance, setBalance] = useState<string | null>(null)
  const [loadingBalance, setLoadingBalance] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    const fetchAll = async () => {
      try {
        // Campaigns
        const { count: campCount } = await supabase
          .from('message_campaigns')
          .select('*', { count: 'exact', head: true })

        // Sent logs
        const { count: sentCount } = await supabase
          .from('message_logs')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'sent')

        // Failed logs
        const { count: failCount } = await supabase
          .from('message_logs')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'failed')

        // Contacts
        const { count: contactCount } = await supabase
          .from('contacts')
          .select('*', { count: 'exact', head: true })

        // Scheduled
        const { count: schedCount } = await supabase
          .from('message_campaigns')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'scheduled')

        // Recent campaigns
        const { data: recent } = await supabase
          .from('message_campaigns')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5)

        // Daily stats (last 7 days)
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        const { data: logs } = await supabase
          .from('message_logs')
          .select('sent_at')
          .gte('sent_at', sevenDaysAgo.toISOString())
          .not('sent_at', 'is', null)

        // Aggregate by date
        const dayMap: Record<string, number> = {}
        for (let i = 6; i >= 0; i--) {
          const d = new Date()
          d.setDate(d.getDate() - i)
          const key = d.toISOString().split('T')[0]
          dayMap[key] = 0
        }
        (logs || []).forEach(l => {
          if (l.sent_at) {
            const key = new Date(l.sent_at).toISOString().split('T')[0]
            if (key in dayMap) dayMap[key]++
          }
        })
        const daily = Object.entries(dayMap).map(([date, count]) => ({ date, count }))

        setTotalCampaigns(campCount || 0)
        setTotalSent(sentCount || 0)
        setTotalFailed(failCount || 0)
        setTotalContacts(contactCount || 0)
        setScheduledCount(schedCount || 0)
        setRecentCampaigns(recent || [])
        setDailyStats(daily)
      } catch (err) {
        console.error('Dashboard fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  const fetchBalance = async () => {
    setLoadingBalance(true)
    try {
      const res = await fetch('/api/solapi/balance')
      const data = await res.json()
      if (data.balance !== undefined) {
        setBalance(`${Number(data.balance).toLocaleString()}원`)
      } else {
        setBalance('조회 실패')
      }
    } catch {
      setBalance('조회 실패')
    } finally {
      setLoadingBalance(false)
    }
  }

  const successRate = totalSent + totalFailed > 0
    ? Math.round((totalSent / (totalSent + totalFailed)) * 100)
    : 0

  const maxDailyCount = Math.max(...dailyStats.map(d => d.count), 1)

  const statusColors: Record<string, string> = {
    completed: 'bg-green-100 text-green-700',
    sending: 'bg-yellow-100 text-yellow-700',
    scheduled: 'bg-purple-100 text-purple-700',
    failed: 'bg-red-100 text-red-700',
    draft: 'bg-gray-100 text-gray-700',
  }
  const statusLabels: Record<string, string> = {
    completed: '완료', sending: '발송 중', scheduled: '예약됨', failed: '실패', draft: '초안',
  }

  if (loading) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" />
        <p className="mt-2 text-sm text-gray-500">대시보드 로딩 중...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">안녕하세요! M-Keter Message Center입니다.</h2>
        <p className="mt-1 text-sm text-gray-600 sm:text-base">메시지 발송 현황을 한눈에 확인하세요.</p>
      </div>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:gap-4 lg:grid-cols-5">
        {[
          { title: '총 캠페인', value: totalCampaigns, icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-50' },
          { title: '발송 성공', value: totalSent, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
          { title: '발송 실패', value: totalFailed, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
          { title: '연락처', value: totalContacts, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { title: '예약 대기', value: scheduledCount, icon: Clock, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map((card) => (
          <div key={card.title} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-5">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={`rounded-lg p-2 sm:p-2.5 ${card.bg}`}>
                <card.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${card.color}`} />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 sm:text-xs">{card.title}</p>
                <p className="text-lg font-bold text-gray-900 sm:text-xl">{card.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Left: Chart + Success Rate */}
        <div className="space-y-4 sm:space-y-6 lg:col-span-2">
          {/* Daily chart */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">최근 7일 발송 추이</h3>
            </div>
            <div className="flex items-end gap-2" style={{ height: '160px' }}>
              {dailyStats.map((d) => (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-xs font-medium text-gray-600">{d.count}</span>
                  <div
                    className="w-full rounded-t-md bg-blue-500 transition-all"
                    style={{
                      height: `${Math.max((d.count / maxDailyCount) * 120, 4)}px`,
                    }}
                  />
                  <span className="text-[10px] text-gray-400">
                    {new Date(d.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Success rate + SOLAPI balance */}
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
              <h4 className="mb-3 text-sm font-medium text-gray-500">발송 성공률</h4>
              <div className="flex items-center gap-4">
                <div className="relative h-20 w-20">
                  <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none" stroke="#e5e7eb" strokeWidth="3"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none" stroke={successRate >= 90 ? '#22c55e' : successRate >= 70 ? '#eab308' : '#ef4444'}
                      strokeWidth="3" strokeDasharray={`${successRate}, 100`}
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-gray-900">
                    {successRate}%
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  <p>성공: <span className="font-medium text-green-600">{totalSent}</span></p>
                  <p>실패: <span className="font-medium text-red-600">{totalFailed}</span></p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
              <h4 className="mb-3 text-sm font-medium text-gray-500">SOLAPI 잔액</h4>
              {balance ? (
                <p className="text-2xl font-bold text-gray-900">{balance}</p>
              ) : (
                <button
                  onClick={fetchBalance}
                  disabled={loadingBalance}
                  className="flex items-center gap-2 rounded-lg bg-purple-50 px-4 py-2.5 text-sm font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50"
                >
                  {loadingBalance ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                  {loadingBalance ? '조회 중...' : '잔액 조회'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Recent campaigns */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">최근 캠페인</h3>
            <Link href="/messages/campaigns" className="text-xs text-blue-600 hover:underline">전체 보기</Link>
          </div>
          {recentCampaigns.length === 0 ? (
            <div className="py-8 text-center">
              <Send className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-2 text-sm text-gray-500">아직 캠페인이 없습니다.</p>
              <Link
                href="/messages/compose"
                className="mt-3 inline-block rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
              >
                첫 메시지 보내기
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentCampaigns.map(c => (
                <Link
                  key={c.id}
                  href={`/messages/campaigns/${c.id}`}
                  className="block rounded-lg border border-gray-100 p-3 transition-colors hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors[c.status] || 'bg-gray-100 text-gray-600'}`}>
                      {statusLabels[c.status] || c.status}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                    <span>{c.type}</span>
                    <span>{c.total_count}건</span>
                    <span>
                      {c.sent_at
                        ? new Date(c.sent_at).toLocaleDateString('ko-KR')
                        : c.scheduled_at
                          ? `📅 ${new Date(c.scheduled_at).toLocaleDateString('ko-KR')}`
                          : new Date(c.created_at).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
