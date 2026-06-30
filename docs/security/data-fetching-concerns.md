# Data fetching & sensitivity concerns

**Chilimba — audit of over-fetching, redundant API calls, and premature data loading**

| | |
|---|---|
| **Date** | 2026-06-30 |
| **Scope** | Frontend stores/pages/layouts + backend API responses |
| **Goal** | Document where we fetch more than a screen needs, why it was built that way, and what the security/privacy risk is |

This document complements [`SECURITY.md`](../../SECURITY.md) (auth, validation, upload rules). It focuses on **data minimization**: only load what the user asked for, only expose what their role requires.

---

## Executive summary

| Category | Count | Highest risk |
|----------|-------|--------------|
| Sensitive data over-exposure | 8 | Member statements IDOR; contribution proof URLs to all members |
| Over-fetching (payload too large) | 7 | `getGroup` always returns all members + phones |
| Redundant / excessive API calls | 5 | `fetchMine()` on almost every page + AppLayout |
| Prefetch before user intent | 4 | Reports page loads all tabs on mount |

**Design pattern that caused most of this:** Phase 1 MVP favoured **one fat endpoint per screen** and **eager loading** so tab switches and dashboards feel instant without a separate caching layer. That is reasonable for a small pilot, but it does not scale and it widens the blast radius if a member account is compromised or a token is leaked.

---

## 1. Sensitive data exposure

These are the highest priority. The UI may hide fields, but **the API still returns them** — any member with devtools or a script can read the full JSON.

### 1.1 Member statement IDOR (P0)

| | |
|---|---|
| **Where** | `backend/src/modules/reports/reports.routes.ts` → `getMemberStatement()` |
| **What is exposed** | Any `memberId` query param returns that member's **phone**, full **contribution history**, **payouts**, and **loans** |
| **Authorization today** | Caller must be an active group member — but **not** limited to their own `memberId` |
| **UI mitigation** | `GroupReports.vue` only shows a member picker to owner/treasurer; regular members still call the API directly |
| **Why it was made so** | Single report endpoint; UI assumed role-based UX was enough |
| **Risk** | **High** — any member can enumerate other members' financial history |
| **Fix** | In the route handler: if `requester.role === 'member'`, require `query.memberId === req.groupMembership.memberId`; owner/treasurer may query any member |

---

### 1.2 Contribution proof URLs exposed to all members (P0)

| | |
|---|---|
| **Where** | `backend/src/modules/contributions/contributions.service.ts` → `listContributions()` |
| **What is exposed** | Full contribution rows including **`proofUrl`** (Cloudinary receipt image/PDF) and **`member.user.phone`** for every member in the round |
| **Authorization today** | Any active group member can `GET` contributions for a round |
| **Why it was made so** | One ledger payload powers treasurer review UI and member status display; `proofUrl` is a column on the contribution model |
| **Risk** | **High** — payment screenshots are financial PII; URL leakage = receipt exposure |
| **Fix** | Role-filter response: members see `{ status, amount, dueDate }` only; owner/treasurer get `proofUrl` via signed short-TTL URL endpoint |

---

### 1.3 Member phone numbers returned group-wide (P1)

| | |
|---|---|
| **Where** | `groups.service.ts` `getGroup()`, `members.service.ts` `listMembers()`, `contributions.service.ts`, `payouts.service.ts`, `loans.service.ts`, `reports.service.ts` `getOutstandingContributions()` |
| **What is exposed** | E.164 phone for **every** active member |
| **UI** | `GroupDetail.vue` members tab; outstanding report lists delinquent members with phones |
| **Why it was made so** | ROSCA groups often need treasurer ↔ member contact; single `getGroup` powers detail, cycles, and reports |
| **Risk** | **Medium** — convenient for treasurers, but regular members do not need full directory access |
| **Fix** | Response DTOs with role-based fields: `phone` for owner/treasurer only; optional masked `phoneLast4` for members |

---

### 1.4 Full loan book visible to every member (P1)

| | |
|---|---|
| **Where** | `backend/src/modules/loans/loans.service.ts` → `listLoans()`; route allows any group member |
| **What is exposed** | All loans (amount, purpose, status, balance) plus **borrower phone** |
| **Why it was made so** | Simple list endpoint for the Loans page; no role split between “my loans” and “group book” |
| **Risk** | **Medium** — exposes who borrowed and how much across the group |
| **Fix** | Members: `GET /loans/mine` or filter by `memberId`; owner/treasurer: full book |

---

### 1.5 `groupCreationToken` returned to admin browser (P1)

| | |
|---|---|
| **Where** | `payment-proofs.service.ts`, `invoices.service.ts` `recordCashPayment()`; `frontend/src/pages/AdminInvoiceDetail.vue` |
| **What is exposed** | Raw signed JWT that can create a group for an invoice — stored in API response, Pinia, and DOM for copy-paste QA |
| **Why it was made so** | Admin fallback when WhatsApp delivery fails; easy copy for support |
| **Risk** | **Medium** — bearer token in network tab / shared admin screen / XSS |
| **Fix** | Return only `groupCreationLink` to client; deliver token via WhatsApp server-side only; shorten TTL + one-time use |

---

### 1.6 POP / proof assets may be publicly reachable (P1)

| | |
|---|---|
| **Where** | `payment-proofs.service.ts` → `getPopDownloadUrl()` |
| **What is exposed** | Image POPs may use stored Cloudinary `secure_url` directly (“public CDN URL”) |
| **Why it was made so** | Faster preview without signing step |
| **Risk** | **Medium** — anyone with the URL can view the receipt |
| **Fix** | Private Cloudinary (or S3) assets + signed GET URLs for all proof types (align with `SECURITY.md` intent) |

---

### 1.7 WhatsApp admin logs retain full message bodies (P2)

| | |
|---|---|
| **Where** | `admin.service.ts` → `listWhatsappLogs()`; `AdminWhatsappLogs.vue` |
| **What is exposed** | `toPhone`, full `message` (may contain OTPs, payment links, group-creation URLs) |
| **Why it was made so** | Admin debugging and manual send UI |
| **Risk** | **Medium** (admin-only, but highly sensitive at rest) |
| **Fix** | Redact OTP patterns; truncate in list view; paginate; audit log access |

---

### 1.8 Refresh token in `localStorage` (P2)

| | |
|---|---|
| **Where** | `frontend/src/lib/session.ts`; `frontend/src/stores/auth.ts` |
| **What is exposed** | 30-day refresh token readable by any XSS on the origin |
| **Why it was made so** | SPA session persistence without cookie plumbing (noted as Week 1–2 simplification in `SECURITY.md`) |
| **Risk** | **Medium** — standard SPA tradeoff; doc says production should use `httpOnly` cookies |
| **Fix** | Move refresh to `httpOnly` secure cookie; keep access token in memory only |

---

## 2. Over-fetching (payload larger than the screen needs)

### 2.1 `listMyGroups` loads every member row to count members

| | |
|---|---|
| **Where** | `backend/src/modules/groups/groups.service.ts` → `listMyGroups()` |
| **Fetched** | Full `Group` + full `GroupSetting` + **all active `members` rows** per group |
| **Actually needed** | Group id, name, `myRole`, `memberCount` (and maybe template) for dashboard / picker |
| **Why it was made so** | `memberCount = m.group.members.length` — quickest path without `_count` |
| **Risk** | **Medium** (performance + unnecessary member graph in memory on client) |
| **Fix** | `include: { group: { include: { settings: true, _count: { select: { members: true } } } } }` |

---

### 2.2 `getMyInvoices` returns full invoices + all POPs + payment details per row

| | |
|---|---|
| **Where** | `backend/src/modules/invoices/invoices.service.ts` → `getMyInvoices()` |
| **Fetched** | Full `Invoice`, all `paymentProofs`, `getEffectivePaymentDetails()` per invoice (N+1) |
| **Actually needed on Dashboard** | Counts: pending/paid; maybe next invoice number + amount |
| **Why it was made so** | One endpoint serves list page, detail page, and dashboard cards |
| **Risk** | **Medium** |
| **Fix** | `GET /invoices/mine/summary` for dashboard; embed `paymentDetails` only on `GET /invoices/:id` |

---

### 2.3 `getGroup` always returns full settings + all members (with phones)

| | |
|---|---|
| **Where** | `groups.service.ts` `getGroup()`; `frontend/src/stores/groups.ts` `fetchOne()` |
| **Fetched** | Complete settings + every member + phone |
| **Actually needed** | Overview tab: settings summary only; Members tab: member list (lazy) |
| **Why it was made so** | Single “group detail” resource for overview, members, cycles, reports, settings |
| **Risk** | **Medium** |
| **Fix** | `GET /groups/:id` (summary) + `GET /groups/:id/members` (on Members tab / treasurer actions) |

---

### 2.4 `getCycle` embeds per-round data; ledger fetched again separately

| | |
|---|---|
| **Where** | `cycles.service.ts` `getCycle()`; `frontend/src/stores/cycles.ts` `fetchCycle()` + `fetchRoundLedger()` |
| **Fetched** | Rich cycle detail **and** separate contributions + payouts for selected round |
| **Why it was made so** | Cycle page shows progress + round ledger; two APIs evolved in parallel |
| **Risk** | **Medium** — duplicate contribution/payout data on every cycles load |
| **Fix** | Slim `getCycle` (rounds metadata only); ledger endpoints own round detail |

---

### 2.5 Admin `listInvoices` — full table, no pagination

| | |
|---|---|
| **Where** | `invoices.service.ts` `listInvoices()`; `AdminInvoices.vue` |
| **Fetched** | Entire invoice table; UI shows 7 columns |
| **Why it was made so** | Small pilot dataset; simple admin table |
| **Risk** | **Medium** at scale |
| **Fix** | Paginate + list DTO |

---

### 2.6 Mutation handlers re-fetch entire resources

| | |
|---|---|
| **Where** | `stores/groups.ts` — after `addMember` / `removeMember` / `updateSettings`: `fetchOne` + `fetchMine`; `stores/cycles.ts` — after record/approve: full `fetchCycle` |
| **Why it was made so** | Easiest way to stay consistent with server |
| **Risk** | **Low–Medium** — bandwidth after small writes |
| **Fix** | Patch local state or refetch only the changed slice |

---

## 3. Too many / redundant API calls

### 3.1 `fetchMine()` called from AppLayout and almost every group page

| | |
|---|---|
| **Where** | `AppLayout.vue` (on mount); `Dashboard.vue`, `GroupDetail.vue`, `GroupCycles.vue`, `GroupReports.vue`, `GroupLoans.vue`, `GroupSettings.vue`, `GroupPicker.vue` |
| **Pattern** | AppLayout loads groups if cache empty; each page calls `fetchMine()` again unconditionally |
| **Why it was made so** | Pages want fresh membership list; no shared staleness/TTL guard |
| **Risk** | **Medium** — often **2× `GET /groups`** per navigation |
| **Fix** | `fetchMine({ force?: boolean })` with `lastFetchedAt` + 30s TTL in store; pages read cache unless forced |

**Typical Group Cycles waterfall today:**

```
AppLayout mount     → GET /groups
GroupCycles mount   → GET /groups
                    → GET /groups/:id
                    → GET /groups/:id/cycles
                    → GET /groups/:id/cycles/:cycleId
                    → GET .../contributions + GET .../payouts
≈ 6 calls before the user taps anything
```

---

### 3.2 Cycles store auto-chains list → detail → ledger

| | |
|---|---|
| **Where** | `frontend/src/stores/cycles.ts` → `fetchCycles()` always calls `fetchCycle()` on active/first cycle, which calls `fetchRoundLedger()` |
| **Why it was made so** | Cycles page always shows the active cycle UI immediately |
| **Risk** | **Medium** — user pays full cycle cost even if they only wanted the list |
| **Fix** | Show cycle list first; load detail/ledger when user selects a cycle or when in-progress UI mounts |

---

### 3.3 Auth cold start: refresh + `/me`

| | |
|---|---|
| **Where** | `frontend/src/stores/auth.ts` → `restore()` |
| **Calls** | `POST /auth/refresh` then `GET /auth/me` |
| **Why it was made so** | Access token in memory; profile loaded separately |
| **Risk** | **Low** |
| **Fix** | Include `PublicUser` in refresh response to drop `/me` |

---

### 3.4 Group Settings duplicate payment fetches

| | |
|---|---|
| **Where** | `GroupSettings.vue` → `getGroupContributionPayment` + `getContributionDefault` in parallel |
| **Why it was made so** | Show override vs platform default |
| **Risk** | **Low** |
| **Fix** | Single “effective contribution payment” response (partially exists already) |

---

## 4. Prefetching data the user has not asked for

### 4.1 AppLayout prefetches groups on all authenticated routes

| | |
|---|---|
| **Where** | `AppLayout.vue` → `groups.fetchMine()` on mount |
| **Prefetched** | Customer group list on **admin**, invoices, help, etc. |
| **Why it was made so** | Sidebar “My group” link and group picker need `activeGroupId` |
| **Risk** | **Low–Medium** — admin sessions still pull customer group membership |
| **Fix** | Prefetch only when route is group-related or nav item is visible; lazy-load on first “My group” click |

---

### 4.2 Group Reports loads every report type on mount

| | |
|---|---|
| **Where** | `frontend/src/pages/GroupReports.vue` → `loadAll()` on mount |
| **Prefetched** | `cycle-summary`, `outstanding`, `loan-book`, `payout-ledger`, **and** `member-statement` before user opens a tab |
| **Why it was made so** | Instant tab switching without loading spinners |
| **Risk** | **Medium** — 5+ heavy calls when user may only read Cycle summary |
| **Fix** | Fetch per tab on first activation; cache in component state |

---

### 4.3 WhatsApp group linking prefetches Evolution group list

| | |
|---|---|
| **Where** | `WhatsappGroupLink.vue` → `onMounted(refreshGroups)` on Group Settings |
| **Prefetched** | `getLinkInfo` + `listLinkableGroups` (external Evolution API) |
| **Why it was made so** | Picker ready immediately |
| **Risk** | **Low–Medium** — external call even if user never links WhatsApp |
| **Fix** | Load when user expands “Connect WhatsApp” section |

---

### 4.4 Dashboard fetches full invoice list for summary cards

| | |
|---|---|
| **Where** | `Dashboard.vue` → `invoices.fetchMine()` |
| **Used for** | `pending.length`, `paid.length`, `pending[0].invoiceNumber` |
| **Why it was made so** | Reuse existing store; no summary endpoint |
| **Risk** | **Low–Medium** |
| **Fix** | Summary endpoint or defer invoice fetch until user opens invoices card |

---

## 5. Priority matrix

| Priority | Issue | Type |
|----------|-------|------|
| **P0** | Member statement IDOR | Authorization / sensitive data |
| **P0** | Contribution `proofUrl` to all members | Sensitive data |
| **P1** | Phone numbers group-wide | Sensitive data |
| **P1** | Full loan book to all members | Sensitive data |
| **P1** | `groupCreationToken` in API/DOM | Token leakage |
| **P1** | Public POP URLs | Sensitive data |
| **P2** | Duplicate `fetchMine()` everywhere | Excessive calls |
| **P2** | Cycles 6-call waterfall | Excessive calls + over-fetch |
| **P2** | Reports prefetch all tabs | Prefetch + excessive calls |
| **P2** | `listMyGroups` member include for count | Over-fetch |
| **P3** | AppLayout global group prefetch | Prefetch |
| **P3** | Admin unpaginated lists | Over-fetch |
| **P3** | Refresh token in `localStorage` | Session security |

---

## 6. Recommended principles going forward

1. **Need-to-know responses** — API returns fields based on `requester.role`, not only UI role checks.
2. **Lazy by default** — load tab/report/cycle detail when the user opens it, not on parent mount.
3. **One source of truth in the store** — dedupe fetches with TTL; avoid every page re-calling `fetchMine()`.
4. **List DTOs ≠ detail DTOs** — dashboard counts should not require full invoice/group graphs.
5. **Sensitive URLs are never long-lived** — proofs, POPs, and creation tokens via signed, short-TTL, role-gated endpoints.
6. **Authorize the row, not just the group** — member-scoped resources must bind `memberId` to `req.groupMembership.memberId` unless owner/treasurer.

---

## 7. Suggested fix order

| Phase | Work |
|-------|------|
| **Phase A (security)** | Member statement authorization; proof URL gating; stop returning raw `groupCreationToken` |
| **Phase B (minimize exposure)** | Role-filtered phone fields; split loan list by role |
| **Phase C (fetch efficiency)** | Store TTL for `fetchMine`; lazy tab loading in Reports; slim `listMyGroups` |
| **Phase D (hardening)** | HttpOnly refresh cookie; private assets + signed URLs for all proofs |

---

## Related docs

- [`SECURITY.md`](../../SECURITY.md) — auth, OTP, upload rules
- [`docs/generated/api-routes.md`](../generated/api-routes.md) — route inventory
- [`docs/product-specs/member-management.md`](../product-specs/member-management.md) — intended member add behaviour