'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Users, Loader2, Pencil, Trash2, X, Eye, UserMinus } from 'lucide-react'
import { formatPhoneDisplay } from '@/lib/utils/phone'

interface ContactGroup {
  id: string
  name: string
  description: string | null
  contact_count: number
  created_at: string
}

interface GroupMember {
  contact_id: string
  contacts: {
    id: string
    first_name: string | null
    last_name: string | null
    phone: string | null
    email: string | null
    company: string | null
  }
}

export default function ContactGroupsPage() {
  const [groups, setGroups] = useState<ContactGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [editingGroup, setEditingGroup] = useState<ContactGroup | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Member view
  const [viewingGroup, setViewingGroup] = useState<ContactGroup | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())

  const supabase = createClient()

  const fetchGroups = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('contact_groups')
      .select('*')
      .order('created_at', { ascending: false })
    setGroups(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchGroups() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('contact_groups').insert({
      user_id: user.id,
      name,
      description: description || null,
    })
    setName(''); setDescription(''); setShowForm(false)
    fetchGroups()
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingGroup) return

    const res = await fetch('/api/contacts/groups', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingGroup.id, name, description }),
    })
    if ((await res.json()).success) {
      setEditingGroup(null); setName(''); setDescription('')
      fetchGroups()
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    const res = await fetch('/api/contacts/groups', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if ((await res.json()).success) {
      fetchGroups()
      if (viewingGroup?.id === id) setViewingGroup(null)
    }
    setDeletingId(null)
  }

  const startEdit = (group: ContactGroup) => {
    setEditingGroup(group)
    setName(group.name)
    setDescription(group.description || '')
    setShowForm(false)
  }

  const viewMembers = async (group: ContactGroup) => {
    setViewingGroup(group)
    setLoadingMembers(true)
    try {
      const res = await fetch(`/api/contacts/groups/members?groupId=${group.id}`)
      const data = await res.json()
      setMembers(data.members || [])
    } catch { setMembers([]) }
    finally { setLoadingMembers(false) }
  }

  const removeMember = async (contactId: string) => {
    if (!viewingGroup) return
    setRemovingIds(prev => new Set(prev).add(contactId))
    try {
      await fetch('/api/contacts/groups/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: viewingGroup.id, contactIds: [contactId] }),
      })
      setMembers(prev => prev.filter(m => m.contact_id !== contactId))
      // Update count in local state
      setGroups(prev => prev.map(g =>
        g.id === viewingGroup.id ? { ...g, contact_count: Math.max(0, g.contact_count - 1) } : g
      ))
    } catch { /* ignore */ }
    finally { setRemovingIds(prev => { const s = new Set(prev); s.delete(contactId); return s }) }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-gray-600">연락처 그룹을 만들어 수신자를 관리하세요.</p>
        <button
          onClick={() => { setShowForm(!showForm); setEditingGroup(null); setName(''); setDescription('') }}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> 새 그룹
        </button>
      </div>

      {/* Create/Edit Form */}
      {(showForm || editingGroup) && (
        <form
          onSubmit={editingGroup ? handleEdit : handleCreate}
          className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              {editingGroup ? '그룹 수정' : '새 그룹 만들기'}
            </h3>
            <button type="button" onClick={() => { setShowForm(false); setEditingGroup(null) }} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">그룹 이름</label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              required
            />
          </div>
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">설명 (선택)</label>
            <input
              type="text" value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            {editingGroup ? '수정' : '생성'}
          </button>
        </form>
      )}

      {/* Member View Modal */}
      {viewingGroup && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              &quot;{viewingGroup.name}&quot; 멤버 목록
            </h3>
            <button onClick={() => setViewingGroup(null)} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          {loadingMembers ? (
            <div className="py-6 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : members.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">이 그룹에 멤버가 없습니다.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-blue-200 bg-blue-100/50">
                  <tr>
                    <th className="px-3 py-2 font-medium text-gray-600">이름</th>
                    <th className="px-3 py-2 font-medium text-gray-600">전화번호</th>
                    <th className="px-3 py-2 font-medium text-gray-600">이메일</th>
                    <th className="px-3 py-2 font-medium text-gray-600">회사</th>
                    <th className="px-3 py-2 font-medium text-gray-600"></th>
                  </tr>
                </thead>
                <tbody>
                  {members.map(m => (
                    <tr key={m.contact_id} className="border-b border-blue-100">
                      <td className="px-3 py-2 text-gray-900">
                        {[m.contacts.first_name, m.contacts.last_name].filter(Boolean).join(' ') || '-'}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {m.contacts.phone ? formatPhoneDisplay(m.contacts.phone) : '-'}
                      </td>
                      <td className="px-3 py-2 text-gray-700">{m.contacts.email || '-'}</td>
                      <td className="px-3 py-2 text-gray-700">{m.contacts.company || '-'}</td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => removeMember(m.contact_id)}
                          disabled={removingIds.has(m.contact_id)}
                          className="text-gray-400 hover:text-red-500 disabled:opacity-50"
                          title="그룹에서 제거"
                        >
                          <UserMinus className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Groups list */}
      {loading ? (
        <div className="py-12 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-12 text-center shadow-sm">
          <Users className="mx-auto h-10 w-10 text-gray-400" />
          <p className="mt-2 text-gray-500">아직 그룹이 없습니다.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <div key={group.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-2 flex items-start justify-between">
                <h3 className="font-semibold text-gray-900">{group.name}</h3>
                <div className="flex gap-1">
                  <button onClick={() => viewMembers(group)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600" title="멤버 보기">
                    <Eye className="h-4 w-4" />
                  </button>
                  <button onClick={() => startEdit(group)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600" title="수정">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => { if (confirm(`"${group.name}" 그룹을 삭제하시겠습니까?`)) handleDelete(group.id) }}
                    disabled={deletingId === group.id}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500 disabled:opacity-50"
                    title="삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {group.description && <p className="mt-1 text-sm text-gray-500">{group.description}</p>}
              <div className="mt-3 flex items-center gap-1 text-sm text-gray-600">
                <Users className="h-4 w-4" /> {group.contact_count}명
              </div>
              <p className="mt-1 text-xs text-gray-400">
                {new Date(group.created_at).toLocaleDateString('ko-KR')} 생성
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
