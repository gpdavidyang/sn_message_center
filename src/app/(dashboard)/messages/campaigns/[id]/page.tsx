'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, ArrowLeft, Download } from 'lucide-react'
import Link from 'next/link'
import { formatPhoneDisplay } from '@/lib/utils/phone'

interface CampaignDetail {
  id: string
  name: string
  type: string
  status: string
  content: string
  sender_number: string
  total_count: number
  success_count: number
  fail_count: number
  sent_at: string | null
  scheduled_at: string | null
  created_at: string
}

interface MessageLog {
  id: string
  recipient_phone: string
  type: string
  status: string
  sent_at: string | null
  error_message: string | null
}

export default function CampaignDetailPage() {
  const { id } = useParams()
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null)
  const [logs, setLogs] = useState<MessageLog[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const fetch = async () => {
      const { data: c } = await supabase
        .from('message_campaigns')
        .select('*')
        .eq('id', id)
        .single()

      const { data: l } = await supabase
        .from('message_logs')
        .select('*')
        .eq('campaign_id', id)
        .order('created_at', { ascending: false })

      setCampaign(c)
      setLogs(l || [])
      setLoading(false)
    }
    fetch()
  }, [id])

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch(`/api/campaigns/export?campaignId=${id}`)
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `campaign_${id}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!campaign) {
    return <p className="text-gray-500">캠페인을 찾을 수 없습니다.</p>
  }

  const statusLabel: Record<string, string> = {
    draft: '초안', sending: '발송 중', completed: '완료', failed: '실패', scheduled: '예약됨',
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link href="/messages/campaigns" className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" /> 캠페인 목록으로
        </Link>
        <button
          onClick={handleExport}
          disabled={exporting || logs.length === 0}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {exporting ? '내보내기 중...' : 'CSV 내보내기'}
        </button>
      </div>

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">{campaign.name}</h2>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${
            campaign.status === 'completed' ? 'bg-green-100 text-green-700' :
            campaign.status === 'scheduled' ? 'bg-purple-100 text-purple-700' :
            campaign.status === 'failed' ? 'bg-red-100 text-red-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {statusLabel[campaign.status] || campaign.status}
          </span>
        </div>
        {campaign.status === 'scheduled' && campaign.scheduled_at && (
          <p className="mt-2 text-sm text-purple-600">
            예약 발송: {new Date(campaign.scheduled_at!).toLocaleString('ko-KR')}
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <span className="text-gray-500">유형</span>
            <p className="font-medium text-gray-900">{campaign.type}</p>
          </div>
          <div>
            <span className="text-gray-500">총 발송</span>
            <p className="font-medium text-gray-900">{campaign.total_count}건</p>
          </div>
          <div>
            <span className="text-gray-500">성공</span>
            <p className="font-medium text-green-600">{campaign.success_count}건</p>
          </div>
          <div>
            <span className="text-gray-500">실패</span>
            <p className="font-medium text-red-600">{campaign.fail_count}건</p>
          </div>
        </div>
        {campaign.content && (
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-medium text-gray-500">메시지 내용</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-900">{campaign.content}</p>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h3 className="font-semibold text-gray-900">발송 로그 ({logs.length}건)</h3>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-600">수신번호</th>
              <th className="px-4 py-3 font-medium text-gray-600">유형</th>
              <th className="px-4 py-3 font-medium text-gray-600">상태</th>
              <th className="px-4 py-3 font-medium text-gray-600">발송 시각</th>
              <th className="px-4 py-3 font-medium text-gray-600">에러</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-gray-100">
                <td className="px-4 py-3 text-gray-900">{formatPhoneDisplay(log.recipient_phone)}</td>
                <td className="px-4 py-3 text-gray-600">{log.type}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    log.status === 'delivered' || log.status === 'sent' ? 'bg-green-100 text-green-700' :
                    log.status === 'failed' ? 'bg-red-100 text-red-700' :
                    log.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {log.status === 'sent' ? '발송됨' :
                     log.status === 'delivered' ? '전달됨' :
                     log.status === 'pending' ? '대기중' :
                     log.status === 'failed' ? '실패' : log.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {log.sent_at ? new Date(log.sent_at).toLocaleString('ko-KR') : '-'}
                </td>
                <td className="px-4 py-3 text-red-500">{log.error_message || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
