# Contributions (Phase 1, Week 5+)

Covers **plan §7.10 (Contributions)**.

## Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/contributions` | bearer + treasurer/owner | Record a contribution |
| GET | `/api/v1/contributions` | bearer + member | List (filter: group, cycle, round, member) |
| POST | `/api/v1/contributions/:id/waive` | bearer + owner | Waive a contribution |

## Record a Contribution

**Body:**
```json
{
  "groupId": "uuid",
  "cycleId": "uuid",
  "roundId": "uuid",
  "memberId": "uuid",
  "amountNgwe": 102000,
  "paidDate": "2026-01-28",
  "proofUrl": "s3://..."      // optional
}
```

**Statuses:**
- `pending` — due but not yet paid
- `paid` — payment recorded
- `late` — paid after `dueDate + gracePeriodDays`
- `waived` — treasurer/owner waived this contribution

**On record:**
1. Validate amount matches `group_settings.contributionAmountNgwe` (or is a treasurer override with a reason)
2. Set `status`:
   - If `paidDate <= dueDate + gracePeriodDays` → `paid`
   - Else → `late`, and create a `penalties` row (Week 5+ pending penalties module)
3. Send WhatsApp to member: "Payment confirmed, {firstName}! …"
4. Update round's `totalCollectedNgwe`

## Late Penalty (auto)

When a contribution is recorded after `dueDate + gracePeriodDays`, a penalty is auto-created using `group_settings.latePenaltyNgwe`. (The penalty module ships in Phase 2; for now we record the `late` status only.)
