# Subscriptions (Phase 2)

Covers **plan §7.15 (Subscriptions)**. Module is not implemented in Phase 1.

## Model

- Group is activated when invoice is paid
- Subscription period: monthly or annual
- 30 days before expiry: auto-create renewal invoice, send WhatsApp to owner
- 7 days before expiry: second reminder
- On expiry: group moves to `suspended` (read-only, no new contributions)
- On renewal payment: group reactivated

## Fields (in `subscriptions` table)

- `plan` — `monthly` | `annual`
- `startsAt`, `expiresAt`
- `status` — `active` | `expired` | `cancelled`
- `renewalInvoiceId` — FK to the new invoice created for renewal
