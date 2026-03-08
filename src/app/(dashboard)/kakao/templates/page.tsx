'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  MessageCircle, Loader2, RefreshCw, ExternalLink,
  CheckCircle, Clock, XCircle, AlertTriangle,
  LayoutGrid, List, Send, Plus, Pencil, Trash2,
  X, ClipboardCheck, ChevronDown, ChevronUp, Copy,
} from 'lucide-react'

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
  categoryCode?: string
  dateCreated?: string
  dateUpdated?: string
  comments?: string[]
}

const CATEGORY_OPTIONS = [
  { code: '001', label: '일반' },
  { code: '002', label: '주문' },
  { code: '003', label: '결제' },
  { code: '004', label: '공지' },
  { code: '005', label: '이벤트' },
  { code: '006', label: '예약' },
  { code: '007', label: '기타' },
]

const BUTTON_TYPES = [
  { value: 'WL', label: '웹링크 (WL)' },
  { value: 'AL', label: '앱링크 (AL)' },
  { value: 'BK', label: '봇키워드 (BK)' },
  { value: 'MD', label: '메시지전달 (MD)' },
  { value: 'DS', label: '배송조회 (DS)' },
  { value: 'BC', label: '상담톡전환 (BC)' },
  { value: 'BT', label: '봇전환 (BT)' },
]

const statusBadge = (status: string) => {
  switch (status?.toUpperCase()) {
    case 'APPROVED': case 'APR':
      return { label: '승인됨', color: 'bg-green-100 text-green-700', icon: CheckCircle }
    case 'PENDING': case 'REG':
      return { label: '검수 중', color: 'bg-yellow-100 text-yellow-700', icon: Clock }
    case 'REJECTED': case 'REJ':
      return { label: '반려됨', color: 'bg-red-100 text-red-700', icon: XCircle }
    default:
      return { label: status || '알 수 없음', color: 'bg-gray-100 text-gray-700', icon: AlertTriangle }
  }
}

const isApproved = (tpl: KakaoTemplate) => {
  const s = (tpl.inspectionStatus || tpl.status || '').toUpperCase()
  return s === 'APPROVED' || s === 'APR'
}
const isEditable = (tpl: KakaoTemplate) => {
  const s = (tpl.inspectionStatus || tpl.status || '').toUpperCase()
  // Can edit if not approved (REG/REJ/UNREGISTERED)
  return s !== 'APPROVED' && s !== 'APR'
}
const canRequestApproval = (tpl: KakaoTemplate) => {
  const s = (tpl.inspectionStatus || tpl.status || '').toUpperCase()
  return s === 'REG' || s === 'PENDING' || s === 'REJ' || s === 'REJECTED' || s === 'UNREGISTERED' || s === 'UNREG'
}

const emptyForm = () => ({
  name: '',
  content: '',
  categoryCode: '004',
  buttons: [] as KakaoButton[],
})

export default function KakaoTemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<KakaoTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list')

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<KakaoTemplate | null>(null)
  const [isDuplicate, setIsDuplicate] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState('')

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Approval request
  const [requestingId, setRequestingId] = useState<string | null>(null)

  // Expanded comments (for rejection reason)
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())

  const fetchTemplates = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/kakao/templates')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setTemplates(data.templates || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '템플릿 조회에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTemplates() }, [])

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  // ─── Modal ───
  const openCreate = () => {
    setEditingTemplate(null)
    setIsDuplicate(false)
    setForm(emptyForm())
    setModalError('')
    setShowModal(true)
  }

  const openEdit = (tpl: KakaoTemplate) => {
    setEditingTemplate(tpl)
    setIsDuplicate(false)
    setForm({
      name: tpl.name,
      content: tpl.content,
      categoryCode: tpl.categoryCode || '004',
      buttons: tpl.buttons ? [...tpl.buttons.map(b => ({ ...b }))] : [],
    })
    setModalError('')
    setShowModal(true)
  }

  const openDuplicate = (tpl: KakaoTemplate) => {
    setEditingTemplate(null)   // null → POST (새 템플릿으로 생성)
    setIsDuplicate(true)
    setForm({
      name: `${tpl.name} (복사)`,
      content: tpl.content,
      categoryCode: tpl.categoryCode || '004',
      buttons: tpl.buttons ? [...tpl.buttons.map(b => ({ ...b }))] : [],
    })
    setModalError('')
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingTemplate(null)
    setIsDuplicate(false)
    setModalError('')
  }

  const addButton = () => {
    if (form.buttons.length >= 5) return
    setForm(f => ({ ...f, buttons: [...f.buttons, { type: 'WL', name: '', linkMo: '', linkPc: '' }] }))
  }

  const updateButton = (idx: number, field: keyof KakaoButton, value: string) => {
    setForm(f => {
      const buttons = [...f.buttons]
      buttons[idx] = { ...buttons[idx], [field]: value }
      return { ...f, buttons }
    })
  }

  const removeButton = (idx: number) => {
    setForm(f => ({ ...f, buttons: f.buttons.filter((_, i) => i !== idx) }))
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.content.trim() || !form.categoryCode) {
      setModalError('이름, 내용, 카테고리를 모두 입력해주세요.')
      return
    }
    setSaving(true)
    setModalError('')
    try {
      const payload = {
        name: form.name.trim(),
        content: form.content.trim(),
        categoryCode: form.categoryCode,
        buttons: form.buttons.filter(b => b.name.trim()),
        ...(editingTemplate ? { templateId: editingTemplate.templateId } : {}),
      }
      const res = await fetch('/api/kakao/templates', {
        method: editingTemplate ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      closeModal()
      fetchTemplates()
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // ─── Delete ───
  const handleDelete = async (templateId: string) => {
    setDeleting(true)
    try {
      const res = await fetch('/api/kakao/templates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setDeletingId(null)
      fetchTemplates()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '삭제에 실패했습니다.')
      setDeletingId(null)
    } finally {
      setDeleting(false)
    }
  }

  // ─── Request Approval ───
  const handleRequestApproval = async (templateId: string) => {
    setRequestingId(templateId)
    try {
      const res = await fetch('/api/kakao/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', templateId }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      fetchTemplates()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '검수 요청에 실패했습니다.')
    } finally {
      setRequestingId(null)
    }
  }

  const toggleComments = (templateId: string) => {
    setExpandedComments(prev => {
      const next = new Set(prev)
      if (next.has(templateId)) next.delete(templateId)
      else next.add(templateId)
      return next
    })
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold text-gray-900">카카오 알림톡 템플릿</h2>
        <div className="flex flex-wrap items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <List className="h-4 w-4" /> 리스트
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'card' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <LayoutGrid className="h-4 w-4" /> 카드
            </button>
          </div>
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
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <ExternalLink className="h-4 w-4" /> SOLAPI 콘솔
          </a>
          <button
            onClick={() => router.push('/kakao/send')}
            className="flex items-center gap-1.5 rounded-lg bg-yellow-500 px-3 py-2 text-sm font-medium text-white hover:bg-yellow-600"
          >
            <Send className="h-4 w-4" /> 알림톡 발송
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            <Plus className="h-4 w-4" /> 새 템플릿
          </button>
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
          <p className="mt-2 text-sm text-gray-500">새 템플릿을 만들어 SOLAPI에 등록하세요.</p>
          <button
            onClick={openCreate}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            <Plus className="h-4 w-4" /> 새 템플릿 만들기
          </button>
        </div>
      ) : viewMode === 'list' ? (

        /* ── LIST VIEW ── */
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">템플릿명</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">내용 미리보기</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">상태</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">등록일</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {templates.map((tpl) => {
                const badge = statusBadge(tpl.inspectionStatus || tpl.status)
                const BadgeIcon = badge.icon
                const approved = isApproved(tpl)
                const editable = isEditable(tpl)
                const canRequest = canRequestApproval(tpl)
                const hasComments = tpl.comments && tpl.comments.length > 0
                return (
                  <tr key={tpl.templateId} className="hover:bg-gray-50">
                    <td className="max-w-[180px] px-4 py-3">
                      <p className="truncate text-sm font-medium text-gray-900">{tpl.name}</p>
                      {hasComments && (
                        <button
                          onClick={() => toggleComments(tpl.templateId)}
                          className="mt-0.5 flex items-center gap-1 text-xs text-red-500 hover:underline"
                        >
                          반려 사유 {expandedComments.has(tpl.templateId) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                      )}
                      {hasComments && expandedComments.has(tpl.templateId) && (
                        <div className="mt-1 rounded bg-red-50 px-2 py-1.5 text-xs text-red-700">
                          {tpl.comments!.join(' / ')}
                        </div>
                      )}
                    </td>
                    <td className="max-w-[300px] px-4 py-3">
                      <p className="truncate text-sm text-gray-500">{tpl.content.replace(/\n/g, ' ')}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${badge.color}`}>
                        <BadgeIcon className="h-3 w-3" />
                        {badge.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {formatDate(tpl.dateCreated)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {canRequest && (
                          <button
                            onClick={() => handleRequestApproval(tpl.templateId)}
                            disabled={requestingId === tpl.templateId}
                            title="검수 요청"
                            className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                          >
                            {requestingId === tpl.templateId ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ClipboardCheck className="h-3.5 w-3.5" />
                            )}
                            검수 요청
                          </button>
                        )}
                        {editable && (
                          <button
                            onClick={() => openEdit(tpl)}
                            title="수정"
                            className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-100"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => openDuplicate(tpl)}
                          title="복제"
                          className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-100"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingId(tpl.templateId)}
                          title="삭제"
                          className="rounded-lg border border-red-200 p-1.5 text-red-400 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => router.push(`/kakao/send?templateId=${tpl.templateId}`)}
                          disabled={!approved}
                          className="inline-flex items-center gap-1 rounded-lg bg-yellow-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-yellow-600 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Send className="h-3.5 w-3.5" /> 발송
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

      ) : (

        /* ── CARD VIEW ── */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((tpl) => {
            const badge = statusBadge(tpl.inspectionStatus || tpl.status)
            const BadgeIcon = badge.icon
            const approved = isApproved(tpl)
            const editable = isEditable(tpl)
            const canRequest = canRequestApproval(tpl)
            const hasComments = tpl.comments && tpl.comments.length > 0
            return (
              <div key={tpl.templateId} className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
                {/* Card Header */}
                <div className="border-b border-gray-100 px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">{tpl.name}</h3>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${badge.color}`}>
                      <BadgeIcon className="h-3 w-3" />
                      {badge.label}
                    </span>
                  </div>
                  {hasComments && (
                    <div>
                      <button
                        onClick={() => toggleComments(tpl.templateId)}
                        className="mt-1 flex items-center gap-1 text-xs text-red-500 hover:underline"
                      >
                        반려 사유 {expandedComments.has(tpl.templateId) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                      {expandedComments.has(tpl.templateId) && (
                        <div className="mt-1 rounded bg-red-50 px-2 py-1.5 text-xs text-red-700">
                          {tpl.comments!.join(' / ')}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Body */}
                <div className="flex-1 px-4 py-3">
                  <div className="rounded-lg bg-yellow-50 p-3">
                    <pre className="whitespace-pre-wrap text-xs leading-relaxed text-gray-800 line-clamp-6">{tpl.content}</pre>
                  </div>
                  {tpl.buttons && tpl.buttons.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {tpl.buttons.map((btn, idx) => (
                        <div key={idx} className="flex items-center justify-center rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-1.5 text-xs font-medium text-yellow-800">
                          {btn.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div className="space-y-2 border-t border-gray-100 px-4 py-2.5">
                  <span className="block text-xs text-gray-400">{formatDate(tpl.dateCreated)}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {canRequest && (
                      <button
                        onClick={() => handleRequestApproval(tpl.templateId)}
                        disabled={requestingId === tpl.templateId}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-blue-300 bg-blue-50 px-2 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                      >
                        {requestingId === tpl.templateId ? <Loader2 className="h-3 w-3 animate-spin" /> : <ClipboardCheck className="h-3 w-3" />}
                        검수 요청
                      </button>
                    )}
                    {editable && (
                      <button
                        onClick={() => openEdit(tpl)}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        <Pencil className="h-3 w-3" /> 수정
                      </button>
                    )}
                    <button
                      onClick={() => openDuplicate(tpl)}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      <Copy className="h-3 w-3" /> 복제
                    </button>
                    <button
                      onClick={() => setDeletingId(tpl.templateId)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3" /> 삭제
                    </button>
                    <button
                      onClick={() => router.push(`/kakao/send?templateId=${tpl.templateId}`)}
                      disabled={!approved}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-yellow-500 px-2 py-1.5 text-xs font-medium text-white hover:bg-yellow-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Send className="h-3 w-3" /> 발송하기
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ─── Create / Edit Modal ─── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeModal}>
          <div
            className="flex w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl"
            style={{ maxHeight: '90vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-yellow-500" />
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingTemplate ? '템플릿 수정' : isDuplicate ? '템플릿 복제' : '새 템플릿 만들기'}
                </h2>
              </div>
              <button onClick={closeModal} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {/* Name */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">템플릿 이름 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="예: 주문 완료 알림"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                />
              </div>

              {/* Category */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">카테고리 <span className="text-red-500">*</span></label>
                <select
                  value={form.categoryCode}
                  onChange={e => setForm(f => ({ ...f, categoryCode: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                >
                  {CATEGORY_OPTIONS.map(c => (
                    <option key={c.code} value={c.code}>{c.code} - {c.label}</option>
                  ))}
                </select>
              </div>

              {/* Content */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  템플릿 내용 <span className="text-red-500">*</span>
                  <span className="ml-2 text-xs text-gray-400 font-normal">변수는 #{'{변수명}'} 형식으로 입력</span>
                </label>
                <textarea
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  rows={8}
                  placeholder={"안녕하세요, #{이름}님!\n주문이 완료되었습니다.\n주문번호: #{주문번호}"}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-mono focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                />
              </div>

              {/* Buttons */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">버튼 (최대 5개)</label>
                  <button
                    type="button"
                    onClick={addButton}
                    disabled={form.buttons.length >= 5}
                    className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" /> 버튼 추가
                  </button>
                </div>
                {form.buttons.length === 0 && (
                  <p className="text-xs text-gray-400">버튼이 없습니다. 필요 시 버튼을 추가하세요.</p>
                )}
                <div className="space-y-2">
                  {form.buttons.map((btn, idx) => (
                    <div key={idx} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">버튼 {idx + 1}</span>
                        <button onClick={() => removeButton(idx)} className="text-gray-400 hover:text-red-500">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <label className="mb-0.5 block text-xs text-gray-500">버튼 타입</label>
                          <select
                            value={btn.type}
                            onChange={e => updateButton(idx, 'type', e.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs focus:border-yellow-500 focus:outline-none"
                          >
                            {BUTTON_TYPES.map(t => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-0.5 block text-xs text-gray-500">버튼 이름</label>
                          <input
                            type="text"
                            value={btn.name}
                            onChange={e => updateButton(idx, 'name', e.target.value)}
                            placeholder="자세히 보기"
                            className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs focus:border-yellow-500 focus:outline-none"
                          />
                        </div>
                        {(btn.type === 'WL' || btn.type === 'AL') && (
                          <>
                            <div>
                              <label className="mb-0.5 block text-xs text-gray-500">모바일 URL</label>
                              <input
                                type="text"
                                value={btn.linkMo || ''}
                                onChange={e => updateButton(idx, 'linkMo', e.target.value)}
                                placeholder="https://example.com"
                                className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs focus:border-yellow-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="mb-0.5 block text-xs text-gray-500">PC URL (선택)</label>
                              <input
                                type="text"
                                value={btn.linkPc || ''}
                                onChange={e => updateButton(idx, 'linkPc', e.target.value)}
                                placeholder="https://example.com"
                                className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs focus:border-yellow-500 focus:outline-none"
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {modalError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {modalError}
                </div>
              )}

              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                {isDuplicate ? (
                  <>💡 복제된 템플릿은 새 템플릿으로 생성됩니다. 저장 후 내용을 수정하고 <strong>검수 요청</strong>을 해야 카카오로 심사가 접수됩니다.</>
                ) : (
                  <>💡 저장 후 <strong>검수 요청</strong>을 해야 카카오로 심사가 접수됩니다. 승인된 템플릿만 발송 가능합니다.</>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-6 py-4">
              <button onClick={closeModal} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-yellow-500 px-5 py-2 text-sm font-medium text-white hover:bg-yellow-600 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingTemplate ? '수정 저장' : isDuplicate ? '복제본 생성' : '템플릿 생성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Confirm Dialog ─── */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">템플릿 삭제</h3>
                <p className="text-sm text-gray-500">이 작업은 되돌릴 수 없습니다.</p>
              </div>
            </div>
            <p className="mb-5 text-sm text-gray-600">
              선택한 템플릿을 SOLAPI에서 영구 삭제하시겠습니까?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                disabled={deleting}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
