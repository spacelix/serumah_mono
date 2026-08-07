---
description: Instructions for building Serumah (Piket Kos App) — React Native + NestJS
globs: *
alwaysApply: true
---

# Serumah Development Agent

Serumah (Piket Kos App) — mobile app for managing cleaning schedules at a boarding house (kos-kosan). Digital version of the physical "piket schedule" pinned to the kitchen wall. Theme: "Papan Piket Digital" with a stamp/cap motif as the signature element for status.

**Current stack (after migration):** React Native (Expo) + NestJS API + PostgreSQL/Prisma + MinIO. State management: React Query (server state) + Zustand (auth/UI state). Previously Flutter + Supabase — fully migrated.

---

# Environment

Agent runs inside WSL2 (Linux). **Node.js and Bun are available** — all Node/Bun/npm/prisma/expo commands may be run here (unlike the old Flutter which was forbidden).

Use **Bun** for project creation and package management. Create projects via official generators/scripts — do not hand-write `package.json` for new apps.

```
apps/mobile/   → Expo RN app  (bun run start / lint / test)
apps/api/      → NestJS API   (bun run start:dev / test / build)
packages/db/   → Prisma schema + migrations + seed (bunx prisma migrate dev)
docker-compose → Postgres 16 + MinIO locally
```

`@serumah/db` ships **compiled JS** (src → `dist/`) so the NestJS runtime can load it. Always run `turbo build` (or `bun run build` inside `packages/db`) **before** starting `apps/api`, and after any schema change regnerate via `prisma generate`. The generated client lives at `packages/db/generated/client` (gitignored, regenerated). Import it in `packages/db` sources as `../generated/client/index.js` (explicit extension required by NodeNext).

Native build verification (Android APK) happens via GitHub Actions / EAS — not in WSL.

---

# Read Before Anything Else

Read these files **in this order** before writing any feature code:

1. `context/core/AGENTS-ROUTING.md` — feature map → which context to read
2. `context/core/ui-tokens.md` — design tokens
3. `context/core/ui-rules.md` — UI rules
4. `context/core/code-standards.md` — code standards (RN + NestJS)
5. `context/architecture/data-model.md` — data schema (Prisma) source of truth
6. `context/features/<feature>/context.md` — only the context for the feature you are working on
7. `context/progress/progress-tracker.md` — build status

Then open `context/designs/Serumah.html` in a browser — the visual prototype for the current phase.

**Do not read other feature contexts** — other features' specs are irrelevant and cause the agent to mix them up (hallucination).

---

# Anti-Hallucination Rules

This is the reason contexts are split per feature. Follow without exception:

1. **1 feature = 1 context.** Never implement a feature without reading its `context/features/<feature>/context.md`.
2. **Unlocked TBC → stop & ask.** If a feature spec says "TBC" / a decision is not locked, ASK the user first with options — do not decide yourself, do not guess.
3. **No inventing scope.** Verify the feature exists in `context/progress/build-plan.md` and `context/features/<feature>/context.md`. Not there → stop & ask.
4. **Data model must not drift.** Prisma fields used by a feature must match `context/architecture/data-model.md`. If a new column is needed → update `data-model.md` FIRST before code.
5. **Locked decisions cannot change.** Decisions written as "Locked decision" in a context are final. To change → ask the user.
6. **Do not copy decisions from other features** into the one you are working on — each feature is standalone.
7. **All UI text is Bahasa Indonesia.** Never English for user-facing text. Money amounts use the `id_ID` format.

---

# Core Development Workflow

Every feature follows this lifecycle:

1. Write/update `context/features/<feature>/context.md` (docs-first)
2. Design UI with mock data (React Native)
3. Review UI
4. Implement NestJS API endpoints
5. Wire API to UI (React Query)
6. Update `context/progress/progress-tracker.md`

No backend integration before UI approval.
No feature is complete until it is testable.

## Verification & Per-Item Commits (mandatory)

1. **Verify before done.** Every item (feature, endpoint, refactor, fix) is **not** complete until it is verified: run its `build`, `lint`, `typecheck`, and tests (`turbo run build lint typecheck test --filter=<pkg>`) and confirm they pass. Never mark an item done or start the next item on unverified work.
2. **Commit per item.** Commit changes **after each completed (and verified) item**, never as one bundled WIP commit. One commit = one logical item, message in the repo style and scoped to that item. Cross-cutting files (e.g. `bun.lock`) go with the item they belong to.
3. **Update docs with the item.** `context/progress/progress-tracker.md` (and any affected context) is updated in the same commit as its item — never a separate later catch-up.

---

# Project Overview

Core Serumah features:

- Register & Login (email + password, JWT)
- Onboarding: profile setup, create rumah (admin), join rumah (invite code)
- Automatic round-robin schedule: weekday Senin/Rabu/Jumat (every other day) + dynamic weekend
- Weekend status toggle (Di kos / Pulang)
- Daily piket execution with before/after photo evidence per room
- Per-room checklist (jenis_piket) — no per-item fine amount
- PJ Kos approval per submission (all-or-nothing) with auto fine generation
- Auto-fine flat for missed deadline (20:00) — amount from `rumah.nominal_denda`
- Swap requests — all-or-nothing full day transfer
- Fine payment via QRIS (PJ uploads QRIS; member scans + uploads proof; PJ confirms)
- Monthly iuran (kos/wifi/listrik wajib) — total cost auto-split, payment proof, PJ confirmation, pelunasan
- Additional electricity self-record — auto-split, adjust next month's bill, no approval
- Galon rotation widget + "Sudah Beli" (no reimbursement)
- Profile page (name, photo, emergency contact, address)
- Rumah Management (member list, edit costs, rekening, QRIS, invite code — admin only)
- In-app non-store update via GitHub Releases (`version.json` + APK)

---

# Architecture

## Stack

| Layer            | Tool                  | Purpose                                    |
| ---------------- | --------------------- | ------------------------------------------ |
| Framework        | React Native (Expo)   | Mobile app (Android/iOS)                   |
| Language         | TypeScript            | Strict mode                                |
| State Mgmt       | React Query + Zustand | Server state + auth/UI state               |
| Backend          | NestJS                | REST API + cron jobs                       |
| Database         | PostgreSQL + Prisma   | Source of truth                            |
| Storage          | MinIO / local disk    | Piket photos, avatar, QRIS, payment proofs |
| Auth             | NestJS + JWT (bcrypt) | Email + password                           |
| Routing (mobile) | Expo Router           | File-based routing                         |
| Icons            | Lucide (React)        | Consistent icon system                     |

## Data flow pattern

```
React Native (React Query) → NestJS API (REST) → Prisma → PostgreSQL
                                   ↓
                            MinIO Storage (photos)
```

All database writes go through **NestJS services** — the RN app never accesses the DB directly.
All queries are scoped to `rumah_id` — never query without a rumah filter.

## Serverless — NOT used

The migration abandons the "serverless only" principle from the Flutter+Supabase era. The backend is now **a self-hosted NestJS** (VPS/Docker). All business logic lives in NestJS services + cron (auto-fine, weekend freeze, reminders).

---

# Rules That Never Change

## Language

- **Bahasa Indonesia** for all UI text, labels, error messages. Never English for user-facing text.
- API errors return human-readable Indonesian messages — not raw stack traces/exceptions.

## Data & Database

- PostgreSQL via Prisma is the single source of truth.
- All queries scoped to `rumah_id`.
- Sensitive mutations (iuran/denda/schedule status transitions) are validated **server-side** in NestJS services — never trust client-provided status.
- Prisma models are defined once in `packages/db` — do not duplicate the schema.

## Auth

- JWT (access token). Passwords hashed with bcrypt.
- Every user belongs to exactly one rumah (`rumah_id` in the anggota table).

## Storage

- Piket photos: `photos/{submission_id}/{room_id}_{type}_{timestamp}.jpg` (type = before/after)
- Avatar: `profiles/{anggota_id}/avatar.jpg`
- Fine payment proof: `photos/denda_bukti/{denda_id}_{ts}.jpg`
- QRIS: `photos/qris/{rumah_id}_{ts}.jpg`
- Iuran proof: `photos/iuran/bukti_total/{bulan}_{ts}.jpg`
- Pelunasan: `photos/iuran/pelunasan/{bulan}_{kategori}_{ts}.jpg`
- Electricity proof: `photos/listrik/{id}/bukti_{ts}.jpg`
- Never store images locally beyond cache.

## State Management (React Native)

- **React Query** for all server state (fetch, cache, invalidate, mutation).
- **Zustand** for auth state + local UI state.
- Forbidden: Redux (unless explicitly decided), business logic in components.

## Navigation (React Native)

- Expo Router (file-based). Auth stack (Splash, Login, Register, Onboarding) separated from `(tabs)` with 4 tabs.
- **Fixed 4 bottom tabs:** Beranda, Piket, Tagihan, Swap — no top navbar.

## UI

- Design tokens from `context/core/ui-tokens.md` — never hardcode hex in components.
- Stamp (rotated -4° stamp) ONLY for status: Lunas, Ditolak, Pending, Approved.
- Money amounts always mono font (JetBrains Mono) — not body font.
- Spacing in 4px multiples (from the token scale).
- Photo before → checklist → photo after — linear, never mixed.

## Schedule Logic

- Weekday piket: Senin, Rabu, Jumat (every other day). Selasa+Kamis off.
- Round-robin cycle across weeks. No back-to-back (one person never gets 2 consecutive days — automatically satisfied because of the Selasa/Kamis gap).
- Weekend: generated from members with "Di kos" status. All "Pulang" → Free day (no fine).
- Weekend status freeze: Friday 20:00 (configurable). No update → default to last week's status.

## Role

- **Admin (creator/PJ Kos):** approve/reject piket, confirm fine payments, upload QRIS, edit rumah costs, manage members, reset invite code, upload pelunasan.
- **Anggota:** piket, upload photos, pay fines, swap, view rumah info.
- The PJ/Admin's own fines are **auto-paid** when proof is uploaded (no self-confirmation).

---

# Code Quality (Summary)

- Simple, readable code. Explicit naming — no abbreviations.
- TypeScript strict. `any` forbidden except at data-migration edges.
- All errors handled — never assume success.
- Repository/service errors logged with the `[ServiceName]` prefix.
- UI errors: clear Indonesian messages.

---

# Progress Tracking

After every completed feature, update `context/progress/progress-tracker.md`:

- Current Status (phase)
- Last Completed
- Next Feature

Also update completed checkboxes.

---

# Phase Gating

Only work on the current active phase. Never start the next phase without approval.

The active phase is recorded in `context/progress/progress-tracker.md`.
When a phase is complete → stop & ask: _"Phase X done. Proceed to Phase Y?"_

---

# To Be Confirmed

Decisions not yet locked by the user live in `context/progress/to-be-confirmed.md` and/or inside `context/features/<feature>/context.md`.

Before implementing a feature that touches an unlocked item → ALWAYS ask for confirmation. Do not decide yourself.
After confirmation → move the decision into the feature file + `progress-tracker.md`, then remove it from the TBC list.

---

# Invariants Summary

| Rule               | Description                                                                            |
| ------------------ | -------------------------------------------------------------------------------------- |
| Language           | Bahasa Indonesia for all UI text                                                       |
| Colors             | Design tokens only — no hex in components                                              |
| Fonts              | Mono (JetBrains) for amounts, body Inter, display Space Grotesk                        |
| Stamp              | Status only — never decorative                                                         |
| Kos scope          | Every DB query must filter rumah_id                                                    |
| Business logic     | In NestJS service / React Query — never in components                                  |
| Fine display       | Always visible at decision points (checklist, bill card)                               |
| Photo flow         | Before → checklist → After — linear                                                    |
| Schedule           | Weekday Sen/Rab/Jum; Sel+Kamis off                                                     |
| No back-to-back    | One person never 2 consecutive days                                                    |
| Role               | Admin (PJ) = edit costs, manage members, reset invite, approve/reject, confirm payment |
| Onboarding         | Required: profile → create/join rumah before accessing the main app                    |
| Data source        | PostgreSQL/Prisma via NestJS — RN app never accesses DB directly                       |
| Anti-hallucination | Unlocked TBC → stop & ask; never invent scope                                          |

---

# Final Rule

If documentation conflicts with implementation — **documentation wins**.
Update code to match the documentation.
Never update implementation without updating documentation first.

Design is the source of truth for appearance. Always reference `context/designs/Serumah.html` before building UI for a new phase.
