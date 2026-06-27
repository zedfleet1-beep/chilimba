# Auth Design

How the user proves they are who they say they are, and how the API enforces it.

## Overview

1. **Signup** — user provides phone + password. A 6-digit OTP is sent via WhatsApp. The user is `otpVerified = false` until they verify.
2. **OTP verify** — user enters the 6-digit code. We mark them verified, issue JWT access + refresh tokens, send a welcome WhatsApp.
3. **Login** — phone + password. Returns the same tokens. Requires `otpVerified = true` and `status = 'active'`.
4. **Refresh** — exchange a refresh token for a new access token. (Rotation in Phase 2.)
5. **Logout** — invalidate the refresh token (in-memory blacklist for now; Redis in Phase 2).
6. **Forgot/reset password** — same flow as OTP, but the OTP is bound to the password-reset purpose and the verify step accepts a new password instead of returning tokens.

## Token Shape

### Access token (15 min)

```json
{
  "sub": "uuid-of-user",
  "role": "member" | "treasurer" | "owner" | "super_admin",
  "iat": 1718000000,
  "exp": 1718000900
}
```

### Refresh token (30 days)

Same shape, signed with a different secret. The frontend stores the refresh token in Pinia state and (in production) also as an `httpOnly` cookie. The cookie is a Phase 2 hardening step; for Week 1–2 we keep it in memory and rely on the access token's short lifetime.

## OTP Rules

- **6 digits**, generated with `crypto.randomInt(0, 1_000_000)`.
- **10-minute expiry** from creation.
- **Single use** — `otps.used = true` on first successful verify.
- **5-attempt lockout** — wrong guesses increment `attempts`. At 5, the OTP is invalidated and a new one must be requested. The phone is also locked for 15 minutes (any new OTP request during the lockout is rejected).
- **Resend rate limit** — max 3 resends per 30 minutes per phone.
- **Resend invalidates prior codes** — the previous `otps.used = true` is forced (or we simply mark the old row as `used = true` and issue a new one).

## Middleware Chain

```
Request
  │
  ▼
pino request logger (attaches requestId)
  │
  ▼
cors + helmet
  │
  ▼
express.json()
  │
  ▼
rateLimit (only on /api/v1/auth/*)
  │
  ▼
auth router → validator → service → response
  │
  ▼
errorHandler (catches any thrown error, formats response)
```

## Why OTP via WhatsApp (not SMS)

- Free (Evolution API has no per-message cost for WhatsApp Business)
- Higher read rates than SMS in Zambia
- Proves the phone is WhatsApp-capable, which is the channel we'll use for all group notifications
- Single channel for all messaging (OTP, reminders, payouts, summaries)

## Why bcrypt rounds 12

Standard recommendation as of 2026 for interactive auth — high enough to resist offline attack, low enough to log in under 300ms on commodity hardware.

## Security Trade-offs Accepted in Week 1–2

- **Refresh tokens in memory, not in httpOnly cookies.** Cookies are the right answer for production, but they need a same-site strategy and CSRF protection that we haven't built yet. Tracked in `tech-debt-tracker.md`.
- **No refresh token rotation.** A stolen refresh token is valid for 30 days. Phase 2 will rotate on every refresh and detect replay.
- **In-memory logout blacklist.** A single Node process, fine for dev. Will move to Redis in Phase 2.

These are deliberate, documented, and tracked. They do not block Phase 1.
