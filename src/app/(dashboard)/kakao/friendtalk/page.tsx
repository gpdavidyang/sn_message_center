'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  MessageCircle, Loader2, Send, Plus, X, Phone, ChevronDown,
  Upload, FileSpreadsheet, Clock, Users, ChevronRight, Check, Search, Link as LinkIcon, Trash2
} from 'lucide-react'
import { normalizePhoneNumber, formatPhoneDisplay } from '@/lib/utils/phone'
import { parseContactsFromCSV } from '@/lib/utils/csv-parser'

interface SenderNumber {
  phoneNumber: string
  handleKey?: string
  status?: string
}

interface FriendtalkButton {
  type: 'WL'
  name: string
  linkMo: string
}

function FriendtalkContent() {
  const searchParams = useSearchParams()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const contactSearchRef = useRef<HTMLDivElement>(null)

  // Content
  const [content, setContent] = useState('')
  const [buttons, setButtons] = useState<FriendtalkButton[]>([])

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

  // Contact search
  const [contactSearch, setContactSearch] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; phone: string; email: string; company: string }[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)

  // Send state
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState('')

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
      setRecipients(phoneList.map((phone, i) => ({
        phone: normalizePhoneNumber(phone),
        name: nameList[i] || undefined,
      })))
    }
  }, [searchParams])

  useEffect(() => {
    const handleClickOutside = () => setSenderDropdownOpen(false)
    if (senderDropdownOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [senderDropdownOpen])

  // Debounced contact search
  useEffect(() => {
    if (!contactSearch.trim() || contactSearch.trim().length < 2) {
      setSearchResults([]); setShowSearchDropdown(false); return
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await fetch(`/api/contacts/search?q=${encodeURIComponent(contactSearch)}`)
        const data = await res.json()
        setSearchResults(data.contacts || [])
        setShowSearchDropdown(true)
      } catch { /* ignore */ }
      finally { setSearchLoading(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [contactSearch])

  // Close search dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (contactSearchRef.current && !contactSearchRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // CSV handlers
  const addContactsFromCSV = (csvText: string) => {
    setCsvMessage('')
    const csvResult = parseContactsFromCSV(csvText)
    if (csvResult.contacts.length === 0 && csvResult.errors.length > 0) {
      setCsvMessage(`${csvResult.errors[0]}`); return
    }
    const existingPhones = new Set(recipients.map(r => r.phone))
    const newContacts = csvResult.contacts.filter(c => !existingPhones.has(c.phone))
    const duplicateCount = csvResult.contacts.length - newContacts.length
    if (newContacts.length > 0) setRecipients(prev => [...prev, ...newContacts])
    const parts: string[] = [`${newContacts.length}명 추가됨`]
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
    const toAdd = hubSpotContacts.filter(c => checkedPhones.has(c.phone) && !existingPhones.has(c.phone))
    if (toAdd.length > 0) setRecipients(prev => [...prev, ...toAdd])
    setShowHubSpotPicker(false)
  }

  const addFromSearch = (contact: { name: string; phone: string }) => {
    const cleaned = normalizePhoneNumber(contact.phone)
    if (cleaned.length < 10) return
    if (!recipients.some(r => r.phone === cleaned)) {
      setRecipients(prev => [...prev, { phone: cleaned, name: contact.name || undefined }])
    }
    setContactSearch('')
    setShowSearchDropdown(false)
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

  // Button management
  const addButton = () => {
    if (buttons.length >= 5) return
    setButtons(prev => [...prev, { type: 'WL', name: '', linkMo: '' }])
  }
  const updateButton = (idx: number, field: 'name' | 'linkMo', value: string) => {
    setButtons(prev => prev.map((b, i) => i === idx ? { ...b, [field]: value } : b))
  }
  const removeButton = (idx: number) => {
    setButtons(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSend = async () => {
    if (!content.trim() || !senderNumber.trim() || recipients.length === 0) {
      setResult('메시지 내용, 발신번호, 수신자를 모두 입력해주세요.')
      return
    }
    if (isScheduled && (!scheduledDate || !scheduledTime)) {
      setResult('예약 발송 시 날짜와 시간을 입력해주세요.')
      return
    }

    setSending(true); setResult('')
    try {
      const validButtons = buttons.filter(b => b.name.trim() && b.linkMo.trim())
      const body: Record<string, unknown> = {
        content: content.trim(),
        senderNumber,
        recipients: recipients.map((r) => ({ phone: r.phone })),
        buttons: validButtons.length > 0 ? validButtons : undefined,
      }
      if (isScheduled) {
        body.scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString()
      }

      const res = await fetch('/api/kakao/friendtalk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      if (isScheduled) {
        setResult(`📅 친구톡이 ${scheduledDate} ${scheduledTime}에 예약되었습니다! (캠페인 ID: ${data.campaignId})`)
      } else {
        setResult(`✅ 카카오 친구톡이 성공적으로 발송되었습니다! (캠페인 ID: ${data.campaignId})`)
      }
      setRecipients([]); setContent(''); setButtons([])
      setIsScheduled(false); setScheduledDate(''); setScheduledTime('')
    } catch (err: unknown) {
      setResult(err instanceof Error ? err.message : '발송에 실패했습니다.')
    } finally { setSending(false) }
  }

  const getMinDate = () => new Date().toISOString().split('T')[0]

  return (
    <div className="mx-auto max-w-4xl">
      {/* Info banner */}
      <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        <strong>친구톡(FriendTalk)</strong>은 카카오채널 친구를 추가한 사용자에게 자유 텍스트로 발송할 수 있는 메시지입니다. 템플릿 사전 승인이 필요 없습니다.
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {/* Left: Content & Settings */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-500" />
            <h3 className="text-lg font-semibold text-gray-900">친구톡 내용 작성</h3>
          </div>

          {/* Content textarea */}
          <div className="mb-4">
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">메시지 내용</label>
              <span className={`text-xs ${content.length > 950 ? 'text-red-500' : 'text-gray-400'}`}>
                {content.length} / 1000
              </span>
            </div>
            <textarea
              value={content}
              onChange={(e) => { if (e.target.value.length <= 1000) setContent(e.target.value) }}
              placeholder="친구톡 메시지 내용을 자유롭게 입력하세요."
              rows={8}
              className="w-full resize-none rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>

          {/* Buttons */}
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">링크 버튼 (선택, 최대 5개)</label>
              {buttons.length < 5 && (
                <button
                  type="button"
                  onClick={addButton}
                  className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700"
                >
                  <Plus className="h-3 w-3" /> 버튼 추가
                </button>
              )}
            </div>
            {buttons.length === 0 ? (
              <p className="text-xs text-gray-400">버튼을 추가하면 메시지 하단에 링크 버튼이 표시됩니다.</p>
            ) : (
              <div className="space-y-2">
                {buttons.map((btn, idx) => (
                  <div key={idx} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600">버튼 {idx + 1}</span>
                      <button type="button" onClick={() => removeButton(idx)} className="text-gray-400 hover:text-red-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={btn.name}
                      onChange={(e) => updateButton(idx, 'name', e.target.value)}
                      placeholder="버튼 이름"
                      className="mb-2 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-green-500 focus:outline-none"
                    />
                    <div className="relative">
                      <LinkIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                      <input
                        type="url"
                        value={btn.linkMo}
                        onChange={(e) => updateButton(idx, 'linkMo', e.target.value)}
                        placeholder="https://example.com"
                        className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-8 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-green-500 focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

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
                  className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-left transition-colors hover:border-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                >
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-green-600" />
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
                        className={`flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-green-50 ${
                          senderNumber === num.phoneNumber ? 'bg-green-50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Phone className={`h-4 w-4 ${senderNumber === num.phoneNumber ? 'text-green-600' : 'text-gray-400'}`} />
                          <span className={`text-sm font-medium ${senderNumber === num.phoneNumber ? 'text-green-700' : 'text-gray-900'}`}>
                            {formatPhoneDisplay(num.phoneNumber)}
                          </span>
                        </div>
                        {senderNumber === num.phoneNumber && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">선택됨</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <p className="mt-1 text-xs text-gray-400">친구톡 발송 실패 시 SMS로 대체 발송됩니다.</p>
          </div>

          {/* Schedule toggle */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={isScheduled}
                onChange={(e) => setIsScheduled(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
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
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none"
                />
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none"
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
              isDragOver ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
            }`}
          >
            <FileSpreadsheet className={`h-5 w-5 flex-shrink-0 ${isDragOver ? 'text-green-500' : 'text-gray-400'}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-700">CSV 파일 업로드 또는 Excel 붙여넣기</p>
              <p className="text-xs text-gray-500">이름, 전화번호 컬럼이 포함된 CSV 파일을 드래그하세요</p>
            </div>
            <Upload className={`h-4 w-4 flex-shrink-0 ${isDragOver ? 'text-green-500' : 'text-gray-400'}`} />
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

          {/* Contact search */}
          <div className="relative mb-3" ref={contactSearchRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              {searchLoading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
              )}
              {!searchLoading && contactSearch && (
                <button
                  type="button"
                  onClick={() => { setContactSearch(''); setShowSearchDropdown(false) }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <input
                type="text"
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowSearchDropdown(true)}
                placeholder="연락처 검색 (이름, 전화번호, 이메일...)"
                className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>
            {showSearchDropdown && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                {searchResults.length === 0 ? (
                  <p className="px-4 py-3 text-center text-sm text-gray-500">검색 결과가 없습니다.</p>
                ) : (
                  searchResults.map((contact) => {
                    const cleaned = normalizePhoneNumber(contact.phone)
                    const isAdded = recipients.some(r => r.phone === cleaned)
                    return (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => addFromSearch(contact)}
                        disabled={isAdded}
                        className="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-4 py-2.5 text-left last:border-b-0 hover:bg-green-50 disabled:cursor-default disabled:opacity-60"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {contact.name && <p className="truncate text-sm font-medium text-gray-900">{contact.name}</p>}
                            {isAdded && <span className="shrink-0 text-xs text-green-600">✓ 추가됨</span>}
                          </div>
                          <p className="text-xs text-gray-600">{contact.phone}</p>
                          {contact.email && <p className="truncate text-xs text-gray-400">{contact.email}</p>}
                        </div>
                        {!isAdded && <Plus className="h-4 w-4 shrink-0 text-green-500" />}
                      </button>
                    )
                  })
                )}
              </div>
            )}
          </div>

          {/* Manual phone input */}
          <div className="mb-4 flex gap-2">
            <input
              type="text"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRecipient())}
              onPaste={handlePaste}
              placeholder="전화번호 직접 입력"
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
            <button onClick={addRecipient} className="rounded-lg bg-gray-100 p-2.5 text-gray-700 hover:bg-gray-200">
              <Plus className="h-5 w-5" />
            </button>
          </div>

          {/* Recipient list */}
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {recipients.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-500">
                수신자를 추가해주세요.<br />CSV 업로드, 검색, 또는 HubSpot에서 가져올 수 있습니다.
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
          disabled={sending || !content.trim() || recipients.length === 0}
          className={`flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
            isScheduled ? 'bg-purple-600 hover:bg-purple-700' : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {sending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isScheduled ? (
            <Clock className="h-5 w-5" />
          ) : (
            <Send className="h-5 w-5" />
          )}
          {sending ? '처리 중...' : isScheduled ? '친구톡 예약 발송' : '친구톡 발송하기'}
        </button>
      </div>

      {/* HubSpot Form Picker Modal */}
      {showHubSpotPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowHubSpotPicker(false)}>
          <div className="flex w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl" style={{ maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
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

              <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                {!selectedFormId ? (
                  <div className="flex flex-1 items-center justify-center text-sm text-gray-400">왼쪽에서 양식을 선택하세요</div>
                ) : hubSpotContactsLoading ? (
                  <div className="flex flex-1 items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  </div>
                ) : hubSpotContacts.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center text-sm text-gray-400">이 양식의 제출 데이터가 없습니다.</div>
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
                        <label key={contact.phone} className="flex cursor-pointer items-center gap-3 border-b border-gray-100 px-4 py-2.5 last:border-b-0 hover:bg-orange-50">
                          <div className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors ${
                            checkedPhones.has(contact.phone) ? 'border-orange-500 bg-orange-500' : 'border-gray-300 bg-white'
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

export default function KakaoFriendtalkPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" /></div>}>
      <FriendtalkContent />
    </Suspense>
  )
}
