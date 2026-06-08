# Family Hub — Next Session Starting Point

**Written:** 07-Jun-2026
**Session status:** Auth + setup flow fully working end to end. RLS fixed. Ready to wire household data and build invite link.

---

## What was built this session (session 4 — 07-Jun-2026)

### Full auth + setup flow — now working end to end

| What | Where | Notes |
|------|-------|-------|
| PKCE callback page | `src/app/auth/callback/page.tsx` | Exchanges `?code=` from email confirmation link for a session via `supabase.auth.exchangeCodeForSession(code)` |
| Setup page | `src/app/setup/page.tsx` | Post-confirmation screen — user enters display name + household name; creates household row then profile row; redirects to pantry |
| `applyProfile()` in AuthContext | `src/contexts/AuthContext.tsx` | Injects profile directly into React state without a SELECT round-trip, avoiding any RLS dependency on the profile read after setup |
| `flowType: 'pkce'` + `emailRedirectTo` | `src/lib/supabase.ts` + `src/app/signup/page.tsx` | Required for PKCE email confirmation to work correctly |
| INSERT instead of upsert in setup | `src/app/setup/page.tsx` | Upsert internally SELECTs to check for conflict — triggers RLS. Plain INSERT only checks the INSERT policy (non-recursive). 23505 unique conflict handled gracefully. |

### RLS infinite recursion fixed (42P17)

The profiles SELECT policy `"Users can read profiles in their household"` was self-referencing — it queried `profiles` from within a policy ON `profiles`, causing PostgreSQL error 42P17 on every SELECT.

**Fix:** Used a PL/pgSQL `DO` block to drop **all** policies on `profiles` regardless of name (so stale renamed policies couldn't hide), then recreated them cleanly:

```sql
do $$ declare pol record; begin
  for pol in select policyname from pg_policies where tablename = 'profiles' and schemaname = 'public'
  loop execute format('drop policy %I on public.profiles', pol.policyname); end loop;
end; $$;

create or replace function get_my_household_id()
returns uuid language sql security definer stable set search_path = public as $$
  select household_id from public.profiles where user_id = auth.uid() limit 1
$$;

create policy "own profile select" on public.profiles for select using (user_id = auth.uid());
create policy "household profiles select" on public.profiles for select using (household_id = get_my_household_id());
create policy "own profile insert" on public.profiles for insert with check (user_id = auth.uid());
create policy "own profile update" on public.profiles for update using (user_id = auth.uid());
```

The `get_my_household_id()` function runs as `SECURITY DEFINER` (bypasses RLS on profiles) — breaks the self-referential cycle for any policy that needs to know the user's household.

---

## State of the app right now

- **Auth + setup:** ✅ Signup → email confirmation → /auth/callback → /setup (name + household) → pantry — fully working
- **Login / forgot password:** ✅ Working
- **Profile sheet:** ✅ Avatar top-right on all pages; sheet shows name, email, household, role, sign out
- **Pantry:** ✅ Add, edit, delete, categories, expiry alerts, import from receipt — but inserts **do not pass `household_id`** yet
- **Shopping list:** ✅ Add, tick off, clear done — but inserts **do not pass `household_id`** yet
- **Invite link (`/join`):** 🚧 Not yet built — family members cannot join yet
- **Menu / Expenses:** 🚧 Placeholder pages only

---

## Priority 1 — Wire `household_id` + `added_by` to inserts (DO THIS FIRST)

The `household_id` and `added_by` columns exist in the DB and RLS policies are live, but the React components still do unscoped inserts. Once a second user tries to join, writes will be blocked by RLS and items will be invisible across the household.

### `src/components/AddPantryItemModal.tsx`

```ts
const { profile } = useAuth()
// in the insert call:
.insert({ ...fields, household_id: profile?.household_id, added_by: profile?.display_name })
```

### `src/components/AddShoppingItemModal.tsx`

```ts
const { profile } = useAuth()
.insert({ name, quantity: qty || null, checked: false, household_id: profile?.household_id, added_by: profile?.display_name })
```

### `src/app/page.tsx` — `addExpiredToShopping()` function

```ts
const { profile } = useAuth()
// in the batch insert:
groups.map(group => ({
  name: group[0].name,
  quantity: groupQuantity(group) || null,
  checked: false,
  household_id: profile?.household_id,
  added_by: profile?.display_name,
}))
```

---

## Priority 2 — Build the `/join` invite page

New file: `src/app/join/page.tsx`

Flow:
1. Read `?code=xxx&role=child` from URL via `useSearchParams()`
2. Query: `SELECT id, name FROM households WHERE invite_code = code`
3. Not found → show error "This invite link is not valid"
4. Found → show signup form (name + email + password) with the household name visible
5. On submit: `supabase.auth.signUp()` → INSERT profile with `household_id` from step 2, `role` from URL
6. Redirect to `/` on success

Add `/join` to `PUBLIC_ROUTES` in `src/components/AuthShell.tsx`:
```ts
const PUBLIC_ROUTES = ['/login', '/signup', '/join', '/auth/callback']
```

Also needed: a way for the parent to generate and share the invite link. Options:
- Button in ProfileSheet: "Invite a family member" → copies link to clipboard
- Or a dedicated `/settings` page (heavier, defer)
- Simplest: add "Copy invite link" button to ProfileSheet; calls Supabase to fetch/generate `households.invite_code` and copies `${origin}/join?code=${code}&role=child` to clipboard

The `invite_code` column already exists on `households`. If it's null, generate a random short code on first share:
```ts
const code = Math.random().toString(36).slice(2, 10) // e.g. "a3f9bc12"
await supabase.from('households').update({ invite_code: code }).eq('id', profile.household_id)
```

---

## Priority 3 — Display "Added by [Name]" on shopping items

Once `added_by` is being saved (Priority 1), update `src/app/shopping/page.tsx` to show it under each item name — small grey text: `"Added by Julia"`.

---

## Priority 4 — Expenses tab (full feature)

The Expenses tab (`src/app/expenses/page.tsx`) is currently a placeholder. See `docs/SPECIFICATION.md` backlog for full scope.

---

## Priority 5 — Parent-only category filtering in Pantry

In `src/app/page.tsx`:
```ts
const PARENT_ONLY_CATEGORIES: Category[] = [] // populate when alcohol/tobacco categories are added
const visibleCategories = profile?.role === 'parent'
  ? CATEGORIES
  : CATEGORIES.filter(c => !PARENT_ONLY_CATEGORIES.includes(c.value))
```

Note: current 7 categories don't include alcohol/tobacco — add them first or defer.

---

## Architecture decisions (do not revisit)

- **No `@supabase/ssr`** — all pages are Client Components; client-side auth with localStorage is correct for this app
- **No middleware** — route guard handled by `AuthShell` client component
- **`detectSessionInUrl: false`** — avoids iOS Safari hash-change reload bug
- **`lock: async (_name, _acquireTimeout, fn) => fn()`** — bypass `navigator.locks` in Supabase client; safe for single-device personal app; prevents 5s hangs in dev from HMR
- **`React.FormEvent` deprecated in React 19** — all form handlers use `onSubmit={e => { e.preventDefault(); void submit() }}`
- **`flex flex-col min-h-full` + `sticky bottom-0`** — shopping page button pinning; do not change to nested overflow containers (caused iOS bug)
- **Profile sheet uses z-50, backdrop z-40** — do not change z-index layering
- **Plain INSERT (not upsert) in setup** — upsert triggers a SELECT which hits RLS; plain INSERT only checks INSERT policy; 23505 on retry = profile already exists, treat as success
- **`get_my_household_id()` SECURITY DEFINER** — all policies that need the user's household should use this function, never an inline `SELECT household_id FROM profiles WHERE user_id = auth.uid()` (that pattern causes infinite recursion on the profiles table)

---

## Tech stack

- Next.js (App Router) — read `node_modules/next/dist/docs/` before writing any Next.js code
- React 19.2.4
- Supabase `@supabase/supabase-js ^2.106.2`
- Tailwind CSS v4
- TypeScript (strict)
- Anthropic SDK (receipt parsing API route only)
