# Family Hub — Next Session Starting Point

**Written:** 11-Jun-2026
**Session status:** Sessions 9–11 complete. Live at https://family-hub-seven-sigma.vercel.app

---

## What was built / fixed in session 11

| What | Where | Notes |
|------|-------|-------|
| Full EN/ET/RU translation layer | `src/lib/i18n.ts` (new) | `useT()` + `useCatLabel()` hooks; all UI strings translated |
| All 15 pages/components translated | All pages + components | Tabs, buttons, categories, slots, modals, expiry badges |
| Receipt item translation | `src/app/api/parse-receipt/route.ts` | Language injected into AI prompt at scan time — no extra API call |
| **SECURITY FIX** — household data isolation | All 5 pages | All SELECT queries now scoped to `household_id` |
| **SECURITY FIX** — Supabase RLS | Supabase dashboard | `my_household_id()` helper + `household_only` policy on all 7 tables |
| **SECURITY FIX** — cleaned conflicting old RLS policies | Supabase dashboard | Dropped all old "Allow all" and duplicate policies |
| Removed recipe preload | `src/app/recipes/page.tsx` | New households start empty — no cross-household starter copies |
| Test data cleaned | Supabase | Expenses, pantry, shopping for HappyFamily; preloaded recipes for other households; Mia deleted |

---

## Current state of the app

| Feature | Status | Notes |
|---------|--------|-------|
| Auth + household + invite | ✅ Working | Multi-household, fully isolated |
| EN/ET/RU UI translations | ✅ Working | Language set in Profile; all strings translated incl. receipt scan items |
| Pantry — full CRUD + search + expiry | ✅ Working | |
| Pantry — reservation badges | ✅ Working | Violet border + 📅 name on items reserved for upcoming meals |
| Pantry — deduction when cooked | ✅ Working | MarkCookedModal deducts checked ingredients |
| Receipt import → pantry + expenses | ✅ Working | Items translated to user's language at scan time |
| Shopping list | ✅ Working | |
| Expenses tab | ✅ Working | |
| Meal Planner — full | ✅ Working | Week view, ingredients, cooked, deduction |
| Cook Tonight AI | ✅ Working | Servings + time + vegetarian toggle + plan/save/shop buttons |
| Recipes tab | ✅ Working | Browse, add/edit/delete, search — household-isolated, no preload |
| Recipes ↔ Menu two-way | ✅ Working | Menu→Recipes (Pick from recipes) + Recipes→Menu (Plan this meal) |
| Household data isolation | ✅ Secure | RLS on all tables + client-side `household_id` filters on all queries |

---

## Household isolation — architecture (important, do not remove)

RLS enforced at DB level via a helper function + policies:

```sql
-- Helper (SECURITY DEFINER so it can read profiles regardless of RLS on profiles)
CREATE OR REPLACE FUNCTION public.my_household_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT household_id FROM public.profiles WHERE user_id = auth.uid()
$$;
```

Every table has exactly one policy named `household_only`:
```sql
CREATE POLICY "household_only" ON public.<table>
  FOR ALL USING (household_id = public.my_household_id());
```

Tables covered: `pantry_items`, `shopping_items`, `meals`, `meal_ingredients`, `expenses`, `recipes`, `recipe_ingredients`

Client-side every SELECT also carries `.eq('household_id', profile.household_id)` as defence in depth.

---

## i18n architecture

- `src/lib/i18n.ts` — full EN/ET/RU dictionary; `useT()` returns `(key) => string`; `useCatLabel()` returns `(value) => string`
- Language stored in `profiles.language` (default `'en'`)
- Changed in ProfileSheet — saved to DB + refreshes React profile
- Receipt scan: `language` passed to `/api/parse-receipt`; language instruction appended to system prompt
- Template pattern for dynamic strings: `t('cooked_btn_deduct').replace('{n}', String(n))`

---

## 💡 Ideas — future improvements

### UX polish
| Idea | Effort | Notes |
|------|--------|-------|
| **Shopping list grouped by store aisle** | Medium | `category` column already on `shopping_items` (deployed). Next: add `section` sub-grouping within Food using store-aisle sections (see below). Existing items default to 'other' — need keyword auto-detect or user picks section. |
| **Expense charts / monthly summary** | Medium | Visualise where money goes; bar/pie chart by category across months |
| "Plan for today / tomorrow" shortcuts | Tiny | Quick buttons in PlanRecipeModal to skip date picker for common cases |
| Household invite via QR code | Small | Alternative to copying the invite link string |
| Weekly meal plan PDF / share | Large | Export the week as printable or shareable |
| Notifications — expiry alerts | Medium | Push or email when items expire soon |
| Barcode scan to add pantry items | Large | Camera scan — out of scope for v1 |

### Shopping list — food section design (next session work)

`category` column is live on `shopping_items`. DB and modal picker are done. Grouping display was rolled back because existing items got `DEFAULT 'other'`.

**Agreed food sections (Baltic store aisle order):**
| Section value | Label | Emoji | Typical items |
|---|---|---|---|
| `veg_fruit` | Vegetables & Fruits | 🥦 | carrots, apples, tomatoes, potatoes |
| `bread` | Bread & Bakery | 🍞 | bread, rolls, pastry |
| `dairy` | Dairy & Eggs | 🥛 | milk, cheese, butter, yogurt, eggs |
| `meat` | Meat & Poultry | 🍖 | chicken, beef, pork, sausages, bacon |
| `fish` | Fish & Seafood | 🐟 | salmon, tuna, herring, shrimp |
| `dry` | Pantry & Dry Goods | 🥫 | pasta, rice, flour, oil, canned goods, sauces |
| `frozen` | Frozen | 🧊 | frozen veg, ice cream |
| `snacks` | Snacks & Sweets | 🍬 | chocolate, chips, nuts, cookies |
| `food_other` | Other Food | 🍽️ | anything that doesn't fit above |

**Design decisions to make next session:**
- Auto-detect section by keyword (zero friction) vs always show section picker vs both
- What to do with existing items that have no section (show ungrouped at bottom? default to food_other?)
- Non-food categories (Household, Personal, etc.) group at top level only — no sub-sections

---

### Store price comparison (future — blocked on data)
| Idea | Effort | Blocker |
|------|--------|---------|
| Compare shopping list total across Rimi / Selver / Coop / Maxima | Large | No official public price APIs exist for Baltic grocery chains. Only possible via web scraping (fragile, ToS-grey) or a third-party aggregator like kaubahind.ee if they expose an API. Worth revisiting if any store publishes an official API. |

---

## Architecture decisions (do not revisit)

- **No `@supabase/ssr`** — Client Components; client-side auth with localStorage
- **`public.my_household_id()` SECURITY DEFINER** — all RLS policies use this; never inline `SELECT` on profiles
- **Module-level `deletedIds` Set** — shopping page; survives unmount
- **`shopping_alert_dismissed` DB flag** — permanent; never auto-reset
- **Merge-or-insert** — receipt import + manual add; `.ilike()` + null-safe expiry matching
- **`max_tokens: 8096`** — receipt parser; do not lower
- **Cook Tonight: `claude-opus-4-7`, max_tokens: 1024**
- **Meal ingredients: `claude-haiku-4-5-20251001`, max_tokens: 512**
- **No recipe preload** — removed in session 11; every household starts blank
- **i18n: no function values** — all translation values are strings; use `{n}` template for dynamic text

---

## Key files quick reference

| File | Purpose |
|------|---------|
| `src/lib/i18n.ts` | EN/ET/RU dictionary; `useT()` + `useCatLabel()` hooks |
| `src/lib/categories.ts` | Shared Category type + CATEGORIES array |
| `src/lib/supabase.ts` | Supabase client singleton (anon key — RLS applies) |
| `src/contexts/AuthContext.tsx` | Auth state, profile, useAuth() |
| `src/components/AuthShell.tsx` | Route guard + layout |
| `src/components/BottomNav.tsx` | 5-tab bottom nav |
| `src/components/AddPantryItemModal.tsx` | Add/edit pantry item |
| `src/components/AddShoppingItemModal.tsx` | Add shopping item |
| `src/components/AddExpenseModal.tsx` | Manual expense entry |
| `src/components/ImportReceiptModal.tsx` | Receipt import — translates items via language param |
| `src/components/AddMealModal.tsx` | Add/edit meal — has "Pick from recipes" option |
| `src/components/MarkCookedModal.tsx` | Mark meal as cooked + pantry deduction |
| `src/components/CookTonightModal.tsx` | Cook Tonight AI modal |
| `src/components/AddRecipeModal.tsx` | Add/edit recipe |
| `src/components/PlanRecipeModal.tsx` | Plan any meal — from Recipes tab or Cook Tonight |
| `src/components/ProfileSheet.tsx` | Account sheet — language picker, invite, sign out |
| `src/app/page.tsx` | Pantry tab |
| `src/app/shopping/page.tsx` | Shopping list |
| `src/app/menu/page.tsx` | Meal planner |
| `src/app/recipes/page.tsx` | Recipes tab |
| `src/app/expenses/page.tsx` | Expenses tab |
| `src/app/api/parse-receipt/route.ts` | Receipt parsing — language-aware |
| `src/app/api/cook-tonight/route.ts` | Cook Tonight AI |
| `src/app/api/meal-ingredients/route.ts` | Meal ingredient extraction |

---

## DB tables (current)

| Table | Key columns |
|-------|-------------|
| `households` | `id`, `name`, `invite_code`, `owner_id` |
| `profiles` | `user_id`, `household_id`, `display_name`, `role`, `language` |
| `pantry_items` | `household_id`, `name`, `category`, `quantity`, `unit`, `expiry_date`, `shopping_alert_dismissed`, `added_by` |
| `shopping_items` | `household_id`, `name`, `quantity`, `is_ticked`, `added_by` |
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
