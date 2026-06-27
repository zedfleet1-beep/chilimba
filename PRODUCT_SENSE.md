# PRODUCT_SENSE.md

> Why the platform is shaped the way it is. Read this before changing product behaviour.

## Why invoice-first before group creation?

Chilimba is a SaaS product. Groups only exist after payment. This also means the operator has a record of every group before it exists, making customer support and billing simpler. The flow is:

`admin creates invoice → customer pays → admin verifies POP → customer opens signed link → group is born`

Without this, we'd have to support groups that may never pay, with a much messier "trial" / "expired" lifecycle.

## Why WhatsApp instead of SMS?

Zambia has very high WhatsApp penetration. The Evolution API gives essentially free messaging via WhatsApp Business, whereas SMS has per-message costs and lower read rates. OTP via WhatsApp also validates the phone number is active and WhatsApp-connected — which is exactly the channel we'll use for all group notifications, so confirming it at signup is doubly useful.

## Why rule-based groups instead of fixed templates?

Two real groups in our research had completely different rules: one did rotating cash payouts to 2 members/month, another did grocery savings with loans and interest. A hardcoded template would break for any group with slightly different rules. Rule-based config means the app works for any Chilimba variant without code changes.

The `group_settings` table is the rule book for a specific group. The defaults come from a template (rotating_cash, grocery, custom) at creation time, and the owner can change every setting afterward.

## Why store money as integers (ngwe)?

Floating point arithmetic is unreliable for currency. K1,020 is stored as `102000n` (ngwe). All arithmetic is done in BigInt and only formatted for display. The rule is non-negotiable — every monetary column in the Prisma schema is `BigInt @default(0)`.

If you find yourself tempted to use `Float` for money anywhere — even in transit, even in tests — stop and use BigInt.

## Why OTP before any group access?

An unverified phone number means WhatsApp messages won't reach the user. Since the whole notification system depends on WhatsApp, a user with an unverified number would silently miss all reminders — which would damage trust in the group. The `otp_verified = true` gate is enforced by `requireAuth` middleware and is a hard rule.

## Why group isolation at the database query level?

A group treasurer or member should never accidentally see another group's data. Relying on the frontend to hide data is insufficient — the backend must enforce it. Every query is scoped by verified group membership. The pattern is in `ARCHITECTURE.md` and is the first thing every new agent should internalise.

## Why a separate treasurer role?

Group owners shouldn't need to be involved in day-to-day collection recording. Many real Chilimba groups have a separate treasurer. Giving them a distinct role means the owner can delegate without giving full admin privileges.

## Why queue WhatsApp messages?

A request handler that calls the Evolution API synchronously would:

- Block the user's response on a network call to a third party
- Fail loudly if Evolution is down (every API call would 5xx)
- Make retries and observability harder

Queueing via BullMQ decouples the API from the messaging system. The user's response is fast, the worker handles retries with backoff, and every attempt is recorded in `whatsapp_logs`.

## Why Vue 3 (not React)?

The existing `chilimba-frontend-new/` codebase is Vue 3, and the AGENTS.md in the new plan calls for Vue + Vite. Vue 3's Composition API is a clean fit for our Pinia stores and the option API is friendly for agents writing small components. No reason to switch.

## Why MinIO (not real S3) for dev?

MinIO is S3-compatible, runs in Docker, and means we can develop and test file uploads without a cloud account. The `S3_*` environment variables point at MinIO in dev and can be repointed at real AWS in production with no code changes (we use the AWS SDK v3 client everywhere).
