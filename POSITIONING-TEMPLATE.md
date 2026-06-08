# Positioning Prompt Template
# Copy, fill in the blanks, paste into Claude in VS Code

---

## App layout rules (include this in EVERY UI prompt)

The app is mobile-first. It has a fixed bottom navigation bar that is 64px tall (`h-16`).
Any action buttons must sit above it using `bottom-16` — never behind it.
All page content must have `pb-32` at the bottom so it does not scroll under the button or nav bar.
Do not use nested overflow containers — this causes iOS scroll bugs.

---

## Positioning template

Fix the positioning of [ELEMENT NAME] in [FILE PATH].

**Current behaviour:**
[ELEMENT] is currently [floating / scrolling with content / hidden behind nav / overlapping X / at the top when it should be at the bottom / etc.]

**Expected behaviour:**
[ELEMENT] should be [fixed to the bottom / sticky at the top / inline with the content / always visible above the nav bar / etc.]

**Position:**
- Vertical: [fixed bottom / sticky top / inline / relative to parent]
- Horizontal: [full width / centered / left-aligned / right-aligned]
- Spacing from bottom nav: [bottom-16 = 64px above nav / bottom-0 = flush with bottom / etc.]
- Padding: [px-4 left and right / centered with max-w-X mx-auto / etc.]
- Z-index: [above content = z-10 / above modals = z-50 / default = auto]

**Scroll behaviour:**
[Should stay visible when user scrolls / should scroll with the list / should disappear on scroll down]

**Width:**
[Full width of screen / full width minus px-4 padding / fixed width of Xpx / auto]

---

## Quick reference — common patterns for this app

| What you want | Tailwind classes |
|---|---|
| Button pinned above bottom nav | `fixed bottom-16 left-0 right-0 px-4` |
| Button pinned to very bottom (no nav) | `fixed bottom-0 left-0 right-0 px-4 pb-4` |
| Page content clears bottom button + nav | `pb-32` on the scrollable container |
| Sticky header at top | `sticky top-0 z-10 bg-white` |
| Always on top (modal backdrop) | `fixed inset-0 z-40` |
| Always on top (modal content) | `fixed inset-0 z-50 flex items-end` |
| Bottom sheet / drawer | `fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl` |
| Full screen overlay | `fixed inset-0 z-[200]` |

---

## Filled example

Fix the positioning of the `+ Add to Shopping List` button in `src/app/shopping/page.tsx`.

**Current behaviour:**
The button is inside the scrollable list content and scrolls out of view when the list is long.

**Expected behaviour:**
The button should always be visible, fixed above the bottom navigation bar.

**Position:**
- Vertical: fixed to bottom of viewport
- Horizontal: full width
- Spacing from bottom nav: `bottom-16` (64px above nav)
- Padding: `px-4` left and right
- Z-index: `z-10` (above list content, below modals)

**Scroll behaviour:**
Always visible — does not scroll with the list.

**Width:**
Full width of screen minus `px-4` padding on each side.
