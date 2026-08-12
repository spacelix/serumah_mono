# AGENTS Routing — Feature → Context Map

Read this file **first** before working on any feature. It determines which context is relevant and which is **forbidden** to read.

---

## Standard reading flow

```
core/AGENTS-ROUTING.md      ← this file (find your feature)
core/ui-tokens.md           ← always (if touching UI)
core/ui-rules.md            ← always (if touching UI)
core/code-standards.md      ← always (RN + NestJS conventions)
architecture/data-model.md  ← if the feature uses the DB
features/<feature>/context.md ← ONLY the feature you are working on
progress/progress-tracker.md← build status
designs/Serumah.html        ← visual prototype (open in browser)
```

---

## Feature → context file map

| Feature    | Context file                     | Scope                                                                         |
| ---------- | -------------------------------- | ----------------------------------------------------------------------------- |
| Auth       | `features/auth/context.md`       | Register, login, JWT, logout, session                                         |
| Onboarding | `features/onboarding/context.md` | Profile setup, create rumah, join rumah (invite code)                         |
| Dashboard  | `features/dashboard/context.md`  | Beranda: weekend toggle, galon widget, billing summary, schedule list         |
| Schedule   | `features/schedule/context.md`   | Round-robin weekday, dynamic weekend, no back-to-back, freeze, auto-fine      |
| Piket      | `features/piket/context.md`      | Daily execution: per-room before→checklist→after, submit                      |
| Verifikasi | `features/verifikasi/context.md` | PJ approval per submission, reject → flat fine                                |
| Denda      | `features/denda/context.md`      | QRIS payment, proof upload, PJ confirmation, PJ auto-paid                     |
| Iuran      | `features/iuran/context.md`      | Monthly iuran: total cost auto-split, payment proof, confirmation, pelunasan  |
| Listrik    | `features/listrik/context.md`    | Extra electricity self-record, next-month adjustment                          |
| Swap       | `features/swap/context.md`       | All-or-nothing full day swap                                                  |
| Galon      | `features/galon/context.md`      | Galon rotation + "Sudah Beli" (no reimbursement)                              |
| Profile    | `features/profile/context.md`    | View/edit name, photo, emergency contact, address                             |
| Rumah      | `features/rumah/context.md`      | Management: members, costs, rekening, QRIS, invite code + rooms & jenis_piket |
| Notifications | `features/notifications/context.md` | FCM push: piket reminders, reviewer/approver alerts, denda weekly, iuran next-month |
| Realtime | `features/realtime/context.md` | Socket.io: swap masuk, approve/reject, galon, weekend — event → invalidate query |
| Update     | `features/update/context.md`     | In-app non-store update via GitHub Releases                                   |

---

## Routing rules

1. **Work on ONE feature at a time.** Find your feature in the table, read its context file.
2. **Do not read other feature contexts.** Other features' specs make the agent mix them up and hallucinate. Only read another file if your feature's context mentions it in the **Dependencies** section — read only what is listed.
3. **Feature not in the table** → probably not in scope. Stop & ask the user. Do not invent a new feature.
4. **Context files reference `architecture/data-model.md`** — do not copy the schema into feature files.

---

## Quick lookup from user requests

| User keyword                                                                   | Feature    |
| ------------------------------------------------------------------------------ | ---------- |
| login, register, sign up, sign in, logout                                      | auth       |
| profile setup, join, invite code, create kos, onboarding                       | onboarding |
| beranda, home, weekend, galon, billing summary, weekly schedule                | dashboard  |
| generate schedule, round-robin, senin rabu jumat, weekend schedule             | schedule   |
| piket today, photo before, checklist, submit                                   | piket      |
| verify, approve, reject                                                        | verifikasi |
| denda, fine, pay, QRIS, payment proof                                          | denda      |
| iuran, sewa, wifi, listrik wajib, pelunasan, transfer proof                    | iuran      |
| extra electricity, token listrik, buy listrik                                  | listrik    |
| swap, exchange schedule, request swap                                          | swap       |
| galon, buy galon, water refill turn                                            | galon      |
| profile, my profile, emergency contact                                         | profile    |
| manage rumah, manage kos, costs, rekening, invite, members, rooms, jenis piket | rumah      |
| notif, notification, push, FCM, reminder, pengingat                            | notifications |
| realtime, websocket, socket, live update, request masuk langsung               | realtime      |
| update, version, apk, release                                                  | update     |
