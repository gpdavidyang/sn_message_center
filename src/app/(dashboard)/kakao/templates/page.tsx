'use client'

import { MessageCircle } from 'lucide-react'

export default function KakaoTemplatesPage() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white py-12 text-center shadow-sm">
      <MessageCircle className="mx-auto h-10 w-10 text-yellow-500" />
      <h3 className="mt-4 text-lg font-semibold text-gray-900">카카오 알림톡 템플릿</h3>
      <p className="mt-2 text-sm text-gray-500">
        SOLAPI 콘솔에서 카카오 채널 연동 및 템플릿 등록 후 이용 가능합니다.
      </p>
      <p className="mt-1 text-sm text-gray-500">
        Phase 4에서 구현 예정입니다.
      </p>
    </div>
  )
}
