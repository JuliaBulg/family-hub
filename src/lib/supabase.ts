import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    detectSessionInUrl: false,
    autoRefreshToken: true,
    storageKey: 'family-hub-auth',
    flowType: 'pkce',
    // bypass navigator.locks — avoids 5-second hangs in dev (HMR creates a new
    // client per reload but the old one still holds the lock for the same key)
    lock: async (_name, _acquireTimeout, fn) => fn(),
  },
})
