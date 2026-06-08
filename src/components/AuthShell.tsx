'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import BottomNav from '@/components/BottomNav'
import ProfileSheet from '@/components/ProfileSheet'

const PUBLIC_ROUTES = ['/login', '/signup', '/auth/callback', '/join']

export default function AuthShell({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth()
  const router   = useRouter()
  const pathname = usePathname()
  const [sheetOpen, setSheetOpen] = useState(false)

  const isPublic  = PUBLIC_ROUTES.includes(pathname)
  const isSetup   = pathname === '/setup'
  const needsSetup = !loading && user && !profile

  const initials = profile?.display_name
    ? profile.display_name.trim().split(/\s+/).map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  useEffect(() => {
    if (loading) return
    if (!user && !isPublic)                router.replace('/login')
    if (user && isPublic && profile)       router.replace('/')
    if (user && isPublic && !profile)      router.replace('/setup')
    if (needsSetup && !isSetup)            router.replace('/setup')
    if (user && profile && isSetup)        router.replace('/')
  }, [user, profile, loading, isPublic, isSetup, needsSetup, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-400 text-sm">Loading…</p>
      </div>
    )
  }

  // Render nothing while a redirect is in flight
  if (!user && !isPublic)                return null
  if (user && isPublic && profile)       return null
  if (user && isPublic && !profile)      return null
  if (needsSetup && !isSetup)            return null
  if (user && profile && isSetup)        return null

  // Setup page has no nav chrome
  if (isSetup) {
    return (
      <div className="flex flex-col h-full max-w-md mx-auto">
        <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full max-w-md mx-auto">
      {!isPublic && (
        <div className="flex-shrink-0 flex justify-end items-center px-4 pt-3 pb-1">
          <button
            onClick={() => setSheetOpen(true)}
            className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm active:scale-95 transition-transform"
            aria-label="Account settings"
          >
            <span className="text-white text-sm font-bold">{initials}</span>
          </button>
        </div>
      )}

      <main className="flex-1 min-h-0 overflow-y-auto">
        {children}
      </main>

      {!isPublic && (
        <div className="flex-shrink-0">
          <BottomNav />
        </div>
      )}

      <ProfileSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  )
}
