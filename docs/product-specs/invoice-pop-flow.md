# Invoice + POP Flow (Phase 1, Week 3+)

Covers **plan §7.4 (Invoice Creation)** and **§7.5 (POP Upload & Verification)**.

## Why this exists

Chilimba is a SaaS. Every group is born from a paid invoice. This feature is what turns a customer into a paying account.

## Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/invoices` | super_admin | Create invoice |
| GET | `/api/v1/invoices` | super_admin | List invoices (filters: status, date range) |
| GET | `/api/v1/invoices/:id` | super_admin / customer | Get invoice details |
| POST | `/api/v1/invoices/:id/pop` | customer | Upload proof of payment |
| POST | `/api/v1/admin/pops/:id/approve` | super_admin | Approve POP → invoice paid |
| POST | `/api/v1/admin/pops/:id/reject` | super_admin | Reject POP with reason |

## Invoice Create

**Body:**
```json
{
  "customerName": "Mary Banda",
  "phone": "+260977123456",
  "email": "mary@example.com",
  "amountNgwe": 50000,
  "description": "Chilimba group plan — monthly"
}
```

**On create:**
- Generate `invoiceNumber` (`INV0001`, `INV0002`, …) via a counter or by querying max+1
- Status = `pending`
- Send WhatsApp to customer with invoice details + payment instructions + upload link
- Invoice visible in admin panel

## POP Upload

**Body:** `{ "fileType": "jpg" | "png" | "pdf" }`

**Response:** `{ "uploadUrl": "presigned-s3-url", "fileKey": "..." }`

The frontend `PUT`s the file directly to S3. After upload, it calls `POST /invoices/:id/pop/complete` with the `fileKey` to register the upload with the backend. (Two-step pattern keeps large file payloads off the API.)

## Admin Verification

Approve:
- `invoices.status = 'paid'`
- `invoices.paidAt = NOW()`
- Generate signed group-creation JWT (48h, contains `invoiceId`)
- Send WhatsApp to customer: "Payment confirmed! Create your group: {link}"

Reject:
- `payment_proofs.status = 'rejected'`
- Send WhatsApp with the reason
- Customer can re-upload

## Frontend

- Admin: `AdminInvoices.vue` list, `AdminInvoiceDetail.vue` with POP preview
- Customer: `InvoiceView.vue` (accessible by signed link from WhatsApp) with upload widget
