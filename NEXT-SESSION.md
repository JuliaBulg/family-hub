# Family Hub — Next Session Starting Point

**Written:** 10-Jun-2026
**Session status:** Session 9+10 complete. Live at https://family-hub-seven-sigma.vercel.app

---

## What was built in session 9–10

| What | Where | Notes |
|------|-------|-------|
| Recipes tab | `src/app/recipes/page.tsx` | Browse, expand, add/edit/delete; auto-preloads 11 family favorites |
| AddRecipeModal | `src/components/AddRecipeModal.tsx` | Name + dynamic ingredient rows |
| BottomNav — 5 tabs | `src/components/BottomNav.tsx` | Pantry · Shopping · Menu · Recipes · Expenses |
| Cook Tonight — ♡ Save | `src/components/CookTonightModal.tsx` | Saves suggestion to recipe book |
| Cook Tonight — 📅 Plan this | `src/components/CookTonightModal.tsx` | Opens date/slot picker to plan the meal |
| Cook Tonight — 🛒 Add missing | `src/components/CookTonightModal.tsx` | Adds suggestion's missing items to shopping list |
| Cook Tonight — 🥦 Vegetarian | `src/components/CookTonightModal.tsx` + API | Toggle forces all suggestions to be vegetarian |
| AddMealModal — Pick from recipes | `src/components/AddMealModal.tsx` | Uses stored recipe ingredients, no AI call |
| Plan this meal | `src/components/PlanRecipeModal.tsx` | From Recipes tab + Cook Tonight → date/slot picker → Menu |
| Recipe search | `src/app/recipes/page.tsx` | Client-side filter by name |

---

## Current state of the app

| Feature | Status | Notes |
|---------|--------|-------|
| Auth + household + invite | ✅ Working | |
| Pantry — full CRUD + search + expiry | ✅ Working | |
| Pantry — reservation badges | ✅ Working | Violet border + 📅 name on items reserved for upcoming meals |
| Pantry — deduction when cooked | ✅ Working | MarkCookedModal deducts checked ingredients |
| Receipt import → pantry + expenses | ✅ Working | |
| Shopping list | ✅ Working | |
| Expenses tab | ✅ Working | |
| Meal Planner — full | ✅ Working | Week view, ingredients, cooked, deduction |
| Cook Tonight AI | ✅ Working | Servings + time + vegetarian toggle + plan/save/shop buttons |
| Recipes tab | ✅ Working | Browse, add/edit/delete, search, 11 preloaded favorites |
| Recipes ↔ Menu two-way | ✅ Working | Menu→Recipes (Pick from recipes) + Recipes→Menu (Plan this meal) |

---

## No pending priorities

The core feature set is complete. What follows are **optional future improvements** only — do not implement unless explicitly asked.

---

## 💡 Ideas — future improvements

### UX polish
| Idea | Effort | Notes |
|------|--------|-------|
| Shopping list grouped by category | Medium | Items grouped under Meat, Dairy, Vegetables etc — better for in-store navigation |
| Pantry "Expiring soon" strip | Small | Highlighted section at top of Pantry showing items expiring within 3 days |
| "Plan for today / tomorrow" shortcuts | Tiny | Quick buttons in PlanRecipeModal so user skips the date picker for common cases |
| Vegetarian badge on suggestions | Tiny | Auto-detect and show 🥦 on cards that happen to be vegetarian even without the toggle |

### Possible new features (bigger scope)
| Idea | Effort | Notes |
|------|--------|-------|
| Weekly meal plan PDF / share | Large | Export the week as a printable or shareable format |
| Pantry item barcode scan | Large | Camera scan to add items — out of scope for v1 |
| Expense charts / monthly summary | Medium | Visualise spending by category over time |
| Household invite via QR code | Small | Alternative to sharing the invite code string |

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
| `src/components/CookTonightModal.tsx` | Cook Tonight AI modal |
| `src/components/AddRecipeModal.tsx` | Add/edit recipe |
| `src/components/PlanRecipeModal.tsx` | Plan any meal — from Recipes tab or Cook Tonight suggestion |
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
