# API Routes (Phase 1)

Hand-written stub. Auto-generation planned for Week 7–8 with `tsoa` or a similar approach.

All routes are prefixed with `/api/v1`. All non-auth routes require `Authorization: Bearer <accessToken>`. Auth routes are rate-limited to 10 req/min/IP.

## Auth (implemented in Week 1–2)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/signup` | public | Create user, send OTP |
| POST | `/auth/otp/request` | public | Resend OTP (rate-limited) |
| POST | `/auth/otp/verify` | public | Verify code, issue tokens |
| POST | `/auth/login` | public | Phone + password, issue tokens |
| POST | `/auth/refresh` | public | Exchange refresh for new access |
| POST | `/auth/logout` | bearer | Invalidate refresh |
| POST | `/auth/forgot` | public | Request reset OTP |
| POST | `/auth/reset` | public | Verify reset OTP + new password |
| GET | `/auth/me` | bearer | Current user |

## Health

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | public | Status of all dependencies |

## Invoices (Week 3+)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/invoices` | super_admin | Create invoice |
| GET | `/invoices` | super_admin | List invoices |
| GET | `/invoices/:id` | super_admin / customer | Get invoice |
| POST | `/invoices/:id/pop` | customer | Upload POP |
| POST | `/invoices/:id/pop/complete` | customer | Confirm upload complete |

## Groups (Week 3+)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/groups` | signed token | Create group |
| GET | `/groups` | bearer | List my groups |
| GET | `/groups/:id` | bearer + member | Group details |
| PUT | `/groups/:id/settings` | bearer + owner | Update settings |
| POST | `/groups/:id/members` | bearer + owner/treasurer | Add member |
| GET | `/groups/:id/members` | bearer + member | List members |
| PUT | `/groups/:id/members/:memberId` | bearer + owner | Update role |
| DELETE | `/groups/:id/members/:memberId` | bearer + owner | Remove member |

## Cycles (Week 5+)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/groups/:id/cycles` | bearer + owner | Open cycle |
| GET | `/groups/:id/cycles` | bearer + member | List cycles |
| GET | `/cycles/:id` | bearer + member | Cycle + rounds |
| POST | `/cycles/:id/complete` | bearer + owner | Force-complete |

## Contributions (Week 5+)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/contributions` | bearer + treasurer/owner | Record |
| GET | `/contributions` | bearer + member | List (filterable) |
| POST | `/contributions/:id/waive` | bearer + owner | Waive |

## Admin (Week 7+)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/stats` | super_admin | Platform metrics |
| GET | `/admin/invoices` | super_admin | All invoices |
| POST | `/admin/pops/:id/approve` | super_admin | Approve POP |
| POST | `/admin/pops/:id/reject` | super_admin | Reject POP |
| GET | `/admin/groups` | super_admin | All groups |
| POST | `/admin/groups/:id/suspend` | super_admin | Suspend |
| GET | `/admin/users` | super_admin | All users |
| POST | `/admin/users/:id/suspend` | super_admin | Suspend |
| GET | `/admin/whatsapp-logs` | super_admin | Recent delivery logs |
| POST | `/admin/whatsapp/send` | super_admin | Manual send |
