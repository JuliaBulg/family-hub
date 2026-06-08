# 🏠 Family Home Hub — Project Brief

## What this is
A smart home management assistant for Julia's family.
Built together with Claude, session by session.
Started: May 2026

---

## The Problem We Are Solving
Julia is a full-time BA in IT, a mom and wife who carries the full mental load of:
- Deciding what to cook every day
- Remembering what's in the fridge and what's expiring
- Making shopping lists from scratch every time
- Husband and daughter always calling to ask what to buy
- Buying food that ends up thrown away (wasted money)
- Shopping 2-3 times per week without a smart system

---

## The Vision (North Star)
> "Visibility on what we have at home + expiry dates + smart shopping list +
> family access + simple recipe ideas = saved time, saved money, no more mental load"

---

## The Family
- 3-4 people usually, sometimes 5
- Location: Viimsi, Estonia
- No dietary restrictions (pine nuts avoided for one rare guest)
- Cuisine: simple, mixed, Julia's own recipes

---

## Shopping Habits
- Main store: Rimi, Viimsi
- Also nearby: Selver, Maxima, Delice
- Household/cosmetics: Tradehouse at Nordica Center
- Frequency: 2-3 times per week (goal: reduce with smarter planning)
- Takeaway when tired: Black Rose (nearby)

---

## Cooking Habits
- Julia cooks 2-3 times per week herself
- Plans the week on Sundays
- Mid-week food sometimes runs out or she's too tired → takeaway
- Family is asked for preferences but Julia ends up deciding anyway
- ~15 family favourite dishes (simple, her own recipes — list to be added)

---

## The Solution — Family Home Hub

### Core Concept
A **chat-based interface** that updates a **dashboard** automatically.
You talk to it naturally → it handles everything behind the scenes.

### Three Core Modules
1. **📦 Pantry** — what's at home, quantities, expiry dates
2. **🍽️ Menu Planner** — weekly meal plan based on favourites + what's available
3. **🛒 Shopping List** — smart, auto-generated, shared live with family
4. **💰 Expenses Tab** — tracks spending per month per store (from receipt photos)

### How Data Flows IN
- 📸 Photo of grocery receipt → AI reads it → adds to Pantry + Expenses
- ✍️ Manual entry → adds to Pantry
- 💬 "I cooked pasta tonight" → AI deducts ingredients from Pantry
- ⏰ Time passing → expiry alerts trigger automatically

### How Data Flows OUT
- Pantry status → Menu suggestion for the week
- Menu for week → Shopping list of what's missing
- Shopping list → Shared live with family on their phones
- Expiring soon → Alert + added to shopping list automatically

---

## User Interaction Design
- **Chat interface** — Julia talks to it naturally
- **Dashboard** — shows pantry, menu, shopping list, expenses, expiry alerts
- **Shared access** — husband and daughter see live shopping list on their phones
- Works on phone browser (no app store needed to start)

---

## Example Sunday Morning Flow
1. Julia opens the app
2. Types: "Plan our week, we have chicken and pasta at home"
3. Claude checks favourites + expiring items → suggests 5 meals
4. Dashboard shows the weekly menu
5. Shopping list auto-generates with missing ingredients
6. Husband and daughter see the list on their phones instantly

---

## Technical Decisions Made

### Stack
- **Frontend:** Next.js — mobile-first responsive web app (works like a phone app, no App Store needed)
- **AI:** Claude API (already have API key!)
- **Database:** Supabase (free to start)
- **Hosting:** Vercel (free to start)
- **Receipt scanning:** Phase 2 — photo → Claude reads it → auto-fills pantry + expenses

### App Design Approach
- **Mobile-first** — designed for phone, works as dashboard on desktop automatically
- **PWA-ready** — family saves link to home screen, looks and works like a real app
- **One URL** — shared with husband and daughter, no install needed

### Estimated Running Costs
| Phase | Monthly Cost |
|---|---|
| Starting (family only) | €0-5 |
| Comfortable | €10-20 |
| Scaled (multiple families) | €50-200 |

### Build Approach
- **Option A: Build together** — Julia and Claude, evening sessions
- Start free, validate with own family, scale later if it works
- Julia applies her BA skills, learns technical side along the way

---

## Build Phases

### Pantry Categories (all phases)
1. 🥦 **Food & groceries** — Rimi, Selver, Maxima, Delice
2. 🧴 **Household & cosmetics** — Tradehouse at Nordica Center
3. 🍷 **Drinks & extras** — wine, juice, water
4. 🚬 **Personal** — ICOS, pods/sticks

### Phase 1 — Family MVP (START HERE)
- [ ] Project setup — Next.js + Supabase + Vercel
- [ ] Mobile-first UI skeleton (bottom navigation, 4 tabs)
- [ ] Pantry tracker — add items manually, all 4 categories
- [ ] Shopping list — shared live with family, tickable, grouped by store
- [ ] Recipe database — 11 family favourites (✅ done in recipes.md)
- [ ] Sunday menu planner — suggests meals from favourites + pantry

### Phase 2 — Smart Layer
- [ ] Receipt photo scanning → auto-add to pantry + expenses
- [ ] Cook a meal → auto-deduct ingredients
- [ ] Expiry date alerts
- [ ] "What can I cook tonight?" based on fridge contents
- [ ] Expenses tab — monthly tracking by store

### Phase 3 — Product (Future)
- [ ] Multiple family accounts
- [ ] Store integration (Rimi online)
- [ ] Budget tracking and insights
- [ ] Monetisation model

---

## Session Log
- **Session 1 (May 2026):** Full brainstorm. Defined problem, vision, solution architecture,
  tech stack, build phases. Ready to start building Phase 1 next session.
- **Session 2 (May 2026):** Added full recipe database (11 dishes + salads + breakfast + grill).
  Finalised all product decisions. Started building Phase 1.

---

## How to Resume This Project
1. Open a new chat with Claude
2. Say: "Let's continue my Home Hub project"
3. Paste the contents of this file (or just the filename if Claude can read it)
4. Claude will have full context and we continue from where we left off!
