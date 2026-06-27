# QUALITY_SCORE.md

> Test coverage and quality standards. Targets are enforced in code review.

## Coverage Targets

- **Service layer** (`src/modules/*/*.service.ts`): ≥ 80% line coverage
- **Validators** (`*.validators.ts`): 100% — every schema tested with valid + invalid input
- **Routes** (`*.routes.ts`): every endpoint has at least one happy-path test + one error test
- **Critical paths** (auth, money-movement, group isolation): 100% — these are the load-bearing parts

## Code Quality Rules

- **No route handler longer than 30 lines.** Logic goes in the service.
- **No `any` without a `// eslint-disable-next-line` comment and a reason.**
- **No `prisma.*` calls in route files.** Service layer only.
- **No `Float` for money anywhere.** Grep test in CI.
- **No `console.log` in committed code.** Use `pino` logger.
- **No TODO without a tracked issue.**
- **One Zod schema per route.** Reject unknown fields.

## Test Conventions

- **Jest** for backend (configured in `backend/jest.config.js`)
- **Supertest** for HTTP integration tests
- Tests live next to the module: `auth.routes.ts` → `auth.test.ts`
- Test setup in `tests/setup.ts` (truncates DB between runs)
- Use `describe` / `it` blocks; describe the behaviour, not the function name

## Per-Feature Checklist (AGENTS.md rule #7)

Every new feature ships with:

- [ ] Prisma migration
- [ ] Service (`*.service.ts`)
- [ ] Route (`*.routes.ts`)
- [ ] Validator (`*.validators.ts`)
- [ ] Test (`*.test.ts`)

If any of the five is missing, the feature is not done.

## CI

Not yet wired up in Week 1–2. Planned for Week 7–8:

```yaml
# .github/workflows/ci.yml (planned)
- npm run lint
- npm run build
- npm test
- grep -r "Float" src/  # money rule
- grep -r "prisma\." src/modules/*/*.routes.ts  # service-layer rule
```
