'use client'

import { usePathname } from 'next/navigation'
import { Bell } from 'lucide-react'

const pageTitles: Record<string, string> = {
  '/': '대시보드',
  '/contacts/hubspot': 'HubSpot 연락처',
  '/contacts/groups': '연락처 그룹',
  '/messages/compose': '문자 작성',
  '/messages/campaigns': '발송 내역',
  '/kakao/templates': '카카오 알림톡 템플릿',
  '/kakao/send': '알림톡 작성',
  '/settings/api': 'API 키 관리',
  '/settings/sender': '발신번호 관리',
  '/settings/users': '사용자 관리',
}

export default function Header() {
  const pathname = usePathname()
  const title = pageTitles[pathname] || 'M-Keter Message Center'

  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 sm:h-16 sm:px-6">
      {/* Spacer for mobile hamburger */}
      <div className="w-10 lg:hidden" />
      <h1 className="text-base font-semibold text-gray-900 sm:text-xl">{title}</h1>
      <div className="flex items-center gap-4">
        <button className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100">
          <Bell className="h-5 w-5" />
        </button>
      </div>
    </header>
  )
}
