'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

interface Props {
  open: boolean
  onClose: () => void
}

export default function ProfileSheet({ open, onClose }: Props) {
  const { user, profile, signOut, refreshProfile } = useAuth()
  const [householdName, setHouseholdName] = useState<string | null>(null)
  const [inviteCode, setInviteCode]       = useState<string | null>(null)
  const [inviteCopied, setInviteCopied]   = useState(false)
  const [members, setMembers]             = useState<{ user_id: string; display_name: string; role: string }[]>([])
  const [updatingRole, setUpdatingRole]   = useState<string | null>(null)
  const [signingOut, setSigningOut]       = useState(false)
  const [mounted, setMounted]             = useState(false)
  const [savingLang, setSavingLang]       = useState(false)

  const LANGUAGES = [
    { code: 'en', flag: '🇬🇧', label: 'English' },
    { code: 'et', flag: '🇪🇪', label: 'Eesti'   },
    { code: 'ru', flag: '🇷🇺', label: 'Русский'  },
  ]

  async function changeLanguage(lang: string) {
    if (!user) return
    setSavingLang(true)
    await supabase.from('profiles').update({ language: lang }).eq('user_id', user.id)
    await refreshProfile()
    setSavingLang(false)
  }

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!open || !profile?.household_id) return
    supabase
      .from('households')
      .select('name, invite_code')
      .eq('id', profile.household_id)
      .single()
      .then(({ data }) => {
        setHouseholdName(data?.name ?? null)
        setInviteCode(data?.invite_code ?? null)
      })
    supabase
      .from('profiles')
      .select('user_id, display_name, role')
      .eq('household_id', profile.household_id)
      .then(({ data }) => setMembers(data ?? []))
  }, [open, profile?.household_id])

  async function changeRole(userId: string, newRole: 'parent' | 'child') {
    setUpdatingRole(userId)
    await supabase.from('profiles').update({ role: newRole }).eq('user_id', userId)
    setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, role: newRole } : m))
    setUpdatingRole(null)
  }

  async function copyInviteLink() {
    let code = inviteCode
    if (!code) {
      code = Math.random().toString(36).slice(2, 10)
      await supabase.from('households').update({ invite_code: code }).eq('id', profile!.household_id!)
      setInviteCode(code)
    }
    await navigator.clipboard.writeText(`${window.location.origin}/join?code=${code}`)
    setInviteCopied(true)
    setTimeout(() => setInviteCopied(false), 2000)
  }

  if (!open || !mounted) return null

  const initials = profile?.display_name
    ? profile.display_name.trim().split(/\s+/).map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  async function handleSignOut() {
    setSigningOut(true)
    await signOut()
    onClose()
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
          {/* header row */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-700">Account</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 text-xl leading-none hover:bg-slate-200 active:bg-slate-300 transition-colors"
            >
              ×
            </button>
          </div>

          <div className="px-6 py-5">
            {/* avatar + identity */}
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                <span className="text-white text-lg font-bold">{initials}</span>
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-800 text-base leading-tight truncate">
                  {profile?.display_name ?? '—'}
                </p>
                <p className="text-slate-500 text-sm truncate">{user?.email}</p>
                {householdName && (
                  <p className="text-emerald-600 text-xs font-medium mt-0.5">🏠 {householdName}</p>
                )}
              </div>
            </div>

            {/* role badge */}
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl mb-5">
              <span className="text-lg">{profile?.role === 'parent' ? '👩‍👧' : '🧒'}</span>
              <div>
                <p className="text-sm font-semibold text-slate-700 capitalize">
                  {profile?.role ?? 'Member'}
                </p>
                <p className="text-xs text-slate-400">Account role</p>
              </div>
            </div>

            {/* Language picker */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Language · AI responses</p>
              <div className="flex gap-2">
                {LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => void changeLanguage(lang.code)}
                    disabled={savingLang}
                    className={`flex-1 flex flex-col items-center py-2.5 rounded-xl border text-sm font-medium transition-colors disabled:opacity-60 ${
                      (profile?.language ?? 'en') === lang.code
                        ? 'bg-emerald-500 text-white border-emerald-500'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-xl">{lang.flag}</span>
                    <span className="text-xs mt-0.5">{lang.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* household members */}
            {members.length > 0 && (
              <div className="mb-5">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  {householdName ?? 'Household'} · {members.length} member{members.length > 1 ? 's' : ''}
                </p>
                <div className="space-y-1.5">
                  {members.map(m => {
                    const isMe = m.user_id === user?.id
                    const canEditRole = profile?.role === 'parent' && !isMe
                    const memberInitials = m.display_name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
                    return (
                      <div key={m.user_id} className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-xl">
                        <div className="w-8 h-8 rounded-full bg-emerald-400 flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-bold">{memberInitials}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">
                            {m.display_name}{isMe && <span className="text-slate-400 font-normal"> (you)</span>}
                          </p>
                          <p className="text-xs text-slate-400 capitalize">{m.role}</p>
                        </div>
                        {canEditRole && (
                          <button
                            onClick={() => void changeRole(m.user_id, m.role === 'parent' ? 'child' : 'parent')}
                            disabled={updatingRole === m.user_id}
                            className="text-xs text-emerald-600 font-medium px-2 py-1 rounded-lg hover:bg-emerald-100 active:bg-emerald-200 disabled:opacity-40 transition-colors flex-shrink-0"
                          >
                            {updatingRole === m.user_id ? '…' : m.role === 'parent' ? '→ Child' : '→ Parent'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* invite link — parents only */}
            {profile?.role === 'parent' && (
              <button
                onClick={() => void copyInviteLink()}
                className="w-full py-3 border border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold rounded-xl text-sm hover:bg-emerald-100 active:bg-emerald-200 transition-colors mb-3"
              >
                {inviteCopied ? '✓ Link copied!' : '🔗 Copy invite link'}
              </button>
            )}

            {/* sign out */}
            <button
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className="w-full py-3 border border-slate-200 text-slate-600 font-semibold rounded-xl text-sm hover:bg-slate-50 active:bg-slate-100 disabled:opacity-60 transition-colors"
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}
