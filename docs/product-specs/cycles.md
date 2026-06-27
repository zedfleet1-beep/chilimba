# Cycles (Phase 1, Week 5+)

Covers **plan §7.9 (Cycles)**.

## Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/groups/:id/cycles` | bearer + owner | Open a new cycle |
| GET | `/api/v1/groups/:id/cycles` | bearer + member | List cycles |
| GET | `/api/v1/cycles/:id` | bearer + member | Get cycle details with rounds |
| POST | `/api/v1/cycles/:id/complete` | bearer + owner | Force-complete a cycle |

## Lifecycle

```
Cycle:   open → in_progress → completed
Round:   pending → collecting → paid_out → completed
```

## Open a Cycle

**Rules:**
- Only one cycle can be `in_progress` at a time
- Previous cycle must be `completed` before new one starts
- Number of rounds = `maxMembers / payoutRecipientsCount` (rounded up)

**On open:**
- Create `cycles` row
- Generate `cycle_rounds` rows (one per round), each with `dueDate` based on `contributionFrequency`
- Assign recipients per round based on `payoutMethod`:
  - `queue` — pre-assigned by `payoutPosition`, deterministic
  - `random` — randomly selected from members who haven't received payout this cycle
  - `manual` — owner/treasurer selects per round
  - `voting` — members vote (Phase 2)

## Auto-complete

When all rounds are `completed`, the cycle automatically moves to `completed`. A new cycle can then be opened.
