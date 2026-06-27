# AGENTS.md

> **Start here.** This file is the entry point for any AI agent (or human) working on Chilimba.

## Project: Chilimba

Chilimba is a SaaS platform for managing rotating savings groups (Chilimba / ROSCA / Village Banking) in Zambia. The full product plan lives at `../chilimba-full-plan.md` — read it before doing anything substantial. This `AGENTS.md` is the condensed agent-facing version.

## Stack

- **Backend:** Node.js 24 + TypeScript + Express + Prisma + PostgreSQL 15
- **Frontend:** Vue 3 + Vite + TypeScript + Pinia + Vue Router + Axios + Tailwind
- **Queue:** BullMQ + Redis 7
- **Auth:** JWT (access 15m / refresh 30d) + bcrypt (rounds 12)
- **WhatsApp:** Evolution API v2.x (REST, self-hosted)
- **File storage:** S3-compatible (MinIO locally)
- **Tests:** Jest + Supertest (backend)
- **Deployment:** Docker + (later) Railway / Render

## How to Run

```bash
# infra
docker compose up -d

# backend
cd backend
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev          # http://localhost:4000

# frontend (separate terminal)
cd frontend
npm install
npm run dev          # http://localhost:5173

# tests
cd backend && npm test
```

## Hard Rules (every agent MUST follow)

1. **Phone numbers** are ALWAYS stored with country code: `+260977123456`. Validate via `lib/phone.ts` (`libphonenumber-js`). Reject anything that doesn't parse to E.164.
2. **OTP verified = true is required** before a user can access any group. `requireAuth` enforces this; do not bypass it.
3. **A group cannot be created without a paid invoice** (`status = 'paid'`). Enforce in the group creation service.
4. **Group isolation** — every query that touches group data MUST be scoped by `groupId` taken from verified membership, not from a request param. See `docs/design-docs/core-beliefs.md`.
5. **Money is BigInt ngwe** (smallest currency unit). NEVER use `Float`/`Double`/`number` for monetary values. Every monetary column in `schema.prisma` is `BigInt @default(0)`.
6. **Service layer between routes and DB** — no `prisma.*` calls in `*.routes.ts` files. All DB access goes through `*.service.ts` modules.
7. **Every new feature needs:** migration → service → route → validator → test. Don't ship any of the five without the others.
8. **WhatsApp messages are queued** — never call Evolution API inline. Use `sendWhatsApp(phone, message)` from `lib/whatsapp.ts` (which enqueues a BullMQ job). The worker (`workers/notification.worker.ts`) calls Evolution and logs to `whatsapp_logs`.
9. **All timestamps are UTC.** Prisma `@default(now())` returns UTC. Never call `new Date()` for storage without `.toISOString()`.
10. **Reject unknown fields** in all Zod validators (`.strict()` or `.strip()`). Never silently accept extra input.
11. **CORS** — only the app domain in production. Dev: `http://localhost:5173`.
12. **Rate limit** all auth routes: 10 req/min per IP.

## Patterns

- **Routes** live at `/api/v1/{resource}` (e.g. `/api/v1/auth/signup`).
- **Auth middleware** — `requireAuth`, `requireRole('owner' | 'treasurer' | 'member' | 'super_admin')`.
- **Validation** — one Zod schema per endpoint, in `*.validators.ts` co-located with the module.
- **Error handling** — central `errorHandler` in `src/middleware/errorHandler.ts` formats everything to `{success:false, error:{code, message}}`. Throw typed errors from `src/lib/errors.ts` (`AppError`, `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`).
- **Tests** — Jest + Supertest for routes; pure unit tests for services. Target ≥ 80% coverage on services.

## What NOT To Do

- ❌ Do not hardcode any group rules (contribution amounts, payout counts, cycle lengths) — every group reads from `group_settings`.
- ❌ Do not expose other groups' data in any API response — always scope by verified `groupId`.
- ❌ Do not send WhatsApp messages synchronously from a request handler — always queue.
- ❌ Do not store phone numbers without country code.
- ❌ Do not skip OTP verification in any auth flow.
- ❌ Do not use `Float` for money anywhere — including in transit (cast to BigInt at the boundary).
- ❌ Do not call `prisma.*` from route files.

## Repo Conventions

- `backend/src/modules/<name>/` — one folder per domain module
  - `<name>.routes.ts` — Express router, no business logic
  - `<name>.service.ts` — all business logic, no req/res
  - `<name>.validators.ts` — Zod schemas
  - `<name>.test.ts` — Jest tests
- `frontend/src/pages/<Name>.vue` — PascalCase route components
- `frontend/src/stores/<name>.ts` — Pinia stores
- `frontend/src/api/<name>.ts` — typed API clients
- All monorepo-wide docs in `docs/`. Feature specs in `docs/product-specs/`.

## Verifying Your Work

Before opening a PR or reporting "done":

```bash
# backend
cd backend
npm run lint          # 0 errors
npm run build         # 0 TS errors
npm test              # all green
grep -r "Float" src/  # empty (money rule)
grep -r "prisma\." src/modules/*/  # empty in routes files only
# full stack health
curl http://localhost:4000/health  # {success:true,data:{services:{db,redis,s3:"ok"}}}
```

## Where To Go Next

- **Building a feature?** Read the matching file in `docs/product-specs/` first.
- **Modifying the schema?** Read `docs/design-docs/data-model.md` and the relevant `docs/product-specs/*.md`. Money = BigInt.
- **Touching auth?** Read `docs/design-docs/auth-design.md`.
- **Picking up the next planned task?** Read `docs/exec-plans/active/phase-1-mvp.md`.
- **Closing out a task?** Update the active plan and (if it's a milestone) move a copy to `docs/exec-plans/completed/`.

## Communication

When you finish a piece of work, leave a short note in the relevant `docs/exec-plans/active/phase-1-mvp.md` checkbox (`- [x]` + a one-line summary if it was non-obvious). Major decisions go in `docs/PRODUCT_SENSE.md` (one level up) or in the matching `design-docs/*.md`.
