# Data Model — Prisma Schema (Source of Truth)

The single source of truth for the database schema. Defined in `packages/db/prisma/schema.prisma`. Feature contexts must **not** copy the schema — they only reference the fields they use. If a new column is needed → update this file FIRST before writing code.

Database: **PostgreSQL**. ORM: **Prisma**. Enums are represented as `String` + validated in services (unless stated as `enum`).

---

## Conventions

- All primary keys: `String` (UUID, generated in the app) — `@default(uuid())`.
- `created_at`/`updated_at`: `DateTime @default(now()) @db.Timestamptz`.
- All "belongs to rumah" tables have `rumah_id` — every query must filter `rumah_id`.
- Statuses defined as `String` with fixed values (see State Machine per entity).
- Table names: `@@map("snake_case")`, models PascalCase.

---

## Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ── AUTH ──────────────────────────────────────────────────────────────
// User account (NestJS JWT auth). Anggota is 1:1 with User.
model User {
  id           String    @id @default(uuid()) @db.Uuid
  email        String    @unique
  passwordHash String    @map("password_hash")
  createdAt    DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt    DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  anggota   Anggota?
  fcmTokens FcmToken[]

  @@map("users")
}

// ── RUMAH & ANGGOTA ───────────────────────────────────────────────────
model Rumah {
  id                String   @id @default(uuid()) @db.Uuid
  nama              String
  alamat            String
  biayaKos          Int      @default(0) @map("biaya_kos")          // TOTAL/month, auto-split
  biayaWifi         Int      @default(0) @map("biaya_wifi")         // TOTAL/month
  biayaListrikWajib Int      @default(0) @map("biaya_listrik_wajib")// TOTAL/month
  nominalDenda      Int      @default(50000) @map("nominal_denda")  // flat per submission
  rekeningBank      String?  @map("rekening_bank")
  rekeningNomor     String?  @map("rekening_nomor")
  rekeningNama      String?  @map("rekening_nama")
  qrisUrl           String?  @map("qris_url")                       // QRIS for fine payment
  inviteCode        String   @unique @map("invite_code")            // 6 digit, auto-generated
  createdById       String?  @map("created_by") @db.Uuid
  createdAt         DateTime @default(now()) @map("created_at") @db.Timestamptz

  anggota        Anggota[]
  undangan       UndanganKos[]
  jadwal         Jadwal[]
  ruangan        Ruangan[]
  pelunasan      PelunasanBulanan[]
  pembayaranListrik PembayaranListrik[]
  giliranGalon   GiliranGalon[]

  @@map("rumah")
}

model Anggota {
  id           String   @id @db.Uuid            // = User.id
  rumahId      String?  @map("rumah_id") @db.Uuid
  nama         String
  fotoProfil   String?  @map("foto_profil")     // Storage URL
  kontakDarurat String? @map("kontak_darurat")
  alamat       String?
  role         String   @default("anggota")     // 'admin' | 'anggota'
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz

  user             User?      @relation(fields: [id], references: [id])
  rumah            Rumah?     @relation(fields: [rumahId], references: [id])
  jadwal           Jadwal[]
  weekendStatus    WeekendStatus[]
  submissions      PiketSubmission[]
  denda            Denda[]
  iuran            IuranBulanan[]
  pembayaranListrik PembayaranListrik[]
  giliranGalon     GiliranGalon[]
  swapDari         SwapRequest[]  @relation("SwapDari")
  swapKe           SwapRequest[]  @relation("SwapKe")

  @@index([rumahId])
  @@map("anggota")
}

model UndanganKos {
  id        String   @id @default(uuid()) @db.Uuid
  rumahId   String   @map("rumah_id") @db.Uuid
  kode      String                            // 6 digit invite code
  dibuatOleh String  @map("dibuat_oleh") @db.Uuid
  expiredAt DateTime? @map("expired_at") @db.Timestamptz
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz

  rumah Rumah @relation(fields: [rumahId], references: [id])

  @@index([kode])
  @@map("undangan_kos")
}

// ── SCHEDULE ──────────────────────────────────────────────────────────
model Jadwal {
  id       String   @id @default(uuid()) @db.Uuid
  rumahId  String   @map("rumah_id") @db.Uuid
  tanggal  DateTime @db.Date           // Senin/Rabu/Jumat (piket days)
  anggotaId String  @map("anggota_id") @db.Uuid
  ruangan  String[]                    // snapshot of room names that day, ordered by ruangan.urutan
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz

  rumah       Rumah           @relation(fields: [rumahId], references: [id])
  anggota     Anggota         @relation(fields: [anggotaId], references: [id])
  submissions PiketSubmission[]

  @@index([rumahId, tanggal])
  @@map("jadwal")
}

model WeekendStatus {
  id          String   @id @default(uuid()) @db.Uuid
  anggotaId   String   @map("anggota_id") @db.Uuid
  mingguMulai DateTime @map("minggu_mulai") @db.Date  // Monday of week
  hari        String                               // 'sabtu' | 'minggu' (drift column, see notes)
  status      String                               // 'di_kos' | 'pulang'

  anggota Anggota @relation(fields: [anggotaId], references: [id])

  @@unique([anggotaId, mingguMulai, hari])
  @@map("weekend_status")
}

// ── RUANGAN & JENIS PIKET ─────────────────────────────────────────────
model Ruangan {
  id      String   @id @default(uuid()) @db.Uuid
  rumahId String   @map("rumah_id") @db.Uuid
  nama    String
  urutan  Int      @default(0)          // display order
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz

  rumah      Rumah       @relation(fields: [rumahId], references: [id])
  jenisPiket JenisPiket[]
  proofs     RuanganProof[]

  @@index([rumahId, urutan])
  @@map("ruangan")
}

model JenisPiket {
  id        String   @id @default(uuid()) @db.Uuid
  ruanganId String   @map("ruangan_id") @db.Uuid
  nama      String
  isActive  Boolean  @default(true) @map("is_active")

  ruangan Ruangan @relation(fields: [ruanganId], references: [id])

  @@index([ruanganId])
  @@map("jenis_piket")
}

// ── PIKET EXECUTION ───────────────────────────────────────────────────
model PiketSubmission {
  id          String    @id @default(uuid()) @db.Uuid
  jadwalId    String    @map("jadwal_id") @db.Uuid
  anggotaId   String    @map("anggota_id") @db.Uuid
  status      String    @default("menunggu") // 'menunggu' | 'approved' | 'rejected' | 'bolong'
  submittedAt DateTime? @map("submitted_at") @db.Timestamptz
  reviewerId  String?   @map("reviewer_id") @db.Uuid // assigned reviewer (PJ for member subs; round-robin member for PJ subs)

  jadwal    Jadwal         @relation(fields: [jadwalId], references: [id])
  anggota   Anggota        @relation(fields: [anggotaId], references: [id])
  proofs    RuanganProof[]
  approvals PiketApproval[]
  denda     Denda[]

  @@index([jadwalId])
  @@map("piket_submissions")
}

model RuanganProof {
  id           String   @id @default(uuid()) @db.Uuid
  submissionId String   @map("submission_id") @db.Uuid
  ruanganId    String   @map("ruangan_id") @db.Uuid
  fotoBefore   String?  @map("foto_before")   // Storage URL
  fotoAfter    String?  @map("foto_after")    // Storage URL
  jenisSelesai String[] @map("jenis_selesai") // completed jenis_piket names

  submission PiketSubmission @relation(fields: [submissionId], references: [id])
  ruangan    Ruangan         @relation(fields: [ruanganId], references: [id])

  @@unique([submissionId, ruanganId])
  @@map("ruangan_proof")
}

model PiketApproval {
  id           String   @id @default(uuid()) @db.Uuid
  submissionId String   @map("submission_id") @db.Uuid
  status       String                         // 'approved' | 'rejected'
  reviewerId   String   @map("reviewer_id") @db.Uuid
  reviewedAt   DateTime @default(now()) @map("reviewed_at") @db.Timestamptz

  submission PiketSubmission @relation(fields: [submissionId], references: [id])

  @@index([submissionId])
  @@map("piket_approval")
}

// ── FINES (DENDA) & PAYMENT ───────────────────────────────────────────
model Denda {
  id             String    @id @default(uuid()) @db.Uuid
  anggotaId      String    @map("anggota_id") @db.Uuid
  submissionId   String?   @map("submission_id") @db.Uuid
  nominal        Int                                // flat from rumah.nominal_denda
  status         String    @default("belum_bayar")  // 'belum_bayar' | 'menunggu_konfirmasi' | 'lunas'
  bayarKeAnggotaId String? @map("bayar_ke_anggota_id") @db.Uuid  // PJ recipient
  buktiBayar     String?   @map("bukti_bayar")      // Storage URL payment proof
  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz

  anggota      Anggota             @relation(fields: [anggotaId], references: [id])
  submission   PiketSubmission?    @relation(fields: [submissionId], references: [id])
  pembayaranApproval PembayaranApproval[]

  @@index([anggotaId])
  @@map("denda")
}

model PembayaranApproval {
  id         String   @id @default(uuid()) @db.Uuid
  dendaId    String   @map("denda_id") @db.Uuid
  approverId String   @map("approver_id") @db.Uuid
  status     String                         // 'approved' | 'rejected'
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz

  denda Denda @relation(fields: [dendaId], references: [id])

  @@index([dendaId])
  @@map("pembayaran_approval")
}

// ── IURAN & LISTRIK ───────────────────────────────────────────────────
model IuranBulanan {
  id        String   @id @default(uuid()) @db.Uuid
  anggotaId String   @map("anggota_id") @db.Uuid
  bulan     DateTime @db.Date              // first of month
  kategori  String                         // 'sewa' | 'wifi' | 'listrik_wajib' (not listrik_tambahan)
  label     String                         // display label
  nominal   Int                            // auto-split total/n + listrik adjustment
  status    String   @default("belum_bayar") // 'belum_bayar' | 'menunggu_konfirmasi' | 'lunas'
  buktiBayar String? @map("bukti_bayar")   // Storage URL
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz

  anggota Anggota @relation(fields: [anggotaId], references: [id])

  @@unique([anggotaId, bulan, kategori])
  @@index([bulan])
  @@map("iuran_bulanan")
}

model PelunasanBulanan {
  id         String   @id @default(uuid()) @db.Uuid
  rumahId    String   @map("rumah_id") @db.Uuid
  bulan      DateTime @db.Date           // first of month
  kategori   String                      // 'sewa' | 'wifi' | 'listrik_wajib'
  buktiLunas String   @map("bukti_lunas") // PJ proof total paid to pemilik kos
  createdById String  @map("created_by") @db.Uuid
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz

  rumah Rumah @relation(fields: [rumahId], references: [id])

  @@unique([rumahId, bulan, kategori])
  @@map("pelunasan_bulanan")
}

model PembayaranListrik {
  id         String   @id @default(uuid()) @db.Uuid
  rumahId    String   @map("rumah_id") @db.Uuid
  anggotaId  String   @map("anggota_id") @db.Uuid
  bulan      DateTime @db.Date          // month of purchase
  nominal    Int                        // token/pulsa
  buktiBayar String?  @map("bukti_bayar") // Storage URL
  keterangan String?
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz

  rumah   Rumah   @relation(fields: [rumahId], references: [id])
  anggota Anggota @relation(fields: [anggotaId], references: [id])

  @@index([rumahId, bulan])
  @@map("pembayaran_listrik")
}

// ── SWAP & GALON ──────────────────────────────────────────────────────
model SwapRequest {
  id          String   @id @default(uuid()) @db.Uuid
  dariAnggotaId String @map("dari_anggota_id") @db.Uuid
  keAnggotaId   String @map("ke_anggota_id") @db.Uuid
  tanggal     DateTime @db.Date          // day being swapped
  status      String   @default("diajukan") // 'diajukan' | 'diterima' | 'ditolak'
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz

  dari Anggota @relation("SwapDari", fields: [dariAnggotaId], references: [id])
  ke   Anggota @relation("SwapKe", fields: [keAnggotaId], references: [id])

  @@index([keAnggotaId])
  @@map("swap_requests")
}

model GiliranGalon {
  id          String    @id @default(uuid()) @db.Uuid
  rumahId     String    @map("rumah_id") @db.Uuid
  anggotaId   String    @map("anggota_id") @db.Uuid
  periodeMulai DateTime @map("periode_mulai") @db.Date
  status      String    @default("menunggu") // 'menunggu' | 'sudah_dibeli'
  confirmedAt DateTime? @map("confirmed_at") @db.Timestamptz

  rumah   Rumah   @relation(fields: [rumahId], references: [id])
  anggota Anggota @relation(fields: [anggotaId], references: [id])

  @@map("giliran_galon")
}

// ── OBSERVABILITY / LOG VIEWER ───────────────────────────────────────────
// Infra/audit table for the log viewer — NOT rumah-scoped (exception to the
// "every query filters rumah_id" invariant). One row per HTTP request, written
// by the global LoggerInterceptor in apps/api.
model LogEntry {
  id           BigInt   @id @default(autoincrement())
  timestamp    DateTime @default(now()) @db.Timestamptz
  method       String
  path         String
  statusCode   Int
  durationMs   Int
  userId       String?  @db.Uuid   // JWT user id when the route was authenticated
  ip           String?
  isError      Boolean             // derived: statusCode >= 400
  errorMessage String?  @map("error_message") // snippet, captured only when statusCode >= 400

  @@index([timestamp])
  @@index([isError])
  @@map("log_entries")
}

// ── NOTIFICATIONS ─────────────────────────────────────────────────────
model FcmToken {
  id        String   @id @default(uuid()) @db.Uuid
  anggotaId String   @map("anggota_id") @db.Uuid
  token     String
  platform  String                       // 'android' | 'ios'
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz

  user User @relation(fields: [anggotaId], references: [id])

  @@unique([token])
  @@map("fcm_tokens")
}
```

---

## State Machines

| Entity            | Transition                                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PiketSubmission   | `menunggu` → `approved` \| `rejected` (→ flat fine) \| `bolong` (auto, no submit)                                                                             |
| Denda             | `belum_bayar` → (upload proof) `menunggu_konfirmasi` → (PJ approve) `lunas`; reject → `belum_bayar`. **PJ/Admin's own fine → proof upload directly `lunas`.** |
| IuranBulanan      | `belum_bayar` → (upload total proof) `menunggu_konfirmasi` → (PJ confirm) `lunas`. **PJ/Admin → directly `lunas`.**                                           |
| PembayaranListrik | No status — self-record recorded immediately.                                                                                                                 |
| SwapRequest       | `diajukan` → `diterima` (schedule moves) \| `ditolak` (stays).                                                                                                |
| GiliranGalon      | `menunggu` → `sudah_dibeli` → rotate to next member. No nominal/reimbursement.                                                                                |

---

## Drift Notes & Schema Decisions

1. **New `users` table** — replaces Supabase `auth.users`. `anggota.id` = `users.id` (1:1). bcrypt password.
2. **`weekend_status.hari`** — drift column from the live DB (`sabtu`/`minggu`, UNIQUE anggota+week+day). Preserved.
3. **`piket_approval` WITHOUT `jenis_piket_id`** — one approval row per submission (all-or-nothing).
4. **Fine flat per submission** — amount from `rumah.nominal_denda`, not per jenis_piket.
5. **`giliran_galon` without `nominal`** — reimbursement column removed (locked decision item 25).
6. **`iuran_bulanan` without `bayar_ke_anggota_id`** — paid to the kos rekening; `bukti_bayar` per user (1 total proof per month). Categories only `sewa`/`wifi`/`listrik_wajib`.
7. **All sensitive mutations via NestJS services** (replaces SECURITY DEFINER RPC) — role + status validation in service, not client.
8. **`anggota.kamar` removed** — no room number on the member profile. A person can be responsible for more than one room; which rooms to clean is decided via `Ruangan`/`JenisPiket` (schedule), not a profile field.
9. **`log_entries` is NOT rumah-scoped** — it's an infra/audit table for the log viewer (`features/logviewer`). Exception to the "every query filters `rumah_id`" invariant; no `rumah_id` column by design.

---

## Log Viewer Access (Locked 2026-08-07)

- Served by `apps/api` at `GET /admin` (+ `/admin/stats`, `/admin/logs`), **fully public — no login** (`@Public()`). User-accepted risk: anyone knowing the URL can view log/stats data.
- **Pipeline:** global `LoggerInterceptor` buffers each request (`RPUSH log:buffer`, Redis list, microseconds) → **BullMQ repeatable job** flushes every 5 min (`LRANGE` + `DEL`, `createMany` bulk) → `log_entries`. Excludes `/api/health`, `/api/update/manifest`, `/admin`. The same Redis also serves the referential Beranda/Profile **read-cache** (`cache:{scope}:{resource}`, TTL ~60s, invalidated on related mutations). No retention/cleanup in MVP.

---

## Data Invariants

- Every DB query filters `rumah_id` (except auth tables).
- Iuran auto-split: `floor(total/n)` + remainder rotated between members per month.
- Extra electricity: adjust current-month `listrik_wajib` from previous month's records (buyer credit / non-buyer +split, floor per record, clamp ≥ 0).
- Invite code: 6 digits, unique per rumah, admin can reset.
- Admin check (`role='admin'`) validated server-side for: edit costs, manage members, reset invite code, approve/reject piket, confirm payments, upload QRIS, upload pelunasan.
