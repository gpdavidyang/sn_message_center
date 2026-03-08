'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Settings,
  LogOut,
  MessageCircle,
  Menu,
  X,
  ClipboardList,
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
      { name: '문자 작성', href: '/messages/compose' },
    ],
  },
  {
    name: '카카오 알림톡',
    href: '/kakao',
    icon: MessageCircle,
    children: [
      { name: '템플릿 관리', href: '/kakao/templates' },
      { name: '알림톡 작성', href: '/kakao/send' },
    ],
  },
  {
    name: '발송 내역',
    href: '/messages/campaigns',
    icon: ClipboardList,
    matchPrefix: true,
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
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mketer.png" alt="M-Keter" className="h-9 w-9 rounded-full" />
          <div className="flex flex-col">
            <span className="text-base font-bold leading-tight text-gray-900">M-Keter</span>
            <span className="text-[10px] leading-tight text-gray-400">Message Center</span>
          </div>
        </div>
        {/* Mobile close button */}
        <button
          onClick={() => setMobileOpen(false)}
          className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navigation.map((item) => {
          const isActive = (item as { matchPrefix?: boolean }).matchPrefix
            ? pathname.startsWith(item.href)
            : pathname === item.href ||
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

      {/* Logout + Footer */}
      <div className="border-t border-gray-200 p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
        >
          <LogOut className="h-5 w-5" />
          로그아웃
        </button>
        <div className="mt-2 flex flex-col items-center gap-1 px-3 pb-1">
          <div className="flex items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-sparknova.png" alt="SparkNova" className="h-4" />
            <span className="text-[10px] text-gray-400">powered by SparkNova</span>
          </div>
          <span className="text-[9px] text-gray-300">All Rights Reserved &copy; SparkNova</span>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-40 rounded-lg bg-white p-2 shadow-md lg:hidden"
        aria-label="메뉴 열기"
      >
        <Menu className="h-5 w-5 text-gray-700" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white shadow-xl transition-transform duration-300 lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden h-screen w-64 flex-col border-r border-gray-200 bg-white lg:flex">
        {sidebarContent}
      </aside>
    </>
  )
}
