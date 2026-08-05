# UI Rules

Rules for building Serumah UI in React Native. Reference `context/designs/Serumah.html` for the interactive prototype of the active phase before starting a new phase.

---

## Layout

- Full-screen mobile layout (no web/desktop modes).
- Bottom nav fixed at bottom, 4 tabs. No top navbar — screen titles inline in content.
- Content scrolls vertically within each tab.
- Segmented control inside Tagihan for Denda / Iuran Bulanan / Listrik.
- Default content padding: 16px.

---

## Bottom Navigation

4 tabs in fixed order:

1. **Beranda** — house icon
2. **Piket** — clipboard/checklist icon
3. **Tagihan** — receipt/wallet icon
4. **Swap** — arrows/swap icon

Active tab: icon + label, color `pine`. Inactive: `inkSoft`.
No badge counts. No custom tab shapes.

---

## Stamp Usage

**Only for these statuses:** Lunas, Ditolak, Pending, Approved

```
border: 2.5px
borderRadius: 8px
transform: rotate(-4deg)
padding: 4px 10px
font: Space Grotesk Bold, uppercase, wide letter-spacing
```

Position: top-right corner inside the card. Never center/center.

**Colors:**
- Lunas/Approved: `pine` solid border
- Ditolak: `brick` solid border
- Pending: `olive` dashed border

Never use the stamp decoratively. Status only.

---

## Photo Slots (Piket Page)

Two slots: **Foto Before** (top) and **Foto After** (bottom). Checklist between them — not mixed.

- Empty state: dashed border, camera icon, "Tap to take photo" label.
- Filled state: thumbnail preview, X button to retake.
- Aspect ratio: 4:3 minimum, full width.

---

## Checkbox (Piket Checklist)

```
size: 22×22px
borderRadius: 7px
border: 2px solid inkSoft when unchecked
background: pine when checked
checkmark: white
```

Each row: checkbox + jenis_piket label. **No per-item fine amount** (fine is flat per submission, lives in the risk banner).

---

## Cards

All cards use `colors.card` background. Never use colored card surfaces — color goes inside via stamps, badges, borders, and text.

**Bill Card:**
```
┌──────────────────────────┐
│                  [Stempel] │
│ Alasan/Item              │
│ Tanggal · Nama           │
│                          │
│ Rp 50.000    [Btn][Btn]  │
└──────────────────────────┘
```

**Approve Card (mustard-soft background):**
Same as the bill card but with Approve/Reject buttons instead of Bayar/Detail.

---

## Typography Hierarchy

Three levels:

- **Page title / card heading:** Space Grotesk 600, 18px or 16px, `ink`.
- **Body / label:** Inter 400/500, 14px, `ink` (primary) or `inkSoft` (secondary).
- **Data / nominal:** JetBrains Mono 500/700, 16px (amounts) or 14px (dates/numbers), `brick` (fines) or `ink` (normal data).

---

## Interaction Principles

- State changes must have **instant visual feedback** (stamp updates, card color shifts) — not just toast/snackbar.
- Fine amount always visible at decision points (checklist, bill card) — transparent pricing.
- Destructive actions (reject piket → instant fine, reject payment) **do NOT need confirmation dialog** — deliberate action assumed.
- Photo flow: before → checklist → after → submit — keep linear and clear.

---

## Empty States

Every list that can be empty must have an empty state:
- Short text in `inkSoft` color
- Relevant icon above the text
- CTA if a logical next action exists

---

## Do Nots

- Never use default Material/RN buttons/cards — custom theme only.
- Never use cream+terracotta palette (#F4F1EA + #D97757).
- Never use dark+neon palette.
- Never use stamp outside status display.
- Never mix photo slots with checklist items — keep sections separate.
- Never add excessive animation to the stamp — it is a static stamp.
- Never use the default Material checkbox.
- Never display fine amounts in Inter — always JetBrains Mono.
- Never add gradients to cards.
