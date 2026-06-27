# PLANS.md

> Phase tracker. The full 8-week Phase 1 plan lives in `docs/exec-plans/active/phase-1-mvp.md`. This file is the high-level status.

## Phase 1 — MVP (8 weeks)

| Week | Theme | Status |
|---|---|---|
| 1–2 | **Foundation** — monorepo, schema, auth, WhatsApp wrapper | ✅ **2026-06-12** — completed this session |
| 3–4 | Invoices + POP + Group creation + Members | ✅ **2026-06-15** — vertical slice shipped (backend + frontend + seed) |
| 5–6 | Cycles + Contributions + Payouts + Late detection | ✅ **2026-06-27** — backend + GroupCycles UI + seed |
| 7–8 | Notifications polish + Admin panel + Frontend polish + E2E | 🛠 **in progress** — admin panel shipped; CI/E2E/prod compose remain |

See `docs/exec-plans/completed/2026-06-12-foundation.md` for what was actually shipped in this session.

## Phase 2 — 4 weeks after Phase 1 stable

- Penalties (full CRUD + resolution)
- Reports (cycle summary, member statement, PDF export)
- Subscription model + renewal invoices
- Monthly summary WhatsApp to group owners
- Voting payout method
- Refresh-token rotation in Redis
- Cookie-based refresh tokens

## Phase 3 — 6 weeks after Phase 2 stable

- Loans (request, sureties, approval, repayment, default)
- Interest calculation
- Loan book report
- Mobile app (React Native wrapping existing API)
- Mobile money integration

## Status Definitions

- ⏳ **planned** — listed but not started
- 🛠 **in progress** — active work
- ✅ **completed** — shipped, tests passing, documented
- ⚠️ **at risk** — blocked or slipping
