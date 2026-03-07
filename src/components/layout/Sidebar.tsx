'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Send,
  Settings,
  LogOut,
  MessageCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navigation = [
  {
    name: '대시보드',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    name: '연락처',
    href: '/contacts',
    icon: Users,
    children: [
      { name: 'HubSpot 연락처', href: '/contacts/hubspot' },
      { name: '연락처 그룹', href: '/contacts/groups' },
    ],
  },
  {
    name: '문자 메시지',
    href: '/messages',
    icon: MessageSquare,
    children: [
      { name: '메시지 작성', href: '/messages/compose' },
      { name: '캠페인 목록', href: '/messages/campaigns' },
    ],
  },
  {
    name: '카카오 알림톡',
    href: '/kakao',
    icon: MessageCircle,
    children: [
      { name: '템플릿 관리', href: '/kakao/templates' },
      { name: '알림톡 발송', href: '/kakao/send' },
    ],
  },
  {
    name: '설정',
    href: '/settings',
    icon: Settings,
    children: [
      { name: 'API 키 관리', href: '/settings/api' },
      { name: '발신번호 관리', href: '/settings/sender' },
      { name: '사용자 관리', href: '/settings/users' },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-gray-200 px-6">
        <Send className="h-6 w-6 text-blue-600" />
        <span className="text-lg font-bold text-gray-900">SparkNova</span>
        <span className="text-xs text-gray-500">Message</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href ||
            item.children?.some((child) => pathname === child.href)

          return (
            <div key={item.name} className="mb-1">
              <Link
                href={item.children ? item.children[0].href : item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>

              {/* Sub navigation */}
              {item.children && isActive && (
                <div className="ml-8 mt-1 space-y-1">
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={cn(
                        'block rounded-md px-3 py-1.5 text-sm transition-colors',
                        pathname === child.href
                          ? 'font-medium text-blue-700'
                          : 'text-gray-600 hover:text-gray-900'
                      )}
                    >
                      {child.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="border-t border-gray-200 p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
        >
          <LogOut className="h-5 w-5" />
          로그아웃
        </button>
      </div>
    </aside>
  )
}
