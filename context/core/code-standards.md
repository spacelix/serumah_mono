# Code Standards

Code standards for React Native (Expo) + NestJS. Follow in every session without exception.

---

## Engineering Mindset

- **Think before implementing** — understand the feature and why before writing code.
- **Read context files first** — verify against `architecture/data-model.md` and `features/<feature>/context.md`.
- **Scope is sacred** — only build what the current feature requires.
- **Clean over clever** — readable code a junior can understand over clever abstractions.
- **One thing at a time** — complete one feature fully before the next.
- **Every feature must be testable** — immediately visible/verifiable.

---

## TypeScript (general)

- Strict mode. `any` forbidden except at data-migration edges (allowed, but add `// TODO(any): ...`).
- Use `interface` for objects/DTOs, `type` for unions/utilities.
- All function parameters and return types explicitly typed.
- `as` casts only after valid narrowing/guard — no blind `as`.
- Enums for fixed value sets (status), `const` for constant values.
- Explicit error handling — never assume success.
- File naming: `kebab-case` for files, `PascalCase` for components/classes, `camelCase` for functions/variables.

---

## NestJS

### Module structure

```
src/
├── main.ts                    → bootstrap, global prefix 'api', ValidationPipe, CORS
├── app.module.ts              → root module + config
├── common/
│   ├── guards/jwt-auth.guard.ts
│   ├── decorators/current-user.decorator.ts
│   ├── decorators/roles.decorator.ts
│   ├── filters/http-exception.filter.ts   → Indonesian messages, never stack traces
│   └── dto/ (shared DTO, pagination, etc.)
└── modules/
    └── <feature>/
        ├── <feature>.module.ts
        ├── <feature>.controller.ts      → REST endpoints, DTO validation
        ├── <feature>.service.ts         → business logic (server-side validation)
        ├── <feature>.repository.ts      → Prisma access (optional; service may use Prisma directly)
        ├── dto/                         → create/update/query DTO + validators
        └── <feature>.spec.ts            → unit tests
```

### Service/controller rules

- **Controllers are thin**: only parse the request + delegate to the service. No business logic.
- **Services own business logic**: status transitions, split calculations, role validation, `rumah_id` scoping.
- **All sensitive mutations are validated server-side** — never trust client-provided status/role.
- **Never trust the client**: use `@CurrentUser()` (from JWT) for identity, not the body.
- Room scope: verify the requesting member is part of the `rumah_id` being accessed.
- Log errors with the `[ServiceName]` prefix.
- Exceptions: `NotFoundException`, `BadRequestException`, `ForbiddenException`, `ConflictException` — with Indonesian messages.

### DTO & validation

- Always use `class-validator` (`class-transformer` in `main.ts` via `ValidationPipe({ whitelist: true, transform: true })`).
- One DTO per action: `CreateXDto`, `UpdateXDto`, `QueryXDto`.
- Validation messages in Indonesian (`@IsNotEmpty({ message: 'Nama wajib diisi' })`).

### Cron

- `@Cron(CronExpression.EVERY_DAY_AT_10PM)` from `@nestjs/schedule`.
- Auto-fine piket: daily 22:00 (skip Sel/Kamis).
- Weekend freeze: Friday 20:00.

### Prisma

- Access via `PrismaService` (global module from `packages/db`).
- All queries filter `rumah_id` — never without scope.
- Use the generated Prisma Client — no raw SQL in services.

---

## React Native (Expo)

### Structure

```
apps/mobile/src/
├── app/                       → Expo Router (file-based routing)
│   ├── _layout.tsx            → root layout (auth gate)
│   ├── (tabs)/_layout.tsx     → 4-tab shell
│   │   ├── index.tsx          → Beranda
│   │   ├── piket.tsx
│   │   ├── tagihan.tsx
│   │   └── swap.tsx
│   ├── login.tsx / register.tsx
│   └── onboarding/            → profile, create-rumah, join-rumah
├── components/                → shared components (Stamp, BillCard, etc.)
├── features/<feature>/
│   ├── api/                   → React Query hooks + fetchers
│   ├── types/                 → TS types for this feature
│   └── components/            → feature-specific components
├── stores/                    → Zustand stores (authStore, uiStore)
├── lib/                       → api client, storage, format (currency/date)
└── theme/                     → colors, typography, spacing from ui-tokens.md
```

### State management

- **React Query** for server state: fetch, cache, invalidate, mutation.
  - `useQuery` for reads, `useMutation` for writes, `queryClient.invalidateQueries` after mutations.
  - All fetchers call the NestJS API via `lib/apiClient` — no scattered fetch calls.
- **Zustand** for auth state + local UI state (open bottom sheet, selected month, etc.).
- Forbidden: Redux (unless explicitly decided), business logic in components.

### React Query patterns

```ts
// Read
const { data, isLoading } = useQuery({
  queryKey: ['jadwal', 'minggu', mondayISO],
  queryFn: () => getWeek(mondayISO),
});

// Mutation → invalidate
const { mutate, isPending } = useMutation({
  mutationFn: submitPiket,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['piket'] }),
});
```

- `queryKey` lowercase, consistent, scoped to entity + parameters.
- Optimistic update only when the user feels latency; otherwise use pending state.

### Auth & navigation gate

- `authStore` (Zustand) holds user + token (from the JWT login response).
- Root `_layout.tsx` redirects based on: authenticated? → has profile? → has rumah? → tabs.
- Token stored via `expo-secure-store` (not AsyncStorage for tokens).

### Styling

- Always use tokens from `theme/` — no inline hex.
- StyleSheet.create or one consistent styled system — one approach, not mixed.
- Money amounts: mono font + `id_ID` format.

---

## API Client

```ts
// lib/apiClient.ts
const apiClient = axios.create({ baseURL: process.env.EXPO_PUBLIC_API_URL });
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const message =
      err.response?.data?.message ?? 'Terjadi kesalahan. Coba lagi.';
    return Promise.reject(new Error(message)); // Indonesian message
  },
);
```

- All errors mapped to human-readable Indonesian messages.
- 401 → auto logout + redirect to login.

---

## Error Handling

- RN: UI errors via SnackBar/Alert with Indonesian messages.
- NestJS: exception filter converts errors → `{ statusCode, message }` in Indonesian. Never stack traces to the client.
- Services log with the `[ServiceName]` prefix.
- Never use empty catch.

---

## Photos & Storage

- Before upload: resize/compress (max 1920px on the longest edge, JPEG quality ~85).
- Upload via NestJS `/storage` endpoint → MinIO. Public URL saved in the DB column.
- Paths (see `AGENTS.md` → Storage).
- Display photos via public URL + caching (expo-image or Image with cache).

---

## Dependencies

Do not install new packages without updating this list.

**Monorepo (root):** `typescript`, `turborepo`, `prettier`, `eslint`.

**apps/api:** `@nestjs/core|common|platform-express`, `@nestjs/config`, `@nestjs/jwt`, `@nestjs/passport`, `@nestjs/schedule`, `passport` + `passport-jwt`, `bcrypt`, `class-validator`, `class-transformer`, `prisma`/`@prisma/client` (via packages/db), `minio` (or `@aws-sdk/client-s3` if moving), `multer` + `multer-s3`.

**apps/mobile:** `expo`, `expo-router`, `react-native-safe-area-context`, `@tanstack/react-query`, `zustand`, `axios`, `expo-image-picker`, `expo-image`, `expo-secure-store`, `lucide-react-native`, `expo-updates` (if using EAS Update), `expo-file-system`, `expo-constants`, `expo-document-picker`.

**packages/db:** `prisma`, `@prisma/client`.

---

## Naming & Conventions

- Feature folders: `kebab-case`.
- Component files: `PascalCase.tsx`. Util/hook files: `camelCase.ts`.
- One responsibility per file.
- TypeScript strict in all apps.

---

## Comments

- No comments explaining "what" — code must be self-documenting.
- Comments only for "why" — non-obvious decisions.
- No committed `// TODO` without tracking.
