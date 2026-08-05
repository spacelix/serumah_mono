# UI Tokens

Design tokens for Serumah (Piket Kos App). Source: `context/designs/piket-kos-design-system.html` and `context/designs/Serumah.html`. Use these exact values — never hardcode hex in React Native components.

---

## How to Use (React Native)

Tokens are defined in the theme at `apps/mobile/src/theme/` (colors, typography, spacing). Reference them via the theme object — never inline hex.

```ts
// Correct
color: colors.pine,

// Never
color: '#3D6B5C',
```

---

## Colors

### Paper & Neutrals

| Token | Hex | CSS Name | Usage |
|---|---|---|---|
| `paperCanvas` | `#DCD6C8` | `--paper-canvas` | Background outside the device frame |
| `paper` | `#EFEAE0` | `--paper-base` | Main screen background |
| `card` | `#FBF9F4` | `--paper-card` | Card & panel surface |
| `paperDeep` | `#E5DFD1` | `--paper-muted` | Segmented control track, secondary panel |
| `line` | `#D9D2C0` | `--paper-border` | Standard card & button border |
| `lineDash` | `#C3BAA2` | `--paper-dash` | Empty state / add-new border |
| `disabledBg` | `#CFC7B4` | `--disabled-bg` | Disabled button background |
| `disabledFg` | `#7D7768` | `--disabled-fg` | Disabled button text |

### Ink

| Token | Hex | CSS Name | Usage |
|---|---|---|---|
| `ink` | `#1E2A24` | `--ink-900` | Primary text, headings, dark surfaces |
| `inkSoft` | `#5B6862` | `--ink-500` | Secondary text, meta, placeholder |
| `inkMuted` | `#8B8474` | `--ink-300` | Tertiary text, "free from piket" state |

### Green · Primary

| Token | Hex | CSS Name | Usage |
|---|---|---|---|
| `pine` | `#3D6B5C` | `--forest-600` | Primary accent, CTA buttons, links |
| `pineDeep` | `#2B4E43` | `--forest-700` | Hover/pressed of forest 600 |
| `pineSoft` | `#D7E6DF` | `--forest-100` | Success tint background (tag "Selesai") |

### Red · Danger

| Token | Hex | CSS Name | Usage |
|---|---|---|---|
| `brick` | `#B33F3F` | `--brick-600` | Unpaid, rejected, fines |
| `brickDeep` | `#8F2F2F` | `--brick-700` | Text on brick 100 background |
| `brickSoft` | `#F1DAD5` | `--brick-100` | Warning / fine risk tint background |

### Gold · Accent

| Token | Hex | CSS Name | Usage |
|---|---|---|---|
| `mustard` | `#C9A227` | `--gold-600` | "today" accent, date emphasis |
| `mustardSoft` | `#F4E9C8` | `--gold-100` | "today" tag tint background |
| `mustardBorder` | `#E4D3A0` | `--gold-border` | Gold-accented card border |
| `mustardInk` | `#7D6C1F` | `--gold-ink` | Text on gold 100 background |
| `mustardInkStrong` | `#241F08` | `--gold-ink-strong` | "today" date chip text |
| `olive` | `#9A8A3A` | `--olive-600` | "waiting confirmation" status |

### Stamp Colors

| Status | Border Color | Border Style |
|---|---|---|
| Lunas/OK | `pine` | 2.5px solid |
| Ditolak/Unpaid | `brick` | 2.5px solid |
| Pending/Waiting | `olive` | 2.5px dashed |

---

## Typography

### Font Families

| Role | Font | Weights | Usage |
|---|---|---|---|
| Display | Space Grotesk | 600, 700 | Page headings, section headings, stamp caps |
| Body | Inter | 400, 500, 600 | Body text, button labels, member names |
| Data/Mono | JetBrains Mono | 400, 500, 600, 700 | Rupiah amounts, kickers, dates, timestamps |

### Type Scale

| Role | Spec | Sample Size |
|---|---|---|
| Display / H1 | Space Grotesk 600 · 25px/1.1 · -0.02em | 25px |
| Section heading | Space Grotesk 600 · 13–14.5px | 14px |
| Large amount | JetBrains Mono 700 · 21–26px · -0.02em | 22px |
| Medium amount | JetBrains Mono 700 · 14–18px | 16px |
| Name / strong label | Inter 600 · 12.5–13.5px | 13px |
| Body | Inter 400/500 · 10.5–11.5px | 11px |
| Button label | Inter 600 · 11.5–14px | 12px |
| Kicker / eyebrow | JetBrains Mono 500 · 8.5–10.5px · +0.1–0.14em | 10px |
| Meta / caption | JetBrains Mono 400/500 · 9.5–11px | 10px |
| Stamp cap | Space Grotesk 700 · 9–10px · +0.11em | 10px |

---

## Radius Scale

| Name | Value | Usage |
|---|---|---|
| `r-xs` | **7px** | Checkbox |
| `r-sm` | **9px** | Day toggle button, small elements |
| `r-md` | **11px** | Standard button, nominal input, rows |
| `r-lg` | **14px** | Large button (submit piket), ink primary button |
| `r-xl` | **16px** | Standard card |
| `r-2xl` | **18px** | Elevated card, bill card |
| `r-3xl` | **20px** | Hero card (weekend card, swap form) |
| `r-pill` | **999px** | Tag, pill badge |

---

## Spacing

The spacing scale does **not** follow the standard 4px/8px grid. Values are component-specific. Three most common: **8px, 11px, 12px**.

Values in use: 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18, 20.

- Card padding: 12–16px
- Gap between cards: 8px
- Tight label-to-value gap: 2px

---

## Signature Element: Stamp

```
border: 2.5px solid (or dashed for pending)
borderRadius: 8px
transform: rotate(-4deg)
fontFamily: Space Grotesk, 700
letterSpacing: 0.11em
textTransform: uppercase

// Animation (React Native): stampIn — 0.42s, cubic-bezier(.2,1.4,.4,1)
// Keyframe: -14deg scale(1.6) → -4deg scale(.96) → -4deg scale(1)

// Only for: Lunas, Ditolak, Pending, Approved
// Never use decoratively
```

---

## Component Tokens

### Buttons

| Variant | Properties |
|---|---|
| Primary · Ink | bg `ink`, fg white, radius **14px**, padding 12×18, Inter 600 12.5px. Pressed → `pine` |
| Primary · Forest | bg `pine`, fg white, radius **11px**, padding 11×16, Inter 600 12px. Pressed → `pineDeep` |
| Secondary · Outline | transparent, border `line` 1px, fg `ink`, radius **11px**, padding 11×16, Inter 600 12px |
| Disabled | bg `disabledBg`, fg `disabledFg`, radius **14px**, padding 13×18, Inter 600 13px |
| On dark | bg `paper`, fg `ink`, radius **11px**, padding 12×18, Inter 600 12.5px |
| Dashed CTA | bg `paperDeep`, dashed border `lineDash`, fg `pine`, radius **18px**, padding 16, Inter 600 13px |

### Cards

| Variant | Properties |
|---|---|
| Standard (tap) | bg `card`, border `line` 1px, radius **16px**, padding 14×15 |
| Hero · Forest | bg `pine`, fg white, radius **20px**, padding 17 |
| Gold accent | bg `card`, border `line` 1px + left `mustard` 4px, radius **16px**, padding 14×15 |
| Dark (swap) | bg `ink`, fg white, radius **20px**, padding 17 |

### Segmented Control

```
track bg: paperDeep, radius 13px, gap 4px, padding 3px
button: radius 10px, Inter 600 12px
active: bg ink, fg white
inactive: transparent, fg inkSoft
```

### Bottom Navigation

```
track bg: paper, border line 1px, radius 20px, padding 8px
item: radius 14px, flex column center, gap 5px
item icon: 19×19, stroke 2px
item label: Inter 600 9.5px
active: bg ink, fg white
inactive: bg transparent, fg inkSoft
```

### Schedule Row

```
bg: card, border line 1px, radius 16px, padding 12×14
date chip: radius 11px, 42×46px, flex column center
  "today": bg mustard, fg mustardInkStrong
  normal: bg paper, fg ink
dow: JetBrains Mono 500 8.5px
date: JetBrains Mono 700 16px
```

### Bill Row

```
bg: card, border line 1px, radius 18px, padding 14×15
reason: Inter 600 13px, ink
meta: JetBrains Mono 400 10.5px, inkSoft
amount: JetBrains Mono 700 24px, brick, -0.02em
```

### Checkbox

```
unchecked: border 2px inkSoft, radius 7px
checked: bg pine, white checkmark, radius 7px
done name: inkSoft, line-through
denda safe: pine
denda risk: brick
```

### Tags (schedule)

| Variant | Properties |
|---|---|
| Today | bg `mustardSoft`, fg `mustardInk`, pill |
| Planned / Scheduled | transparent, border `line` 1px, fg `inkSoft`, pill |
| Free | transparent, dashed border `lineDash`, fg `inkMuted`, pill |
| Done | bg `pineSoft`, fg `pineDeep`, pill |

### Nominal Input

```
container: bg card, border line 1px, radius 11px, padding 11×13
prefix: JetBrains Mono 500 12px, inkSoft
value: JetBrains Mono 700 15px, ink
```

### Photo Placeholder

```
empty: dashed border lineDash 1.5px, radius 16px, bg paperDeep, h 80px
filled: solid border line 1px, radius 16px, texture bg (striped), h 80px
```

### Avatar Chip

```
bg: card, border line 1px, radius pill, padding 5×10
circle: 26×26px, radius 50%, bg pine, fg paper, Space Grotesk 600 11px
name: Inter 600 11.5px, ink
```

### Inline Banner (risk/summary)

```
bg: pineSoft (safe) / brickSoft (risk)
radius: 11px, padding 10×13
label: Inter 500 11.5px
amount: JetBrains Mono 700 14px
```

---

## Motion

| Name | Duration | Easing | Transform |
|---|---|---|---|
| `stampIn` | 0.42s | cubic-bezier(.2,1.4,.4,1) | rotate -14°→-4°, scale 1.6→0.96→1 |
| `riseIn` | 0.26s | ease | translateY 8px→0, opacity 0→1 |

---

## Invariants

- Never use raw hex in components — always `colors.*` from the theme.
- Never use default Material/React Native colors.
- Stamp only for important status — never decorative.
- All fine/denda amounts use JetBrains Mono — not Inter or Space Grotesk.
- Stamp rotation is always -4deg.
- Icons: thin stroke, 1.9–2.2px, round cap/join, 24×24 viewBox.
