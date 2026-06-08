# Family Hub — Next Session Starting Point

**Written:** 09-Jun-2026
**Session status:** Session 6 complete. Expenses tab, receipt→expense import, PDF receipts, shopping delete fix, Vercel deployment. Live at https://family-hub-seven-sigma.vercel.app

---

## What was built in session 6

| What | Where | Notes |
|------|-------|-------|
| Added by label | `src/app/shopping/page.tsx` | Shows `by [Name]` under each shopping item |
| Role editing | `src/components/ProfileSheet.tsx` | Parents can change any member's role (Parent ↔ Child) via buttons next to each member |
| Join page role default | `src/app/join/page.tsx` | Default role is now `parent`; explicit two-button selector UI |
| Shared categories | `src/lib/categories.ts` | Single source of truth for all 7 categories used by pantry, expenses, and receipt import |
| Expenses tab | `src/app/expenses/page.tsx` | Month navigation, total card, category breakdown with progress bars, expandable rows |
| Add Expense modal | `src/components/AddExpenseModal.tsx` | Amount, category grid, store, note, date fields; saves to `expenses` table |
| Receipt → expense auto-log | `src/components/ImportReceiptModal.tsx` | Step 4: per-category amounts pre-filled from AI-extracted prices; one DB row per category |
| PDF receipt support | `src/app/api/parse-receipt/route.ts` | Anthropic `document` content block; max_tokens raised to 8096 |
| PDF UX polish | `src/components/ImportReceiptModal.tsx` | Blue card for PDF preview; "Large PDFs can take up to 30 seconds" message |
| Expiry alert fix | `src/app/page.tsx` | `shoppingNames` Set fetched from DB; alert never re-shows if item is on shopping list |
| Shopping delete fix | `src/app/shopping/page.tsx` | Immediate DB delete on ✕; undo re-inserts a fresh row — no reappearance on navigation |
| Vercel deployment | — | Auto-deploys on push to `main` via https://github.com/JuliaBulg/family-hub.git |

---

## Current state of the app

| Feature | Status | Notes |
|---------|--------|-------|
| Auth (signup, login, forgot password) | ✅ Working | PKCE flow, email confirmation |
| Household creation | ✅ Working | /setup page |
| Invite link (/join) | ✅ Working | `?code=` lookup, role selector, default parent |
| Profile sheet | ✅ Working | Members list, role badges, parents can edit roles |
| Pantry | ✅ Working | Categories, expiry alerts, cook tonight (placeholder) |
| From Receipt (pantry) | ✅ Working | Image + PDF; adds to pantry AND logs expenses per category |
| Shopping list | ✅ Working | Add, tick, delete (immediate + undo), "added by" label |
| Expenses tab | ✅ Working | Month nav, total, category bars, expandable expense rows |
| Add Expense modal | ✅ Working | Manual entry from Expenses tab |
| Meal Planner | 🚧 Placeholder | Menu tab shows "coming soon" |

---

## Priority 1 — Husband's receipt upload issue (investigate first)

The user mentioned their husband had a problem uploading a receipt. Not investigated yet. Likely causes:
- PDF too large for Anthropic API (20MB limit)
- Non-receipt document
- Network timeout on mobile

Reproduce: have husband re-try. If it fails, get the exact error shown and check Vercel function logs.

---

## Priority 2 — Meal Planner (next major feature)

The Meal Planner tab (`src/app/menu/page.tsx`) is a placeholder. Proposed scope:
- View meals planned for the current week (Mon–Sun)
- Add a meal to a day + slot (breakfast / lunch / dinner)
- Delete a meal
- "What can I cook tonight?" button on Pantry tab → AI suggestion from current pantry items (modal already wired up)

**DB tables needed:**
```sql
create table meal_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id),
  week_start date not null,
  created_at timestamptz default now()
);

create table meals (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references meal_plans(id) on delete cascade,
  day text not null,       -- 'mon', 'tue', etc.
  slot text not null,      -- 'breakfast', 'lunch', 'dinner'
  name text not null,
  added_by text,
  created_at timestamptz default now()
);
```

---

## Priority 3 — Shopping list → Pantry loop

When "Done shopping (N)" is tapped, offer to move ticked items into pantry. Reduces re-entry after a shopping trip.

Flow: tap "Done shopping" → sheet shows ticked items with category picker → confirm → insert into `pantry_items`, delete from `shopping_items`.

---

## Priority 4 — Transport / custom categories (future)

User wants a Transport expense category. Architecture is ready (`CATEGORIES` array in `src/lib/categories.ts`). Hold off until core is stable. When adding: update `categories.ts` and the receipt import system prompt.

---

## Architecture decisions (do not revisit)

- **No `@supabase/ssr`** — all pages are Client Components; client-side auth with localStorage is correct
- **No middleware** — route guard handled by `AuthShell` client component
- **`detectSessionInUrl: false`** — avoids iOS Safari hash-change reload bug
- **`lock: async (_name, _acquireTimeout, fn) => fn()`** — bypasses `navigator.locks`; prevents 5s dev hangs
- **Plain INSERT (not upsert) in setup** — upsert triggers a SELECT which hits RLS; plain INSERT only checks INSERT policy
- **`get_my_household_id()` SECURITY DEFINER** — all RLS policies that scope by household use this function; never use inline `SELECT household_id FROM profiles WHERE user_id = auth.uid()` — causes infinite recursion (42P17)
- **`shoppingNames` Set** — pantry expiry alert uses Set of active shopping item names fetched from DB; always in sync; never re-shows if item is on the list
- **Immediate DB delete** — shopping items deleted from DB on ✕; undo re-inserts a fresh row; avoids unmount race condition
- **`max_tokens: 8096`** — receipt parser needs this for large PDFs; do not lower
- **Receipt import 4 steps** — input → parsing → review → expense; expense step always pre-fills per-category amounts from AI prices

---

## Key files quick reference

| File | Purpose |
|------|---------|
| `src/lib/categories.ts` | Shared `Category` type + `CATEGORIES` array (7 categories) |
| `src/lib/supabase.ts` | Supabase client singleton |
| `src/contexts/AuthContext.tsx` | Auth state, profile, `useAuth()` hook |
| `src/components/AuthShell.tsx` | Route guard + layout wrapper |
| `src/components/BottomNav.tsx` | 4-tab bottom navigation |
| `src/components/ProfileSheet.tsx` | Avatar → slide-up sheet with members, role editing, sign out |
| `src/components/AddPantryItemModal.tsx` | Add / edit pantry item |
| `src/components/AddShoppingItemModal.tsx` | Add shopping item |
| `src/components/AddExpenseModal.tsx` | Manual expense entry |
| `src/components/ImportReceiptModal.tsx` | Receipt → pantry + expense (4 steps) |
| `src/app/page.tsx` | Pantry tab |
| `src/app/shopping/page.tsx` | Shopping list tab |
| `src/app/expenses/page.tsx` | Expenses tab |
| `src/app/menu/page.tsx` | Meal planner tab (placeholder) |
| `src/app/api/parse-receipt/route.ts` | Anthropic API route for receipt parsing |
| `src/app/join/page.tsx` | Invite link landing + signup |
| `src/app/setup/page.tsx` | Post-signup setup (display name + household) |

---

## DB tables

| Table | Key columns | RLS |
|-------|-------------|-----|
| `households` | `id`, `name`, `invite_code` | — |
| `profiles` | `user_id`, `household_id`, `display_name`, `role` | Scoped to own household via `get_my_household_id()` |
| `pantry_items` | `household_id`, `name`, `category`, `quantity`, `unit`, `expiry_date`, `added_by` | Scoped to household |
| `shopping_items` | `household_id`, `name`, `quantity`, `store`, `is_ticked`, `added_by` | Scoped to household |
| `expenses` | `household_id`, `amount`, `category`, `store`, `note`, `date`, `added_by` | Scoped to household |

---

## Tech stack

- Next.js (App Router) — **read `node_modules/next/dist/docs/` before writing any Next.js code**
- React 19.2.4
- Supabase `@supabase/supabase-js ^2.106.2`
- Tailwind CSS v4
- TypeScript (strict)
- Anthropic SDK (receipt parsing only; model: `claude-opus-4-7`)
- Deployed on Vercel — auto-deploy from `main` at https://github.com/JuliaBulg/family-hub.git
