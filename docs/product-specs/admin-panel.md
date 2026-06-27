# Admin Panel (Phase 1, Week 7+)

Covers **plan §7.12 (Admin Panel)**. Only the super admin role can access.

## Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/admin/stats` | super_admin | Platform metrics |
| GET | `/api/v1/admin/invoices` | super_admin | All invoices |
| POST | `/api/v1/admin/pops/:id/approve` | super_admin | Approve POP |
| POST | `/api/v1/admin/pops/:id/reject` | super_admin | Reject POP |
| GET | `/api/v1/admin/groups` | super_admin | All groups (read-only) |
| POST | `/api/v1/admin/groups/:id/suspend` | super_admin | Suspend a group |
| POST | `/api/v1/admin/groups/:id/reactivate` | super_admin | Reactivate |
| GET | `/api/v1/admin/users` | super_admin | All users |
| POST | `/api/v1/admin/users/:id/suspend` | super_admin | Suspend a user |
| GET | `/api/v1/admin/whatsapp-logs` | super_admin | Recent delivery logs |
| POST | `/api/v1/admin/whatsapp/send` | super_admin | Manual send |

## Dashboard Metrics

- Active groups
- Total members across all groups
- Invoices pending POP review
- Total revenue (paid invoices) this month
- WhatsApp messages sent today
- Failed WhatsApp deliveries (need attention)

## Frontend

- `/admin` route group, guarded by `requireRole('super_admin')`
- Pages: `AdminDashboard.vue`, `AdminInvoices.vue`, `AdminInvoiceDetail.vue`, `AdminGroups.vue`, `AdminUsers.vue`, `AdminWhatsappLogs.vue`
