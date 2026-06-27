# WhatsApp Notifications (Phase 1, all weeks)

Covers **plan §7.11 (WhatsApp Notifications)**.

All WhatsApp sends go through the `sendWhatsApp(phone, message)` wrapper in `lib/whatsapp.ts`, which enqueues a BullMQ job. The worker (`workers/notification.worker.ts`) calls Evolution API and logs to `whatsapp_logs`.

## Message Templates

Every template is a pure function in `src/modules/notifications/templates/` that takes the data and returns the message text. No HTML, no Markdown — WhatsApp is plain text.

| Key | Trigger | Template |
|---|---|---|
| `welcome` | OTP verified | "Welcome to Chilimba, {first_name}! …" |
| `otp` | Signup or resend | "Your Chilimba verification code is: {code} …" |
| `invoice_created` | Admin creates invoice | "Hello {name}, your Chilimba invoice is ready …" |
| `pop_approved` | Admin approves POP | "Great news, {name}! Payment confirmed … {group_creation_link}" |
| `pop_rejected` | Admin rejects POP | "Your proof of payment was not accepted …" |
| `contribution_reminder` | X days before due | "Hi {first_name}, your contribution is due on {due_date} …" |
| `contribution_received` | Contribution recorded | "Payment confirmed, {first_name}! …" |
| `payout_notification` | Round recipient assigned | "Congratulations, {first_name}! You're scheduled to receive this round's payout …" |
| `renewal_reminder` | 30 days before subscription expiry | "Hi {owner_name}, your Chilimba group subscription expires on {expiry_date} …" |
| `monthly_summary` | Month end | "{group_name} — Monthly Summary …" |

## Templates In Code

```typescript
// src/modules/notifications/templates/otp.ts
export const otpTemplate = ({ code }: { code: string }) =>
  `Your Chilimba verification code is: ${code}\n\nValid for 10 minutes. Do not share this code.`
```

The worker calls `renderTemplate(type, data)`, which looks up the right function and returns the text.

## Reliability

- 3 retries with exponential backoff (2s → 4s → 8s)
- Every attempt logged to `whatsapp_logs` with full Evolution API response
- Final failure: `whatsapp_logs.status = 'failed'`, surfaced in admin dashboard (Week 7+)
- Failure rate alert (> 5% over 1h) — Phase 2
