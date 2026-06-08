# Family Hub — Product Specification

**Version:** 1.4
**Date:** 07-Jun-2026
**Status:** Active development — Auth + setup flow fully working; Pantry + Shopping built; household_id inserts not yet wired; Menu + Expenses placeholder

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
| Teenager / Older Child | Regular contributor | Add to shopping list, create personal shopping list |
| Younger Child | Occasional reader | Check the shopping list or meal plan |

> **Auth status:** Multi-user with email + password accounts is live — see Section 3a and 3b for full details.

---

## 3a. User Accounts & Household Model ✅ Built

### Authentication
- **Method:** Email + password (via Supabase Auth)
- **Session:** Persistent — stored in `localStorage` under key `family-hub-auth`; user stays logged in until explicit sign-out
- **Onboarding:** First user to sign up creates the household; subsequent family members join via an invite link (built next)
- **Email confirmation:** If Supabase project has email confirmation enabled, the signup page detects the pending state (`session === null`) and shows a "Check your email" screen with the user's email address and a link to sign in — no misleading error messages
- **Route guard:** `AuthShell` component wraps all pages; unauthenticated users are redirected to `/login`; authenticated users accessing `/login` or `/signup` are redirected to `/`

### Signup Rules
- Required fields: email, password (min 6 chars), confirm password
- Password and confirm password must match — validated client-side with inline red border + hint text before submit
- Signup always triggers email confirmation. After submit: "Check your email" screen shown with the user's email address
- After confirming email: `/auth/callback` exchanges the PKCE code for a session → user is redirected to `/setup`
- On `/setup`: user enters their **display name** and **household name** → household row + profile row created → redirect to pantry
- Household name is optional on setup — defaults to `"[Display Name]'s Family"` if left blank

### Setup Page (`/setup`)
- Shown to any authenticated user who has no profile row yet
- Two fields: "Your name" (required, min 2 chars) and "Household name" (optional — auto-defaults shown as placeholder)
- On submit: INSERT into `households`, then INSERT into `profiles` with `role = 'parent'`
- If the household already exists (retry scenario): existing household is reused; profile INSERT gracefully handles a 23505 unique constraint (profile already exists from previous attempt)
- On success: `applyProfile()` injects the profile into React context directly — no SELECT round-trip — then `useEffect` redirects to `/`
- "Wrong account? Sign out" link at the bottom for users who landed here with the wrong session

### Forgotten Password
- "Forgot password?" link below the password field on the login page
- Tapping opens a reset screen (same page, state-driven — no navigation)
- User enters their email; `supabase.auth.resetPasswordForEmail()` sends a reset link
- After sending: "Check your email" confirmation screen shown with the email address
- "← Back to sign in" button returns to the login form at any point

### Household Model
- One household contains all shared data: pantry, shared shopping list, shared expenses
- Every user belongs to exactly one household
- All household members have equal permissions: add, update, delete any item
- All mutations record `added_by` / `deleted_by` (user display name) — wiring in progress

### Roles
- `role: 'parent' | 'child'` stored on the profile row
- First user to create a household is always assigned `role = 'parent'`
- Roles assigned at invite time (future: `/join?code=xxx&role=child`)
- Parent-only category filtering: `PARENT_ONLY_CATEGORIES` constant in app code; children do not see restricted pantry categories (alcohol, tobacco etc.) — not yet enforced as categories don't exist yet

### Personalisation
| Where | What is shown |
|-------|---------------|
| Header (all tabs) | "Good morning, [Name] 👋" |
| Shopping list items | "Added by Julia" under each item |
| Deleted shopping items | Greyed-out / struck-through row: "Deleted by Mia" + Re-add button |
| Expenses | "Logged by Julia" on each entry |

### Shopping Lists — Shared vs Personal

| List Type | Visible to | Goes into shared expenses? | Notes |
|-----------|-----------|---------------------------|-------|
| **Shared shopping list** | All household members | Yes | The current list — one household list everyone sees and edits |
| **Personal shopping list** | Only the creator | No — goes to personal expenses | Any family member can create one; it is private to them |

**Personal expenses:** Each user sees a collapsed card on the Expenses tab showing the total of their personal shopping lists. The card is only visible to that user — other family members cannot see it.

### Deleted Items in the Shared Shopping List
When a household member deletes a shopping list item:
- The item is **not permanently removed** — it is soft-deleted (marked `deleted: true`, `deleted_by: user_name`)
- It appears at the bottom of the list, greyed out / struck through, with a label: *"Deleted by Mia"*
- Any household member can tap **Re-add** to restore it (clears the deleted flag)
- A "Clear deleted" action removes soft-deleted items permanently for all users

### Data Model (as built)
| Table | Status | Notes |
|-------|--------|-------|
| `auth.users` | ✅ Supabase managed | email, encrypted_password, id (uuid) |
| `households` | ✅ Created | id, name, owner_id (FK→auth.users), invite_code, created_at |
| `profiles` | ✅ Created | id, user_id (FK→auth.users), display_name, household_id (FK→households), role, created_at |
| `pantry_items` | ✅ Columns added | household_id, added_by added; RLS policies applied |
| `shopping_items` | ✅ Columns added | household_id, added_by, deleted, deleted_by, is_personal, owner_user_id added; RLS applied |

### RLS (Row Level Security)
All four tables have RLS enabled. Policies ensure:
- Users can only read/write data that belongs to their household
- Profile inserts are restricted to `user_id = auth.uid()`
- Household inserts are restricted to `owner_id = auth.uid()`

**RLS note — profiles table:** An earlier infinite recursion bug (42P17) was fixed by dropping all policies on `profiles` via a PL/pgSQL `DO` block (ensuring no stale policies remained by name), then recreating them using a `get_my_household_id()` `SECURITY DEFINER` function that bypasses RLS on `profiles` to break the self-referential lookup cycle.

### Known Wiring Gap
`household_id` and `added_by` are **not yet passed** on pantry/shopping INSERTs — the columns exist in the DB but the React components still do unscoped inserts. This is Priority 1 for the next session.

---

## 3b. Profile & Account Settings ✅ Built

### Profile Avatar
- Every authenticated page shows a small emerald circle with the user's initials in the **top-right corner** (rendered by `AuthShell`, not individual pages)
- Initials derived from `profile.display_name` — first letter of each word, max 2 characters
- Tapping the avatar opens the Profile Sheet

### Profile Sheet (bottom sheet)
Slides up from the bottom of the screen. Contains:

| Element | Source |
|---------|--------|
| Initials avatar (large, emerald) | `profile.display_name` |
| Full display name | `profile.display_name` |
| Email address | `user.email` (from Supabase Auth) |
| Household name (🏠) | Fetched lazily from `households` table when sheet opens |
| Role badge (👩‍👧 Parent / 🧒 Child) | `profile.role` |
| Sign out button | `supabase.auth.signOut()` |

- Sheet is dismissed by tapping the backdrop or completing sign-out
- Household name is fetched only once per open (not on every tap)

---

## 4. Current Feature Scope (v1 — as built)

### 4.1 Pantry Tracker ✅ Built

The core feature of the app. Tracks everything in the household.

| Capability | Detail |
|-----------|--------|
| Add item | Name, category, quantity, unit, expiry date (optional) |
| Edit item | Tap ✏️ to open pre-filled modal; update any field; saves to Supabase |
| Delete item | Tap ✕ on any item group |
| Group by name | Items with the same name are merged; quantities are summed |
| Categories | Food & Groceries, Drinks & Extras, Household, Personal & Cosmetics, Medicine & First Aid, Pets & Animals, Everything Else |
| Expiry alerts | Red alert for expired items; amber warning for items expiring within 3 days |
| Expired → Shopping | One tap on red alert adds all expired items to the shopping list with their quantities |
| Import from receipt | AI-powered (Claude Opus 4.7) — photo or pasted text → extracted items → review → add to pantry |
| "Cook tonight" | Placeholder button; shows "coming soon" modal; will link to meal suggestions in a future phase |

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

---

### 4.2 Shopping List ✅ Built

A simple flat list of things to buy.

| Capability | Detail |
|-----------|--------|
| Add item | Name + optional quantity; no store grouping |
| Tick off | Tap circle to mark as done (strikethrough) |
| Delete item | Tap ✕ on any item |
| Clear done | One tap to remove all ticked items |
| Item count | Header shows "X left · Y done" |
| Auto-populate | Expired pantry items can be pushed here from the Pantry page |

---

### 4.3 Menu / Meal Planner 🚧 Placeholder

Page exists at `/menu` but shows placeholder content. Planned for a future session.

---

### 4.4 Expenses 🚧 Placeholder

Page exists at `/expenses` but shows placeholder content. Planned for a future session.

---

## 5. Technical Architecture

### 5.1 Technology Stack

| Layer | Technology | Detail |
|-------|-----------|--------|
| Framework | Next.js (App Router) | Server + client components, API routes |
| Language | TypeScript | Strict typing throughout |
| Styling | Tailwind CSS | Mobile-first utility classes |
| Database | Supabase (PostgreSQL) | Project ID: `kqolxqefwimfujwmejfn` |
| AI / ML | Anthropic Claude API | Model: `claude-opus-4-7` for receipt parsing |
| Hosting | Local dev (`localhost:3000`) | Vercel deployment planned |
| PWA | Web App Manifest | Installable on iOS/Android home screen |

### 5.2 Project Structure

```
family-hub/
├── src/
│   ├── app/
│   │   ├── page.tsx                  # Pantry / Home page (/)
│   │   ├── layout.tsx                # Root layout — wraps AuthProvider + AuthShell
│   │   ├── login/page.tsx            # Sign-in page — email + password + forgot password
│   │   ├── signup/page.tsx           # Sign-up page — email + password + confirm; shows "Check your email" screen
│   │   ├── setup/page.tsx            # Post-confirmation setup — display name + household name; creates household + profile
│   │   ├── auth/callback/page.tsx    # PKCE callback — exchanges ?code= for session; fires onAuthStateChange
│   │   ├── shopping/page.tsx         # Shopping list (/shopping)
│   │   ├── menu/page.tsx             # Meal planner — placeholder (/menu)
│   │   ├── expenses/page.tsx         # Expenses — placeholder (/expenses)
│   │   └── api/
│   │       └── parse-receipt/route.ts  # Claude AI receipt parsing endpoint
│   ├── components/
│   │   ├── AuthShell.tsx             # Route guard + layout shell + avatar button
│   │   ├── ProfileSheet.tsx          # Bottom sheet: user info + role + sign out
│   │   ├── AddPantryItemModal.tsx    # Add + Edit pantry item (shared modal)
│   │   ├── AddShoppingItemModal.tsx  # Add shopping item
│   │   ├── ImportReceiptModal.tsx    # Receipt import (photo or text)
│   │   └── BottomNav.tsx             # Bottom navigation bar (4 tabs)
│   ├── contexts/
│   │   └── AuthContext.tsx           # Auth state: user, profile, loading, signOut
│   └── lib/
│       └── supabase.ts               # Supabase client (navigator.locks bypass via no-op lock)
├── docs/                             # BA documentation (this folder)
├── NEXT-SESSION.md                   # Resumption context for next dev session
├── public/
│   └── manifest.json                 # PWA manifest
└── .env.local                        # ANTHROPIC_API_KEY, Supabase keys
```

### 5.3 Database Schema (current)

**Table: `households`**

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `id` | uuid | Yes | Primary key, auto-generated |
| `name` | text | Yes | e.g. "Julia's Family" |
| `owner_id` | uuid | Yes | FK → `auth.users.id` — user who created it |
| `invite_code` | text | No | Short code for `/join` link (generated on demand) |
| `created_at` | timestamp | Yes | Auto-set by Supabase |

RLS policies: SELECT for household members; INSERT restricted to `owner_id = auth.uid()`.

---

**Table: `profiles`**

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `id` | uuid | Yes | Primary key, auto-generated |
| `user_id` | uuid | Yes | FK → `auth.users.id` — one profile per user |
| `display_name` | text | Yes | Name shown in the UI |
| `household_id` | uuid | Yes | FK → `households.id` |
| `role` | text | Yes | `'parent'` or `'child'` |
| `created_at` | timestamp | Yes | Auto-set by Supabase |

RLS policies: SELECT for household members; INSERT restricted to `user_id = auth.uid()`.

---

**Table: `pantry_items`**

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `id` | uuid | Yes | Primary key, auto-generated |
| `name` | text | Yes | Item name |
| `category` | text | Yes | One of 7 category values |
| `quantity` | text | No | String to allow "500", "2 packs", etc. |
| `unit` | text | No | "g", "L", "pcs", etc. |
| `expiry_date` | date | No | ISO date string |
| `household_id` | uuid | No | FK → `households.id` — **not yet wired in inserts** |
| `added_by` | text | No | Display name of the user who added the item — **not yet wired** |
| `created_at` | timestamp | Yes | Auto-set by Supabase |

---

**Table: `shopping_items`**

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `id` | uuid | Yes | Primary key, auto-generated |
| `name` | text | Yes | Item name |
| `quantity` | text | No | Optional quantity |
| `checked` | boolean | Yes | Default: false |
| `store` | text | No | Column exists; not used in current UI |
| `household_id` | uuid | No | FK → `households.id` — **not yet wired in inserts** |
| `added_by` | text | No | Display name of the user who added the item — **not yet wired** |
| `deleted` | boolean | No | Soft-delete flag — column exists; hard-delete used in current UI |
| `deleted_by` | text | No | Display name of the user who deleted the item — future use |
| `is_personal` | boolean | No | If true, item belongs to a personal shopping list |
| `owner_user_id` | uuid | No | FK → `auth.users.id` — set when `is_personal = true` |
| `created_at` | timestamp | Yes | Auto-set by Supabase |

---

## 6. Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-001 | Compatibility | Must work on Safari iOS 15+, Chrome Android 90+ |
| NFR-002 | Layout | Optimised for screens 375px–430px wide (iPhone range) |
| NFR-003 | Performance | Pages must load in under 3 seconds on a 4G connection |
| NFR-004 | Usability | All primary actions reachable within 2 taps from any screen |
| NFR-005 | Navigation | Fixed bottom nav always visible; no app bar obscuring content |
| NFR-006 | AI cost | Receipt parsing uses Claude API — estimated ~€0.01 per scan |
| NFR-007 | PWA | App is installable on iOS/Android home screen via web manifest |

---

## 7. User Stories — Built Features

### Pantry

**US-P01 — Add a pantry item manually**
> As a family member,
> I want to add an item to the pantry with its name, category, quantity, and expiry date,
> So that I have an accurate record of what the household has.

*Acceptance Criteria:*
- Given I tap "+ Add Item" on the Pantry page
- When I fill in the name (required) and other optional fields and tap "Add to Pantry"
- Then the item appears in the correct category section immediately
- And if two items have the same name, their quantities are summed and displayed together

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

---

**US-P04 — Add expired items to shopping list**
> As a family member,
> I want to send expired items to the shopping list in one tap,
> So that I know what needs to be replaced without manually re-entering everything.

*Acceptance Criteria:*
- Given there are expired items showing in the red alert
- When I tap "+ Shopping" on the alert
- Then all expired items are added to the shopping list with their quantities carried over
- And the button changes to "✓ Added" for 3 seconds as confirmation

---

**US-P05 — Import items from a receipt**
> As a primary user,
> I want to photograph or paste a grocery receipt and have items extracted automatically,
> So that I can stock the pantry quickly after shopping without typing every item.

*Acceptance Criteria:*
- Given I tap "🧾 From Receipt" on the Pantry page
- When I upload a photo or paste receipt text
- Then the AI extracts all product names, categories, and quantities
- And I see a review screen where I can deselect or rename items
- And tapping "Add to Pantry" saves all selected items

---

### Shopping List

**US-S01 — Add a shopping item**
> As a family member,
> I want to add an item to the shopping list with an optional quantity,
> So that I know what to buy and how much.

*Acceptance Criteria:*
- Given I tap "+ Add to Shopping List"
- When I enter a name and optional quantity and tap "Add Item"
- Then the item appears at the bottom of the list immediately

---

**US-S02 — Tick off items while shopping**
> As a family member,
> I want to mark items as done while I'm shopping,
> So that I can keep track of what's already in the trolley.

*Acceptance Criteria:*
- Given I am looking at the shopping list
- When I tap the circle next to an item
- Then the item is struck through and the circle turns green
- And the header count updates (e.g., "2 left · 1 done")

---

**US-S03 — Clear completed items**
> As a family member,
> I want to remove all ticked items in one tap,
> So that I can clean up the list after shopping.

*Acceptance Criteria:*
- Given there are ticked items on the shopping list
- When I tap "Clear done (N)"
- Then all ticked items are removed from the list and from the database

---

### Auth & Account

**US-A01 — Sign up and create a household**
> As a new user,
> I want to create an account with my name, email, and a confirmed password,
> So that my family's household data is private to us.

*Acceptance Criteria:*
- Given I open the app for the first time
- When I fill in name, email, password, and a matching confirm password and tap "Create account"
- Then a household is created in my name, my profile is saved with role = parent, and I land on the pantry page
- And if the passwords do not match, the confirm field shows a red border and inline hint; submit is blocked
- And if Supabase requires email confirmation, I see a "Check your email" screen with my email address and a link to sign in
- And if the email is already registered, an error is shown and the form stays populated

---

**US-A02 — Sign in to an existing account**
> As a returning user,
> I want to sign in with my email and password,
> So that I can access my household's data on any device.

*Acceptance Criteria:*
- Given I open the app with no active session
- When I enter my email and password and tap "Sign in"
- Then I am redirected to the pantry page and my display name appears in the greeting
- And if credentials are wrong, an error message is shown and the form stays populated
- And if I reload the page, I remain signed in (session persists in localStorage)

---

**US-A03 — Reset a forgotten password**
> As a user who has forgotten their password,
> I want to receive a reset link by email,
> So that I can regain access without needing anyone else to help me.

*Acceptance Criteria:*
- Given I tap "Forgot password?" on the login page
- When I enter my email and tap "Send reset link"
- Then I see a confirmation screen showing my email address and instructions to check my inbox
- And I can tap "← Back to sign in" at any point to return to the login form

---

**US-A04 — View account details and sign out**
> As a signed-in user,
> I want to see my name, email, household, and role at a glance and be able to sign out,
> So that I can verify my account and leave the app cleanly on a shared device.

*Acceptance Criteria:*
- Given I am on any authenticated page
- When I tap the initials avatar in the top-right corner
- Then a bottom sheet slides up showing my display name, email, household name, and role badge
- And I can tap "Sign out" to end the session and be redirected to the login page
- And I can tap the backdrop to dismiss the sheet without signing out

---

## 8. Assumptions

| # | Assumption |
|---|-----------|
| A-01 | Users have a smartphone with a modern browser (Safari iOS 15+ or Chrome Android 90+) |
| A-02 | Single household — no multi-user authentication in current version |
| A-03 | English language only for current version |
| A-04 | Internet connection is available — no offline mode implemented yet |
| A-05 | Quantities are stored as free-text strings to handle diverse formats ("500g", "2 bottles", "1 pack") |
| A-06 | The `store` column in `shopping_items` exists in the database but is intentionally unused in the UI |
| A-07 | Receipt parsing via Claude API will produce valid JSON; a fallback error message is shown if not |

---

## 9. Known Constraints

| # | Constraint |
|---|-----------|
| C-01 | ~~No user authentication~~ — **resolved**: email + password auth with Supabase is live |
| C-02 | No offline mode — app requires internet to read and write data |
| C-03 | Recipe / meal planning is not yet functional |
| C-04 | Expense tracking is not yet functional |
| C-05 | Receipt parsing categories are limited to: food, household, drinks, personal (does not include medicine/pets) |
| C-06 | No barcode scanning — manual entry only in v1 |

---

## 10. Backlog (agreed, not yet implemented)

| Feature | Description | Priority |
|---------|-------------|---------|
| **Auth — Phase 1: Sign up / log in** | ✅ Done — Full end-to-end flow working: signup → email confirmation → PKCE callback → /setup (display name + household) → pantry. Forgot password flow. Profile sheet with avatar, household name, role, sign out. RLS fixed (no more infinite recursion). | Done |
| **Wire household_id to inserts** | Pass `household_id` and `added_by` on every pantry and shopping INSERT so RLS policies allow writes and data is scoped correctly. Without this, writes will fail once RLS is enforced. | **Critical next** |
| **Auth — Phase 2: Household invite** | ✅ Done — Parent taps "🔗 Copy invite link" in Profile Sheet; generates/fetches invite_code, copies `/join?code=xxx` to clipboard. Family member opens link, fills in name + email + password, confirms email, auto-joined to household on `/setup` via Supabase user metadata. | Done |
| **Auth — Phase 3: Personalisation** | Record `added_by` / `deleted_by` on all mutations. Show names on shopping items and expenses. | High |
| **Shopping — deleted items history** | Soft-delete instead of hard delete. Deleted items appear greyed out at the bottom with "Deleted by [Name]" label and a Re-add button. Permanent clear available separately. | High |
| **Shopping — personal list** | Any user can create a private shopping list visible only to them. Not shared with household. Total feeds into personal expenses section. | Medium |
| **Expenses — personal section** | Collapsed card on Expenses tab showing the total of the user's personal shopping lists. Visible only to that user. | Medium |
| Recipe API | TheMealDB integration — "surprise me" and search by ingredient | High |
| Menu / Meal Planner | Weekly meal planning, linked to pantry | High |
| Expense Tracker | Receipt photo → AI reads total + store; monthly chart | High |
| Vercel deployment | Deploy to public URL; share with family | High |
| Recurring shopping items | One-tap to add weekly staples (milk, eggs, bread) | Medium |
| Low quantity alerts | Flag items below a threshold (especially for Pets category) | Medium |
| **Shopping → Pantry loop (open discussion)** | When "Done shopping" is tapped, should bought items be automatically added back to the pantry? Risk: duplicates if user also imports a receipt (receipt import is the richer path — with category, expiry, quantity). Options to explore: (A) no auto-add — receipt import is the loop; (B) "Add to pantry?" prompt after Done shopping; (C) smart dedup by name. Decision deferred. | Discussion |
| Expenses — store selector | When logging an expense, user picks from a saved list of favourite stores instead of typing each time. Open question: household-wide store list or per-user? | Medium |
| Expenses — receipts archive | Dedicated section inside Expenses tab where all imported receipts are stored and can be reviewed | Medium |
| Estonian language | Before wider family sharing | Low |
| Barcode scanning | Phase 2 — reduce manual entry friction | Low |
| Push notifications | Morning expiry alerts | Low |

---

## 11. Change History

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 27-May-2026 | Initial build — Pantry + receipt import |
| 1.1 | 07-Jun-2026 | Shopping list, edit pantry items, new categories (medicine/pets), cook tonight button |
| 1.2 | 07-Jun-2026 | User accounts & household model designed — Section 3a added; backlog updated with auth phases, personal shopping list, deleted items history |
| 1.3 | 07-Jun-2026 | Auth implemented — email + password login/signup live; password confirm field; email confirmation screen; forgot password + reset link; profile avatar + bottom sheet (name, email, household, role, sign out); navigator.locks hang fixed; Section 3a rewritten as built; Section 3b added; auth user stories US-A01–US-A04 added; DB schema expanded with households + profiles tables |
| 1.4 | 07-Jun-2026 | Full auth + setup flow working end to end — PKCE callback page (`/auth/callback`), setup page (`/setup`) for display name + household creation post-email-confirmation; RLS infinite recursion (42P17) on profiles table fixed using DO block + `get_my_household_id()` SECURITY DEFINER function; signup simplified to email/password only (name collected on /setup); project structure updated with new pages |
