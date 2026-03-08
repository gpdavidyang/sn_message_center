'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  MessageCircle, Loader2, Send, Plus, X, Phone, ChevronDown,
  Upload, FileSpreadsheet, Clock, Users, ChevronRight, Check
} from 'lucide-react'
import { normalizePhoneNumber, formatPhoneDisplay } from '@/lib/utils/phone'
import { parseContactsFromCSV } from '@/lib/utils/csv-parser'

interface SenderNumber {
  phoneNumber: string
  handleKey?: string
  status?: string
}

interface KakaoTemplate {
  templateId: string
  name: string
  content: string
  buttons?: Array<{ type: string; name: string; linkMo?: string; linkPc?: string }>
  status: string
  inspectionStatus?: string
}

function KakaoSendContent() {
  const searchParams = useSearchParams()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Template states
  const [templates, setTemplates] = useState<KakaoTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<KakaoTemplate | null>(null)
  const [loadingTemplates, setLoadingTemplates] = useState(true)

  // Sender states
  const [senderNumber, setSenderNumber] = useState('')
  const [senderNumbers, setSenderNumbers] = useState<SenderNumber[]>([])
  const [loadingSenders, setLoadingSenders] = useState(true)
  const [senderDropdownOpen, setSenderDropdownOpen] = useState(false)

  // Recipients
  const [recipients, setRecipients] = useState<{ phone: string; name?: string }[]>([])
  const [newPhone, setNewPhone] = useState('')
  const [csvMessage, setCsvMessage] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)

  // Schedule
  const [isScheduled, setIsScheduled] = useState(false)
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')

  // HubSpot picker
  const [showHubSpotPicker, setShowHubSpotPicker] = useState(false)
  const [hubSpotForms, setHubSpotForms] = useState<{ id: string; name: string }[]>([])
  const [hubSpotFormsLoading, setHubSpotFormsLoading] = useState(false)
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null)
  const [hubSpotContacts, setHubSpotContacts] = useState<{ phone: string; name?: string }[]>([])
  const [hubSpotContactsLoading, setHubSpotContactsLoading] = useState(false)
  const [checkedPhones, setCheckedPhones] = useState<Set<string>>(new Set())

  // Send state
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState('')

  // Fetch templates
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const res = await fetch('/api/kakao/templates')
        const data = await res.json()
        const tpls = data.templates || []
        // Only show approved templates
        const approved = tpls.filter((t: KakaoTemplate) => {
          const status = (t.inspectionStatus || t.status || '').toUpperCase()
          return status === 'APPROVED' || status === 'APR'
        })
        setTemplates(approved)
        // Auto-select if templateId passed via URL
        const templateIdParam = searchParams.get('templateId')
        if (templateIdParam) {
          const found = approved.find((t: KakaoTemplate) => t.templateId === templateIdParam)
          if (found) setSelectedTemplate(found)
        }
      } catch (err) {
        console.error('템플릿 조회 실패:', err)
      } finally {
        setLoadingTemplates(false)
      }
    }
    fetchTemplates()
  }, [searchParams])

  // Fetch sender numbers
  useEffect(() => {
    const fetchSenderNumbers = async () => {
      try {
        const res = await fetch('/api/solapi/sender-numbers')
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        const numbers: SenderNumber[] = data.numbers || []
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

  useEffect(() => {
    const handleClickOutside = () => setSenderDropdownOpen(false)
    if (senderDropdownOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [senderDropdownOpen])

  // CSV handlers
  const addContactsFromCSV = (csvText: string) => {
    setCsvMessage('')
    const csvResult = parseContactsFromCSV(csvText)
    if (csvResult.contacts.length === 0 && csvResult.errors.length > 0) {
      setCsvMessage(`${csvResult.errors[0]}`)
      return
    }
    const existingPhones = new Set(recipients.map(r => r.phone))
    const newContacts = csvResult.contacts.filter(c => !existingPhones.has(c.phone))
    const duplicateCount = csvResult.contacts.length - newContacts.length
    if (newContacts.length > 0) setRecipients(prev => [...prev, ...newContacts])
    const parts: string[] = []
    parts.push(`${newContacts.length}명 추가됨`)
    if (duplicateCount > 0) parts.push(`${duplicateCount}명 중복`)
    if (csvResult.errors.length > 0) parts.push(`${csvResult.errors.length}건 오류`)
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

  const openHubSpotPicker = async () => {
    setShowHubSpotPicker(true)
    setSelectedFormId(null)
    setHubSpotContacts([])
    setCheckedPhones(new Set())
    if (hubSpotForms.length === 0) {
      setHubSpotFormsLoading(true)
      try {
        const res = await fetch('/api/contacts/hubspot-forms?action=forms')
        const data = await res.json()
        setHubSpotForms(data.forms || [])
      } catch { /* ignore */ }
      finally { setHubSpotFormsLoading(false) }
    }
  }

  const selectHubSpotForm = async (formId: string) => {
    setSelectedFormId(formId)
    setHubSpotContacts([])
    setCheckedPhones(new Set())
    setHubSpotContactsLoading(true)
    try {
      const res = await fetch(`/api/contacts/hubspot-forms?action=submissions&formId=${formId}`)
      const data = await res.json()
      const contacts = (data.contacts || [])
        .map((c: { properties: { phone?: string; firstname?: string; lastname?: string } }) => ({
          phone: c.properties.phone || '',
          name: [c.properties.firstname, c.properties.lastname].filter(Boolean).join(' ') || undefined,
        }))
        .filter((c: { phone: string }) => c.phone.length >= 10)
      setHubSpotContacts(contacts)
    } catch { /* ignore */ }
    finally { setHubSpotContactsLoading(false) }
  }

  const toggleHubSpotContact = (phone: string) => {
    setCheckedPhones(prev => {
      const next = new Set(prev)
      if (next.has(phone)) next.delete(phone)
      else next.add(phone)
      return next
    })
  }

  const addHubSpotContacts = () => {
    const existingPhones = new Set(recipients.map(r => r.phone))
    const toAdd = hubSpotContacts
      .filter(c => checkedPhones.has(c.phone) && !existingPhones.has(c.phone))
    if (toAdd.length > 0) setRecipients(prev => [...prev, ...toAdd])
    setShowHubSpotPicker(false)
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
    if (!selectedTemplate || !senderNumber.trim() || recipients.length === 0) {
      setResult('템플릿, 발신번호, 수신자를 모두 선택/입력해주세요.')
      return
    }
    if (isScheduled && (!scheduledDate || !scheduledTime)) {
      setResult('예약 발송 시 날짜와 시간을 입력해주세요.')
      return
    }

    setSending(true); setResult('')
    try {
      const body: Record<string, unknown> = {
        templateId: selectedTemplate.templateId,
        content: selectedTemplate.content,
        senderNumber,
        recipients: recipients.map((r) => ({ phone: r.phone })),
      }
      if (isScheduled) {
        body.scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString()
      }

      const res = await fetch('/api/kakao/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      if (isScheduled) {
        setResult(`📅 알림톡이 ${scheduledDate} ${scheduledTime}에 예약되었습니다! (캠페인 ID: ${data.campaignId})`)
      } else {
        setResult(`✅ 카카오 알림톡이 성공적으로 발송되었습니다! (캠페인 ID: ${data.campaignId})`)
      }
      setRecipients([]); setIsScheduled(false); setScheduledDate(''); setScheduledTime('')
    } catch (err: unknown) {
      setResult(err instanceof Error ? err.message : '발송에 실패했습니다.')
    } finally { setSending(false) }
  }

  const getMinDate = () => new Date().toISOString().split('T')[0]

  return (
    <div className="mx-auto max-w-4xl">
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {/* Left: Template & Settings */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-yellow-500" />
            <h3 className="text-lg font-semibold text-gray-900">알림톡 설정</h3>
          </div>

          {/* Template Selection */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">알림톡 템플릿</label>
            {loadingTemplates ? (
              <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                <span className="text-sm text-gray-500">템플릿 불러오는 중...</span>
              </div>
            ) : templates.length === 0 ? (
              <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5">
                <p className="text-sm text-orange-700">사용 가능한 승인된 템플릿이 없습니다. SOLAPI 콘솔에서 템플릿을 등록해주세요.</p>
              </div>
            ) : (
              <select
                value={selectedTemplate?.templateId || ''}
                onChange={(e) => {
                  const tpl = templates.find(t => t.templateId === e.target.value)
                  setSelectedTemplate(tpl || null)
                }}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
              >
                <option value="">템플릿을 선택하세요</option>
                {templates.map(tpl => (
                  <option key={tpl.templateId} value={tpl.templateId}>{tpl.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Template Preview */}
          {selectedTemplate && (
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-gray-700">미리보기</label>
              <div className="rounded-lg bg-yellow-50 p-4">
                <pre className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{selectedTemplate.content}</pre>
                {selectedTemplate.buttons && selectedTemplate.buttons.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {selectedTemplate.buttons.map((btn, idx) => (
                      <div key={idx} className="flex items-center justify-center rounded-lg border border-yellow-300 bg-white px-3 py-2 text-sm font-medium text-yellow-800">
                        {btn.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sender number dropdown */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">발신번호 (대체 발송용)</label>
            {loadingSenders ? (
              <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                <span className="text-sm text-gray-500">발신번호 불러오는 중...</span>
              </div>
            ) : senderNumbers.length === 0 ? (
              <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5">
                <p className="text-sm text-orange-700">등록된 발신번호가 없습니다.</p>
              </div>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setSenderDropdownOpen(!senderDropdownOpen) }}
                  className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-left transition-colors hover:border-gray-400 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                >
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-yellow-600" />
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
                        className={`flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-yellow-50 ${
                          senderNumber === num.phoneNumber ? 'bg-yellow-50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Phone className={`h-4 w-4 ${senderNumber === num.phoneNumber ? 'text-yellow-600' : 'text-gray-400'}`} />
                          <span className={`text-sm font-medium ${senderNumber === num.phoneNumber ? 'text-yellow-700' : 'text-gray-900'}`}>
                            {formatPhoneDisplay(num.phoneNumber)}
                          </span>
                        </div>
                        {senderNumber === num.phoneNumber && (
                          <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">선택됨</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <p className="mt-1 text-xs text-gray-400">카카오 알림톡 발송 실패 시 SMS로 대체 발송됩니다.</p>
          </div>

          {/* Schedule toggle */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={isScheduled}
                onChange={(e) => setIsScheduled(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
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
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-yellow-500 focus:outline-none"
                />
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-yellow-500 focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* Right: Recipients */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
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
              isDragOver ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
            }`}
          >
            <FileSpreadsheet className={`h-5 w-5 flex-shrink-0 ${isDragOver ? 'text-yellow-500' : 'text-gray-400'}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-700">CSV 파일 업로드 또는 Excel 붙여넣기</p>
              <p className="text-xs text-gray-500">이름, 전화번호 컬럼이 포함된 CSV 파일을 드래그하세요</p>
            </div>
            <Upload className={`h-4 w-4 flex-shrink-0 ${isDragOver ? 'text-yellow-500' : 'text-gray-400'}`} />
            <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleFileInputChange} className="hidden" />
          </div>

          {csvMessage && (
            <div className={`mb-3 rounded-lg px-3 py-2 text-sm ${
              csvMessage.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'
            }`}>{csvMessage}</div>
          )}

          {/* HubSpot form picker button */}
          <button
            type="button"
            onClick={openHubSpotPicker}
            className="mb-3 flex w-full items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-left transition-colors hover:bg-orange-100"
          >
            <Users className="h-5 w-5 flex-shrink-0 text-orange-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-orange-800">HubSpot 양식에서 가져오기</p>
              <p className="text-xs text-orange-600">양식 제출자를 수신자로 추가합니다</p>
            </div>
            <ChevronRight className="h-4 w-4 flex-shrink-0 text-orange-400" />
          </button>

          {/* Manual phone input */}
          <div className="mb-4 flex gap-2">
            <input
              type="text"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRecipient())}
              onPaste={handlePaste}
              placeholder="전화번호 입력 또는 데이터 붙여넣기"
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
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
          result.includes('성공') || result.includes('✅') || result.includes('📅')
            ? 'border-green-200 bg-green-50 text-green-800'
            : 'border-red-200 bg-red-50 text-red-800'
        }`}>{result}</div>
      )}

      {/* Send button */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSend}
          disabled={sending || !selectedTemplate || recipients.length === 0}
          className={`flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
            isScheduled ? 'bg-purple-600 hover:bg-purple-700' : 'bg-yellow-500 hover:bg-yellow-600'
          }`}
        >
          {sending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isScheduled ? (
            <Clock className="h-5 w-5" />
          ) : (
            <Send className="h-5 w-5" />
          )}
          {sending ? '처리 중...' : isScheduled ? '알림톡 예약 발송' : '알림톡 발송하기'}
        </button>
      </div>

      {/* HubSpot Form Picker Modal */}
      {showHubSpotPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowHubSpotPicker(false)}>
          <div className="flex w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl" style={{ maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-orange-500" />
                <h2 className="text-lg font-semibold text-gray-900">HubSpot 양식에서 수신자 추가</h2>
              </div>
              <button onClick={() => setShowHubSpotPicker(false)} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 overflow-hidden">
              {/* Left: Forms list */}
              <div className="w-56 flex-shrink-0 overflow-y-auto border-r border-gray-200 bg-gray-50">
                <p className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500">양식 선택</p>
                {hubSpotFormsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  </div>
                ) : hubSpotForms.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-gray-500">양식이 없습니다.</p>
                ) : hubSpotForms.map(form => (
                  <button
                    key={form.id}
                    onClick={() => selectHubSpotForm(form.id)}
                    className={`w-full px-4 py-3 text-left text-sm transition-colors hover:bg-white ${
                      selectedFormId === form.id ? 'bg-white font-semibold text-orange-700' : 'text-gray-700'
                    }`}
                  >
                    {form.name}
                  </button>
                ))}
              </div>

              {/* Right: Contacts list */}
              <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                {!selectedFormId ? (
                  <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
                    왼쪽에서 양식을 선택하세요
                  </div>
                ) : hubSpotContactsLoading ? (
                  <div className="flex flex-1 items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  </div>
                ) : hubSpotContacts.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
                    이 양식의 제출 데이터가 없습니다.
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
                      <span className="text-sm text-gray-600">{hubSpotContacts.length}명 · {checkedPhones.size}명 선택됨</span>
                      <button
                        onClick={() => {
                          if (checkedPhones.size === hubSpotContacts.length) setCheckedPhones(new Set())
                          else setCheckedPhones(new Set(hubSpotContacts.map(c => c.phone)))
                        }}
                        className="text-xs text-orange-600 hover:underline"
                      >
                        {checkedPhones.size === hubSpotContacts.length ? '전체 해제' : '전체 선택'}
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      {hubSpotContacts.map(contact => (
                        <label
                          key={contact.phone}
                          className="flex cursor-pointer items-center gap-3 border-b border-gray-100 px-4 py-2.5 last:border-b-0 hover:bg-orange-50"
                        >
                          <div className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors ${
                            checkedPhones.has(contact.phone)
                              ? 'border-orange-500 bg-orange-500'
                              : 'border-gray-300 bg-white'
                          }`} onClick={() => toggleHubSpotContact(contact.phone)}>
                            {checkedPhones.has(contact.phone) && <Check className="h-3 w-3 text-white" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            {contact.name && <p className="text-sm font-medium text-gray-900">{contact.name}</p>}
                            <p className="text-sm text-gray-600">{contact.phone}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
              <span className="text-sm text-gray-500">
                {checkedPhones.size > 0 ? `${checkedPhones.size}명 선택됨` : '수신자를 선택해주세요'}
              </span>
              <div className="flex gap-2">
                <button onClick={() => setShowHubSpotPicker(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  취소
                </button>
                <button
                  onClick={addHubSpotContacts}
                  disabled={checkedPhones.size === 0}
                  className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                >
                  수신자 추가 ({checkedPhones.size}명)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function KakaoSendPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" /></div>}>
      <KakaoSendContent />
    </Suspense>
  )
}
