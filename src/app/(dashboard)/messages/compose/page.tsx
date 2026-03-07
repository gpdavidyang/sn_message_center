'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Send, Loader2, Plus, X, Phone, ChevronDown, Upload, FileSpreadsheet, Save, BookOpen, Clock, Trash2 } from 'lucide-react'
import { getByteLength, getMessageType } from '@/lib/utils/byte-counter'
import { normalizePhoneNumber, formatPhoneDisplay } from '@/lib/utils/phone'
import { parseContactsFromCSV } from '@/lib/utils/csv-parser'

interface SenderNumber {
  phoneNumber: string
  handleKey?: string
  status?: string
  dateCreated?: string
  label?: string
}

interface Template {
  id: string
  name: string
  type: string
  content: string
  created_at: string
}

function ComposeMessageContent() {
  const searchParams = useSearchParams()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [type, setType] = useState<'SMS' | 'LMS'>('SMS')
  const [content, setContent] = useState('')
  const [senderNumber, setSenderNumber] = useState('')
  const [senderNumbers, setSenderNumbers] = useState<SenderNumber[]>([])
  const [loadingSenders, setLoadingSenders] = useState(true)
  const [senderDropdownOpen, setSenderDropdownOpen] = useState(false)
  const [recipients, setRecipients] = useState<{ phone: string; name?: string }[]>([])
  const [newPhone, setNewPhone] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<string>('')
  const [csvMessage, setCsvMessage] = useState<string>('')
  const [isDragOver, setIsDragOver] = useState(false)

  // Template states
  const [templates, setTemplates] = useState<Template[]>([])
  const [showTemplates, setShowTemplates] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)

  // Schedule states
  const [isScheduled, setIsScheduled] = useState(false)
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')

  const byteLength = getByteLength(content)
  const autoType = getMessageType(content)

  // Fetch sender numbers from SOLAPI
  useEffect(() => {
    const fetchSenderNumbers = async () => {
      try {
        const res = await fetch('/api/solapi/sender-numbers')
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        let numbers: SenderNumber[] = []
        if (data.numbers && Array.isArray(data.numbers)) numbers = data.numbers
        setSenderNumbers(numbers)
        if (numbers.length > 0) setSenderNumber(numbers[0].phoneNumber)
      } catch (err) {
        console.error('발신번호 조회 실패:', err)
      } finally {
        setLoadingSenders(false)
      }
    }
    fetchSenderNumbers()
  }, [])

  // Fetch templates
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const res = await fetch('/api/templates')
        const data = await res.json()
        if (data.templates) setTemplates(data.templates)
      } catch (err) {
        console.error('템플릿 조회 실패:', err)
      }
    }
    fetchTemplates()
  }, [])

  // Auto-load recipients from URL params
  useEffect(() => {
    const phones = searchParams.get('phones')
    const names = searchParams.get('names')
    if (phones) {
      const phoneList = phones.split(',').filter(Boolean)
      const nameList = names ? names.split(',') : []
      const newRecipients = phoneList.map((phone, i) => ({
        phone: normalizePhoneNumber(phone),
        name: nameList[i] || undefined,
      }))
      setRecipients(newRecipients)
    }
  }, [searchParams])

  useEffect(() => { setType(autoType) }, [autoType])

  useEffect(() => {
    const handleClickOutside = () => setSenderDropdownOpen(false)
    if (senderDropdownOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [senderDropdownOpen])

  // ======= Template Handlers =======
  const saveTemplate = async () => {
    if (!templateName.trim() || !content.trim()) return
    setSavingTemplate(true)
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: templateName, type, content }),
      })
      const data = await res.json()
      if (data.template) {
        setTemplates(prev => [data.template, ...prev])
        setTemplateName('')
        setShowSaveTemplate(false)
        setResult('✅ 템플릿이 저장되었습니다.')
      }
    } catch { setResult('템플릿 저장에 실패했습니다.') }
    finally { setSavingTemplate(false) }
  }

  const loadTemplate = (tpl: Template) => {
    setContent(tpl.content)
    setShowTemplates(false)
    setResult(`📋 "${tpl.name}" 템플릿을 불러왔습니다.`)
  }

  const deleteTemplate = async (id: string) => {
    try {
      await fetch('/api/templates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setTemplates(prev => prev.filter(t => t.id !== id))
    } catch { /* ignore */ }
  }

  // ======= CSV Handlers =======
  const addContactsFromCSV = (csvText: string) => {
    setCsvMessage('')
    const result = parseContactsFromCSV(csvText)
    if (result.contacts.length === 0 && result.errors.length > 0) {
      setCsvMessage(`${result.errors[0]}`)
      return
    }
    const existingPhones = new Set(recipients.map(r => r.phone))
    const newContacts = result.contacts.filter(c => !existingPhones.has(c.phone))
    const duplicateCount = result.contacts.length - newContacts.length
    if (newContacts.length > 0) setRecipients(prev => [...prev, ...newContacts])
    const parts: string[] = []
    parts.push(`${newContacts.length}명 추가됨`)
    if (duplicateCount > 0) parts.push(`${duplicateCount}명 중복`)
    if (result.errors.length > 0) parts.push(`${result.errors.length}건 오류`)
    setCsvMessage(newContacts.length > 0 ? `✅ ${parts.join(', ')}` : `⚠️ ${parts.join(', ')}`)
  }

  const handleCSVFileUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => { const text = e.target?.result as string; if (text) addContactsFromCSV(text) }
    reader.readAsText(file)
  }
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (file) handleCSVFileUpload(file); e.target.value = ''
  }
  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text')
    if (!text) return
    if (text.includes('\t') || (text.includes('\n') && text.includes(','))) {
      e.preventDefault(); addContactsFromCSV(text)
    }
  }
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true) }
  const handleDragLeave = () => { setIsDragOver(false) }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.txt') || file.type.includes('csv') || file.type.includes('text'))) {
      handleCSVFileUpload(file)
    } else { setCsvMessage('CSV 또는 TXT 파일만 지원합니다.') }
  }

  const addRecipient = () => {
    if (!newPhone.trim()) return
    const cleaned = normalizePhoneNumber(newPhone)
    if (cleaned.length < 10) { setResult('올바른 전화번호를 입력해주세요.'); return }
    if (recipients.some((r) => r.phone === cleaned)) { setResult('이미 추가된 번호입니다.'); return }
    setRecipients([...recipients, { phone: cleaned }]); setNewPhone(''); setResult('')
  }
  const removeRecipient = (phone: string) => { setRecipients(recipients.filter((r) => r.phone !== phone)) }
  const clearAllRecipients = () => { setRecipients([]); setCsvMessage('') }

  const handleSend = async () => {
    if (!content.trim() || !senderNumber.trim() || recipients.length === 0) {
      setResult('발신번호, 수신자, 메시지 내용을 모두 입력해주세요.'); return
    }
    if (isScheduled && (!scheduledDate || !scheduledTime)) {
      setResult('예약 발송 시 날짜와 시간을 입력해주세요.'); return
    }

    setSending(true); setResult('')
    try {
      const body: Record<string, unknown> = {
        type, content, senderNumber,
        recipients: recipients.map((r) => ({ phone: r.phone })),
      }
      if (isScheduled) {
        body.scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString()
      }

      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      if (isScheduled) {
        setResult(`📅 메시지가 ${scheduledDate} ${scheduledTime}에 예약되었습니다! (캠페인 ID: ${data.campaignId})`)
      } else {
        setResult(`✅ 메시지가 성공적으로 발송되었습니다! (캠페인 ID: ${data.campaignId})`)
      }
      setContent(''); setRecipients([]); setIsScheduled(false); setScheduledDate(''); setScheduledTime('')
    } catch (err: unknown) {
      setResult(err instanceof Error ? err.message : '발송에 실패했습니다.')
    } finally { setSending(false) }
  }

  // Get min datetime for schedule (now + 5 minutes)
  const getMinDate = () => {
    const now = new Date()
    return now.toISOString().split('T')[0]
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Message Editor */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">메시지 작성</h3>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowTemplates(!showTemplates); setShowSaveTemplate(false) }}
                className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <BookOpen className="h-3.5 w-3.5" />
                템플릿
              </button>
              {content.trim() && (
                <button
                  onClick={() => { setShowSaveTemplate(!showSaveTemplate); setShowTemplates(false) }}
                  className="flex items-center gap-1 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                >
                  <Save className="h-3.5 w-3.5" />
                  저장
                </button>
              )}
            </div>
          </div>

          {/* Template List */}
          {showTemplates && (
            <div className="mb-4 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50">
              {templates.length === 0 ? (
                <p className="p-4 text-center text-sm text-gray-500">저장된 템플릿이 없습니다.</p>
              ) : templates.map(tpl => (
                <div key={tpl.id} className="flex items-center justify-between border-b border-gray-200 px-4 py-2.5 last:border-b-0 hover:bg-white">
                  <button onClick={() => loadTemplate(tpl)} className="flex-1 text-left">
                    <p className="text-sm font-medium text-gray-900">{tpl.name}</p>
                    <p className="truncate text-xs text-gray-500">{tpl.content}</p>
                  </button>
                  <button onClick={() => deleteTemplate(tpl.id)} className="ml-2 p-1 text-gray-400 hover:text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Save Template Form */}
          {showSaveTemplate && (
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="템플릿 이름"
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
                />
                <button
                  onClick={saveTemplate}
                  disabled={!templateName.trim() || savingTemplate}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingTemplate ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          )}

          {/* Type badge */}
          <div className="mb-4 flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${
              type === 'SMS' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
            }`}>
              {type}
            </span>
            <span className="text-sm font-medium text-gray-700">
              {byteLength} / {type === 'SMS' ? '90' : '2,000'} 바이트
            </span>
          </div>

          {/* Sender number - Dropdown */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">발신번호</label>
            {loadingSenders ? (
              <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                <span className="text-sm text-gray-500">발신번호 불러오는 중...</span>
              </div>
            ) : senderNumbers.length === 0 ? (
              <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5">
                <p className="text-sm text-orange-700">등록된 발신번호가 없습니다. SOLAPI에서 발신번호를 등록해주세요.</p>
              </div>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setSenderDropdownOpen(!senderDropdownOpen) }}
                  className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-left transition-colors hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-gray-900">
                      {senderNumber ? formatPhoneDisplay(senderNumber) : '발신번호를 선택하세요'}
                    </span>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${senderDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {senderDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                    {senderNumbers.map((num) => (
                      <button
                        key={num.phoneNumber}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setSenderNumber(num.phoneNumber); setSenderDropdownOpen(false) }}
                        className={`flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-blue-50 ${
                          senderNumber === num.phoneNumber ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Phone className={`h-4 w-4 ${senderNumber === num.phoneNumber ? 'text-blue-600' : 'text-gray-400'}`} />
                          <span className={`text-sm font-medium ${senderNumber === num.phoneNumber ? 'text-blue-700' : 'text-gray-900'}`}>
                            {formatPhoneDisplay(num.phoneNumber)}
                          </span>
                        </div>
                        {senderNumber === num.phoneNumber && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">선택됨</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Message content */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">메시지 내용</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              placeholder="메시지를 입력하세요..."
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Byte meter */}
          <div className="mb-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className={`h-full rounded-full transition-all ${
                  byteLength <= 90 ? 'bg-green-500' : byteLength <= 2000 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min((byteLength / (type === 'SMS' ? 90 : 2000)) * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* Schedule toggle */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={isScheduled}
                onChange={(e) => setIsScheduled(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">예약 발송</span>
            </label>
            {isScheduled && (
              <div className="mt-3 flex gap-3">
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={getMinDate()}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                />
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* Right: Recipients */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">수신자 ({recipients.length}명)</h3>
            {recipients.length > 0 && (
              <button onClick={clearAllRecipients} className="text-xs text-gray-500 hover:text-red-500">전체 삭제</button>
            )}
          </div>

          {/* CSV Upload Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`mb-3 flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed px-4 py-3 transition-colors ${
              isDragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
            }`}
          >
            <FileSpreadsheet className={`h-5 w-5 flex-shrink-0 ${isDragOver ? 'text-blue-500' : 'text-gray-400'}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-700">CSV 파일 업로드 또는 Excel 붙여넣기</p>
              <p className="text-xs text-gray-500">이름, 전화번호 컬럼이 포함된 CSV 파일을 드래그하세요</p>
            </div>
            <Upload className={`h-4 w-4 flex-shrink-0 ${isDragOver ? 'text-blue-500' : 'text-gray-400'}`} />
            <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleFileInputChange} className="hidden" />
          </div>

          {csvMessage && (
            <div className={`mb-3 rounded-lg px-3 py-2 text-sm ${
              csvMessage.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'
            }`}>{csvMessage}</div>
          )}

          {/* Manual phone input */}
          <div className="mb-4 flex gap-2">
            <input
              type="text"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRecipient())}
              onPaste={handlePaste}
              placeholder="전화번호 입력 또는 데이터 붙여넣기"
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button onClick={addRecipient} className="rounded-lg bg-gray-100 p-2.5 text-gray-700 hover:bg-gray-200">
              <Plus className="h-5 w-5" />
            </button>
          </div>

          {/* Recipient list */}
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {recipients.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-500">
                수신자를 추가해주세요.<br />CSV 업로드, 붙여넣기, 또는 HubSpot에서 가져올 수 있습니다.
              </p>
            ) : (
              recipients.map((r, idx) => (
                <div key={`${r.phone}-${r.name || idx}`} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  <div>
                    {r.name && <span className="text-sm font-semibold text-gray-900">{r.name} </span>}
                    <span className="text-sm font-medium text-gray-700">{formatPhoneDisplay(r.phone)}</span>
                  </div>
                  <button onClick={() => removeRecipient(r.phone)} className="text-gray-400 hover:text-red-500">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Result message */}
      {result && (
        <div className={`mt-4 rounded-lg border p-3 text-sm font-medium ${
          result.includes('성공') || result.includes('✅') || result.includes('📋') || result.includes('📅')
            ? 'border-green-200 bg-green-50 text-green-800'
            : 'border-red-200 bg-red-50 text-red-800'
        }`}>{result}</div>
      )}

      {/* Send button */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSend}
          disabled={sending || !content.trim() || recipients.length === 0}
          className={`flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
            isScheduled ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {sending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isScheduled ? (
            <Clock className="h-5 w-5" />
          ) : (
            <Send className="h-5 w-5" />
          )}
          {sending ? '처리 중...' : isScheduled ? `${type} 예약 발송` : `${type} 발송하기`}
        </button>
      </div>
    </div>
  )
}

export default function ComposeMessagePage() {
  return (
    <Suspense fallback={<div className="py-12 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" /></div>}>
      <ComposeMessageContent />
    </Suspense>
  )
}
