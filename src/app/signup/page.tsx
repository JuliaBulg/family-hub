'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function SignupPage() {
  const [name, setName]                   = useState('')
  const [email, setEmail]                 = useState('')
  const [password, setPassword]           = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError]                 = useState('')
  const [loading, setLoading]             = useState(false)
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)

  async function submit() {
    setError('')
    if (password !== confirmPassword) {
      setError("Passwords don't match — please check and try again.")
      return
    }
    setLoading(true)

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })

    if (authError || !authData.user) {
      setError(authError?.message ?? 'Sign-up failed. Please try again.')
      setLoading(false)
      return
    }

    // Email confirmation is enabled — session won't exist until they verify
    if (!authData.session) {
      setAwaitingConfirmation(true)
      setLoading(false)
      return
    }

    const userId = authData.user.id

    // 2. Create household
    const { data: household, error: householdError } = await supabase
      .from('households')
      .insert({ name: `${name}'s Family`, owner_id: userId })
      .select('id')
      .single()

    if (householdError || !household) {
      setError('Setup failed — please sign in again to complete your account.')
      setLoading(false)
      return
    }

    // 3. Create profile (first user is always a parent)
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({ user_id: userId, display_name: name, household_id: household.id, role: 'parent' })

    if (profileError) {
      setError('Setup failed — please sign in again to complete your account.')
      setLoading(false)
      return
    }
    // AuthShell detects the new session and redirects to /
  }

  if (awaitingConfirmation) {
    return (
      <div className="flex flex-col min-h-full px-6 pt-16 pb-8">
        <p className="text-5xl mb-6">📬</p>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Check your email</h1>
        <p className="text-slate-500 text-sm leading-relaxed mb-6">
          We sent a confirmation link to <span className="font-semibold text-slate-700">{email}</span>.
          Open it to activate your account — then come back and sign in.
        </p>
        <a
          href="/login"
          className="w-full py-3.5 bg-emerald-500 text-white font-semibold rounded-xl text-sm text-center transition-colors shadow-sm"
        >
          Go to sign in
        </a>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full px-6 pt-16 pb-8">
      <div className="mb-10">
        <p className="text-5xl mb-4">🏠</p>
        <h1 className="text-2xl font-bold text-slate-800">Create your hub</h1>
        <p className="text-slate-500 text-sm mt-1">Set up your family account</p>
      </div>

      <form onSubmit={e => { e.preventDefault(); void submit() }} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Your name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your name"
            required
            minLength={2}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
          />
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
              confirmPassword && confirmPassword !== password
                ? 'border-red-300'
                : 'border-slate-200'
            }`}
          />
          {confirmPassword && confirmPassword !== password && (
            <p className="text-red-500 text-xs mt-1">Passwords do not match</p>
          )}
        </div>

        {error && (
          <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-60 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm mt-2"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-8">
        Already have an account?{' '}
        <Link href="/login" className="text-emerald-600 font-semibold">
          Sign in
        </Link>
      </p>
    </div>
  )
}
