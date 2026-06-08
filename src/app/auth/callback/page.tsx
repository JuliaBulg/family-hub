'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState('')

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) {
      router.replace('/login')
      return
    }

    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setError('Could not confirm your email. The link may have expired — please request a new one.')
      }
      // On success, onAuthStateChange fires and AuthShell handles the redirect
    })
  }, [])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <p className="text-4xl mb-4">⚠️</p>
        <p className="text-slate-700 font-semibold mb-2">Confirmation failed</p>
        <p className="text-slate-500 text-sm mb-6">{error}</p>
        <a href="/signup" className="text-emerald-600 text-sm font-medium underline">
          Back to sign up
        </a>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <p className="text-slate-400 text-sm">Confirming your account…</p>
    </div>
  )
}
