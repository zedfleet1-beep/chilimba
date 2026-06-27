# New User Onboarding (Phase 1, Week 1–2)

Covers **plan §7.1 (Sign Up)**, **§7.2 (OTP Verification)**, **§7.3 (Login)**, and the **Forgot Password** flow.

## Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/auth/signup` | public | Create user, send OTP |
| POST | `/api/v1/auth/otp/request` | public | Resend OTP (rate-limited) |
| POST | `/api/v1/auth/otp/verify` | public | Verify code, issue tokens |
| POST | `/api/v1/auth/login` | public | Phone + password, issue tokens |
| POST | `/api/v1/auth/refresh` | public | Exchange refresh token for new access token |
| POST | `/api/v1/auth/logout` | bearer | Invalidate refresh token |
| POST | `/api/v1/auth/forgot` | public | Request reset OTP |
| POST | `/api/v1/auth/reset` | public | Verify reset OTP + new password |
| GET | `/api/v1/auth/me` | bearer | Return current user |

## Sign Up

**Body:**
```json
{
  "firstName": "Mary",
  "lastName": "Banda",
  "phone": "+260977123456",
  "email": "mary@example.com",        // optional
  "password": "P@ssw0rd!",
  "consent": true                       // WhatsApp messaging consent (required)
}
```

**On success (201):**
```json
{ "success": true, "data": { "userId": "uuid", "phone": "+260977123456" } }
```
A 6-digit OTP is sent via WhatsApp. The user is `otpVerified = false`.

**Errors:**
- `PHONE_ALREADY_EXISTS` → 409
- `INVALID_PHONE_FORMAT` → 400
- `WEAK_PASSWORD` → 400
- `CONSENT_REQUIRED` → 400

## OTP Verify

**Body:** `{ "phone": "+260977123456", "code": "123456" }`

**On success (200):**
```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "firstName": "Mary", "phone": "+260977123456", "role": "member" },
    "accessToken": "...",
    "refreshToken": "..."
  }
}
```

**Errors:**
- `INVALID_OTP` → 401 (increments `attempts`)
- `OTP_EXPIRED` → 410
- `OTP_LOCKED` → 423 (after 5 attempts)
- `RATE_LIMITED` → 429

## Login

**Body:** `{ "phone": "+260977123456", "password": "..." }`

**On success:** same shape as OTP verify.

**Errors:**
- `INVALID_CREDENTIALS` → 401 (generic — doesn't reveal which field is wrong)
- `OTP_NOT_VERIFIED` → 403
- `ACCOUNT_SUSPENDED` → 403

## Forgot / Reset Password

**`POST /auth/forgot`:** `{ phone }` → sends reset OTP, returns `{ success: true }` always (to avoid phone enumeration).

**`POST /auth/reset`:** `{ phone, code, newPassword }` → marks OTP used, updates password hash, invalidates all tokens.

## Frontend

Pages: `SignUp.vue`, `OtpVerify.vue`, `Login.vue`, `Dashboard.vue`.

State: `auth` Pinia store holds `user`, `accessToken`, `refreshToken`, `isAuthenticated`. The store's `signup/requestOtp/verifyOtp/login/logout` actions wrap the API calls.

See `../design-docs/auth-design.md` for the full design and trade-offs.
