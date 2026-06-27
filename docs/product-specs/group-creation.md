# Group Creation (Phase 1, Week 3+)

Covers **plan §7.6 (Group Creation)** and the template system.

## Why this exists

A group is the unit of isolation. The creation flow is gated by a paid invoice and a signed JWT, ensuring only paying customers can spin up groups.

## Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/groups` | signed token | Create group (token from WhatsApp) |
| GET | `/api/v1/groups` | bearer | List groups the user is a member of |
| GET | `/api/v1/groups/:id` | bearer + member | Get group details |
| PUT | `/api/v1/groups/:id/settings` | bearer + owner | Update group settings |

## Create Group

**Token:** JWT in `Authorization: Bearer <token>` header (the token was sent via WhatsApp). The token's payload includes `invoiceId` and `purpose: 'group_creation'`.

**Body:**
```json
{
  "name": "Lusaka Women's Chilimba 2026",
  "description": "Monthly savings for our 12-person group",
  "template": "rotating_cash" | "grocery" | "custom",
  "country": "ZM",
  "currency": "ZMW"
}
```

**Validation:**
- Token valid, not expired, `purpose === 'group_creation'`
- Invoice exists, `status === 'paid'`, no group linked yet
- Name non-empty, ≤ 200 chars

**On create:**
1. Create `groups` row with `invoiceId`, `ownerId = token.sub`
2. Create `group_settings` row with template defaults
3. Create `group_member` for the owner with `role = 'owner'`, next available `payoutPosition`
4. Send WhatsApp to owner: "Your group '{name}' has been created."

## Template Defaults

| Setting | Rotating cash | Grocery | Custom |
|---|---|---|---|
| `maxMembers` | 20 | 20 | 10 |
| `contributionFrequency` | monthly | monthly | monthly |
| `payoutRecipientsCount` | 2 | 0 | 1 |
| `allowLoans` | false | true | false |
| `loanInterestRate` | — | 0.20 | — |

All other settings use DB defaults from `schema.prisma` and can be edited via the settings route.
