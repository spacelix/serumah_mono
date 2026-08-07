# UI Rules

Rules for building Serumah UI in React Native. Reference `context/designs/Serumah.html` for the interactive prototype of the active phase before starting a new phase.

---

## Layout

- Full-screen mobile layout (no web/desktop modes).
- Bottom nav fixed at bottom, 4 tabs. No top navbar — screen titles inline in content (header: mono kicker + Space Grotesk 25px title).
- Content scrolls vertically within each tab. Content top padding 6px; side padding 20px; bottom 108px (clears nav).
- Segmented control inside Tagihan for Denda / Iuran Bulanan / Listrik.
- Default content padding: 16px (page-level view padding).

---

## Bottom Navigation

4 tabs in fixed order:

1. **Beranda** — house icon
2. **Piket** — clipboard/checklist icon
3. **Tagihan** — receipt/wallet icon
4. **Swap** — arrows/swap icon

Active tab: `bg ink` pill (radius 14) with `paper` icon+label. Inactive: transparent, `inkSoft`.
No badge counts. No custom tab shapes. Nav bar background: gradient from paper to transparent (content scrolls under).

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

Two slots per room: **Foto before** (top) and **Foto after** (bottom). Checklist between them — not mixed.

- Empty state: dashed border `lineDash`, camera icon, "+ ambil foto" label. Height 72px.
- Filled state: striped texture thumbnail ("foto terpasang · ketuk buat ganti"), tap to retake. Height 104px.
- Slot width full (room card), radius 11px, mono 11px label.
- Each slot has a header: "FOTO BEFORE"/"FOTO AFTER" (mono 9.5px uppercase, .12em) + hint ("wajib"/"terkirim").

---

## Checkbox (Piket Checklist)

```
size: 22×22px
borderRadius: 7px
border: 2px solid inkSoft when unchecked
background: pine when checked
checkmark: white
```

Each row: checkbox + jenis_piket label. **No per-item fine amount** (fine is flat per submission, lives in the risk banner). Row border-bottom `paper`, row padding 9px vertical. Checked: name `inkSoft` + line-through.

## Room Card (Piket)

```
bg: card, border line 1px, radius 11px, padding 14, gap 12
header: number badge 26×26 radius 9 (done pine/paper, else paperDeep/inkSoft) + name Inter 600 14.5px + progress mono 10.5px
checklist between foto before and foto after
risk banner at bottom (safe → pineSoft/pineDeep "Rp 0", risk → brickSoft/brickDeep)
```

## Risk Banner

```
bg: pineSoft (safe, "Semua ruangan lengkap") / brickSoft (risk, "Kalau disubmit belum lengkap / ditolak")
radius: 11px, padding 11×13
label: Inter 500 11.5px
amount: JetBrains Mono 700 15px, same fg as label
```

---

## Cards

All cards use `colors.card` background (except explicit tinted variants below). Never use colored card surfaces by default — color goes inside via stamps, badges, borders, and text.

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

- **Screen title (H1):** Space Grotesk 600, 25px/1.1, `ink`, letter-spacing -0.02em. Preceded by a mono kicker (9.5–10.5px, uppercase, .14em, `inkSoft`) e.g. house name / "Papan piket · Kos Ampel 12".
- **Card heading / section:** Space Grotesk 600, 13–15.5px, `ink`; or Inter 600 13.5–14.5px for rows.
- **Body / label:** Inter 400/500, 10.5–13.5px, `ink` (primary) or `inkSoft` (secondary).
- **Data / nominal:** JetBrains Mono 500/700, 22–26px (amounts) or 9.5–16px (dates/numbers), `brick` (fines) or `ink` (normal data).

Kicker/list labels use JetBrains Mono 500 9.5px, uppercase, letter-spacing .1–.14em.

---

## Interaction Principles

- State changes must have **instant visual feedback** (stamp updates, card color shifts) — not just toast/snackbar.
- Fine amount always visible at decision points (checklist, bill card) — transparent pricing.
- Destructive actions (reject piket → instant fine, reject payment) **do NOT need confirmation dialog** — deliberate action assumed.
- Photo flow: before → checklist → after → submit — keep linear and clear.
- Animation vocabulary is limited to **two** keyframes: `stampIn` (status stamps) and `riseIn` (element entrance), plus `background/.16s` press feedback. Do not add spring/bounce/parallax.
- `riseIn` is an **entrance** only — never exit/leave animation. Exit = instant removal. Use shorter durations (<.3s) for lists, longer (~.3s) for cards, and let sheets/forms use .26s.

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
- Never add custom/excess animation to the stamp — only the defined `stampIn` entrance (0.42s) on appearance.
- Never add spring, bounce, parallax, or infinite loops.
- Never use the default Material checkbox.
- Never display fine amounts in Inter — always JetBrains Mono.
- Never add gradients to cards. (Exception: bottom-nav bar gradient fade, per design.)
- Fonts only: Inter (body), Space Grotesk (display), JetBrains Mono (data). Never other fonts.
