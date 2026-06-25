'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/contexts/AuthContext'
import type { Pet } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useT } from '@/lib/i18n'

const LANGUAGES = [
  { code: 'en', abbr: 'ENG', label: 'English' },
  { code: 'et', abbr: 'EST', label: 'Eesti'   },
  { code: 'ru', abbr: 'RUS', label: 'Русский'  },
]

const PET_TYPES = [
  { type: 'dog',    emoji: '🐕' },
  { type: 'cat',    emoji: '🐈' },
  { type: 'rabbit', emoji: '🐇' },
  { type: 'bird',   emoji: '🐦' },
  { type: 'fish',   emoji: '🐠' },
]

const PET_EMOJI: Record<string, string> = {
  dog: '🐕', cat: '🐈', rabbit: '🐇', bird: '🐦', fish: '🐠',
}
function petEmoji(type: string) { return PET_EMOJI[type] ?? '🐾' }

interface Props {
  open: boolean
  onClose: () => void
}

export default function ProfileSheet({ open, onClose }: Props) {
  const { user, profile, signOut, refreshProfile } = useAuth()
  const t = useT()

  const [householdName, setHouseholdName] = useState<string | null>(null)
  const [inviteCode, setInviteCode]       = useState<string | null>(null)
  const [inviteCopied, setInviteCopied]   = useState(false)
  const [members, setMembers]             = useState<{ user_id: string; display_name: string; role: string }[]>([])
  const [updatingRole, setUpdatingRole]   = useState<string | null>(null)
  const [signingOut, setSigningOut]       = useState(false)
  const [mounted, setMounted]             = useState(false)

  const [savingLang, setSavingLang]       = useState(false)
  const [langDropdownOpen, setLangDropdownOpen] = useState(false)
  const langDropdownRef = useRef<HTMLDivElement>(null)

  const [numPeople, setNumPeople]         = useState<number>(profile?.num_people ?? 1)
  const [pets, setPets]                   = useState<Pet[]>(profile?.pets ?? [])
  const [showPetPicker, setShowPetPicker] = useState(false)
  const [otherPetName, setOtherPetName]   = useState('')
  const [householdSaved, setHouseholdSaved] = useState(false)

  // Refs for auto-save debounce
  const saveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipSave    = useRef(true)
  const numPeopleRef = useRef(numPeople)
  const petsRef      = useRef(pets)
  numPeopleRef.current = numPeople
  petsRef.current      = pets

  useEffect(() => { setMounted(true) }, [])

  // Load household data when sheet opens
  useEffect(() => {
    if (!open || !profile?.household_id) return
    supabase.from('households').select('name, invite_code').eq('id', profile.household_id).single()
      .then(({ data }) => { setHouseholdName(data?.name ?? null); setInviteCode(data?.invite_code ?? null) })
    supabase.from('profiles').select('user_id, display_name, role').eq('household_id', profile.household_id)
      .then(({ data }) => setMembers(data ?? []))
  }, [open, profile?.household_id])

  // Sync people + pets from profile when sheet opens; skip auto-save during sync
  useEffect(() => {
    if (open && profile) {
      skipSave.current = true
      setNumPeople(profile.num_people ?? 1)
      setPets(profile.pets ?? [])
      const t = setTimeout(() => { skipSave.current = false }, 300)
      return () => clearTimeout(t)
    }
    if (!open) skipSave.current = true
  }, [open, profile?.num_people, profile?.pets])

  // Auto-save household with debounce
  useEffect(() => {
    if (skipSave.current || !user || !open) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await supabase.from('profiles')
        .update({ num_people: numPeopleRef.current, pets: petsRef.current })
        .eq('user_id', user.id)
      await refreshProfile()
      setHouseholdSaved(true)
      setTimeout(() => setHouseholdSaved(false), 2000)
    }, 800)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [numPeople, pets])

  useEffect(() => {
    if (!langDropdownOpen) return
    function handleClick(e: MouseEvent) {
      if (langDropdownRef.current && !langDropdownRef.current.contains(e.target as Node)) {
        setLangDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [langDropdownOpen])

  async function changeLanguage(lang: string) {
    if (!user) return
    setSavingLang(true)
    await supabase.from('profiles').update({ language: lang }).eq('user_id', user.id)
    await refreshProfile()
    setSavingLang(false)
  }

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

  function addPet(type: string) {
    setPets(prev => {
      const idx = prev.findIndex(p => p.type === type)
      return idx >= 0 ? prev.map((p, i) => i === idx ? { ...p, count: p.count + 1 } : p) : [...prev, { type, count: 1 }]
    })
    setShowPetPicker(false)
  }

  function addOtherPet() {
    const name = otherPetName.trim().toLowerCase()
    if (!name) return
    setPets(prev => {
      const idx = prev.findIndex(p => p.type === name)
      return idx >= 0 ? prev.map((p, i) => i === idx ? { ...p, count: p.count + 1 } : p) : [...prev, { type: name, count: 1 }]
    })
    setOtherPetName('')
    setShowPetPicker(false)
  }

  function updatePetCount(idx: number, delta: number) {
    setPets(prev => prev.map((p, i) => i === idx ? { ...p, count: p.count + delta } : p).filter(p => p.count > 0))
  }

  function removePet(idx: number) {
    setPets(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSignOut() {
    setSigningOut(true)
    await signOut()
    onClose()
  }

  if (!open || !mounted) return null

  const initials = profile?.display_name
    ? profile.display_name.trim().split(/\s+/).map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return createPortal(
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl flex flex-col" style={{ maxHeight: '90dvh' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 flex-shrink-0">
            <h2 className="text-base font-semibold text-slate-700">{t('profile_account')}</h2>
            <div className="flex items-center gap-2">
              {/* Language pill */}
              <div className="relative" ref={langDropdownRef}>
                <button
                  onClick={() => setLangDropdownOpen(v => !v)}
                  disabled={savingLang}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-600 transition-colors disabled:opacity-50"
                >
                  <span>{LANGUAGES.find(l => l.code === (profile?.language ?? 'en'))?.abbr ?? 'ENG'}</span>
                  <span className="text-slate-400 text-[10px]">▾</span>
                </button>
                {langDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-10 min-w-[130px]">
                    {LANGUAGES.map(lang => (
                      <button
                        key={lang.code}
                        onClick={() => { void changeLanguage(lang.code); setLangDropdownOpen(false) }}
                        disabled={savingLang}
                        className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                          (profile?.language ?? 'en') === lang.code
                            ? 'bg-emerald-50 text-emerald-700 font-semibold'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className="font-mono text-xs">{lang.abbr}</span>
                        <span className="text-slate-400 text-xs ml-3">{lang.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 text-xl leading-none hover:bg-slate-200 transition-colors"
              >×</button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

            {/* 1. Identity */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                <span className="text-white text-lg font-bold">{initials}</span>
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-800 text-base leading-tight truncate">{profile?.display_name ?? '—'}</p>
                <p className="text-slate-500 text-sm truncate">{user?.email}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {householdName && <p className="text-emerald-600 text-xs font-medium">🏠 {householdName}</p>}
                  <span className="text-xs text-slate-300">·</span>
                  <p className="text-xs text-slate-400">{profile?.role === 'parent' ? '👩‍👧' : '🧒'} {profile?.role === 'parent' ? t('profile_role_parent') : t('profile_role_child')}</p>
                </div>
              </div>
            </div>

            {/* 3. Members */}
            {members.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  {householdName ?? t('profile_household_label')} · {members.length} {members.length > 1 ? t('profile_members') : t('profile_member')}
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
                            {m.display_name}{isMe && <span className="text-slate-400 font-normal"> ({t('profile_you')})</span>}
                          </p>
                          <p className="text-xs text-slate-400">{m.role === 'parent' ? t('profile_role_parent') : t('profile_role_child')}</p>
                        </div>
                        {canEditRole && (
                          <button
                            onClick={() => void changeRole(m.user_id, m.role === 'parent' ? 'child' : 'parent')}
                            disabled={updatingRole === m.user_id}
                            className="text-xs text-emerald-600 font-medium px-2 py-1 rounded-lg hover:bg-emerald-100 disabled:opacity-40 transition-colors flex-shrink-0"
                          >
                            {updatingRole === m.user_id ? '…' : m.role === 'parent' ? t('profile_to_child') : t('profile_to_parent')}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 4. Household settings */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{t('profile_household_label')}</p>
                {householdSaved && <p className="text-xs text-emerald-600 font-medium">{t('profile_household_saved')}</p>}
              </div>

              {/* People stepper */}
              <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50 rounded-xl mb-2">
                <p className="text-sm font-medium text-slate-700">{t('profile_people_label')}</p>
                <div className="flex items-center gap-3">
                  <button onClick={() => setNumPeople(n => Math.max(1, n - 1))} className="w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-sm transition-colors">−</button>
                  <span className="text-sm font-bold text-slate-800 w-4 text-center">{numPeople}</span>
                  <button onClick={() => setNumPeople(n => Math.min(20, n + 1))} className="w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-sm transition-colors">+</button>
                </div>
              </div>

              {/* Pets */}
              <div className="space-y-1.5">
                <p className="text-xs text-slate-400 font-medium px-1">{t('profile_pets_label')}</p>
                {pets.map((pet, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl">
                    <span className="text-base">{petEmoji(pet.type)}</span>
                    <p className="text-sm text-slate-700 flex-1 capitalize">{PET_EMOJI[pet.type] ? t(`profile_pet_${pet.type}` as Parameters<typeof t>[0]) : pet.type}</p>
                    <button onClick={() => updatePetCount(idx, -1)} className="w-6 h-6 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition-colors">−</button>
                    <span className="text-sm font-bold text-slate-800 w-4 text-center">{pet.count}</span>
                    <button onClick={() => updatePetCount(idx, +1)} className="w-6 h-6 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition-colors">+</button>
                    <button onClick={() => removePet(idx)} className="text-slate-300 hover:text-red-400 text-base ml-1 transition-colors">✕</button>
                  </div>
                ))}

                {showPetPicker ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                    {PET_TYPES.map(pt => (
                      <button
                        key={pt.type}
                        onClick={() => addPet(pt.type)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 border-b border-slate-50 last:border-0 transition-colors"
                      >
                        <span>{pt.emoji}</span><span>{t(`profile_pet_${pt.type}` as Parameters<typeof t>[0])}</span>
                      </button>
                    ))}
                    <div className="flex items-center gap-2 px-3 py-2 border-t border-slate-100">
                      <input
                        type="text"
                        value={otherPetName}
                        onChange={e => setOtherPetName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addOtherPet()}
                        placeholder={t('profile_pet_placeholder')}
                        className="flex-1 text-sm px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-400"
                      />
                      <button onClick={addOtherPet} disabled={!otherPetName.trim()} className="text-xs font-semibold text-emerald-600 disabled:text-slate-300 px-2">
                        {t('profile_household_save')}
                      </button>
                    </div>
                    <button onClick={() => { setShowPetPicker(false); setOtherPetName('') }} className="w-full text-xs text-slate-400 py-1.5 hover:text-slate-600">
                      {t('profile_cancel')}
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setShowPetPicker(true)} className="text-sm text-emerald-600 font-medium hover:text-emerald-700 px-1 py-1">
                    {t('profile_add_pet')}
                  </button>
                )}
              </div>
            </div>

            {/* 5. Actions */}
            {profile?.role === 'parent' && (
              <button
                onClick={() => void copyInviteLink()}
                className="w-full py-3 border border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold rounded-xl text-sm hover:bg-emerald-100 transition-colors"
              >
                {inviteCopied ? t('profile_invite_copied') : t('profile_invite')}
              </button>
            )}

            <button
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className="w-full py-3 border border-slate-200 text-slate-600 font-semibold rounded-xl text-sm hover:bg-slate-50 disabled:opacity-60 transition-colors"
            >
              {signingOut ? t('profile_signing_out') : t('profile_sign_out')}
            </button>

          </div>
        </div>
      </div>
    </>,
    document.body
  )
}
