'use client'

import { Phone } from 'lucide-react'

export default function SenderNumbersPage() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white py-12 text-center shadow-sm">
      <Phone className="mx-auto h-10 w-10 text-gray-400" />
      <h3 className="mt-4 text-lg font-semibold text-gray-900">발신번호 관리</h3>
      <p className="mt-2 text-sm text-gray-500">
        SOLAPI 콘솔에서 발신번호를 등록한 후 여기서 확인할 수 있습니다.
      </p>
      <p className="mt-1 text-sm text-gray-500">
        Phase 5에서 구현 예정입니다.
      </p>
    </div>
  )
}
