'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Send, Loader2, ArrowLeft } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="mb-4 text-4xl">✉️</div>
          <h2 className="mb-2 text-xl font-semibold text-gray-900">
            이메일을 확인해주세요
          </h2>
          <p className="mb-6 text-gray-600">
            <strong>{email}</strong>로 비밀번호 재설정 링크를 보냈습니다.
            이메일을 확인하여 비밀번호를 변경해주세요.
          </p>
          <Link
            href="/auth/login"
            className="text-sm font-medium text-blue-600 hover:text-blue-500"
          >
            로그인 페이지로 돌아가기
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mb-4 flex items-center justify-center gap-2">
            <Send className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">SparkNova</span>
          </div>
          <p className="text-gray-600">비밀번호를 재설정합니다</p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleReset}
          className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm"
        >
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <p className="mb-4 text-sm text-gray-600">
            가입할 때 사용한 이메일 주소를 입력하면 비밀번호 재설정 링크를 보내드립니다.
          </p>

          <div className="mb-6">
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              이메일
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="name@company.com"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            재설정 링크 보내기
          </button>

          <div className="mt-4 text-center">
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="h-4 w-4" />
              로그인으로 돌아가기
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
