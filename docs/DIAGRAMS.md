# Family Hub — Diagrams

**Version:** 1.4
**Date:** 07-Jun-2026
**Render:** All diagrams use Mermaid syntax — renders in VS Code (Markdown Preview), GitHub, and Notion.

---

## 1. Feature Map — What Is Built

```mermaid
mindmap
  root((Family Hub))
    Auth & Accounts ✅
      Sign up — email + password + confirm
      Sign in
      Email confirmation screen
      Forgot password + reset link
      Household creation on signup
      Profile — display name + role
      Profile avatar top-right corner
      Profile sheet — name · email · household · role · sign out
      Invite link for family members 🚧 next
      Role-based visibility — parent / child 🚧 next
    Pantry Tracker ✅
      Add item manually
      Edit item
      Delete item
      7 categories
      Group by name / sum quantity
      Expiry date alerts
        Red — expired
        Amber — expiring in 3 days
      Expired → Shopping in one tap
      Import from receipt
        Photo upload
        Paste text
        AI extraction via Claude
        Review and deselect
      Cook tonight button
        Placeholder modal
    Shopping List ✅
      Flat list, no store grouping
      Add item with quantity
      Tick off while shopping
      Delete single item
      Clear all done items
      Auto-populated from expired pantry items
    Menu / Meal Planner 🚧
      Placeholder only
    Expenses 🚧
      Placeholder only
```

---

## 2. System Context Diagram

Shows how Family Hub sits within its broader ecosystem: who uses it and what external systems it communicates with.

```mermaid
graph TD
    PA["👤 Parent / Admin<br/>(Primary User)"]
    FM["👤 Family Member<br/>(Child / Partner)"]

    subgraph FH ["Family Hub Web App (Next.js)"]
        UI[Client UI<br/>React · Tailwind]
        API[API Routes<br/>Next.js Route Handlers]
    end

    subgraph SUPABASE ["Supabase (Backend-as-a-Service)"]
        AUTH[Supabase Auth<br/>email + password sessions<br/>JWT tokens · localStorage]
        DB[(Supabase PostgreSQL<br/>households · profiles<br/>pantry_items · shopping_items)]
    end

    EMAIL["📧 Email Provider<br/>(Supabase-managed SMTP)<br/>confirmation links · reset links"]
    CLAUDE["🤖 Anthropic Claude API<br/>claude-opus-4-7<br/>receipt parsing"]

    PA -->|uses app in browser| UI
    FM -->|uses app in browser| UI
    UI -->|auth calls| AUTH
    UI -->|data queries / mutations via Supabase JS SDK| DB
    AUTH -->|sends| EMAIL
    EMAIL -->|email confirmation / reset link| PA
    EMAIL -->|email confirmation / reset link| FM
    API -->|messages.create| CLAUDE
    UI -->|POST /api/parse-receipt| API
    AUTH -->|RLS: auth.uid() checks| DB
```

---

## 3. App Navigation Structure (with Auth)

```mermaid
flowchart TD
    ROOT[Browser opens app]
    ROOT --> LAYOUT[Root Layout<br/>layout.tsx]
    LAYOUT --> AUTH_PROVIDER[AuthProvider<br/>contexts/AuthContext.tsx<br/>holds user + profile + role]
    AUTH_PROVIDER --> AUTH_SHELL[AuthShell<br/>components/AuthShell.tsx<br/>route guard + layout]

    AUTH_SHELL --> AUTH_CHECK{User logged in?}

    AUTH_CHECK -->|No| LOGIN[/login<br/>Email + Password form]
    LOGIN -->|No account?| SIGNUP[/signup<br/>Email + Password<br/>Sends confirmation email]
    SIGNUP -->|Email confirmed| CALLBACK[/auth/callback<br/>Exchanges PKCE code for session]
    CALLBACK --> SETUP[/setup<br/>Enter display name + household name<br/>Creates household + profile]
    SETUP -->|Success| AUTH_CHECK
    LOGIN -->|Success| AUTH_CHECK

    AUTH_CHECK -->|Yes| NAV[Bottom Navigation Bar<br/>4 tabs visible]
    AUTH_CHECK -->|Yes| MAIN[Main content area]

    NAV -->|Tab 1 🏠| PANTRY[Pantry Page /]
    NAV -->|Tab 2 🛒| SHOPPING[Shopping Page /shopping]
    NAV -->|Tab 3 🍽️| MENU[Menu Page /menu — placeholder]
    NAV -->|Tab 4 💰| EXPENSES[Expenses Page /expenses — placeholder]

    PANTRY -->|tap + Add Item| MODAL_ADD[AddPantryItemModal]
    PANTRY -->|tap ✏️ on item| MODAL_EDIT[AddPantryItemModal — edit mode]
    PANTRY -->|tap 🧾 From Receipt| MODAL_RECEIPT[ImportReceiptModal]
    SHOPPING -->|tap + Add| MODAL_SHOP[AddShoppingItemModal]
```

---

## 3. User Flow — Sign Up (Create Household)

```mermaid
flowchart TD
    A([User opens app for first time]) --> B[AuthShell detects no session]
    B --> C[Redirect to /login]
    C --> D[User taps 'Create an account']
    D --> E[/signup page loads]

    E --> F[Enter email]
    F --> G[Enter password — min 6 chars + confirm]
    G --> H[Tap 'Create account']

    H --> I[supabase.auth.signUp with emailRedirectTo=/auth/callback]
    I --> J{Auth error?}
    J -->|Yes — email taken etc.| K[Error shown<br/>form stays populated]
    J -->|No session yet| L['Check your email' screen shown<br/>link to /login]

    L --> M([User opens confirmation email])
    M --> N[/auth/callback — supabase.auth.exchangeCodeForSession]
    N --> O[Session created — onAuthStateChange fires]
    O --> P[AuthShell: user exists but no profile → redirect to /setup]

    P --> Q[/setup page — enter your name]
    Q --> R[Enter display name — required]
    R --> S[Enter household name — optional]
    S --> T[Tap 'Create my household']

    T --> U[INSERT into households<br/>name = household name or default<br/>owner_id = auth.uid()]
    U --> V{Household created?}
    V -->|Error| W[Error shown — user can retry]
    V -->|Success| X[INSERT into profiles<br/>user_id, display_name, household_id, role = 'parent']

    X --> Y{Profile created?}
    Y -->|Error 23505 — already exists| Z[applyProfile from form data<br/>treat as success]
    Y -->|Other error| AA[Error shown]
    Y -->|Success| Z
    Z --> AB[applyProfile → React state updated]
    AB --> AC[AuthShell detects profile → redirect to /]
    AC --> AD([Pantry page])
```

---

## 4. User Flow — Sign In

```mermaid
flowchart TD
    A([User visits app — previously had account]) --> B[AuthShell checks localStorage]
    B --> C{Valid session found?}

    C -->|Yes — session still valid| D([Skip login — go directly to Pantry])

    C -->|No — expired or first time on device| E[Redirect to /login]
    E --> F[Enter email + password]
    F --> G[Tap 'Sign in']
    G --> H[supabase.auth.signInWithPassword]

    H --> I{Auth error?}
    I -->|Wrong credentials| J[Error shown<br/>'Invalid login credentials']
    J --> F
    I -->|Success| K[Session stored in localStorage<br/>key: family-hub-auth]
    K --> L[AuthContext fires onAuthStateChange]
    L --> M[loadProfile — fetch profiles row]
    M --> N[profile.display_name + role loaded into context]
    N --> O[AuthShell redirects to /]
    O --> P([Pantry page — personalised greeting])
```

---

## 5. User Flow — Child Joins via Invite Link

```mermaid
flowchart TD
    A([Parent generates invite]) --> B[Invite link created:<br/>/join?code=a3f9bc12&role=child]
    B --> C[Parent shares link via WhatsApp / message]

    C --> D([Child opens link on their phone])
    D --> E[/join page reads code + role from URL]
    E --> F[Look up household by invite_code<br/>SELECT from households WHERE invite_code = code]

    F --> G{Valid code?}
    G -->|No — expired or wrong| H[Error: 'This invite link is not valid.<br/>Ask your parent for a new one.']
    G -->|Yes| I[Show signup form<br/>pre-filled role = child<br/>household name shown for context]

    I --> J[Child enters their name]
    J --> K[Child enters email]
    K --> L[Child enters password]
    L --> M[Tap 'Join Family Hub']

    M --> N[supabase.auth.signUp]
    N --> O{Success?}
    O -->|Error| P[Error shown]
    O -->|Yes| Q[INSERT into profiles<br/>user_id, display_name<br/>household_id = from invite code<br/>role = 'child']

    Q --> R[AuthContext loads — role = child]
    R --> S([Child lands on Pantry<br/>Restricted categories hidden])
```

---

## 6. User Flow — Add Pantry Item

```mermaid
flowchart TD
    A([User on Pantry page]) --> B[Tap '+ Add Item']
    B --> C[AddPantryItemModal opens]
    C --> D[Enter item name*]
    D --> E[Select category]
    E --> F[Enter quantity — optional]
    F --> G[Enter unit — optional]
    G --> H[Set expiry date — optional]
    H --> I[Tap 'Add to Pantry']
    I --> J{Name filled in?}
    J -->|No| K[Button disabled — nothing happens]
    J -->|Yes| L[POST to Supabase pantry_items]
    L --> M{Save successful?}
    M -->|Error| N[Error message shown<br/>form stays populated]
    M -->|Success| O[Modal closes]
    O --> P[fetchItems re-runs]
    P --> Q([Item appears in correct category<br/>Quantities merged if name matches])
```

---

## 7. User Flow — Import from Receipt

```mermaid
flowchart TD
    A([User on Pantry page]) --> B[Tap '🧾 From Receipt']
    B --> C[ImportReceiptModal opens]
    C --> D{Choose input method}

    D -->|Photo tab| E[Tap to select photo from camera/gallery]
    D -->|Text tab| F[Paste receipt text]

    E --> G[Image converted to base64]
    F --> H[Raw text ready]

    G --> I[POST /api/parse-receipt — type: image]
    H --> I2[POST /api/parse-receipt — type: text]

    I --> J[Claude API — claude-opus-4-7]
    I2 --> J

    J --> K{AI response valid JSON?}
    K -->|No| L[Error shown — user can try again]
    K -->|Yes| M[Review screen — list of extracted items]

    M --> N[User reviews items]
    N --> O[Deselect unwanted items]
    O --> R[Tap 'Add to Pantry']
    R --> S[Batch INSERT to Supabase pantry_items]
    S --> T[Modal closes]
    T --> U([All selected items appear in pantry])
```

---

## 8. User Flow — Shopping List

```mermaid
flowchart TD
    A([User on Shopping page]) --> B[fetchItems loads from Supabase]

    B --> C{List empty?}
    C -->|Yes| D[Empty state — 🛒 Your list is empty]
    C -->|No| E[Flat list rendered]

    E --> F{User action?}

    F -->|Tap + Add| G[AddShoppingItemModal opens]
    G --> H[Enter name + optional quantity]
    H --> I[INSERT to shopping_items]
    I --> E

    F -->|Tap circle on item| J[Toggle checked state]
    J --> K[UPDATE shopping_items set checked]
    K --> E

    F -->|Tap ✕ on item| O[DELETE from shopping_items]
    O --> E

    F -->|Tap Clear done N| P{Any checked items?}
    P -->|No| E
    P -->|Yes| Q[DELETE all checked items]
    Q --> E
```

---

## 9. User Flow — Expired Items to Shopping List

```mermaid
flowchart TD
    A([User opens Pantry page]) --> B[fetchItems loads from Supabase]
    B --> C{Any expired items?}
    C -->|No| D[No red alert shown]
    C -->|Yes| E[Red alert: 🚨 X items expired]
    E --> F[User taps '+ Shopping']
    F --> G[Expired items grouped by name]
    G --> H[Quantities summed per group]
    H --> I[Batch INSERT to shopping_items]
    I --> J[Button changes to '✓ Added' for 3s]
    J --> K([Items visible on Shopping page])
```

---

## 10. Entity Relationship Diagram (target schema — auth phase)

```mermaid
erDiagram
    AUTH_USERS {
        uuid id PK
        text email
        text encrypted_password
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
        uuid household_id FK
        text added_by
        timestamp created_at
    }

    SHOPPING_ITEMS {
        uuid id PK
        text name
        text quantity
        boolean checked
        text store
        uuid household_id FK
        text added_by
        boolean deleted
        text deleted_by
        boolean is_personal
        uuid owner_user_id FK
        timestamp created_at
    }

    AUTH_USERS ||--o| PROFILES : "has profile"
    AUTH_USERS ||--o{ HOUSEHOLDS : "owns"
    HOUSEHOLDS ||--o{ PROFILES : "has members"
    HOUSEHOLDS ||--o{ PANTRY_ITEMS : "owns"
    HOUSEHOLDS ||--o{ SHOPPING_ITEMS : "owns"
    PROFILES ||--o{ SHOPPING_ITEMS : "personal lists"
```

---

## 11. Role-Based Visibility

```mermaid
flowchart LR
    subgraph PARENT ["👩 Parent role"]
        P1[All pantry categories]
        P2[Shared shopping list]
        P3[Shared expenses]
        P4[Family member management]
        P5[All 7 pantry categories incl. restricted]
    end

    subgraph CHILD ["🧒 Child role"]
        C1[Pantry — non-restricted categories only]
        C2[Shared shopping list]
        C3[Personal shopping list]
        C4[Expenses tab hidden]
        C5[No family management]
    end

    subgraph RESTRICTED ["🔒 Parent-only categories"]
        R1[alcohol]
        R2[tobacco]
        R3[Future — configurable per household]
    end

    PARENT --> RESTRICTED
    CHILD -. hidden .-> RESTRICTED
```

---

## 12. AI Integration — Receipt Parsing

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant APP as Next.js App
    participant API as /api/parse-receipt
    participant CLAUDE as Claude API

    U->>APP: Submits receipt (photo or text)
    APP->>API: POST { type, data, mediaType }
    API->>CLAUDE: messages.create() — system: parser prompt
    CLAUDE-->>API: JSON string with items array
    API->>API: Strip markdown fences + JSON.parse
    alt Parse success
        API-->>APP: { items: [{name, category, quantity, unit}] }
        APP-->>U: Review screen
    else Parse failure
        API-->>APP: { error, raw }
        APP-->>U: Error message
    end
```

---

## 13. Component Architecture (with Auth)

```mermaid
graph TD
    LAYOUT[layout.tsx<br/>Root Layout — Server Component]
    LAYOUT --> AUTH_PROVIDER[AuthProvider<br/>contexts/AuthContext.tsx<br/>user · profile · role · signOut]
    AUTH_PROVIDER --> AUTH_SHELL[AuthShell.tsx<br/>Client Component<br/>route guard + layout wrapper]

    AUTH_SHELL --> PAGES[Page Components]
    AUTH_SHELL --> NAV[BottomNav.tsx<br/>only shown when logged in]
    AUTH_SHELL --> AVATAR[Avatar Button<br/>initials · top-right]
    AVATAR -->|tap| PROFILE_SHEET[ProfileSheet.tsx<br/>name · email · household · role · sign out]
    PROFILE_SHEET --> SUPABASE

    PAGES --> PAGE_LOGIN[login/page.tsx<br/>no nav shown]
    PAGES --> PAGE_SIGNUP[signup/page.tsx<br/>no nav shown]
    PAGES --> PAGE_CALLBACK[auth/callback/page.tsx<br/>PKCE code exchange]
    PAGES --> PAGE_SETUP[setup/page.tsx<br/>display name + household creation]
    PAGES --> PAGE_PANTRY[page.tsx — Pantry]
    PAGES --> PAGE_SHOP[shopping/page.tsx]
    PAGES --> PAGE_MENU[menu/page.tsx — placeholder]
    PAGES --> PAGE_EXP[expenses/page.tsx — placeholder]

    PAGE_PANTRY --> MODAL_ADD[AddPantryItemModal]
    PAGE_PANTRY --> MODAL_IMPORT[ImportReceiptModal]
    PAGE_SHOP --> MODAL_SHOP[AddShoppingItemModal]

    MODAL_IMPORT --> API_ROUTE[api/parse-receipt/route.ts]
    API_ROUTE --> CLAUDE_SDK[Anthropic SDK]

    PAGE_PANTRY --> SUPABASE[lib/supabase.ts]
    PAGE_SHOP --> SUPABASE
    AUTH_PROVIDER --> SUPABASE

    SUPABASE --> DB[(Supabase PostgreSQL)]
    DB --> T1[auth.users]
    DB --> T2[households]
    DB --> T3[profiles]
    DB --> T4[pantry_items]
    DB --> T5[shopping_items]
```
