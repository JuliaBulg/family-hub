# Family Hub — Product Specification

**Version:** 1.5
**Date:** 09-Jun-2026
**Status:** Pantry + Shopping + Expenses + Meal Planner Phase 1 + Cook Tonight built and live on Vercel. Meal Planner Phase 2 next.

---

## 1. Product Vision

> Family Hub is a mobile-first web app that gives a family a single place to manage their home — from what's in the fridge to what they need to buy.

No app install required. Opens in any phone browser. Designed for quick, low-friction interactions during real household moments (unpacking groceries, planning dinner, writing a shopping list).

---

## 2. Problem Statement

Families manage household tasks across paper lists, WhatsApp messages, and notes apps. There is no unified, shared tool designed specifically for home management. This leads to forgotten shopping items, food going to waste because expiry dates are missed, and no single view of what the household has.

Family Hub solves this with a single shared app covering pantry, shopping, meals, and expenses.

---

## 3. Target Users

| User | Description | Primary Need |
|------|-------------|--------------|
| Parent (Admin) | Sets up the household, invites family members | Full overview, quick data entry, manage household |
| Partner / Spouse | Shared day-to-day management | Update pantry, check shopping list, log expenses |
| Teenager / Older Child | Regular contributor | Add to shopping list, check meal plan |
| Younger Child | Occasional reader | Check the shopping list or meal plan |

---

## 3a. User Accounts & Household Model ✅ Built

### Authentication
- **Method:** Email + password (via Supabase Auth)
- **Session:** Persistent — stored in `localStorage` under key `family-hub-auth`
- **Onboarding:** First user signs up → creates household; subsequent family members join via invite link (`/join?code=xxx`)
- **Email confirmation:** PKCE flow; after confirming email `/auth/callback` exchanges code for session → user redirected to `/setup`
- **Route guard:** `AuthShell` wraps all pages; unauthenticated users → `/login`; authenticated users on `/login` or `/signup` → `/`

### Signup Rules
- Required fields: email, password (min 6 chars), confirm password
- Passwords must match — validated client-side before submit
- After submit: "Check your email" screen shown with the user's email address
- After confirming email: `/auth/callback` → session created → redirect to `/setup`
- `/setup`: user enters display name and household name → household row + profile row created → redirect to pantry

### Household Model
- One household contains all shared data: pantry, shared shopping list, expenses, meals
- Every user belongs to exactly one household
- All household members can add, update, delete any shared item
- All mutations record `added_by` (user display name)

### Roles
- `role: 'parent' | 'child'` stored on the profile row
- First user to create a household is always `role = 'parent'`
- Role assigned at invite time; parents can edit any member's role from the Profile Sheet

### Shopping Lists — Shared vs Personal

| List Type | Visible to | Notes |
|-----------|-----------|-------|
| **Shared shopping list** | All household members | One household list everyone sees and edits |
| **Personal shopping list** | Only the creator | Private; not shared with household |

---

## 3b. Profile & Account Settings ✅ Built

- Initials avatar (top-right corner) → tapping opens Profile Sheet
- Profile Sheet: display name, email, household name, role badge, sign out
- Parents can edit any member's role (Parent ↔ Child) via buttons in the Profile Sheet

---

## 4. Current Feature Scope (as built)

### 4.1 Pantry Tracker ✅ Built

| Capability | Detail |
|-----------|--------|
| Add item manually | Name, category, quantity, unit, expiry date (optional) |
| Edit item | Tap ✏️ to open pre-filled modal |
| Delete item | Tap ✕ on any item group |
| Group by name | Items with the same name are merged; quantities summed |
| Search | Always-visible search bar at top of pantry; filters by name across all categories; clear button (✕) |
| Categories | Food & Groceries, Drinks & Extras, Household, Personal & Cosmetics, Medicine & First Aid, Pets & Animals, Everything Else |
| Expiry alerts | Red alert for expired items; amber warning for items expiring within 3 days |
| Expired → Shopping | One tap on red alert adds all expired items to shopping list; alert dismissed persistently via DB flag |
| "Was on list" indicator | Once an expiry alert is dismissed (item sent to shopping), pantry card shows "· ✓ Was on list" instead of re-alerting |
| Import from receipt | AI-powered (Claude Opus 4.7) — photo or PDF → extracted items → review → add to pantry |
| Receipt expiry estimation | AI estimates expiry date per item based on EU shelf-life averages; stored as `expiry_date` on insert |
| Quantity merging | When adding from receipt: if same name + category + expiry date already exists → quantities summed; otherwise new row inserted |
| Cook Tonight | Button on pantry page → opens Cook Tonight modal (AI recipe suggestions) |

**Item categories:**

| Value | Label | Emoji |
|-------|-------|-------|
| `food` | Food & Groceries | 🛒 |
| `drinks` | Drinks & Extras | 🥤 |
| `household` | Household | 🧹 |
| `personal` | Personal & Cosmetics | 🧴 |
| `medicine` | Medicine & First Aid | 💊 |
| `pets` | Pets & Animals | 🐾 |
| `other` | Everything Else | 🧺 |

**EU shelf-life averages used for AI expiry estimation:**

| Product | Estimated days |
|---------|---------------|
| Milk | 7 |
| Chicken / poultry | 2 |
| Raw beef / pork / mince | 3 |
| Vegetables | 5 |
| Yogurt / kefir | 14 |
| Hard cheese | 21 |
| Soft cheese | 7 |
| Eggs | 21 |
| Bread | 5 |
| Non-perishables | null (no expiry set) |

---

### 4.2 Shopping List ✅ Built

| Capability | Detail |
|-----------|--------|
| Add item | Name + optional quantity |
| Tick off | Tap circle to mark as done (strikethrough) |
| Delete item | Tap ✕ — immediate DB delete; 5s undo available |
| Undo delete | "Undo" snackbar appears for 5s after delete; tapping re-inserts a fresh row |
| Clear done | One tap to remove all ticked items |
| Item count | Header shows "X left · Y done" |
| Auto-populate | Expired / expiring pantry items pushed here from Pantry page |
| Added by | Each item shows "by [Name]" below the item name |

**Delete race condition fix:** Deleted item IDs are tracked in a module-level `Set<string>` (outside the React component) that survives tab navigation and component unmounts. `fetchItems` filters out any ID in this set. The set entry is removed once the DB delete confirms. Undo (`Re-add`) removes the ID from the set before re-inserting.

---

### 4.3 Meal Planner ✅ Phase 1 Built

| Capability | Detail |
|-----------|--------|
| Week view | Mon–Sun grid; shows this week and next week; navigation arrows ‹ › |
| Today highlight | Today's card has emerald border + "Today" badge |
| Meal slots | Breakfast 🌅, Lunch ☀️, Dinner 🌙 — sorted in that order per day |
| Add meal | Tap "+ Add" on any day → AddMealModal; fields: date, slot selector, meal name, servings stepper (1–12) |
| Edit meal | Tap ✏️ on any meal row → pre-filled AddMealModal |
| Delete meal | Tap ✕ on any meal row → immediate delete with optimistic update |
| Servings | Each meal stores number of servings for the planned cooking |

**Week navigation:** `getWeekDays(offset)` computes Mon–Sun for offset=0 (this week) or offset=1 (next week). ‹ disabled at offset=0; › disabled at offset=1.

---

### 4.4 Expenses ✅ Built

| Capability | Detail |
|-----------|--------|
| Month view | Month navigation (‹ ›); total spend card at top |
| Category breakdown | Progress bars showing spend per category relative to month total |
| Expandable rows | Tap a category to expand and see individual expense rows |
| Add expense manually | Amount, category grid, store, note, date fields |
| Receipt → expense | Part of receipt import flow (Step 4): per-category amounts pre-filled from AI-extracted prices; one DB row per category |
| Added by | Each expense shows "Logged by [Name]" |

---

### 4.5 Cook Tonight (AI) ✅ Built

Accessible via the "🍽️ Cook Tonight" button on the Pantry page.

| Capability | Detail |
|-----------|--------|
| Servings picker | Stepper 1–12; default 4 people |
| Time presets | ⚡ Quick (≤25 min), 🕐 Normal (≤45 min, default), 🍲 No rush (no limit) |
| AI suggestions | 3 recipe suggestions from Claude Opus 4.7 based on current pantry contents |
| Suggestion card | Shows: name, emoji, description, ✓ key ingredients from pantry, − missing ingredients, ⏱ time in minutes |
| Time constraint | Selected time preset passed to Claude; suggestions respect the limit |
| Servings constraint | Servings count passed to Claude; missing ingredients flagged relative to servings |

---

## 5. Technical Architecture

### 5.1 Technology Stack

| Layer | Technology | Detail |
|-------|-----------|--------|
| Framework | Next.js 16 (App Router, Turbopack) | Server + client components, API routes |
| Language | TypeScript | Strict typing throughout |
| Styling | Tailwind CSS v4 | Mobile-first utility classes |
| Database | Supabase (PostgreSQL) | Project ID: `kqolxqefwimfujwmejfn` |
| AI / ML | Anthropic Claude API | `claude-opus-4-7` for receipts + cook tonight |
| Hosting | Vercel | Auto-deploy from `main` at https://family-hub-seven-sigma.vercel.app |
| PWA | Web App Manifest | Installable on iOS/Android home screen |

### 5.2 Project Structure

```
family-hub/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Pantry tab (/)
│   │   ├── layout.tsx                  # Root layout — AuthProvider + AuthShell
│   │   ├── login/page.tsx              # Sign-in page
│   │   ├── signup/page.tsx             # Sign-up page
│   │   ├── setup/page.tsx              # Post-confirmation: display name + household
│   │   ├── auth/callback/page.tsx      # PKCE code exchange
│   │   ├── join/page.tsx               # Invite link landing + signup
│   │   ├── shopping/page.tsx           # Shopping list tab
│   │   ├── menu/page.tsx               # Meal planner tab
│   │   ├── expenses/page.tsx           # Expenses tab
│   │   └── api/
│   │       ├── parse-receipt/route.ts  # Claude AI receipt parsing
│   │       └── cook-tonight/route.ts   # Claude AI recipe suggestions
│   ├── components/
│   │   ├── AuthShell.tsx               # Route guard + layout + avatar
│   │   ├── ProfileSheet.tsx            # Bottom sheet: account info + role editing
│   │   ├── BottomNav.tsx               # 4-tab bottom navigation
│   │   ├── AddPantryItemModal.tsx      # Add + Edit pantry item
│   │   ├── AddShoppingItemModal.tsx    # Add shopping item
│   │   ├── ImportReceiptModal.tsx      # Receipt import (photo/PDF → pantry + expenses)
│   │   ├── AddExpenseModal.tsx         # Manual expense entry
│   │   ├── AddMealModal.tsx            # Add + Edit meal (meal planner)
│   │   └── CookTonightModal.tsx        # Cook Tonight — servings, time, AI suggestions
│   ├── contexts/
│   │   └── AuthContext.tsx             # Auth state: user, profile, signOut
│   └── lib/
│       ├── supabase.ts                 # Supabase client singleton
│       └── categories.ts              # Shared Category type + CATEGORIES array
├── docs/
│   ├── SPECIFICATION.md               # This file
│   └── DIAGRAMS.md                    # Mermaid diagrams
├── NEXT-SESSION.md                    # Session handoff notes
└── .env.local                         # ANTHROPIC_API_KEY, Supabase keys
```

### 5.3 Database Schema (current)

**Table: `households`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | Auto-generated |
| `name` | text | e.g. "Julia's Family" |
| `owner_id` | uuid FK → auth.users | User who created it |
| `invite_code` | text | Short code for `/join` link |
| `created_at` | timestamp | Auto-set |

---

**Table: `profiles`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | Auto-generated |
| `user_id` | uuid FK → auth.users | One profile per user |
| `display_name` | text | Name shown in the UI |
| `household_id` | uuid FK → households | |
| `role` | text | `'parent'` or `'child'` |
| `created_at` | timestamp | Auto-set |

---

**Table: `pantry_items`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | Auto-generated |
| `name` | text | Item name |
| `category` | text | One of 7 category values |
| `quantity` | text | Free-text e.g. "500", "2 packs" |
| `unit` | text | "g", "L", "pcs", etc. |
| `expiry_date` | date | Optional; set manually or estimated from receipt |
| `shopping_alert_dismissed` | boolean | True once user sends item to shopping list; prevents re-alerting. Never resets automatically |
| `household_id` | uuid FK → households | |
| `added_by` | text | Display name of the user who added the item |
| `created_at` | timestamp | Auto-set |

**Important:** `shopping_alert_dismissed` is the mechanism for persistent expiry alert suppression. It is set to `true` when the user taps "+ Shopping" on an expiry alert. It is never reset by the app — once dismissed, the item shows "· ✓ Was on list" in the pantry card instead of re-alerting.

---

**Table: `shopping_items`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | Auto-generated |
| `name` | text | Item name |
| `quantity` | text | Optional |
| `checked` | boolean | Default: false |
| `store` | text | Column exists; not used in current UI |
| `household_id` | uuid FK → households | |
| `added_by` | text | Display name of the user who added the item |
| `is_ticked` | boolean | Alias for checked in some queries |
| `created_at` | timestamp | Auto-set |

---

**Table: `expenses`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | Auto-generated |
| `household_id` | uuid FK → households | |
| `amount` | numeric | Decimal amount |
| `category` | text | One of the 7 shared categories |
| `store` | text | Optional store name |
| `note` | text | Optional free-text note |
| `date` | date | Date of expense; defaults to today |
| `added_by` | text | Display name of the user who logged it |
| `created_at` | timestamp | Auto-set |

---

**Table: `meals`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | Auto-generated |
| `household_id` | uuid FK → households | RLS via `get_my_household_id()` |
| `date` | date | The date this meal is planned for |
| `slot` | text | `'breakfast'`, `'lunch'`, or `'dinner'` |
| `name` | text | Meal name e.g. "Pasta Bolognese" |
| `servings` | integer | Number of people; default 2 |
| `added_by` | text | Display name of who added it |
| `cooked_at` | timestamp | Set when user marks as cooked (Phase 2) |
| `created_at` | timestamp | Auto-set |

---

### 5.4 Key Architecture Decisions

| Decision | Rationale |
|---------|-----------|
| No `@supabase/ssr` | All pages are Client Components; client-side auth with localStorage is correct for this app |
| No middleware | Route guard handled by `AuthShell` client component |
| `detectSessionInUrl: false` | Avoids iOS Safari hash-change reload bug |
| `navigator.locks` no-op | `lock: async (_name, _acquireTimeout, fn) => fn()` — bypasses Supabase navigator.locks; prevents 5s dev hangs |
| `get_my_household_id()` SECURITY DEFINER | All RLS policies that scope by household use this function. Never use inline `SELECT household_id FROM profiles WHERE user_id = auth.uid()` — causes infinite recursion (42P17) |
| Module-level `deletedIds` Set | Lives outside the React component to survive unmount; prevents deleted shopping items from reappearing on tab navigation |
| `shopping_alert_dismissed` DB flag | Persistent expiry alert suppression; never resets; survives page reload, tab switch, new session |
| Merge-or-insert for receipt items | Receipt import checks for existing row with same name + category + expiry date (using `.ilike()` + `.is()` or `.eq()` depending on null-safety); merges quantities if found; inserts new row otherwise |
| `max_tokens: 8096` for receipt parser | Required for large PDF receipts; do not lower |
| Cook Tonight uses `claude-opus-4-7` | Best model for recipe reasoning; max_tokens 1024 |
| Quantity as free-text string | Handles diverse formats: "500", "2 bottles", "1 pack" |

---

## 6. Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-001 | Compatibility | Must work on Safari iOS 15+, Chrome Android 90+ |
| NFR-002 | Layout | Optimised for screens 375px–430px wide (iPhone range) |
| NFR-003 | Performance | Pages must load in under 3 seconds on a 4G connection |
| NFR-004 | Usability | All primary actions reachable within 2 taps from any screen |
| NFR-005 | Navigation | Fixed bottom nav always visible |
| NFR-006 | AI cost | Receipt parsing ~€0.01 per scan; Cook Tonight ~€0.005 per call |
| NFR-007 | PWA | App is installable on iOS/Android home screen via web manifest |

---

## 7. User Stories — Built Features

### Pantry

**US-P01 — Add a pantry item manually**
> As a family member,
> I want to add an item to the pantry with its name, category, quantity, and optional expiry date,
> So that I have an accurate record of what the household has.

*Acceptance Criteria:*
- Given I tap "+ Add Item" on the Pantry page
- When I fill in the name (required) and optional fields and tap "Add to Pantry"
- Then the item appears in the correct category section immediately
- And if an item with the same name, category, and expiry date already exists, its quantity is increased instead of creating a duplicate

---

**US-P02 — Edit a pantry item**
> As a family member,
> I want to update an existing pantry item's details,
> So that I don't have to delete and re-add it when something changes.

*Acceptance Criteria:*
- Given I tap ✏️ on a pantry item
- When the edit modal opens pre-filled with current values and I change any field and tap "Save Changes"
- Then the item is updated immediately in the pantry list
- And no duplicate item is created

---

**US-P03 — See expiry warnings**
> As a family member,
> I want to be alerted when pantry items are expired or expiring soon,
> So that we can use or replace them before wasting food.

*Acceptance Criteria:*
- Given the pantry has items with expiry dates
- When an item is past its expiry date, a red "🚨 X items expired" alert appears at the top
- When an item expires within 3 days, an amber "⏰ X items expiring soon" alert appears
- And each alert shows the names of the affected items
- And items whose `shopping_alert_dismissed = true` are excluded from the alert

---

**US-P04 — Send expired items to shopping list (with persistent dismissal)**
> As a family member,
> I want to send expired items to the shopping list in one tap and never see that alert again for those items,
> So that I am not nagged repeatedly about items I have already actioned.

*Acceptance Criteria:*
- Given there are expired items showing in the red alert
- When I tap "+ Shopping" on the alert
- Then all expired items are added to the shopping list with their quantities
- And `shopping_alert_dismissed` is set to `true` in the DB for each of those pantry items
- And the alert no longer appears for those items — even after page reload or tab navigation
- And those items still appear in the pantry list under their category with a "· ✓ Was on list" label instead of the alert
- And if the items are later deleted from the shopping list, the pantry still shows "· ✓ Was on list" (the flag is never cleared)

---

**US-P05 — Import items from a receipt (with expiry estimation and quantity merging)**
> As a primary user,
> I want to photograph or upload a grocery receipt and have items extracted, categorised, and added to the pantry with estimated expiry dates and merged quantities,
> So that I can stock the pantry quickly after shopping without typing every item.

*Acceptance Criteria:*
- Given I tap "🧾 From Receipt" and upload a photo or PDF
- When the AI processes the receipt
- Then all product names, categories, quantities, and units are extracted
- And each item has an estimated `expiry_date` set based on EU shelf-life averages (null for non-perishables)
- And I see a review screen where I can deselect items before adding
- When I tap "Add to Pantry"
- Then for each item: if a pantry row with the same name, category, and expiry date already exists, the quantities are summed; otherwise a new row is inserted

---

**US-P06 — Search pantry items**
> As a family member,
> I want to search pantry items by name,
> So that I can quickly find a specific item without scrolling through all categories.

*Acceptance Criteria:*
- Given the Pantry page is open
- When I type in the always-visible search bar at the top
- Then the pantry switches from category view to a flat filtered list showing only matching items
- And each result shows the category emoji next to the item name
- And tapping ✕ in the search bar clears the search and returns to normal category view

---

### Shopping List

**US-S01 — Add a shopping item**
> As a family member,
> I want to add an item to the shopping list,
> So that I know what to buy and how much.

*Acceptance Criteria:*
- Given I tap "+ Add to Shopping List"
- When I enter a name and optional quantity and tap "Add Item"
- Then the item appears at the bottom of the list immediately with "by [my name]" shown

---

**US-S02 — Tick off items while shopping**
> As a family member,
> I want to mark items as done while I'm shopping,
> So that I can track what's already in the trolley.

*Acceptance Criteria:*
- Given I am on the shopping list
- When I tap the circle next to an item
- Then the item is struck through and the counter updates ("X left · Y done")

---

**US-S03 — Delete a shopping item with undo**
> As a family member,
> I want to delete an item from the shopping list with a brief undo window,
> So that accidental taps don't lose items.

*Acceptance Criteria:*
- Given I tap ✕ on a shopping item
- Then the item disappears immediately from the list
- And an "Undo" snackbar appears for 5 seconds
- When I tap "Undo" within 5 seconds
- Then the item reappears in the list
- And if I navigate away and come back, the deleted item does not reappear (module-level Set prevents this)

---

**US-S04 — Clear completed items**
> As a family member,
> I want to remove all ticked items in one tap,
> So that I can clean up the list after shopping.

*Acceptance Criteria:*
- Given there are ticked items on the shopping list
- When I tap "Clear done (N)"
- Then all ticked items are removed from the list and from the database

---

### Meal Planner

**US-M01 — View the week's meal plan**
> As a family member,
> I want to see all meals planned for the current week at a glance,
> So that I know what we're eating without asking anyone.

*Acceptance Criteria:*
- Given I open the Menu tab
- Then I see a card for each day of the current week (Mon–Sun)
- And today's card is highlighted in emerald with a "Today" badge
- And each meal appears under its slot (🌅 Breakfast, ☀️ Lunch, 🌙 Dinner) with the meal name and servings
- And days with no meals show "No meals planned"

---

**US-M02 — Navigate to next week**
> As a family member,
> I want to view and plan meals for next week,
> So that I can do my Sunday weekly planning in advance.

*Acceptance Criteria:*
- Given I am on the Meal Planner
- When I tap the › button
- Then the view shows next week (Mon–Sun with correct dates)
- And the ‹ button becomes active to return to this week
- And the › button is disabled when on next week (cannot navigate further)

---

**US-M03 — Add a meal to a day**
> As a family member,
> I want to add a meal to a specific day and time slot,
> So that the family knows what's planned.

*Acceptance Criteria:*
- Given I tap "+ Add" on any day card
- When I select a slot (Breakfast / Lunch / Dinner), enter a meal name, set servings, and tap "Add Meal"
- Then the meal appears on the correct day card under the correct slot immediately
- And servings are shown below the meal name

---

**US-M04 — Edit a planned meal**
> As a family member,
> I want to edit a meal I already planned,
> So that I can change the slot, name, or servings without deleting and re-adding.

*Acceptance Criteria:*
- Given I tap ✏️ on a meal row
- When the edit modal opens pre-filled and I change fields and tap "Save Changes"
- Then the meal is updated immediately in the day card

---

**US-M05 — Delete a planned meal**
> As a family member,
> I want to remove a meal from the plan,
> So that the plan stays accurate if something changes.

*Acceptance Criteria:*
- Given I tap ✕ on a meal row
- Then the meal is removed immediately (optimistic update)
- And it is deleted from the database

---

### Cook Tonight (AI)

**US-C01 — Get AI recipe suggestions based on pantry**
> As a family member,
> I want to see recipe suggestions based on what's currently in the pantry,
> So that I can decide what to cook without having to think from scratch.

*Acceptance Criteria:*
- Given I tap "🍽️ Cook Tonight" on the Pantry page
- When the modal opens and I tap "✨ Get suggestions"
- Then 3 recipe suggestions appear, each showing: name, emoji, description, ✓ ingredients I have, − ingredients I'm missing, and estimated time
- And if the pantry is empty, an empty state is shown instead of the button

---

**US-C02 — Set number of people for cooking suggestions**
> As a family member,
> I want to specify how many people I'm cooking for,
> So that ingredient quantities and missing-items flags reflect the right amount.

*Acceptance Criteria:*
- Given the Cook Tonight modal is open
- When I use the − / N / + stepper to set 1–12 people (default: 4)
- Then the suggestions reflect that serving size
- And missing ingredient warnings are relative to that number of people

---

**US-C03 — Filter recipe suggestions by available cooking time**
> As a family member,
> I want to optionally set how much time I have to cook,
> So that I only get suggestions I can actually make right now.

*Acceptance Criteria:*
- Given the Cook Tonight modal is open in Step 1
- When I select a time preset: ⚡ Quick (≤25 min), 🕐 Normal (≤45 min, default), or 🍲 No rush (no limit)
- Then the selected preset is highlighted in emerald
- And when suggestions arrive, all three respect the chosen time constraint (time_minutes ≤ chosen limit, or any for No rush)
- And the preset can be changed before tapping "Get suggestions"

---

### Auth & Account

**US-A01 — Sign up and create a household**
> As a new user,
> I want to create an account and a household,
> So that my family's data is private to us.

*Acceptance Criteria:*
- Given I open the app for the first time and sign up
- When I confirm my email and complete setup with a display name and household name
- Then I land on the pantry page with my name in the greeting and role = parent

---

**US-A02 — Sign in to an existing account**
> As a returning user,
> I want to sign in with my email and password,
> So that I can access my household's data on any device.

*Acceptance Criteria:*
- Given I open the app with no active session
- When I enter my email and password and tap "Sign in"
- Then I am on the pantry page and my display name appears in the greeting
- And if I reload the page, I remain signed in

---

**US-A03 — Reset a forgotten password**
> As a user who has forgotten their password,
> I want to receive a reset link by email,
> So that I can regain access without needing anyone's help.

*Acceptance Criteria:*
- Given I tap "Forgot password?" and enter my email
- Then a confirmation screen shows and a reset link is sent to my inbox

---

**US-A04 — View account details and sign out**
> As a signed-in user,
> I want to see my name, email, household, and role and be able to sign out,
> So that I can verify my account or leave the app on a shared device.

*Acceptance Criteria:*
- Given I tap the initials avatar
- Then a bottom sheet shows my display name, email, household name, and role badge
- And I can tap "Sign out" to end the session

---

## 8. Business Rules

| ID | Rule |
|----|------|
| BR-001 | A pantry item's `shopping_alert_dismissed` flag, once set to `true`, is never automatically reset. It persists across sessions and tab navigation. |
| BR-002 | When adding items from a receipt, items with the same name + category + expiry date are merged (quantities summed). Items with different expiry dates are kept as separate rows. |
| BR-003 | Expiry date estimation uses EU shelf-life averages baked into the AI system prompt. Non-perishable items receive `null` expiry (no expiry set). |
| BR-004 | Cook Tonight time presets are advisory to the AI — the AI should prefer suggestions that fit within the chosen time limit. |
| BR-005 | Meal servings are stored per meal and used by the Cook Tonight AI to calibrate ingredient quantities and missing-items warnings. |
| BR-006 | Module-level `deletedIds` Set survives React component unmount; ensures deleted shopping items never reappear on tab navigation, even if `fetchItems` is called before the DB delete confirms. |

---

## 9. Assumptions

| # | Assumption |
|---|-----------|
| A-01 | Users have a smartphone with a modern browser (Safari iOS 15+ or Chrome Android 90+) |
| A-02 | English language only |
| A-03 | Internet connection is available — no offline mode implemented |
| A-04 | Quantities are stored as free-text strings to handle diverse formats |
| A-05 | Receipt parsing will produce valid JSON; fallback error shown if not |
| A-06 | EU shelf-life averages are a reasonable baseline; users can manually edit expiry dates if needed |

---

## 10. Known Constraints

| # | Constraint |
|---|-----------|
| C-01 | No offline mode |
| C-02 | No barcode scanning — manual entry only in v1 |
| C-03 | Meal Planner Phase 2 (pantry deduction, missing ingredient alerts) not yet built |
| C-04 | Shopping → Pantry auto-add loop not yet implemented (deferred) |
| C-05 | Receipt parsing categories limited to the 7 app categories |

---

## 11. Backlog (agreed, not yet implemented)

| Feature | Description | Priority |
|---------|-------------|---------|
| **Meal Planner Phase 2** | AI ingredient pre-fill when adding meal; pantry reservation badges (items reserved for a planned meal shown in pantry); missing ingredient alerts when planning a meal not covered by pantry; Mark as Cooked + pantry deduction | **Next — Session 8** |
| **Shopping → Pantry loop** | When "Done shopping" tapped, prompt to move ticked items into pantry. Deferred because receipt import is the richer path (adds expiry dates + quantities). | High |
| **Error reporting button** | When receipt upload fails for unusual reasons (old receipts, wrong file type), a "Report issue" button for future investigation | Medium |
| Recurring shopping items | One-tap to add weekly staples (milk, eggs, bread) | Medium |
| Low quantity alerts | Flag pantry items below a threshold | Medium |
| Push notifications | Morning expiry alerts | Low |
| Estonian language | Before wider family sharing | Low |
| Barcode scanning | Reduce manual entry friction | Low |

---

## 12. Change History

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 27-May-2026 | Initial build — Pantry + receipt import |
| 1.1 | 07-Jun-2026 | Shopping list, edit pantry items, new categories |
| 1.2 | 07-Jun-2026 | User accounts & household model |
| 1.3 | 07-Jun-2026 | Auth implemented — full login/signup/forgot password flow |
| 1.4 | 07-Jun-2026 | Full auth + setup flow working end to end; RLS fix |
| 1.5 | 09-Jun-2026 | Session 7: pantry search bar; persistent expiry alert dismissal (`shopping_alert_dismissed` DB flag); "Was on list" indicator; receipt quantity merging + AI expiry estimation; shopping delete race condition fix (module-level `deletedIds` Set); Expenses tab built; Meal Planner Phase 1 (week view, add/edit/delete meals); Cook Tonight AI modal (servings + time presets); new files: AddMealModal, CookTonightModal, cook-tonight API route; DB: meals table added, `shopping_alert_dismissed` column added to pantry_items |
