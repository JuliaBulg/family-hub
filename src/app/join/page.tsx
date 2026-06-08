'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function JoinPage() {
  const searchParams  = useSearchParams()
  const code          = searchParams.get('code') ?? ''

  const [household, setHousehold]                   = useState<{ id: string; name: string } | null>(null)
  const [checking, setChecking]                     = useState(true)
  const [invalidCode, setInvalidCode]               = useState(false)
  const [displayName, setDisplayName]               = useState('')
  const [email, setEmail]                           = useState('')
  const [password, setPassword]                     = useState('')
  const [confirmPassword, setConfirmPassword]       = useState('')
  const [role, setRole]                             = useState<'parent' | 'child'>('parent')
  const [error, setError]                           = useState('')
  const [loading, setLoading]                       = useState(false)
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)

  useEffect(() => {
    if (!code) { setInvalidCode(true); setChecking(false); return }
    supabase.rpc('get_household_by_invite_code', { code }).then(({ data, error }) => {
      if (error || !data || data.length === 0) {
        setInvalidCode(true)
      } else {
        setHousehold(data[0] as { id: string; name: string })
      }
      setChecking(false)
    })
  }, [code])

  async function submit() {
    if (password !== confirmPassword) { setError("Passwords don't match."); return }
    setError('')
    setLoading(true)

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          display_name: displayName.trim(),
          household_id: household!.id,
          role,
          joining: true,
        },
      },
    })

    if (authError || !data.user) {
      setError(authError?.message ?? 'Sign-up failed. Please try again.')
      setLoading(false)
      return
    }

    setAwaitingConfirmation(true)
    setLoading(false)
  }

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-full">
        <p className="text-slate-400 text-sm">Checking invite link…</p>
      </div>
    )
  }

  if (invalidCode) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full px-6 text-center">
        <p className="text-4xl mb-4">🔗</p>
        <h1 className="text-xl font-bold text-slate-800 mb-2">Invalid invite link</h1>
        <p className="text-slate-500 text-sm mb-6">
          This link is not valid or has expired. Ask the household owner to send you a new one.
        </p>
        <Link href="/login" className="text-emerald-600 text-sm font-medium underline">
          Go to sign in
        </Link>
      </div>
    )
  }

  if (awaitingConfirmation) {
    return (
      <div className="flex flex-col min-h-full px-6 pt-16 pb-8">
        <p className="text-5xl mb-6">📬</p>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Check your email</h1>
        <p className="text-slate-500 text-sm leading-relaxed mb-6">
          We sent a confirmation link to{' '}
          <span className="font-semibold text-slate-700">{email}</span>. Open it to
          activate your account — you&apos;ll then be joined to{' '}
          <span className="font-semibold text-slate-700">{household?.name}</span>.
        </p>
        <Link
          href="/login"
          className="w-full py-3.5 bg-emerald-500 text-white font-semibold rounded-xl text-sm text-center shadow-sm"
        >
          Go to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full px-6 pt-12 pb-8">
      <div className="mb-8">
        <p className="text-5xl mb-4">🏠</p>
        <h1 className="text-2xl font-bold text-slate-800">You&apos;re invited!</h1>
        <p className="text-slate-500 text-sm mt-1">
          Join <span className="font-semibold text-slate-700">{household?.name}</span> on Family Hub
        </p>
      </div>

      <form onSubmit={e => { e.preventDefault(); void submit() }} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Your name</label>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="e.g. Mia"
            required
            minLength={2}
            autoFocus
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Your role</label>
          <div className="grid grid-cols-2 gap-2">
            {(['parent', 'child'] as const).map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`py-3 rounded-xl text-sm font-semibold border-2 transition-colors ${
                  role === r
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-500'
                }`}
              >
                {r === 'parent' ? '👩‍👧 Parent' : '🧒 Child'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="at least 6 characters"
            required
            minLength={6}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Confirm password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="repeat your password"
            required
            minLength={6}
            className={`w-full px-4 py-3 bg-white border rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm ${
              confirmPassword && confirmPassword !== password ? 'border-red-300' : 'border-slate-200'
            }`}
          />
          {confirmPassword && confirmPassword !== password && (
            <p className="text-red-500 text-xs mt-1">Passwords do not match</p>
          )}
        </div>

        {error && (
          <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || displayName.trim().length < 2}
          className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-60 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm"
        >
          {loading ? 'Creating account…' : `Join ${household?.name}`}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-8">
        Already have an account?{' '}
        <Link href="/login" className="text-emerald-600 font-semibold">Sign in</Link>
      </p>
    </div>
  )
}
