'use client'

import { MessageCircle } from 'lucide-react'

export default function KakaoSendPage() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white py-12 text-center shadow-sm">
      <MessageCircle className="mx-auto h-10 w-10 text-yellow-500" />
      <h3 className="mt-4 text-lg font-semibold text-gray-900">카카오 알림톡 발송</h3>
      <p className="mt-2 text-sm text-gray-500">
        템플릿 설정이 완료되면 알림톡을 발송할 수 있습니다.
      </p>
      <p className="mt-1 text-sm text-gray-500">
        Phase 4에서 구현 예정입니다.
      </p>
    </div>
  )
}
