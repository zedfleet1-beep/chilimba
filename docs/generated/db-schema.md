# DB Schema (auto-generated stub)

This file is a placeholder. The Prisma schema is the source of truth at `backend/prisma/schema.prisma`. To regenerate this doc:

```bash
cd backend
npx prisma generate
# then run the planned `npx prisma-docs-generator` (not yet wired up)
```

## Phase 1 tables

| Table | Purpose |
|---|---|
| `users` | User accounts with phone (E.164), email, password hash, OTP verified flag, role, status |
| `otps` | Time-limited verification codes (single-use, 10-min expiry, 5-attempt lockout) |
| `invoices` | SaaS billing rows (pending → paid/cancelled) |
| `payment_proofs` | POP uploads linked to invoices (pending → approved/rejected) |
| `groups` | A Chilimba group (1:1 with paid invoice via `invoiceId UNIQUE`) |
| `group_settings` | The rule book for a group (contribution amount, payout method, etc.) |
| `group_members` | A user joined to a group with a role and payout position |
| `cycles` | A savings cycle within a group (`@@unique([groupId, cycleNumber])`) |
| `cycle_rounds` | Individual rounds inside a cycle with `dueDate` |
| `cycle_payouts` | Who got paid in a round, and how much |
| `contributions` | Every contribution event (pending/paid/late/waived) |
| `notifications` | One row per outbound message intent |
| `whatsapp_logs` | One row per Evolution API call attempt (with response) |

## Money columns

All monetary columns are `BigInt @default(0)` in the smallest currency unit (ngwe). See `docs/design-docs/data-model.md` for the full rule.
