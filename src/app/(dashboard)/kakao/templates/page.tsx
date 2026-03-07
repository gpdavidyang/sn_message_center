'use client'

import { useState, useEffect } from 'react'
import { MessageCircle, Loader2, RefreshCw, ExternalLink, CheckCircle, Clock, XCircle, AlertTriangle } from 'lucide-react'

interface KakaoButton {
  type: string
  name: string
  linkMo?: string
  linkPc?: string
}

interface KakaoTemplate {
  templateId: string
  name: string
  content: string
  buttons?: KakaoButton[]
  status: string
  inspectionStatus?: string
  dateCreated?: string
  dateUpdated?: string
}

const statusBadge = (status: string) => {
  switch (status?.toUpperCase()) {
    case 'APPROVED':
    case 'APR':
      return { label: '승인됨', color: 'bg-green-100 text-green-700', icon: CheckCircle }
    case 'PENDING':
    case 'REG':
      return { label: '검수 중', color: 'bg-yellow-100 text-yellow-700', icon: Clock }
    case 'REJECTED':
    case 'REJ':
      return { label: '반려됨', color: 'bg-red-100 text-red-700', icon: XCircle }
    default:
      return { label: status || '알 수 없음', color: 'bg-gray-100 text-gray-700', icon: AlertTriangle }
  }
}

export default function KakaoTemplatesPage() {
  const [templates, setTemplates] = useState<KakaoTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pfId, setPfId] = useState('')

  const fetchTemplates = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/kakao/templates')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setTemplates(data.templates || [])
      if (data.pfId) setPfId(data.pfId)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '템플릿 조회에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">카카오 알림톡 템플릿</h2>
          {pfId && <p className="mt-1 text-xs text-gray-500">채널 ID: {pfId}</p>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchTemplates}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
          <a
            href="https://console.solapi.com/kakao"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-yellow-500 px-3 py-2 text-sm font-medium text-white hover:bg-yellow-600"
          >
            <ExternalLink className="h-4 w-4" />
            SOLAPI 콘솔
          </a>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
          <button onClick={() => setError('')} className="ml-3 font-bold underline">닫기</button>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white py-12 text-center shadow-sm">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" />
          <p className="mt-3 text-sm text-gray-500">템플릿을 불러오는 중...</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-12 text-center shadow-sm">
          <MessageCircle className="mx-auto h-10 w-10 text-yellow-500" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900">등록된 템플릿이 없습니다</h3>
          <p className="mt-2 text-sm text-gray-500">
            SOLAPI 콘솔에서 카카오 채널을 연동하고 알림톡 템플릿을 등록해주세요.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((tpl) => {
            const badge = statusBadge(tpl.inspectionStatus || tpl.status)
            const BadgeIcon = badge.icon
            return (
              <div
                key={tpl.templateId}
                className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                {/* Card Header */}
                <div className="border-b border-gray-100 px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">{tpl.name}</h3>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${badge.color}`}>
                      <BadgeIcon className="h-3 w-3" />
                      {badge.label}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">ID: {tpl.templateId}</p>
                </div>

                {/* Card Body - Message Preview */}
                <div className="flex-1 px-4 py-3">
                  <div className="rounded-lg bg-yellow-50 p-3">
                    <pre className="whitespace-pre-wrap text-xs leading-relaxed text-gray-800">{tpl.content}</pre>
                  </div>

                  {/* Buttons */}
                  {tpl.buttons && tpl.buttons.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {tpl.buttons.map((btn, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-center rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-1.5 text-xs font-medium text-yellow-800"
                        >
                          {btn.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div className="border-t border-gray-100 px-4 py-2.5 text-xs text-gray-400">
                  등록: {formatDate(tpl.dateCreated)} | 수정: {formatDate(tpl.dateUpdated)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
