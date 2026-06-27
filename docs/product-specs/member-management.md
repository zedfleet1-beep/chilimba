# Member Management (Phase 1, Week 3+)

Covers **plan §7.8 (Member Management)**.

## Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/groups/:id/members` | bearer + owner/treasurer | Add member |
| GET | `/api/v1/groups/:id/members` | bearer + member | List members |
| PUT | `/api/v1/groups/:id/members/:memberId` | bearer + owner | Update role / position |
| DELETE | `/api/v1/groups/:id/members/:memberId` | bearer + owner | Remove member |

## Add Member

**Body:**
```json
{
  "firstName": "Peter",
  "lastName": "Mumba",
  "phone": "+260977654321",
  "role": "member" | "treasurer",
  "payoutPosition": 3        // optional, auto-assigned to next available if omitted
}
```

**On add:**
1. Check `group.settings.maxMembers` not reached
2. Check phone not already a member
3. If a `users` row exists for that phone → link to it
4. If no row → create a `pending` user, send WhatsApp invitation with a signup link
5. Assign `payoutPosition` (next available if not specified)

## Remove Member

- Allowed if no cycle is `in_progress`, OR the member has already received their payout in the current cycle
- If removing mid-cycle before payout: flagged for treasurer review, exit penalty may apply
