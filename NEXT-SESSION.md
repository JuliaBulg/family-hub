# Family Hub — Next Session Starting Point

**Written:** 09-Jun-2026
**Session status:** Session 7 complete. Live at https://family-hub-seven-sigma.vercel.app

---

## What was built in session 7

| What | Where | Notes |
|------|-------|-------|
| Pantry search bar | `src/app/page.tsx` | Always visible; flat filtered list when searching; category emoji shown; ✕ to clear |
| Persistent expiry alert dismissal | `src/app/page.tsx` + `pantry_items.shopping_alert_dismissed` | Once user sends item to shopping, alert never comes back — DB flag survives reload |
| "Was on list" indicator | `src/app/page.tsx` | Items with `shopping_alert_dismissed = true` show `· ✓ Was on list` in pantry card |
| Receipt expiry date estimation | `src/app/api/parse-receipt/route.ts` | AI estimates `expiry_date` per item using EU shelf-life averages baked into system prompt |
| Quantity merging from receipt | `src/components/ImportReceiptModal.tsx` | Same name + category + expiry → quantities summed; else new row inserted |
| Quantity merging on manual add | `src/components/AddPantryItemModal.tsx` | Same merge-or-insert logic for manual adds |
| Shopping delete race condition fix | `src/app/shopping/page.tsx` | Module-level `deletedIds` Set (outside React component) survives unmount; deleted items never reappear on tab navigation |
| Meal Planner Phase 1 | `src/app/menu/page.tsx` | Full week view (this + next week), today highlighted, add/edit/delete meals with slots + servings |
| Add/Edit Meal modal | `src/components/AddMealModal.tsx` | NEW file: date picker, slot selector, meal name, servings stepper |
| Cook Tonight AI modal | `src/components/CookTonightModal.tsx` | NEW file: servings picker + time presets + AI recipe suggestions |
| Cook Tonight API route | `src/app/api/cook-tonight/route.ts` | NEW file: Claude Opus 4.7; accepts items + servings + maxMinutes; returns 3 suggestions |
| Cooking time presets | `src/components/CookTonightModal.tsx` | ⚡ Quick ≤25 min · 🕐 Normal ≤45 min (default) · 🍲 No rush; labels show minutes |

---

## Current state of the app

| Feature | Status | Notes |
|---------|--------|-------|
| Auth (signup, login, forgot password) | ✅ Working | PKCE flow, email confirmation |
| Household creation + invite link | ✅ Working | `/setup` + `/join?code=xxx` |
| Profile sheet + role editing | ✅ Working | Parents can edit any member's role |
| Pantry — full CRUD + search | ✅ Working | Categories, expiry alerts, search, cook tonight |
| From Receipt (pantry + expenses) | ✅ Working | Image + PDF; quantity merging; expiry estimation; auto-logs expenses |
| Shopping list | ✅ Working | Add, tick, delete + undo, "added by", expiry alert integration |
| Expenses tab | ✅ Working | Month nav, total, category bars, expandable rows, manual add |
| Meal Planner Phase 1 | ✅ Working | Week view, add/edit/delete meals, servings |
| Cook Tonight AI | ✅ Working | Servings + time presets + 3 AI suggestions with ingredients |
| Meal Planner Phase 2 | 🚧 Not started | See Priority 1 below |

---

## Priority 1 — Meal Planner Phase 2 (next major feature)

**Goal:** Close the loop between meal planning and pantry — so the app can alert about missing ingredients and deduct from pantry when a meal is cooked.

### Phase 2A — Pantry awareness while planning

**Feature: Missing ingredient alert when adding a meal**
When user adds a meal name, AI checks which pantry items are available. If key ingredients seem to be missing, show a badge or prompt: "You may need to buy: [item]". Tapping adds it to the shopping list.

**Feature: Pantry reservation badge**
When a meal is planned for a future date and the item is in the pantry, show a small badge on the pantry card: "Reserved for [Meal name] on [date]". Prevents the family from using ingredients already committed to a planned meal.

### Phase 2B — Cook and deduct

**Feature: Mark as Cooked**
On the meal planner, each meal gets a "✅ Mark as cooked" button. Tapping it:
1. Sets `cooked_at` timestamp on the `meals` row
2. Opens a confirmation modal: "Deduct ingredients from pantry?" with a list of items to deduct
3. User confirms → selected pantry items reduced in quantity (or deleted if quantity hits 0)

**DB changes needed for Phase 2:**
- `meals` table already has `cooked_at` column — no migration needed for that
- May need a `meal_ingredients` table to store ingredient-to-pantry-item linkages (design decision to make at start of session)

### Phase 2C — Shopping list integration

**Feature: Add missing meal ingredients to shopping list**
From the meal planner, a "🛒 Add missing" button per meal that:
1. Checks which ingredients are not in the pantry (or have insufficient quantity for planned servings)
2. Adds those ingredients to the shopping list in one tap

---

## Priority 2 — Shopping → Pantry loop (deferred, revisit)

When "Done shopping" is tapped, offer to move ticked items into pantry. Risk: duplicates if user also imports a receipt. Design options:
- (A) No auto-add — receipt import is the preferred loop
- (B) "Add to pantry?" prompt after clearing done items, with duplicate check
- (C) Smart dedup by name

Decision deferred — receipt import is the richer path (adds expiry dates + categories). Keep for discussion.

---

## Architecture decisions (do not revisit)

- **No `@supabase/ssr`** — Client Components only; client-side auth with localStorage
- **No middleware** — route guard via `AuthShell` client component
- **`detectSessionInUrl: false`** — avoids iOS Safari hash-change reload bug
- **`lock: async (_name, _acquireTimeout, fn) => fn()`** — bypasses `navigator.locks`; prevents 5s dev hangs
- **`get_my_household_id()` SECURITY DEFINER** — all RLS policies use this function; never use inline `SELECT household_id FROM profiles` — causes 42P17 infinite recursion
- **Module-level `deletedIds` Set** — outside React component; survives unmount; prevents reappearance of deleted shopping items
- **`shopping_alert_dismissed` DB flag** — permanent; never auto-reset; only way to suppress expiry alerts
- **Merge-or-insert** — both receipt import and manual add check for existing row (same name + category + expiry_date) before inserting; `.ilike()` for name, `.is('expiry_date', null)` vs `.eq('expiry_date', date)` for null-safe expiry
- **`max_tokens: 8096`** — receipt parser; do not lower
- **Cook Tonight: `claude-opus-4-7`, max_tokens: 1024**

---

## Key files quick reference

| File | Purpose |
|------|---------|
| `src/lib/categories.ts` | Shared `Category` type + `CATEGORIES` array (7 categories) |
| `src/lib/supabase.ts` | Supabase client singleton |
| `src/contexts/AuthContext.tsx` | Auth state, profile, `useAuth()` hook |
| `src/components/AuthShell.tsx` | Route guard + layout wrapper |
| `src/components/BottomNav.tsx` | 4-tab bottom navigation |
| `src/components/ProfileSheet.tsx` | Avatar sheet — members, role editing, sign out |
| `src/components/AddPantryItemModal.tsx` | Add / edit pantry item (with merge-or-insert) |
| `src/components/AddShoppingItemModal.tsx` | Add shopping item |
| `src/components/AddExpenseModal.tsx` | Manual expense entry |
| `src/components/ImportReceiptModal.tsx` | Receipt → pantry + expense (4 steps, quantity merging, expiry estimation) |
| `src/components/AddMealModal.tsx` | Add / edit meal (meal planner) |
| `src/components/CookTonightModal.tsx` | Cook Tonight modal — servings + time presets + AI suggestions |
| `src/app/page.tsx` | Pantry tab — search, expiry alerts, dismissal logic |
| `src/app/shopping/page.tsx` | Shopping list — delete race condition fix |
| `src/app/menu/page.tsx` | Meal planner — week view, add/edit/delete |
| `src/app/expenses/page.tsx` | Expenses tab |
| `src/app/api/parse-receipt/route.ts` | Claude receipt parsing — EU shelf-life table in system prompt |
| `src/app/api/cook-tonight/route.ts` | Claude recipe suggestions — accepts items, servings, maxMinutes |

---

## DB tables (current)

| Table | Key columns | Notes |
|-------|-------------|-------|
| `households` | `id`, `name`, `invite_code` | |
| `profiles` | `user_id`, `household_id`, `display_name`, `role` | RLS via `get_my_household_id()` |
| `pantry_items` | `household_id`, `name`, `category`, `quantity`, `unit`, `expiry_date`, `shopping_alert_dismissed`, `added_by` | `shopping_alert_dismissed` added session 7 |
| `shopping_items` | `household_id`, `name`, `quantity`, `checked`, `added_by` | |
| `expenses` | `household_id`, `amount`, `category`, `store`, `note`, `date`, `added_by` | |
| `meals` | `household_id`, `date`, `slot`, `name`, `servings`, `added_by`, `cooked_at` | Added session 7 |

---

## Tech stack

- Next.js 16 (App Router, Turbopack) — **read `node_modules/next/dist/docs/` before writing any Next.js code**
- React 19.2.4
- Supabase `@supabase/supabase-js ^2.106.2`
- Tailwind CSS v4
- TypeScript (strict)
- Anthropic SDK — `claude-opus-4-7` for receipts + cook tonight
- Vercel — auto-deploy from `main` at https://github.com/JuliaBulg/family-hub.git
