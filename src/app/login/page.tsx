'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const [showReset, setShowReset]         = useState(false)
  const [resetEmail, setResetEmail]       = useState('')
  const [resetSent, setResetSent]         = useState(false)
  const [resetLoading, setResetLoading]   = useState(false)
  const [resetError, setResetError]       = useState('')

  async function submit() {
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  async function sendReset() {
    setResetError('')
    setResetLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail)
    setResetLoading(false)
    if (error) {
      setResetError(error.message)
    } else {
      setResetSent(true)
    }
  }

  if (showReset) {
    return (
      <div className="flex flex-col min-h-full px-6 pt-16 pb-8">
        <button
          onClick={() => { setShowReset(false); setResetSent(false); setResetError('') }}
          className="text-slate-400 text-sm mb-8 text-left"
        >
          ← Back to sign in
        </button>

        {resetSent ? (
          <>
            <p className="text-5xl mb-6">📬</p>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Check your email</h1>
            <p className="text-slate-500 text-sm leading-relaxed">
              We sent a password reset link to{' '}
              <span className="font-semibold text-slate-700">{resetEmail}</span>.
              Open it and follow the instructions to set a new password.
            </p>
          </>
        ) : (
          <>
            <p className="text-5xl mb-6">🔑</p>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Reset your password</h1>
            <p className="text-slate-500 text-sm mb-8">
              Enter your email and we'll send you a link to set a new password.
            </p>

            <form onSubmit={e => { e.preventDefault(); void sendReset() }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                />
              </div>

              {resetError && (
                <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  {resetError}
                </p>
              )}

              <button
                type="submit"
                disabled={resetLoading}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-60 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm"
              >
                {resetLoading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full px-6 pt-16 pb-8">
      <div className="mb-10">
        <p className="text-5xl mb-4">🏠</p>
        <h1 className="text-2xl font-bold text-slate-800">Welcome back</h1>
        <p className="text-slate-500 text-sm mt-1">Sign in to your family hub</p>
      </div>

      <form onSubmit={e => { e.preventDefault(); void submit() }} className="space-y-4">
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
            placeholder="••••••••"
            required
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
          />
          <button
            type="button"
            onClick={() => setShowReset(true)}
            className="mt-1.5 text-xs text-emerald-600 font-medium text-right w-full"
          >
            Forgot password?
          </button>
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
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-8">
        New to Family Hub?{' '}
        <Link href="/signup" className="text-emerald-600 font-semibold">
          Create an account
        </Link>
      </p>
    </div>
  )
}
