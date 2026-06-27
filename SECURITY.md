# SECURITY.md

> Rules and standards. Violations should be caught in code review.

## Authentication

- Passwords hashed with **bcrypt (rounds: 12)**. Never store plaintext; never log hashes.
- **JWT access tokens** expire in **15 minutes**. Issued claims: `sub` (userId), `role`, `iat`, `exp`.
- **JWT refresh tokens** expire in **30 days**. Stored in `httpOnly` cookies, not `localStorage`. (Week 1–2 stores them in Pinia state to keep the SPA simple; the production hardening step moves them to cookies — tracked in `docs/exec-plans/tech-debt-tracker.md`.)
- On password reset, **invalidate all existing tokens** for the user.

## OTP

- **6 digits**, generated with `crypto.randomInt(0, 1_000_000)` (uniform, no modulo bias).
- **10-minute expiry** from creation.
- **Single use** — `otps.used = true` on first successful verify.
- **Brute-force protection:** max **5 attempts** per OTP, then a **15-minute lockout** on the phone number. Resend invalidates prior codes.
- **Rate limit:** max **3 resends per 30 minutes** per phone.
- **Rate limit (HTTP):** max **10 requests per minute per IP** on all `/api/v1/auth/*` endpoints.

## Phone Numbers

- ALWAYS stored in **E.164** format: `+260977123456`.
- Validated with `libphonenumber-js` on the way in. Reject anything that doesn't parse to a valid E.164 for the supplied country.
- **No** phone number ever leaves the system without its country code.

## Data Validation

- Every route has a **Zod** validator that calls `.strict()` or `.strip()` to reject unknown fields.
- SQL injection is impossible — all queries go through Prisma, which uses parameterised statements.
- Cross-tenant data leakage is prevented by **group isolation** (see `ARCHITECTURE.md`).

## File Uploads

- **Allowed MIME types:** `image/jpeg`, `image/png`, `application/pdf`. Validated server-side from the actual file buffer (not just the extension or `Content-Type` header).
- **Max size:** 10 MB. Enforced both in the upload route and at the proxy level.
- Files go **directly to S3** via presigned URLs. They are never written to the application server's disk.
- The S3 bucket has a **private** ACL. Reads happen via presigned GET URLs with a short TTL.

## Authorization

- `requireAuth` middleware verifies the access JWT and attaches `req.user = { id, role }`.
- `requireRole('super_admin' | 'owner' | 'treasurer' | 'member')` is applied per route.
- Admin routes require `role === 'super_admin'` checked server-side (not just hidden in the SPA).
- Group-scoped routes (Week 3+) require an additional `requireGroupRole(groupId, roles[])` middleware that:
  1. Looks up the user's `groupMember` row for that group
  2. Confirms `status === 'active'`
  3. Confirms the role is in the allowed list
  4. Attaches `req.groupMembership` for the service to use

## CORS, Headers, TLS

- **CORS:** whitelist only the app domain in production. In dev, `http://localhost:5173` is allowed.
- **Helmet** is enabled in `app.ts` for all standard security headers.
- **HTTPS** is terminated at the proxy in production. The API itself serves HTTP inside the container.

## What NEVER Goes in API Responses

- Password hashes
- OTP codes (current or historical)
- Raw refresh tokens
- Internal stack traces (use a server-side logger instead — `pino`)
- Other users' phone numbers (unless they're a group member of yours and the route is in the group context)

## Money and Concurrency

- All financial writes happen inside **Prisma `$transaction`** blocks.
- All monetary arithmetic happens in **BigInt**. The API boundary casts to `Number` for display only.
- Idempotency keys are not required in Week 1–2 (no money moves yet) but are planned for Week 3+ (invoices, POPs, group creation).

## Incident Response

- `whatsapp_logs` records every Evolution API call with response and status. This is the primary tool for diagnosing message delivery issues.
- Failed WhatsApp jobs that exceed 3 retries are flagged for admin review. An alert (in Phase 2) will be sent if failure rate exceeds 5%.
- All errors are logged via `pino` with `requestId` correlation. The frontend surfaces user-friendly messages and never leaks server error details.
