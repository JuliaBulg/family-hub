# Family Hub — Next Session Starting Point

**Written:** 10-Jun-2026
**Session status:** Session 8 complete. Live at https://family-hub-seven-sigma.vercel.app

---

## What was built in session 8

| What | Where | Notes |
|------|-------|-------|
| meal_ingredients table | Supabase | RLS via `get_my_household_id()`; on delete cascade from meals |
| /api/meal-ingredients route | `src/app/api/meal-ingredients/route.ts` | Claude Haiku 4.5 — extracts 4–8 key ingredients for a meal name + servings; matches against pantry by name |
| AddMealModal step 2 | `src/components/AddMealModal.tsx` | After saving new meal: shows ✓ In pantry / − Missing ingredient split; one-tap "Add missing to shopping list" |
| MarkCookedModal | `src/components/MarkCookedModal.tsx` | NEW: checklist of pantry-linked ingredients to deduct; sets cooked_at on meal; reduces/deletes pantry quantities |
| Menu page — Cooked + Add missing buttons | `src/app/menu/page.tsx` | Each uncooked meal gets 🛒 Add missing + ✅ Cooked buttons; cooked meals shown struck-through |
| Pantry reservation badges | `src/app/page.tsx` | Violet border + 📅 [Meal name] on pantry items reserved for upcoming planned meals |

---

## Current state of the app

| Feature | Status | Notes |
|---------|--------|-------|
| Auth + household + invite | ✅ Working | |
| Pantry — full CRUD + search + expiry | ✅ Working | |
| Pantry — reservation badges | ✅ Working | Shows which items are reserved for planned meals |
| Receipt import → pantry + expenses | ✅ Working | |
| Shopping list | ✅ Working | |
| Expenses tab | ✅ Working | |
| Meal Planner Phase 1 | ✅ Working | Week view, add/edit/delete meals |
| Meal Planner Phase 2 | ✅ Working | Ingredients, missing alerts, mark as cooked, pantry deduction |
| Cook Tonight AI | ✅ Working | Servings + time presets + 3 suggestions |
| Recipes tab | 🚧 Not started | See Priority 1 below |

---

## Priority 1 — Recipes tab (next major feature)

### The idea
Recipes tab = your permanent cookbook. Menu tab = your weekly calendar. They connect in both directions.

### Tab order (agreed)
```
1. 🏠 Pantry    — daily
2. 🛒 Shopping  — daily/weekly
3. 🍽️ Menu      — weekly
4. 📖 Recipes   — occasional
5. 💰 Expenses  — monthly
```
Menu + Recipes stay adjacent (positions 3 & 4) — important because they're closely linked.

### What the Recipes tab does
- Browse all saved recipes
- Add new recipe (name + ingredients list)
- Edit / delete recipe
- Tap a recipe → see detail + "Plan this meal →" button → picks date + slot → added to Menu

### Where recipes come from
| Source | How |
|--------|-----|
| Pre-loaded | Auto-insert from `recipes.md` on first load (11 family favorites with exact quantities) |
| Manual | User adds their own via "+" button in Recipes tab |
| Cook Tonight AI | "♡ Save to recipes" button on each suggestion card |

### How Recipes connects to Menu planner
When tapping "+ Add" on a day in the Menu tab, user gets two options:
1. "📖 Pick from recipes" → list of saved recipes → tap one → name + ingredients pre-filled (no AI call)
2. "✏️ Type meal name" → existing flow (AI extracts ingredients)

### DB table needed
```sql
create table recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id),
  name text not null,
  added_by text,
  source text,   -- 'manual', 'ai', 'preloaded'
  created_at timestamptz default now()
);

create table recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  household_id uuid not null references households(id),
  name text not null,
  quantity text,
  unit text,
  sort_order integer default 0
);
```
Both tables need RLS via `get_my_household_id()`.

### Build order
1. SQL migration — `recipes` + `recipe_ingredients` tables
2. Recipes tab page (`src/app/recipes/page.tsx`) — browse + delete
3. AddRecipeModal — name + ingredients (dynamic list)
4. Pre-load 11 recipes from `recipes.md` on first visit
5. Update BottomNav — add Recipes tab (5th), reorder to: Pantry · Shopping · Menu · Recipes · Expenses
6. Cook Tonight — "♡ Save to recipes" on suggestion cards
7. AddMealModal — "Pick from recipes" option (replaces AI call with recipe data)

---

## Architecture decisions (do not revisit)

- **No `@supabase/ssr`** — Client Components; client-side auth with localStorage
- **`get_my_household_id()` SECURITY DEFINER** — all RLS policies use this; never inline SELECT on profiles
- **Module-level `deletedIds` Set** — shopping page; survives unmount
- **`shopping_alert_dismissed` DB flag** — permanent; never auto-reset
- **Merge-or-insert** — receipt import + manual add; `.ilike()` + null-safe expiry matching
- **`max_tokens: 8096`** — receipt parser; do not lower
- **Cook Tonight: `claude-opus-4-7`, max_tokens: 1024**
- **Meal ingredients: `claude-haiku-4-5-20251001`, max_tokens: 512** — simple extraction, cheap

---

## Key files quick reference

| File | Purpose |
|------|---------|
| `src/lib/categories.ts` | Shared Category type + CATEGORIES array |
| `src/lib/supabase.ts` | Supabase client singleton |
| `src/contexts/AuthContext.tsx` | Auth state, profile, useAuth() |
| `src/components/AuthShell.tsx` | Route guard + layout |
| `src/components/BottomNav.tsx` | Bottom navigation — needs 5th tab added |
| `src/components/ProfileSheet.tsx` | Avatar sheet |
| `src/components/AddPantryItemModal.tsx` | Add/edit pantry item |
| `src/components/AddShoppingItemModal.tsx` | Add shopping item |
| `src/components/AddExpenseModal.tsx` | Manual expense entry |
| `src/components/ImportReceiptModal.tsx` | Receipt import |
| `src/components/AddMealModal.tsx` | Add/edit meal — needs "Pick from recipes" option |
| `src/components/MarkCookedModal.tsx` | Mark meal as cooked + pantry deduction |
| `src/components/CookTonightModal.tsx` | Cook Tonight — needs "♡ Save" button on suggestions |
| `src/app/page.tsx` | Pantry tab |
| `src/app/shopping/page.tsx` | Shopping list |
| `src/app/menu/page.tsx` | Meal planner |
| `src/app/expenses/page.tsx` | Expenses tab |
| `src/app/api/parse-receipt/route.ts` | Receipt parsing |
| `src/app/api/cook-tonight/route.ts` | Cook Tonight AI |
| `src/app/api/meal-ingredients/route.ts` | Meal ingredient extraction |
| `recipes.md` | 11 family favorite recipes — source for pre-loading |

---

## DB tables (current)

| Table | Key columns |
|-------|-------------|
| `households` | `id`, `name`, `invite_code` |
| `profiles` | `user_id`, `household_id`, `display_name`, `role` |
| `pantry_items` | `household_id`, `name`, `category`, `quantity`, `unit`, `expiry_date`, `shopping_alert_dismissed`, `added_by` |
| `shopping_items` | `household_id`, `name`, `quantity`, `checked`, `added_by` |
| `expenses` | `household_id`, `amount`, `category`, `store`, `note`, `date`, `added_by` |
| `meals` | `household_id`, `date`, `slot`, `name`, `servings`, `added_by`, `cooked_at` |
| `meal_ingredients` | `meal_id`, `household_id`, `name`, `quantity`, `unit`, `pantry_item_id` |

---

## Tech stack

- Next.js 16 (App Router, Turbopack) — **read `node_modules/next/dist/docs/` before writing any Next.js code**
- React 19.2.4 · Supabase ^2.106.2 · Tailwind CSS v4 · TypeScript strict
- Anthropic SDK — claude-opus-4-7 (receipts + cook tonight) · claude-haiku-4-5-20251001 (meal ingredients)
- Vercel auto-deploy from main — https://github.com/JuliaBulg/family-hub.git
