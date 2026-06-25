# Family Hub — Next Session Starting Point

**Written:** 25-Jun-2026
**Session status:** Session 13 complete. Live at https://family-hub-seven-sigma.vercel.app

---

## What was built / fixed in session 13

| What | Where | Notes |
|------|-------|-------|
| Swipe-left actions on pantry rows | `src/app/page.tsx` — `SwipeRow` component | Swipe left → 🛒 Shop (green) + 🗑️ Delete (red). Uses refs to avoid stale closure bugs. |
| Tap/click row to open edit modal | `src/app/page.tsx` | Replaces the ✏️ pencil icon. Works on mobile (tap) and desktop (click). |
| Delete button in edit modal | `src/components/AddPantryItemModal.tsx` | `onDeleted` prop + red "Delete item" button in footer — desktop parity for swipe delete. |
| i18n `pmodal_delete_btn` | `src/lib/i18n.ts` | EN: "Delete item" · ET: "Kustuta toode" · RU: "Удалить товар" |
| Fix: action buttons always visible | `src/app/page.tsx` | `absolute` buttons were painting above static content div. Fix: added `relative` to content wrapper so it stacks on top. |
| Fix: vertical scroll triggered edit modal | `src/app/page.tsx` | Vertical swipe set `dragging=false` but left `moved=false`, so touchEnd fired `onTap()`. Fix: set `moved=true` when vertical movement > 8px. |
| Fix: keyboard opened on edit modal | `src/components/AddPantryItemModal.tsx` | Removed `autoFocus` from item name input. Keyboard now only opens when user deliberately taps a field. |
| Fix: receipt → pantry food sub-categories | `ImportReceiptModal.tsx` + DB migration | DB CHECK constraint blocked `food_veg`, `food_dairy`, etc. User ran SQL migration; modal now inserts `item.category` directly. |
| Fix: expense step blank after receipt import | `ImportReceiptModal.tsx` | Scroll position retained from review step. Fix: `bodyRef.current?.scrollTo({ top: 0 })` on step transition. |
| Fix: action bar pinned above BottomNav | `src/app/page.tsx` | Restructured page as `flex flex-col h-full`; scrollable content `flex-1 min-h-0 overflow-y-auto`; action bar `flex-shrink-0`. |
| Fix: Import Receipt button green | `src/app/page.tsx` + `git push` | Button was white. Root cause: 6 commits never pushed to GitHub — Vercel deploys from GitHub only. |

---

## Current state of the app

| Feature | Status | Notes |
|---------|--------|-------|
| Auth + household + invite | ✅ Working | Multi-household, fully isolated |
| EN/ET/RU UI translations | ✅ Working | All strings translated incl. receipt scan items |
| Pantry — full CRUD + search + expiry | ✅ Working | |
| Pantry — swipe-left (Shop / Delete) | ✅ Working | Mobile swipe; desktop: edit modal → Delete button |
| Pantry — tap/click row to edit | ✅ Working | No keyboard on open (autoFocus removed) |
| Pantry — reservation badges | ✅ Working | Violet border + 📅 name on items reserved for upcoming meals |
| Pantry — deduction when cooked | ✅ Working | Auto-deducts recipe qty; skips unit mismatches with ⚠️ |
| Receipt import → pantry + expenses | ✅ Working | Food sub-categories working; items translated to user's language |
| Shopping list — structured quantities | ✅ Working | `pcs × amount_per_pack · unit` display; edit button; tick→pantry prompt |
| Shopping list — ingredient merge | ✅ Working | Same item added twice merges quantities |
| Expenses tab | ✅ Working | |
| Meal Planner — week view | ✅ Working | Today label timezone-fixed |
| Meal Planner — expandable ingredients | ✅ Working | Tap meal to see ingredients + quantities + pantry status |
| Cook Tonight AI | ✅ Working | Planning a meal saves AI-generated quantities to meal_ingredients |
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
| **Extend swipe-left to other tabs** | Medium | Shopping + Expenses are candidates. Validate pantry pattern first, then extend. |
| **Reclassify old pantry items to food sub-categories** | Small | Old items stored as generic `food` before DB migration. SQL keyword reclassification possible. |
| **Rename "Menu" tab to "Planner"** | Tiny | i18n key `tab_menu` in `src/lib/i18n.ts` + `BottomNav.tsx`. |
| **Fix hardcoded English greeting in pantry** | Tiny | `"Good to see you, {name}!"` in `src/app/page.tsx` — should use i18n. |
| **Hide €0.00 categories in Expenses** | Tiny | Monthly summary shows all categories even when zero. |
| **Receipt review — fewer category pills** | Small | Review step shows all 13 pills per item. Could default to AI-chosen + "Change" to expand. |
| **Shopping list grouped by store aisle** | Medium | `category` column live on `shopping_items`. See food section design below. |
| **Expense charts / monthly summary** | Medium | Bar/pie chart by category across months |
| "Plan for today / tomorrow" shortcuts | Tiny | Quick buttons in PlanRecipeModal to skip date picker |
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

### Store price comparison (future — blocked on data)
| Idea | Effort | Blocker |
|------|--------|---------|
| Compare shopping list total across Rimi / Selver / Coop / Maxima | Large | No official public price APIs for Baltic chains. Web scraping only (fragile, ToS-grey). |

---

## Git discipline — lesson from this session

Vercel auto-deploys from GitHub (`main` branch). Local commits are invisible to the deployed app. After every commit: **`git push origin main`**.

---

## SwipeRow — architecture notes (do not revisit)

`SwipeRow` component lives at the top of `src/app/page.tsx` (before `PantryPage`).

Key design decisions:
- **All position tracking uses refs** (`curOffset`, `startX`, `startY`, `moved`, `dragging`) — avoids stale closures in touch handlers
- **`didTouch` ref** — prevents double-fire: touchEnd fires `onTap()`, then browser fires a click event; `didTouch` skips the click if touch already handled it
- **Content div must be `relative`** — `absolute` action buttons paint above `static` elements; `relative` on the content wrapper ensures it stacks on top and covers buttons at rest
- **Vertical scroll detection** — when `Math.abs(dy) > Math.abs(dx) + 5` AND `dy > 8px`, sets `moved=true` so touchEnd skips `onTap()`. Prevents scroll from opening edit modal.

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
- **SwipeRow refs over state** — touch position tracking via refs; `didTouch` prevents double-fire; content div must be `relative` to stack above absolute action buttons

---

## Key files quick reference

| File | Purpose |
|------|---------|
| `src/lib/i18n.ts` | EN/ET/RU dictionary; `useT()` + `useCatLabel()` hooks |
| `src/lib/shopping.ts` | `addToShoppingMerged()` — merge-or-insert with structured quantity logic |
| `src/lib/categories.ts` | Shared Category type + CATEGORIES array + `isFoodFamily()` |
| `src/lib/supabase.ts` | Supabase client singleton (anon key — RLS applies) |
| `src/contexts/AuthContext.tsx` | Auth state, profile, useAuth() |
| `src/components/AuthShell.tsx` | Route guard + layout |
| `src/components/BottomNav.tsx` | 5-tab bottom nav |
| `src/components/AddPantryItemModal.tsx` | Add/edit pantry item; `onDeleted` prop + Delete button in footer; no autoFocus |
| `src/components/AddShoppingItemModal.tsx` | Add/edit shopping item — dual-mode, structured quantity fields |
| `src/components/AddExpenseModal.tsx` | Manual expense entry |
| `src/components/ImportReceiptModal.tsx` | Receipt import — language-aware; scroll reset on step change |
| `src/components/AddMealModal.tsx` | Add/edit meal — has "Pick from recipes" option |
| `src/components/MarkCookedModal.tsx` | Mark meal as cooked + auto pantry deduction (no manual input) |
| `src/components/CookTonightModal.tsx` | Cook Tonight AI modal |
| `src/components/AddRecipeModal.tsx` | Add/edit recipe |
| `src/components/PlanRecipeModal.tsx` | Plan any meal — calls AI for ingredients; timezone-safe date |
| `src/components/ProfileSheet.tsx` | Account sheet — language picker, invite, sign out |
| `src/app/page.tsx` | Pantry tab — `SwipeRow` component, flex layout, tap-to-edit, action bar above BottomNav |
| `src/app/shopping/page.tsx` | Shopping list — structured quantities, tick→pantry prompt |
| `src/app/menu/page.tsx` | Meal planner — expandable ingredient cards, Today fix |
| `src/app/recipes/page.tsx` | Recipes tab |
| `src/app/expenses/page.tsx` | Expenses tab |
| `src/app/api/parse-receipt/route.ts` | Receipt parsing — language-aware, food sub-categories in system prompt |
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
