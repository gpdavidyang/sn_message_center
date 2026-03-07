'use client'

import { useState, useEffect } from 'react'
import { Users, Loader2, UserPlus, Shield, ShieldCheck, X } from 'lucide-react'

interface UserProfile {
  id: string
  full_name: string
  role: string
  email: string
  last_sign_in: string | null
  email_confirmed: boolean
  created_at: string
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState('')

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setUsers(data.users || [])
      }
    } catch {
      setError('사용자 목록을 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviting(true); setInviteResult('')
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, fullName: inviteName, role: inviteRole }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setInviteResult(`✅ ${data.message}`)
      setInviteEmail(''); setInviteName(''); setInviteRole('member')
      setShowInvite(false)
      fetchUsers()
    } catch (err: unknown) {
      setInviteResult(err instanceof Error ? err.message : '초대에 실패했습니다.')
    } finally {
      setInviting(false)
    }
  }

  const changeRole = async (userId: string, newRole: string) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '역할 변경 실패')
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <Shield className="mx-auto h-10 w-10 text-red-400" />
        <p className="mt-2 font-medium text-red-700">{error}</p>
        <p className="mt-1 text-sm text-red-500">관리자 계정으로 로그인해주세요.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-gray-600">소수 테스트 사용자를 초대하고 관리하세요.</p>
        <button
          onClick={() => setShowInvite(!showInvite)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <UserPlus className="h-4 w-4" /> 사용자 초대
        </button>
      </div>

      {/* Invite Form */}
      {showInvite && (
        <form onSubmit={handleInvite} className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">사용자 초대</h3>
            <button type="button" onClick={() => setShowInvite(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">이메일 *</label>
              <input
                type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com" required
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">이름</label>
              <input
                type="text" value={inviteName} onChange={(e) => setInviteName(e.target.value)}
                placeholder="홍길동"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">역할</label>
              <select
                value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              >
                <option value="member">일반 사용자</option>
                <option value="admin">관리자</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <button
              type="submit" disabled={inviting || !inviteEmail}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {inviting ? '초대 중...' : '초대 링크 발송'}
            </button>
          </div>
        </form>
      )}

      {inviteResult && (
        <div className={`mb-4 rounded-lg p-3 text-sm font-medium ${
          inviteResult.startsWith('✅') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>{inviteResult}</div>
      )}

      {/* User List */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-4 py-3">
          <h3 className="font-semibold text-gray-900">등록된 사용자 ({users.length}명)</h3>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-600">이름</th>
              <th className="px-4 py-3 font-medium text-gray-600">이메일</th>
              <th className="px-4 py-3 font-medium text-gray-600">역할</th>
              <th className="px-4 py-3 font-medium text-gray-600">상태</th>
              <th className="px-4 py-3 font-medium text-gray-600">마지막 로그인</th>
              <th className="px-4 py-3 font-medium text-gray-600">가입일</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{u.full_name || '-'}</td>
                <td className="px-4 py-3 text-gray-700">{u.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={u.role}
                    onChange={(e) => changeRole(u.id, e.target.value)}
                    className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="admin">관리자</option>
                    <option value="member">일반</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  {u.email_confirmed ? (
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <ShieldCheck className="h-3.5 w-3.5" /> 활성
                    </span>
                  ) : (
                    <span className="text-xs text-yellow-600">초대 대기</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {u.last_sign_in ? new Date(u.last_sign_in).toLocaleString('ko-KR') : '-'}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {new Date(u.created_at).toLocaleDateString('ko-KR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
