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

- **Splash**: `splashGreen` (#3F6F61) background; app logo (118px) + wordmark **"Serumah"** (Space Grotesk 700, 31px, `paper`) + kicker **"Piket · Iuran · Galon"** (JetBrains Mono 500, 9.5px, letter-spacing .2em, uppercase, `paper` @ 55%). Shown only while session is being checked (`checking`). Matches `Serumah.html` splash exactly (via `splash-screen.tsx`).
- **Welcome**: landing page shown after the splash when not logged in (auth entry screen). Centered logo (104px) + wordmark "Serumah" + kicker "Piket · Iuran · Galon", short blurb, primary **"Masuk"** CTA + outline **"Daftar akun baru"**. Session-based redirect after splash:
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
