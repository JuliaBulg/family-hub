# Family Hub — Next Session Starting Point

**Written:** 16-Jun-2026
**Session status:** Session 12 complete. Live at https://family-hub-seven-sigma.vercel.app

---

## What was built / fixed in session 12

| What | Where | Notes |
|------|-------|-------|
| Structured quantities on shopping items | `shopping_items` table + `AddShoppingItemModal` + `shopping/page.tsx` | New columns: `pcs`, `amount_per_pack`, `unit`. Display: "2 × 400 g". Edit mode added to modal. |
| Ingredient merge on shopping list | `src/lib/shopping.ts` — `addToShoppingMerged()` | Case-insensitive match; merges pcs or amounts when units match; batch-safe |
| Tick → add to pantry prompt | `shopping/page.tsx` | Inline prompt when item ticked; pre-fills quantity from structured fields |
| Timezone bug fix — "Today" label | `src/app/menu/page.tsx` + `PlanRecipeModal.tsx` | Replaced `toISOString()` with local date components to fix UTC offset in Estonia |
| Edit button on shopping items | `AddShoppingItemModal.tsx` | Dual-mode modal (add / edit); updates existing row |
| MarkCookedModal rewrite — auto-deduction | `src/components/MarkCookedModal.tsx` | **No manual input.** Checkbox only for items where recipe units match pantry units. ⚠️ shown + skipped when units differ or recipe has no amount. Auto-deducts on confirm. |
| PlanRecipeModal — AI ingredients | `src/components/PlanRecipeModal.tsx` | Cook Tonight → Plan now calls `/api/meal-ingredients` to get quantities + units. Falls back to ingredient names if AI fails. |
| AddMealModal — structured shopping | `src/components/AddMealModal.tsx` | "Add missing to shopping" now uses `addToShoppingMerged` with structured fields instead of legacy text |
| Expandable ingredient list on menu | `src/app/menu/page.tsx` | Tap meal name to reveal ingredients + quantities. ✓ green = in pantry, · grey = missing. Lazy-loaded, cached. |

---

## Current state of the app

| Feature | Status | Notes |
|---------|--------|-------|
| Auth + household + invite | ✅ Working | Multi-household, fully isolated |
| EN/ET/RU UI translations | ✅ Working | All strings translated incl. receipt scan items |
| Pantry — full CRUD + search + expiry | ✅ Working | |
| Pantry — reservation badges | ✅ Working | Violet border + 📅 name on items reserved for upcoming meals |
| Pantry — deduction when cooked | ✅ Working | Auto-deducts recipe qty; skips unit mismatches with ⚠️ |
| Receipt import → pantry + expenses | ✅ Working | Items translated to user's language at scan time |
| Shopping list — structured quantities | ✅ Working | `pcs × amount_per_pack · unit` display; edit button; tick→pantry prompt |
| Shopping list — ingredient merge | ✅ Working | Same item added twice merges quantities |
| Expenses tab | ✅ Working | |
| Meal Planner — week view | ✅ Working | Today label timezone-fixed |
| Meal Planner — expandable ingredients | ✅ Working | Tap meal to see ingredients + quantities + pantry status |
| Cook Tonight AI | ✅ Working | Planning a meal now saves AI-generated quantities to meal_ingredients |
| Recipes tab | ✅ Working | Browse, add/edit/delete, search — household-isolated |
| Recipes ↔ Menu two-way | ✅ Working | Menu→Recipes + Recipes→Menu |
| Household data isolation | ✅ Secure | RLS on all tables + client-side `household_id` filters |

---

## 🔜 Next session priority: Consumption Tracking

### Problem statement
Items without a time-based mechanism (toothpaste, shampoo, pet food) stay in the pantry forever even as they are actively being used. Pantry becomes a historical list, not a real inventory.

### Agreed design

**1. Household profile — one-time setup (in avatar/profile modal)**
Add to the household setup flow:
- Number of people in household (stepper, default 1)
- Pets section: add/remove by type (dog, cat, rabbit…) + count each

These are global defaults, not per-meal. Cook Tonight servings stays independent (per-meal, as it is now).

**2. Product catalogue — base consumption rates**
A curated list of common items with base rates per unit:

| Product | Rate | Per |
|---------|------|-----|
| Toothpaste | 45 days | per person |
| Shampoo | 30 days | per person |
| Shower gel | 25 days | per person |
| Mascara | 90 days | per person |
| Dog food (dry) | 300 g/day | per dog |
| Cat food (dry) | 80 g/day | per cat |

Start as a hardcoded JSON; evolve to DB table later.

**3. Pantry item — consumption fields**
Add to `pantry_items`:
- `consumption_days` (int, nullable) — fixed duration estimate (for items without quantity)
- `daily_usage` (numeric, nullable) — deduction rate per day
- `daily_usage_unit` (text, nullable) — unit for daily_usage

Behaviour:
- When adding/editing a pantry item, if the name matches the product catalogue → auto-suggest `consumption_days` or `daily_usage` based on household profile (people × per-person rate)
- Always editable per item — e.g. daughter has her own shampoo in separate bathroom, can set a different rate
- "Days remaining" = `quantity / daily_usage` (rate-based) OR `date_opened + consumption_days` (duration-based)
- Warning chip shows when days remaining < 7 (same style as expiry warning)

**4. Pantry display changes**
- Show "~X days remaining" below item name when `consumption_days` or `daily_usage` is set
- Amber chip when approaching zero; red when past

**User stories**
| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-01 | As a household admin, I want to set the number of people and pets during profile setup, so that consumption defaults are personalised | Profile modal shows people stepper + pet type/count section; saved to household profile |
| US-02 | As a user, I want toothpaste to auto-suggest a consumption rate when I add it to the pantry, so I don't have to calculate manually | When item name matches catalogue, `consumption_days` field pre-filled based on num_people |
| US-03 | As a user, I want to override the suggested rate per item, so I can handle edge cases like two people using separate tubes | `consumption_days` / `daily_usage` fields editable on add/edit pantry modal |
| US-04 | As a user, I want to see "~X days remaining" on tracked pantry items, so I know when to buy more | Displays below item name; updates based on current quantity or elapsed time |
| US-05 | As a user, I want a warning when a consumable item is running low, so I can add it to the shopping list in time | Amber chip < 7 days; same style as expiry chip |

**DB changes needed**
```sql
-- Add to profiles table
ALTER TABLE profiles ADD COLUMN num_people integer DEFAULT 1;
ALTER TABLE profiles ADD COLUMN pets jsonb DEFAULT '[]';
-- e.g. pets: [{"type": "dog", "count": 2}, {"type": "cat", "count": 1}]

-- Add to pantry_items table
ALTER TABLE pantry_items ADD COLUMN consumption_days integer;
ALTER TABLE pantry_items ADD COLUMN daily_usage numeric;
ALTER TABLE pantry_items ADD COLUMN daily_usage_unit text;
ALTER TABLE pantry_items ADD COLUMN date_opened date;
```

**Build order**
1. DB migration (columns above)
2. Profile/avatar modal — add people + pets section
3. Pantry add/edit modal — add consumption fields + auto-suggest from catalogue
4. Pantry display — "~X days remaining" + warning chip
5. Hardcoded product catalogue JSON

---

## 💡 Ideas — future improvements

### UX polish
| Idea | Effort | Notes |
|------|--------|-------|
| **Shopping list grouped by store aisle** | Medium | `category` column already on `shopping_items`. Next: add `section` sub-grouping within Food. Existing items default to 'other' — need keyword auto-detect or user picks section. See food section design below. |
| **Expense charts / monthly summary** | Medium | Visualise where money goes; bar/pie chart by category across months |
| "Plan for today / tomorrow" shortcuts | Tiny | Quick buttons in PlanRecipeModal to skip date picker for common cases |
| Household invite via QR code | Small | Alternative to copying the invite link string |
| Weekly meal plan PDF / share | Large | Export the week as printable or shareable |
| Notifications — expiry alerts | Medium | Push or email when items expire soon |
| Barcode scan to add pantry items | Large | Camera scan — out of scope for v1 |

### Shopping list — food section design (deferred)

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

**Design decisions to make:**
- Auto-detect section by keyword (zero friction) vs always show section picker vs both
- What to do with existing items that have no section (show ungrouped at bottom? default to food_other?)
- Non-food categories (Household, Personal, etc.) group at top level only — no sub-sections

### Store price comparison (future — blocked on data)
| Idea | Effort | Blocker |
|------|--------|---------|
| Compare shopping list total across Rimi / Selver / Coop / Maxima | Large | No official public price APIs exist for Baltic grocery chains. Only possible via web scraping (fragile, ToS-grey) or a third-party aggregator like kaubahind.ee if they expose an API. |

---

## Session 12 — BA Release Notes

### Family Hub — Session 12 Enhancements
**Release date:** 16-Jun-2026

---

#### 1. Auto-deduction when marking a meal as cooked

**Feature area:** Meal Planner → Mark as Cooked

**What changed:**
The "Mark as Cooked" modal was rewritten to eliminate all manual input. The system now auto-deducts recipe quantities from pantry automatically.

**User story:**
> As a family member, I want the app to automatically deduct used ingredients from the pantry when I mark a meal as cooked, so I don't have to type amounts manually.

**Acceptance criteria — met:**
- Given a meal has ingredients with recipe quantities and matching pantry units → deduction happens automatically on confirm
- Given units differ (e.g. recipe says "1 pc", pantry has "1 kg") → ingredient shows ⚠️ "units differ" and is skipped; pantry item is NOT deleted
- Given a recipe ingredient has no quantity recorded → ingredient shows ⚠️ "no amount" and is skipped
- User can uncheck any ingredient to exclude it from deduction
- No manual input fields anywhere in the modal

**Bug fixed:** Previously, a unit mismatch caused the entire pantry item to be deleted (comparison failed and fell to the delete branch). This is now fully resolved.

---

#### 2. AI ingredient quantities for Cook Tonight planned meals

**Feature area:** Cook Tonight → Plan a meal

**What changed:**
When a user plans a meal from Cook Tonight suggestions, the app now calls the AI to retrieve ingredient names, quantities, and units (scaled to the selected number of servings). Previously, ingredients were saved with no quantity.

**User story:**
> As a user who plans meals from Cook Tonight, I want the saved meal to include ingredient quantities so I can see what's needed and auto-deduct correctly when I cook it.

**Acceptance criteria — met:**
- Given a Cook Tonight suggestion is planned with 4 servings → `meal_ingredients` is populated with AI-suggested quantities and units
- Given the AI call fails → falls back to saving ingredient names only (no quantities), no error shown
- Ingredients are matched against existing pantry items (pantry_item_id set where matched)

---

#### 3. Expandable ingredient list on the menu weekly view

**Feature area:** Meal Planner — weekly view

**What changed:**
Each meal card in the weekly view now has an expand/collapse toggle. Tapping the meal name reveals the full ingredient list with quantities and pantry availability status.

**User story:**
> As a user planning meals for the week, I want to see what ingredients a planned meal requires directly from the menu view, so I know what to prepare or buy without opening a separate screen.

**Acceptance criteria — met:**
- Tap meal name → ingredients load and appear inline (lazy-loaded, cached after first load)
- Each ingredient shows: name, quantity + unit (if set), ✓ green if in pantry / · grey if missing
- Tap again → collapses
- Cooked meals also show ingredients when expanded
- If no ingredients recorded → "No ingredients recorded" message shown

---

#### 4. Structured quantities on shopping list

**Feature area:** Shopping List

**What changed:**
Shopping items now support three structured fields — `pcs` (number of packs), `amount_per_pack` (quantity per pack), `unit` — in addition to a legacy text field. Display adapts: "2 × 400 g", "1 × 10 pc", "500 g", etc.

**User story:**
> As a shopper, I want to see exactly how many packs and what size each shopping item refers to, so I buy the right amount without guessing.

**Acceptance criteria — met:**
- Add item modal has pcs + amount fields + unit pill buttons (g, kg, mL, L, pc, pack, box)
- Edit button on each item opens pre-filled modal
- When item is ticked, a prompt appears to add it to pantry with the quantity pre-filled
- Missing meal ingredients added to shopping list use structured fields (not legacy text)
- Duplicate items are merged: same unit + same pack size → pcs added; different amounts, same unit → totalled

---

#### 5. Timezone fix — "Today" label

**Feature area:** Meal Planner + Plan Recipe modal

**Bug fixed:**
"Today" label was showing on the wrong day for users in UTC+ timezones (e.g. Estonia, UTC+3). `toISOString()` converts to UTC before formatting, causing a -3 hour offset that shifts the date backwards at midnight.

**Fix:** Replaced with local date component formatting (`getFullYear()`, `getMonth()`, `getDate()`) in both `menu/page.tsx` and `PlanRecipeModal.tsx`.

---

## Household isolation — architecture (do not remove)

RLS enforced at DB level via a helper function + policies:

```sql
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
- **Structured shopping quantities** — `pcs`, `amount_per_pack`, `unit` columns on `shopping_items`; legacy `quantity` (text) kept for backward compat; `addToShoppingMerged()` handles all merge logic

---

## Key files quick reference

| File | Purpose |
|------|---------|
| `src/lib/i18n.ts` | EN/ET/RU dictionary; `useT()` + `useCatLabel()` hooks |
| `src/lib/shopping.ts` | `addToShoppingMerged()` — merge-or-insert with structured quantity logic |
| `src/lib/categories.ts` | Shared Category type + CATEGORIES array |
| `src/lib/supabase.ts` | Supabase client singleton (anon key — RLS applies) |
| `src/contexts/AuthContext.tsx` | Auth state, profile, useAuth() |
| `src/components/AuthShell.tsx` | Route guard + layout |
| `src/components/BottomNav.tsx` | 5-tab bottom nav |
| `src/components/AddPantryItemModal.tsx` | Add/edit pantry item |
| `src/components/AddShoppingItemModal.tsx` | Add/edit shopping item — dual-mode, structured quantity fields |
| `src/components/AddExpenseModal.tsx` | Manual expense entry |
| `src/components/ImportReceiptModal.tsx` | Receipt import — translates items via language param |
| `src/components/AddMealModal.tsx` | Add/edit meal — has "Pick from recipes" option |
| `src/components/MarkCookedModal.tsx` | Mark meal as cooked + auto pantry deduction (no manual input) |
| `src/components/CookTonightModal.tsx` | Cook Tonight AI modal |
| `src/components/AddRecipeModal.tsx` | Add/edit recipe |
| `src/components/PlanRecipeModal.tsx` | Plan any meal — calls AI for ingredients; timezone-safe date |
| `src/components/ProfileSheet.tsx` | Account sheet — language picker, invite, sign out |
| `src/app/page.tsx` | Pantry tab |
| `src/app/shopping/page.tsx` | Shopping list — structured quantities, tick→pantry prompt |
| `src/app/menu/page.tsx` | Meal planner — expandable ingredient cards, Today fix |
| `src/app/recipes/page.tsx` | Recipes tab |
| `src/app/expenses/page.tsx` | Expenses tab |
| `src/app/api/parse-receipt/route.ts` | Receipt parsing — language-aware |
| `src/app/api/cook-tonight/route.ts` | Cook Tonight AI |
| `src/app/api/meal-ingredients/route.ts` | Meal ingredient extraction — returns name + quantity + unit + pantry_item_id |

---

## DB tables (current)

| Table | Key columns |
|-------|-------------|
| `households` | `id`, `name`, `invite_code`, `owner_id` |
| `profiles` | `user_id`, `household_id`, `display_name`, `role`, `language` |
| `pantry_items` | `household_id`, `name`, `category`, `quantity`, `unit`, `expiry_date`, `shopping_alert_dismissed`, `added_by` |
| `shopping_items` | `household_id`, `name`, `quantity` (legacy text), `pcs`, `amount_per_pack`, `unit`, `category`, `is_ticked`, `added_by` |
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
