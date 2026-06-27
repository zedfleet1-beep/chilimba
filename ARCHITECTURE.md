# ARCHITECTURE.md

> Last updated: 2026-06-12 — Foundation (Week 1–2 of Phase 1)

## Overview

Chilimba is a multi-tenant SaaS for managing rotating savings groups (ROSCA / Chilimba) in Zambia. Groups are the unit of isolation — every group is a complete tenant with its own members, cycles, contributions, and WhatsApp notification stream.

The platform is delivered as:

- A **Vue 3 SPA** that talks to a single REST API
- An **Express + Prisma** API server backed by PostgreSQL
- A **BullMQ worker** (co-located with the API in dev) that delivers WhatsApp messages via Evolution API
- An **S3-compatible object store** (MinIO in dev) for proof-of-payment uploads
- An **external Evolution API** instance (run from the sibling `../evolution-api/` folder) for WhatsApp Business

## High-level Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (Vue 3 SPA)                       │
└──────────────────────────┬──────────────────────────────────┘
                           │  HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────┐
│            API Server (Express :4000)                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │  auth    │ │ groups*  │ │ cycles*  │ │ invoices*    │   │
│  │          │ │ members* │ │ contrib* │ │ admin*       │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │
│         │                                                   │
│         ▼                                                   │
│  ┌────────────────┐    ┌──────────────────────────────┐   │
│  │ Prisma Client  │    │  BullMQ Queue (notifications) │   │
│  └────────────────┘    └──────────────────────────────┘   │
└──────┬─────────────────────────┬───────────────────────────┘
       │                         │
       ▼                         ▼
 ┌───────────┐           ┌────────────────────┐
 │ PostgreSQL│           │ Notification Worker│
 │   :5432   │           │   (in-process)     │
 └───────────┘           └─────────┬──────────┘
                                  │ HTTP
                                  ▼
                          ┌──────────────────┐
                          │  Evolution API   │
                          │     :8080        │
                          └──────────────────┘

 * = not yet implemented (Week 1–2 scope is auth only)
```

## Module Boundaries

| Module | Owns | Never touches |
|---|---|---|
| `auth` | `users`, `otps`, refresh tokens | group data |
| `invoices` | `invoices`, `payment_proofs` | group internals |
| `groups` | `groups`, `group_settings`, `group_members` | invoices |
| `cycles` | `cycles`, `cycle_rounds`, `cycle_payouts` | invoices |
| `contributions` | `contributions` | cycle/round status logic |
| `notifications` | `notifications`, `whatsapp_logs` | financial data |
| `admin` | read-only views across all | (always reads, never writes except user/group suspension) |
| `loans` (Phase 3) | `loans`, `loan_repayments` | — |

## Key Data Flow: Group Creation (Phase 1, Week 3+)

```
Admin creates invoice (status='pending')
        │
        ▼
Customer uploads POP (status='pending')
        │
        ▼
Admin verifies POP → invoice.status = 'paid'
        │
        ▼
System generates signed group-creation JWT
(48h expiry, contains invoice_id)
        │
        ▼
WhatsApp: "Payment confirmed! Create your group: {link}"
        │
        ▼
Customer opens link → creates group
        │
        ▼
Group is now active, owner can add members
```

## Group Isolation Rule

Every database query that touches group data MUST include a `group_id` filter that comes from the authenticated user's verified group membership — never from a request parameter alone.

```typescript
// ❌ WRONG
const members = await prisma.groupMember.findMany({
  where: { groupId: req.params.groupId }
})

// ✅ RIGHT
const membership = await prisma.groupMember.findFirst({
  where: { userId: req.user.id, groupId: req.params.groupId }
})
if (!membership) throw new ForbiddenError()
const members = await prisma.groupMember.findMany({
  where: { groupId: membership.groupId }
})
```

The `requireRole` middleware enforces this for protected routes by requiring a verified `groupId` claim on the JWT (added in Week 3 when group-scoped tokens are introduced).

## Why This Stack

- **TypeScript everywhere** — prevents the class of bug that comes from a misspelled field name or a wrong type sneaking past review. Critical for a financial app.
- **Prisma** — type-safe queries, first-class migrations, great DX, agent-friendly schema files.
- **PostgreSQL** — ACID transactions, foreign keys, partial indexes. Mandatory for financial data.
- **BullMQ + Redis** — standard, observable job queue; we need retries with backoff for WhatsApp sends.
- **Vue 3 + Pinia** — composition API is easy to teach, Pinia stores are simple to test, and `vue-router` 4 has a clean auth-guard API.
- **Tailwind** — utility classes mean an agent can write predictable styles without inventing new ones.
- **MinIO** — S3-compatible, runs in Docker, and we can switch to real S3 in production by changing env vars.

## Money as BigInt

All monetary values are stored as `BigInt` (Postgres `BIGINT`) in the smallest currency unit (ngwe = 1/100 of a Zambian Kwacha). All arithmetic happens in BigInt space; the API boundary casts to `Number` only for display, never for computation.

```typescript
// ✅ correct: add in BigInt
const total = BigInt(100) + BigInt(200)  // 300n

// ❌ wrong: never do monetary math in JavaScript numbers
const total = 1.00 + 2.00  // 3 — but 0.1 + 0.2 = 0.30000000000000004
```

See `docs/design-docs/data-model.md` for the full schema.

## WhatsApp Delivery

All outbound WhatsApp messages go through the queue:

1. Service code calls `sendWhatsApp(phone, message)` in `lib/whatsapp.ts`.
2. A BullMQ job is added with `attempts: 3` and exponential backoff.
3. The worker (`workers/notification.worker.ts`) picks up the job.
4. Worker calls `POST ${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}` with the phone and text.
5. Result (success or failure) is recorded in `whatsapp_logs`.
6. On final failure, the message is flagged for admin review.

This pattern is mandatory — it keeps API requests fast (no blocking on WhatsApp delivery) and makes the system observable.

## Environment

- **dev** — docker-compose for postgres, redis, MinIO. Evolution API runs from `../evolution-api/`. Both API and worker run in the same Node process via `tsx watch`.
- **prod** — same images, separate hosts. BullMQ worker can be split to its own process via `npm run worker`. S3 points at real AWS. Evolution API can be a managed instance.
