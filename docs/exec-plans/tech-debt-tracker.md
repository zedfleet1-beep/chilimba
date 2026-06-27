# Tech Debt Tracker

Known issues, deliberate shortcuts, and follow-ups. Each item has a "fix by" phase.

## Phase 1 (acceptable for Week 1–2)

- **[ ] Refresh tokens stored in Pinia state, not in httpOnly cookies.** Production-grade hardening moves them to httpOnly + same-site=strict + CSRF tokens. **Fix in Phase 2.**
- **[ ] No refresh token rotation.** A stolen refresh token is valid for 30 days. **Fix in Phase 2** — rotate on every refresh, detect replay by storing the previous token's id and rejecting reuse.
- **[ ] In-memory logout blacklist.** Single Node process, fine for dev. **Fix in Phase 2** — move to Redis.
- **[ ] No CI pipeline.** Lint, typecheck, tests not gated. **Fix in Week 7–8** with GitHub Actions.
- **[ ] No Vitest on the frontend.** Manual smoke tests in the browser for now. **Fix in Week 7–8.**
- **[ ] DESIGN.md is a stub.** No real design system, no component library, no dark mode. **Fix in Week 7–8.**
- **[ ] WhatsApp failure rate alert is not implemented.** Logged but not alerting. **Fix in Phase 2.**
- **[ ] Idempotency keys not used for money-moving routes.** Fine while there's no money movement. **Fix in Week 3** when invoices land.

## Phase 2 candidates

- [ ] Schema for `penalties`, `subscriptions` (declared in plan §6, not yet migrated)
- [ ] Voting payout method
- [ ] PDF export (cycle summary, member statement)
- [ ] Auto monthly summary WhatsApp to group owners
- [ ] CORS tightening for production domains
- [ ] DB read replicas for the admin dashboard
- [ ] Redis-backed rate limit (currently in-process)
- [ ] Refresh token rotation + replay detection

## Phase 3 candidates

- [ ] Schema for `loans`, `loan_sureties`, `loan_repayments`
- [ ] Loan flow + interest calculation
- [ ] Mobile app wrapping the existing API
- [ ] Mobile money integration
