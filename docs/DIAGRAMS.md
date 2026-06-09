# Family Hub — Diagrams

**Version:** 1.5
**Date:** 09-Jun-2026
**Render:** All diagrams use Mermaid syntax — renders in VS Code (Markdown Preview), GitHub, and Notion.

---

## 1. Feature Map — What Is Built

```mermaid
mindmap
  root((Family Hub))
    Auth & Accounts ✅
      Sign up — email + password
      Sign in + forgot password
      Email confirmation flow
      Household creation on signup
      Profile avatar + sheet
      Invite link for family members
      Role editing by parent
    Pantry Tracker ✅
      Add item manually
      Edit item
      Delete item
      Search bar — always visible
      7 categories
      Group by name / sum quantity
      Expiry date alerts
        Red — expired
        Amber — expiring in 3 days
        Persistent dismissal via DB flag
        Was on list indicator
      Expired → Shopping in one tap
      Import from receipt photo or PDF
        AI extraction via Claude
        Expiry date estimation EU averages
        Quantity merging on duplicate
        Review and deselect
    Shopping List ✅
      Flat list
      Add item with quantity
      Tick off while shopping
      Delete with 5s undo
      Clear all done items
      Auto-populated from expired items
      Added by label per item
    Meal Planner Phase 1 ✅
      Week view Mon–Sun
      This week and next week navigation
      Today highlighted with badge
      3 slots Breakfast Lunch Dinner
      Add meal per day
      Edit meal
      Delete meal
      Servings per meal
    Cook Tonight AI ✅
      Servings picker 1–12
      Time presets Quick Normal No rush
      3 AI recipe suggestions
      Key ingredients from pantry
      Missing ingredients flagged
      Time estimate per suggestion
    Expenses ✅
      Month navigation
      Total spend card
      Category breakdown with progress bars
      Expandable expense rows
      Add expense manually
      Receipt import auto-logs per category
    Meal Planner Phase 2 🚧 Next
      AI ingredient pre-fill
      Pantry reservation badges
      Missing ingredient alerts
      Mark as cooked
      Pantry deduction on cook
```

---

## 2. System Context Diagram

```mermaid
graph TD
    PA["👤 Parent / Admin"]
    FM["👤 Family Member"]

    subgraph FH ["Family Hub (Next.js — Vercel)"]
        UI[Client UI<br/>React · Tailwind]
        API_R[API Routes<br/>parse-receipt<br/>cook-tonight]
    end

    subgraph SUPABASE ["Supabase"]
        AUTH[Auth<br/>email + password · JWT]
        DB[(PostgreSQL<br/>households · profiles<br/>pantry_items · shopping_items<br/>expenses · meals)]
    end

    EMAIL["📧 Email<br/>confirmation + reset links"]
    CLAUDE["🤖 Anthropic Claude API<br/>claude-opus-4-7<br/>receipts + cook tonight"]

    PA -->|browser| UI
    FM -->|browser| UI
    UI -->|auth| AUTH
    UI -->|data CRUD| DB
    AUTH --> EMAIL
    EMAIL --> PA
    EMAIL --> FM
    API_R -->|messages.create| CLAUDE
    UI -->|POST /api/parse-receipt| API_R
    UI -->|POST /api/cook-tonight| API_R
    AUTH -->|RLS auth.uid| DB
```

---

## 3. App Navigation Structure

```mermaid
flowchart TD
    ROOT[Browser opens app]
    ROOT --> AUTH_CHECK{Logged in?}

    AUTH_CHECK -->|No| LOGIN[/login]
    LOGIN --> SIGNUP[/signup]
    SIGNUP --> CALLBACK[/auth/callback — PKCE]
    CALLBACK --> SETUP[/setup — name + household]
    SETUP --> AUTH_CHECK

    AUTH_CHECK -->|Yes, no profile| SETUP
    AUTH_CHECK -->|Yes, has profile| TABS

    TABS --> T1[🏠 Pantry /]
    TABS --> T2[🛒 Shopping /shopping]
    TABS --> T3[🍽️ Menu /menu]
    TABS --> T4[💰 Expenses /expenses]

    T1 -->|+ Add Item| M1[AddPantryItemModal]
    T1 -->|✏️ edit| M1
    T1 -->|🧾 From Receipt| M2[ImportReceiptModal]
    T1 -->|🍽️ Cook Tonight| M3[CookTonightModal]
    T2 -->|+ Add| M4[AddShoppingItemModal]
    T3 -->|+ Add on any day| M5[AddMealModal]
    T3 -->|✏️ edit meal| M5
    T4 -->|+ Add Expense| M6[AddExpenseModal]
```

---

## 4. User Flow — Expiry Alert Lifecycle

This is one of the more complex flows — it covers how the expiry alert appears, gets dismissed, and how the pantry displays the item afterwards.

```mermaid
flowchart TD
    A([Pantry item has expiry_date set]) --> B{Is item expired or expiring soon?}

    B -->|No| C[No alert shown — item displays normally]
    B -->|Yes, but shopping_alert_dismissed = true| D[Item shows in pantry<br/>with '· ✓ Was on list' label<br/>No alert banner]
    B -->|Yes and shopping_alert_dismissed = false| E[Alert banner shown at top<br/>🚨 Expired or ⏰ Expiring soon]

    E --> F[User taps '+ Shopping' on alert]
    F --> G[All items in the alert group<br/>inserted into shopping_items]
    G --> H[shopping_alert_dismissed = true<br/>set in DB for each item]
    H --> I[Alert disappears immediately]
    I --> J[Pantry card now shows '· ✓ Was on list']

    J --> K{User deletes item from shopping list?}
    K -->|Yes| L[shopping_items row deleted<br/>shopping_alert_dismissed stays true in pantry]
    K -->|No — item stays on list| M[Shopping list shows item normally]

    L --> N([Pantry still shows '· ✓ Was on list'<br/>Alert never comes back])
    M --> N
```

---

## 5. User Flow — Receipt Import (with Expiry Estimation & Quantity Merging)

```mermaid
flowchart TD
    A([User taps 🧾 From Receipt]) --> B[ImportReceiptModal opens]
    B --> C{Choose input}
    C -->|Photo/PDF| D[Upload file]
    C -->|Text| E[Paste text]

    D --> F[POST /api/parse-receipt]
    E --> F

    F --> G[Claude AI extracts items]
    G --> H[Each item gets<br/>name · category · quantity · unit<br/>+ estimated_expiry_days]
    H --> I[estimated_expiry_days → today + N = expiry_date<br/>null for non-perishables]

    I --> J[Review screen shown]
    J --> K[User deselects unwanted items]
    K --> L[Tap 'Add to Pantry']

    L --> M[For each selected item]
    M --> N{Does pantry row exist<br/>with same name + category + expiry_date?}

    N -->|Yes — same expiry| O[Sum quantities<br/>UPDATE pantry_items]
    N -->|No match| P[INSERT new pantry_items row]

    O --> Q[Receipt expense step]
    P --> Q
    Q --> R[AI-extracted prices logged as expenses<br/>per category]
    R --> S([Modal closes — pantry updated])
```

---

## 6. User Flow — Cook Tonight AI

```mermaid
flowchart TD
    A([User taps 🍽️ Cook Tonight on Pantry]) --> B[CookTonightModal opens — Step 1]

    B --> C[Servings stepper: set 1–12 people<br/>default: 4]
    C --> D[Time preset: select ⚡ Quick · 🕐 Normal · 🍲 No rush<br/>default: Normal — ≤45 min]

    D --> E{Pantry empty?}
    E -->|Yes| F[Empty state shown<br/>no button]
    E -->|No| G[Tap '✨ Get suggestions']

    G --> H[POST /api/cook-tonight<br/>body: items · servings · maxMinutes]
    H --> I[Claude API — claude-opus-4-7]
    I --> J[Loading state: 🤔 Thinking…]

    J --> K{Response valid?}
    K -->|Error| L[Error message shown<br/>user can retry]
    K -->|Success| M[3 suggestion cards shown]

    M --> N[Each card shows:<br/>emoji · name · description<br/>✓ key ingredients from pantry<br/>− missing ingredients<br/>⏱ time in minutes]
```

---

## 7. User Flow — Meal Planner

```mermaid
flowchart TD
    A([User opens Menu tab]) --> B[fetchMeals loads for current week]
    B --> C[Week view: Mon–Sun cards rendered]

    C --> D{User action?}

    D -->|Tap › | E[weekOffset = 1 — next week loads]
    D -->|Tap ‹ | F[weekOffset = 0 — this week loads]

    D -->|Tap + Add on a day| G[AddMealModal opens<br/>date pre-filled]
    G --> H[Select slot: Breakfast / Lunch / Dinner]
    H --> I[Enter meal name]
    I --> J[Set servings 1–12]
    J --> K[Tap Add Meal]
    K --> L[INSERT into meals table]
    L --> M[fetchMeals re-runs]
    M --> C

    D -->|Tap ✏️ on meal| N[AddMealModal opens pre-filled]
    N --> O[Edit any field]
    O --> P[Tap Save Changes]
    P --> Q[UPDATE meals row]
    Q --> M

    D -->|Tap ✕ on meal| R[Optimistic: remove from local state]
    R --> S[DELETE from meals table]
    S --> C
```

---

## 8. User Flow — Sign Up (Create Household)

```mermaid
flowchart TD
    A([User opens app]) --> B[AuthShell: no session]
    B --> C[/login]
    C --> D[Tap 'Create an account']
    D --> E[/signup — enter email + password]
    E --> F[supabase.auth.signUp]
    F --> G['Check your email' screen]
    G --> H([User confirms email])
    H --> I[/auth/callback — PKCE exchange]
    I --> J[Session created]
    J --> K[AuthShell: no profile → /setup]
    K --> L[Enter display name + household name]
    L --> M[INSERT households + profiles]
    M --> N([Pantry page — role = parent])
```

---

## 9. User Flow — Shopping List Delete with Undo

```mermaid
flowchart TD
    A([User taps ✕ on shopping item]) --> B[Item removed from local state immediately]
    B --> C[deletedIds.add item.id — module-level Set]
    C --> D[Undo snackbar shown — 5 seconds]
    C --> E[DB DELETE fires async]

    D --> F{User taps Undo within 5s?}
    F -->|Yes| G[deletedIds.delete item.id]
    G --> H[INSERT fresh row into shopping_items]
    H --> I([Item reappears in list])

    F -->|No — timer expires| J[DB DELETE completes]
    J --> K[deletedIds.delete item.id]
    K --> L([Item gone permanently])

    E --> M{If user navigates away and back}
    M --> N[fetchItems filters out any id in deletedIds]
    N --> O([Deleted item never reappears])
```

---

## 10. Entity Relationship Diagram (current schema)

```mermaid
erDiagram
    AUTH_USERS {
        uuid id PK
        text email
        timestamp created_at
    }

    HOUSEHOLDS {
        uuid id PK
        text name
        uuid owner_id FK
        text invite_code
        timestamp created_at
    }

    PROFILES {
        uuid id PK
        uuid user_id FK
        text display_name
        uuid household_id FK
        text role
        timestamp created_at
    }

    PANTRY_ITEMS {
        uuid id PK
        text name
        text category
        text quantity
        text unit
        date expiry_date
        boolean shopping_alert_dismissed
        uuid household_id FK
        text added_by
        timestamp created_at
    }

    SHOPPING_ITEMS {
        uuid id PK
        text name
        text quantity
        boolean checked
        uuid household_id FK
        text added_by
        timestamp created_at
    }

    EXPENSES {
        uuid id PK
        numeric amount
        text category
        text store
        text note
        date date
        uuid household_id FK
        text added_by
        timestamp created_at
    }

    MEALS {
        uuid id PK
        date date
        text slot
        text name
        integer servings
        text added_by
        timestamp cooked_at
        uuid household_id FK
        timestamp created_at
    }

    AUTH_USERS ||--o| PROFILES : "has profile"
    AUTH_USERS ||--o{ HOUSEHOLDS : "owns"
    HOUSEHOLDS ||--o{ PROFILES : "has members"
    HOUSEHOLDS ||--o{ PANTRY_ITEMS : "owns"
    HOUSEHOLDS ||--o{ SHOPPING_ITEMS : "owns"
    HOUSEHOLDS ||--o{ EXPENSES : "tracks"
    HOUSEHOLDS ||--o{ MEALS : "plans"
```

---

## 11. Component Architecture (current)

```mermaid
graph TD
    LAYOUT[layout.tsx — Root Layout]
    LAYOUT --> AUTH_PROVIDER[AuthContext.tsx<br/>user · profile · role · signOut]
    AUTH_PROVIDER --> AUTH_SHELL[AuthShell.tsx<br/>route guard · layout · avatar]

    AUTH_SHELL --> NAV[BottomNav.tsx]
    AUTH_SHELL --> AVATAR[Avatar button]
    AVATAR --> PROFILE_SHEET[ProfileSheet.tsx<br/>name · email · household · role editing · sign out]

    AUTH_SHELL --> PAGES[Pages]
    PAGES --> PAGE_PANTRY[page.tsx — Pantry]
    PAGES --> PAGE_SHOP[shopping/page.tsx]
    PAGES --> PAGE_MENU[menu/page.tsx]
    PAGES --> PAGE_EXP[expenses/page.tsx]
    PAGES --> PAGE_LOGIN[login/page.tsx]
    PAGES --> PAGE_SIGNUP[signup/page.tsx]
    PAGES --> PAGE_SETUP[setup/page.tsx]
    PAGES --> PAGE_CALLBACK[auth/callback/page.tsx]
    PAGES --> PAGE_JOIN[join/page.tsx]

    PAGE_PANTRY --> ADD_PANTRY[AddPantryItemModal.tsx]
    PAGE_PANTRY --> IMPORT[ImportReceiptModal.tsx]
    PAGE_PANTRY --> COOK[CookTonightModal.tsx]
    PAGE_SHOP --> ADD_SHOP[AddShoppingItemModal.tsx]
    PAGE_MENU --> ADD_MEAL[AddMealModal.tsx]
    PAGE_EXP --> ADD_EXP[AddExpenseModal.tsx]

    IMPORT --> API_RECEIPT[api/parse-receipt/route.ts]
    COOK --> API_COOK[api/cook-tonight/route.ts]
    API_RECEIPT --> CLAUDE[Anthropic SDK — claude-opus-4-7]
    API_COOK --> CLAUDE

    PAGE_PANTRY --> SUPABASE[lib/supabase.ts]
    PAGE_SHOP --> SUPABASE
    PAGE_MENU --> SUPABASE
    PAGE_EXP --> SUPABASE
    AUTH_PROVIDER --> SUPABASE
    SUPABASE --> DB[(Supabase PostgreSQL)]
```

---

## 12. AI Integration — Receipt Parsing

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant APP as ImportReceiptModal
    participant API as /api/parse-receipt
    participant CLAUDE as Claude API

    U->>APP: Uploads photo or PDF
    APP->>API: POST { type, data, mediaType }
    API->>CLAUDE: messages.create — system prompt with EU shelf-life table
    CLAUDE-->>API: JSON { items: [{ name, category, quantity, unit, estimated_expiry_days }] }
    API->>API: Strip markdown fences + JSON.parse
    alt Parse success
        API-->>APP: { items }
        APP-->>U: Review screen with items + estimated expiry dates
        U->>APP: Deselects unwanted items + taps Add to Pantry
        loop For each selected item
            APP->>APP: Compute expiry_date = today + estimated_expiry_days
            APP->>APP: Check if matching pantry row exists
            alt Row exists same name + category + expiry_date
                APP-->>APP: UPDATE quantity sum
            else No match
                APP-->>APP: INSERT new row
            end
        end
        APP-->>U: Pantry updated
    else Parse failure
        API-->>APP: { error }
        APP-->>U: Error message shown
    end
```

---

## 13. AI Integration — Cook Tonight

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant MODAL as CookTonightModal
    participant API as /api/cook-tonight
    participant CLAUDE as Claude API

    U->>MODAL: Sets servings (default 4) + time preset (default Normal ≤45 min)
    U->>MODAL: Taps ✨ Get suggestions
    MODAL->>API: POST { items: pantryItems, servings, maxMinutes }
    API->>CLAUDE: messages.create<br/>system: recipe suggestion prompt<br/>user: Cooking for N people · Time: up to X min · Pantry: [items]
    CLAUDE-->>API: JSON { suggestions: [{ name, emoji, description, key_ingredients, missing, time_minutes }] }
    API->>API: JSON.parse cleaned response
    alt Success
        API-->>MODAL: { suggestions }
        MODAL-->>U: 3 recipe cards with ingredients + time
    else Error
        API-->>MODAL: { error }
        MODAL-->>U: Error message shown
    end
```

---

## 14. Role-Based Visibility

```mermaid
flowchart LR
    subgraph PARENT ["👩 Parent role"]
        P1[All pantry categories]
        P2[Shared shopping list]
        P3[Expenses tab — full access]
        P4[Meal planner]
        P5[Cook Tonight]
        P6[Profile — can edit all member roles]
    end

    subgraph CHILD ["🧒 Child role"]
        C1[Pantry — non-restricted categories]
        C2[Shared shopping list]
        C3[Meal planner — view + add]
        C4[Expenses tab — hidden]
        C5[Profile — view only]
    end
```
