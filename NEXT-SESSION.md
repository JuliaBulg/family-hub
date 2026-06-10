# Family Hub — Next Session Starting Point

**Written:** 10-Jun-2026
**Session status:** Session 9 complete. Live at https://family-hub-seven-sigma.vercel.app

---

## What was built in session 9

| What | Where | Notes |
|------|-------|-------|
| src/lib/family-recipes.ts | NEW | 11 family favorites as preload data |
| src/app/recipes/page.tsx | NEW | Browse, expand/collapse, add/edit/delete; auto-preloads on first visit |
| src/components/AddRecipeModal.tsx | NEW | Name + dynamic ingredient rows (name / qty / unit per row) |
| BottomNav — 5 tabs | `src/components/BottomNav.tsx` | Pantry · Shopping · Menu · Recipes · Expenses |
| Cook Tonight — ♡ Save | `src/components/CookTonightModal.tsx` | Saves AI suggestion to recipe book permanently |
| AddMealModal — Pick from recipes | `src/components/AddMealModal.tsx` | Picks stored recipe, loads ingredients directly (no AI call) |

---

## Current state of the app

| Feature | Status | Notes |
|---------|--------|-------|
| Auth + household + invite | ✅ Working | |
| Pantry — full CRUD + search + expiry | ✅ Working | |
| Pantry — reservation badges | ✅ Working | |
| Receipt import → pantry + expenses | ✅ Working | |
| Shopping list | ✅ Working | |
| Expenses tab | ✅ Working | |
| Meal Planner — full | ✅ Working | Week view, ingredients, cooked, deduction |
| Cook Tonight AI | ✅ Working | Servings + time presets + ♡ Save to recipes |
| Recipes tab | ✅ Working | Browse, add/edit/delete, auto-preloaded 11 family favorites |
| Recipes → Menu planner | 🚧 Partial | Menu→Recipes done; Recipes→Menu missing (see Priority 1) |

---

## Priority 1 — "Plan this meal" button (small, high value)

From a recipe in the Recipes tab, user should be able to tap **"📅 Plan this meal"** and it opens a mini picker: choose date + slot → recipe gets added to the Menu planner with ingredients already loaded.

This completes the two-way connection:
- Menu → Recipes: ✅ "Pick from recipes" when adding a meal
- Recipes → Menu: ❌ still missing

### Implementation
- In `src/app/recipes/page.tsx`: add "📅 Plan this meal" button in the expanded card (alongside Edit / Delete)
- Tapping opens a mini modal (or inline date+slot picker)
- On confirm: call the same logic as AddMealModal but skip the form — just INSERT meal with the recipe name + load recipe_ingredients as meal_ingredients

Could reuse AddMealModal with a new prop `prefillRecipe?: { id: string; name: string }` to pre-fill and skip the picker step.

---

## Priority 2 — Cook Tonight "Add to Menu" button

After AI gives suggestions, let user tap **"📅 Add to Menu"** on a suggestion card (next to ♡ Save). It opens a date+slot picker → adds the meal to the planner. This makes Cook Tonight useful for planning ahead, not just eating that evening.

Same mini-modal approach as Priority 1.

---

## Priority 3 — Polish passes (low effort, nice UX)

| Item | Where | Notes |
|------|-------|-------|
| Recipe search / filter | Recipes page | Simple client-side filter by name |
| Serving count on recipe cards | Recipes page | Show "for 4 people" — recipes.md is all for 4 |
| Cook Tonight suggestion → "Add to Menu" | CookTonightModal | See Priority 2 |
| Shopping list — sort by category | Shopping page | Group items by pantry category |

---

## Architecture decisions (do not revisit)

- **No `@supabase/ssr`** — Client Components; client-side auth with localStorage
- **`get_my_household_id()` SECURITY DEFINER** — all RLS policies use this; never inline SELECT on profiles
- **Module-level `deletedIds` Set** — shopping page; survives unmount
- **`shopping_alert_dismissed` DB flag** — permanent; never auto-reset
- **Merge-or-insert** — receipt import + manual add; `.ilike()` + null-safe expiry matching
- **`max_tokens: 8096`** — receipt parser; do not lower
- **Cook Tonight: `claude-opus-4-7`, max_tokens: 1024**
- **Meal ingredients: `claude-haiku-4-5-20251001`, max_tokens: 512**

---

## Key files quick reference

| File | Purpose |
|------|---------|
| `src/lib/categories.ts` | Shared Category type + CATEGORIES array |
| `src/lib/supabase.ts` | Supabase client singleton |
| `src/lib/family-recipes.ts` | 11 preloaded family recipes data |
| `src/contexts/AuthContext.tsx` | Auth state, profile, useAuth() |
| `src/components/AuthShell.tsx` | Route guard + layout |
| `src/components/BottomNav.tsx` | 5-tab bottom nav |
| `src/components/AddPantryItemModal.tsx` | Add/edit pantry item |
| `src/components/AddShoppingItemModal.tsx` | Add shopping item |
| `src/components/AddExpenseModal.tsx` | Manual expense entry |
| `src/components/ImportReceiptModal.tsx` | Receipt import |
| `src/components/AddMealModal.tsx` | Add/edit meal — has "Pick from recipes" option |
| `src/components/MarkCookedModal.tsx` | Mark meal as cooked + pantry deduction |
| `src/components/CookTonightModal.tsx` | Cook Tonight — has ♡ Save to recipes |
| `src/components/AddRecipeModal.tsx` | Add/edit recipe (name + dynamic ingredient rows) |
| `src/app/page.tsx` | Pantry tab |
| `src/app/shopping/page.tsx` | Shopping list |
| `src/app/menu/page.tsx` | Meal planner |
| `src/app/recipes/page.tsx` | Recipes tab |
| `src/app/expenses/page.tsx` | Expenses tab |
| `src/app/api/parse-receipt/route.ts` | Receipt parsing |
| `src/app/api/cook-tonight/route.ts` | Cook Tonight AI |
| `src/app/api/meal-ingredients/route.ts` | Meal ingredient extraction |

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
| `recipes` | `household_id`, `name`, `source`, `added_by`, `created_at` |
| `recipe_ingredients` | `recipe_id`, `household_id`, `name`, `quantity`, `unit`, `sort_order` |

---

## Tech stack

- Next.js 16 (App Router, Turbopack) — **read `node_modules/next/dist/docs/` before writing any Next.js code**
- React 19.2.4 · Supabase ^2.106.2 · Tailwind CSS v4 · TypeScript strict
- Anthropic SDK — claude-opus-4-7 (receipts + cook tonight) · claude-haiku-4-5-20251001 (meal ingredients)
- Vercel auto-deploy from main — https://github.com/JuliaBulg/family-hub.git
