# Core Beliefs

The principles the codebase is built on. If a change violates one of these, change the principle (with discussion), not the rule.

## 1. Money is BigInt, always

Every monetary value in the database, in transit, and in computation is `BigInt` in the smallest currency unit (ngwe). No exceptions. `Float`/`Double`/`Number` for money is a bug.

## 2. Group isolation is a server-side guarantee

The frontend is not trusted to hide data. The backend enforces that every query touching group data is scoped by a `groupId` taken from the authenticated user's verified group membership, never from a request parameter.

## 3. WhatsApp is a queued system, not a synchronous one

The request handler that wants to send a WhatsApp message returns to the user immediately after enqueuing a job. The worker handles delivery, retries, and logging.

## 4. OTP is a real phone-number proof

A user with `otp_verified = false` cannot access any group. The OTP step is a real verification, not a UX ceremony — it proves the phone is reachable on WhatsApp, which is the channel we'll use for every group notification.

## 5. Money never leaves the service layer untyped

Routes don't compute. Services don't speak HTTP. Database writes don't go through the route handler. Every line that touches money or membership lives in `*.service.ts` and is unit-tested.

## 6. Money needs an invoice to exist

Groups are born from paid invoices. This makes the platform a SaaS and gives the operator a customer-support handle for every group.

## 7. Settings are data, not code

Contribution amounts, payout counts, grace periods, loan terms — all of it lives in `group_settings`. The codebase has no `if (group === 'foo')` branches. If a group has unusual rules, the rules live in its settings row.

## 8. Errors are typed

The service layer throws `AppError` and its subclasses. The route layer doesn't catch and rewrap. The error handler at the bottom of the middleware stack formats the response.

## 9. Logs are structured

Every log line is JSON with a `requestId`. The `requestId` is propagated to the frontend as `X-Request-Id` and surfaces in support tickets.

## 10. Schema migrations are forever

A migration that ran in production is a fact. We don't rewrite history. New migrations are forward-compatible: nullable columns, additive tables, no destructive renames without a parallel-write strategy.
