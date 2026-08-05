# Feature Context — Auth

## 1. Goal & Scope
Register (email+password), login, logout, and JWT session management. This feature PROVIDES user identity and token — it does not include profile, rumah, or other content (see Dependencies).

## 2. Data Model
- `User` (`users`): `id`, `email`, `passwordHash` (bcrypt), timestamps. Source: `architecture/data-model.md`.
- `Anggota.id` = `User.id` (1:1, created during onboarding profile).

## 3. API Contract (NestJS)
Module: `auth`. Prefix: `/auth`.

| Method | Path | Request | Response | Notes |
|---|---|---|---|---|
| POST | `/auth/register` | `{ email, password }` | `{ token, user }` | Validate: email format, password ≥ 8. Email already used → 409 `"Email sudah terdaftar"`. |
| POST | `/auth/login` | `{ email, password }` | `{ token, user }` | Wrong password → 401 `"Email atau password salah"`. |
| POST | `/auth/logout` | — (auth) | `{ success: true }` | Blacklist token / client clears token. |
| GET | `/auth/me` | — (auth) | `{ user, anggota }` | Session data; `anggota` null if profile not filled. |

Guard: JWT (`passport-jwt`). Response `user` = `{ id, email }`.

## 4. Business Rules & State Machine
Locked decisions:
- Password always hashed with bcrypt (default cost). Never plaintext.
- JWT access token (no refresh token in v1). Long expiry (e.g. 30 days).
- Register does NOT fully auto-login into the app — immediately redirects to onboarding profile.
- Client session store: `expo-secure-store` (not AsyncStorage).

## 5. UI Spec (React Native)
Screens: `app/login.tsx`, `app/register.tsx`, splash (`app/index.tsx`).

- **Splash**: `splashGreen` (#3F6F61) background; app logo (118px) + wordmark **"Serumah"** (Space Grotesk 700, 31px, `paper`) + kicker **"Piket · Iuran · Galon"** (JetBrains Mono 500, 9.5px, letter-spacing .2em, uppercase, `paper` @ 55%). Shown while session is being checked (`checking`) or fonts still loading. Matches `Serumah.html` splash exactly (via `splash-screen.tsx`).
- **Fonts**: Space Grotesk / Inter / JetBrains Mono loaded at runtime via `@expo-google-fonts/*` (each weight = own family name, e.g. `SpaceGrotesk_600SemiBold`). `theme/typography.ts` exposes `fontFamilies.{display,body,mono}[weight]`; components pick exact weight families (no `fontWeight`). Root layout gates on `useSerumahFonts()` → native splash until loaded.
- **App icon / splash**: `app.json` icon + Android adaptive icon (`#3F6F61` bg, logo foreground) + `expo-splash-screen` bg `#3F6F61` imageWidth 118 — generated from the Serumah logo SVG (no Expo default assets).
- **Welcome (onboarding tutorial)**: shown right after the splash (auth entry screen). Matches `Serumah.html` onboarding: `splashGreen` bg, compact logo mark 36 (`variant="mark"`, single roof stroke 26 + badge 16) + "Serumah" header + **"Lewati"** (skip), centered art box (200×186, radius 26, `paper09`/`paper16`) + kicker (mono 9.5, .16em, `paper50`) + title (Space Grotesk 600 24px) + body (Inter 12.5/1.55, `paper70`), 3 dots (active 18×7 pill), back (←) + **"Lanjut"** / last step **"Mulai · Masuk"** (paper pill, radius 13, py 15). Steps (from `Serumah.html`):
  1. **Jadwal piket yang adil sendiri** — kicker "Papan piket digital", art cal (schedule rows: "Sab · Lo" paper bg + DI KOS pineSoft tag; "Sen·Dani"/"Rab·Fajar" `paper16` with AUTO; "Sel · Kam" dashed `paper35` LIBUR — exact colors match the prototype)
  2. **Bolong ya kena denda** — kicker "Bukti, bukan alasan", art stamp
  3. **Iuran & galon transparan** — kicker "Satu atap, satu catatan", art money (Wifi/Listrik amounts + galon chip with droplet SVG, stroke `mustard` 1.9)
  Skip (`Lewati`) and final "Mulai · Masuk" both → `/login`. Session-based redirect after splash:
  - not logged in → `/welcome`; logged in + no profile → `/onboarding/profile`; has profile + no rumah → `/onboarding/create-rumah`; complete → `(tabs)`.
- **Login**: email field, password field, **"Masuk"** button (ink, full width), link **"Belum punya akun? Daftar"**.
- **Register**: email, password, password confirmation, **"Daftar"** button, link **"Sudah punya akun? Masuk"**.
- Loading state while submitting; errors show Indonesian API messages.
- All text in Bahasa Indonesia. No stamp on these screens.

## 6. Constraints / Prohibited
- No password reset, OTP, or email verification in v1 (not in scope).
- No refresh token / auto-relogin beyond token validity check.
- Do not store tokens in AsyncStorage.
- Do not write role logic here — role is read from `Anggota` in other features.

## 7. Dependencies
- Required read: `core/code-standards.md` (auth gate + apiClient patterns).
- After successful login, the flow continues to `onboarding/context.md`.

## 8. Status
Not yet implemented (awaiting Phase 2–3). See `progress/build-plan.md` — Phase 1 (Backend Auth) & Phase 2 (Mobile Auth).
