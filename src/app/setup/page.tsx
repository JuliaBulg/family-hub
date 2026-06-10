'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export default function SetupPage() {
  const { user, profile, applyProfile, signOut } = useAuth()
  const router = useRouter()
  const [displayName, setDisplayName]     = useState('')
  const [householdName, setHouseholdName] = useState('')
  const [error, setError]                 = useState('')
  const [loading, setLoading]             = useState(false)

  const meta      = user?.user_metadata
  const isJoining = meta?.joining === true

  // Navigate as soon as profile lands in React state
  useEffect(() => {
    if (profile) router.replace('/')
  }, [profile, router])

  // Auto-complete setup for users joining via invite link
  useEffect(() => {
    if (!isJoining || !user || profile) return
    setLoading(true)
    supabase.from('profiles')
      .insert({
        user_id: user.id,
        display_name: meta.display_name,
        household_id: meta.household_id,
        role: meta.role ?? 'child',
      })
      .then(({ error: profileError }) => {
        if (profileError && profileError.code !== '23505') {
          setError(`${profileError.message} [${profileError.code}]`)
          setLoading(false)
          return
        }
        applyProfile({
          display_name: meta.display_name,
          household_id: meta.household_id,
          role: meta.role ?? 'child',
          language: 'en',
        })
      })
  }, [isJoining, user, profile])

  const defaultHouseholdName = displayName.trim()
    ? `${displayName.trim()}'s Family`
    : ''

  const effectiveHouseholdName = householdName.trim() || defaultHouseholdName

  async function submit() {
    setError('')
    setLoading(true)

    // Reuse existing household if one was already created (handles retries)
    const { data: existingHousehold } = await supabase
      .from('households')
      .select('id')
      .eq('owner_id', user!.id)
      .maybeSingle()

    let householdId: string

    if (existingHousehold) {
      householdId = existingHousehold.id
    } else {
      const { data: newHousehold, error: householdError } = await supabase
        .from('households')
        .insert({ name: effectiveHouseholdName, owner_id: user!.id })
        .select('id')
        .single()

      if (householdError || !newHousehold) {
        setError('Could not create your household. Please try again.')
        setLoading(false)
        return
      }
      householdId = newHousehold.id
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .insert({ user_id: user!.id, display_name: displayName.trim(), household_id: householdId, role: 'parent' })

    if (profileError) {
      if (profileError.code === '23505') {
        // Profile already exists from a previous attempt — still good, proceed
        applyProfile({ display_name: displayName.trim(), household_id: householdId, role: 'parent', language: 'en' })
        return
      }
      setError(`${profileError.message} [${profileError.code}]`)
      setLoading(false)
      return
    }

    applyProfile({ display_name: displayName.trim(), household_id: householdId, role: 'parent', language: 'en' })
  }

  if (isJoining) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full px-6 text-center">
        <p className="text-5xl mb-4">🏠</p>
        {error ? (
          <>
            <p className="text-red-500 text-sm mb-4">{error}</p>
            <button onClick={() => void signOut()} className="text-slate-500 text-sm underline">
              Sign out and try again
            </button>
          </>
        ) : (
          <p className="text-slate-500 text-sm">Setting up your account…</p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full px-6 pt-16 pb-8">
      <div className="mb-8">
        <p className="text-5xl mb-4">🏠</p>
        <h1 className="text-2xl font-bold text-slate-800">Welcome to Family Hub</h1>
        <p className="text-slate-500 text-sm mt-1">
          Let's get your account set up — it takes about 30 seconds.
        </p>
      </div>

      <form onSubmit={e => { e.preventDefault(); void submit() }} className="space-y-5">

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Your name</label>
          <p className="text-xs text-slate-400 mb-2">
            This is <span className="font-medium">your personal name</span> — how you'll appear to other family members (e.g. Julia).
          </p>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="e.g. Julia"
            required
            minLength={2}
            autoFocus
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Household name</label>
          <p className="text-xs text-slate-400 mb-2">
            The name for your shared space — all family members will see this (e.g. The Smith Family).
          </p>
          <input
            type="text"
            value={householdName}
            onChange={e => setHouseholdName(e.target.value)}
            placeholder={defaultHouseholdName || 'e.g. The Smith Family'}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
          />
          {defaultHouseholdName && !householdName && (
            <p className="text-xs text-slate-400 mt-1.5">
              Leave blank to use <span className="font-medium text-slate-500">{defaultHouseholdName}</span>
            </p>
          )}
        </div>

        {error && (
          <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || displayName.trim().length < 2}
          className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-60 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm"
        >
          {loading ? 'Creating your household…' : 'Create my household'}
        </button>
      </form>

      <p className="text-center text-xs text-slate-400 mt-8">
        Wrong account?{' '}
        <button onClick={() => void signOut()} className="text-slate-500 underline">
          Sign out
        </button>
      </p>
    </div>
  )
}
