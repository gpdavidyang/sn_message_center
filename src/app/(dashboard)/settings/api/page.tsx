'use client'

import { useState, useEffect } from 'react'
import { Key, CheckCircle, XCircle, Loader2 } from 'lucide-react'

export default function ApiSettingsPage() {
  const [balance, setBalance] = useState<{ balance: number; point: number } | null>(null)
  const [loadingBalance, setLoadingBalance] = useState(false)
  const [balanceError, setBalanceError] = useState('')

  const checkSolapiBalance = async () => {
    setLoadingBalance(true)
    setBalanceError('')
    try {
      const res = await fetch('/api/solapi/balance')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setBalance(data)
    } catch (err: unknown) {
      setBalanceError(err instanceof Error ? err.message : '조회 실패')
    } finally {
      setLoadingBalance(false)
    }
  }

  const [hubspotStatus, setHubspotStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')

  const checkHubspot = async () => {
    setHubspotStatus('loading')
    try {
      const res = await fetch('/api/contacts/hubspot?limit=1')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setHubspotStatus('ok')
    } catch {
      setHubspotStatus('error')
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* HubSpot */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <Key className="h-5 w-5 text-orange-500" />
          <h3 className="text-lg font-semibold text-gray-900">HubSpot API</h3>
        </div>
        <p className="mb-4 text-sm text-gray-600">
          개인 액세스 키가 .env.local에 설정되어 있습니다.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={checkHubspot}
            disabled={hubspotStatus === 'loading'}
            className="rounded-lg bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700 hover:bg-orange-100"
          >
            {hubspotStatus === 'loading' ? (
              <Loader2 className="inline h-4 w-4 animate-spin" />
            ) : (
              '연결 테스트'
            )}
          </button>
          {hubspotStatus === 'ok' && (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" /> 연결 성공
            </span>
          )}
          {hubspotStatus === 'error' && (
            <span className="flex items-center gap-1 text-sm text-red-600">
              <XCircle className="h-4 w-4" /> 연결 실패
            </span>
          )}
        </div>
      </div>

      {/* SOLAPI */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <Key className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-gray-900">SOLAPI</h3>
        </div>
        <p className="mb-4 text-sm text-gray-600">
          API Key / Secret이 .env.local에 설정되어 있습니다.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={checkSolapiBalance}
            disabled={loadingBalance}
            className="rounded-lg bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            {loadingBalance ? (
              <Loader2 className="inline h-4 w-4 animate-spin" />
            ) : (
              '잔액 조회'
            )}
          </button>
          {balance && (
            <span className="text-sm text-gray-700">
              잔액: <strong>{balance.balance?.toLocaleString()}원</strong> / 포인트:{' '}
              <strong>{balance.point?.toLocaleString()}</strong>
            </span>
          )}
          {balanceError && (
            <span className="flex items-center gap-1 text-sm text-red-600">
              <XCircle className="h-4 w-4" /> {balanceError}
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
        API 키를 변경하려면 프로젝트의 <code className="rounded bg-gray-200 px-1.5 py-0.5 text-xs">.env.local</code> 파일을 수정하고 서버를 재시작하세요.
      </div>
    </div>
  )
}
