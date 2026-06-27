# Phase 1 — MVP (8 weeks)

Mirrors `chilimba-full-plan.md` §8. Update checkboxes as work lands.

## Week 1–2: Foundation

- [x] Monorepo scaffold (`chilimba/`) with backend, frontend, docs, docker-compose
- [x] All root docs (AGENTS.md, ARCHITECTURE.md, SECURITY.md, PLANS.md, PRODUCT_SENSE.md, etc.)
- [x] Docker-compose (postgres, redis, minio)
- [x] Full Phase 1 Prisma schema (all tables, money in BigInt ngwe)
- [x] Initial migration + seed (super_admin)
- [x] Auth module: signup, OTP request/verify, login, refresh, logout, forgot/reset
- [x] Evolution API integration via BullMQ worker
- [x] Vue 3 frontend: SignUp, OtpVerify, Login, Dashboard wired to API
- [x] End-to-end smoke test (real WhatsApp)

## Week 3–4: Invoices + Groups + Members

- [x] Admin: invoice CRUD — `backend/src/modules/invoices/*` (sequential `INV####`, race-safe)
- [x] Customer: POP upload (S3 presigned URLs) — two-step `/pop-url` + `/pop`
- [x] Admin: POP verification — `/admin/pops/:id/approve` & `/reject`, 48h group-creation token
- [x] Customer: group creation via signed token — `requireGroupCreationToken` middleware
- [x] Owner: group settings — `PUT /groups/:id/settings` with BigInt round-trip
- [x] Owner/treasurer: member add/remove — `addMember` auto-positions, soft-delete on remove
- [x] All `whatsapp_notifications` templates wired: `invoice_created`, `pop_approved`, `pop_rejected`, `group_created`
- [x] Frontend: light-mood theme (`warm`/`cream`/`sky`/`coral` palette) + `AppLayout` sidebar
- [x] Frontend pages: `AdminInvoices`, `AdminInvoiceDetail`, `CustomerInvoices`, `CustomerInvoiceDetail`, `CreateGroup`, `GroupDetail`, `GroupSettings`, updated `Dashboard`
- [x] Seed: super_admin + Mary (paid, group w/ 5 members) + Peter (pending invoice + POP)

## Week 5–6: Cycles + Contributions

- [x] Cycle creation + round generation
- [x] Contribution recording
- [x] Late detection
- [x] Payout recording
- [x] Templates wired: `contribution_reminder`, `contribution_received`, `payout_notification`
- [x] Frontend: `GroupCycles.vue` wired to router + nav
- [x] Pre-due reminder cron (`contributionDueSoon` template)
- [x] Seed: Mary's group has demo in-progress cycle

## Week 7–8: Notifications + Admin + Polish

- [ ] BullMQ queue dashboard
- [ ] All WhatsApp templates verified end-to-end
- [x] Admin panel: stats, invoices, POP review, groups, users, WhatsApp logs
- [x] Frontend: all screens connected (cycles + admin pages)
- [ ] E2E test: full signup → group → cycle → contribution flow
- [ ] CI (lint + typecheck + test)
- [ ] Production docker-compose with real S3 and managed Evolution API
- [ ] Design system (`DESIGN.md` still a stub)
