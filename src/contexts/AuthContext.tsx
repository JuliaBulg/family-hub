'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export interface Pet {
  type: string
  count: number
}

export interface Profile {
  display_name: string
  household_id: string | null
  role: 'parent' | 'child'
  language: string
  num_people: number
  pets: Pet[]
}

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  applyProfile: (p: Profile) => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
  applyProfile: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const fetchStarted          = useRef(false)

  async function fetchProfile(userId: string) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('display_name, household_id, role, language, num_people, pets')
        .eq('user_id', userId)
        .single()
      setProfile(data ? { ...data, language: data.language ?? 'en', num_people: data.num_people ?? 1, pets: data.pets ?? [] } : null)
    } catch {
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        if (!session?.user) {
          setProfile(null)
          setLoading(false)
        } else {
          fetchStarted.current = true
          void fetchProfile(session.user.id)
        }
      }
    )

    // Fallback: if onAuthStateChange never fires (network blocked, mobile browser quirk)
    const fallback = setTimeout(() => {
      setLoading(false)
    }, 2000)

    return () => {
      clearTimeout(fallback)
      subscription.unsubscribe()
    }
  }, [])

  async function refreshProfile() {
    if (!user) return
    await fetchProfile(user.id)
  }

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      signOut: () => supabase.auth.signOut().then(() => {}),
      refreshProfile,
      applyProfile: (p: Profile) => setProfile(p),
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
