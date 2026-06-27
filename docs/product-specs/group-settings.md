# Group Settings (Phase 1, Week 3+)

Covers **plan §7.7 (Group Settings & Templates)**. Every group rule lives in `group_settings`. Nothing is hardcoded.

## Editable Settings

| Setting | Type | Notes |
|---|---|---|
| `name` | string | Group display name |
| `description` | text | Purpose of the group |
| `maxMembers` | int | Hard cap on membership |
| `contributionAmountNgwe` | BigInt | Fixed amount per round |
| `contributionFrequency` | enum | `weekly` / `fortnightly` / `monthly` |
| `gracePeriodDays` | int | Days after due date before late penalty applies |
| `latePenaltyNgwe` | BigInt | Fixed penalty for late payment |
| `payoutRecipientsCount` | int | How many members receive payout each round |
| `payoutMethod` | enum | `queue` / `random` / `manual` / `voting` |
| `allowLoans` | bool | Whether members can take loans |
| `maxLoanMultiplier` | decimal | Max loan = X × member's total savings |
| `loanInterestRate` | decimal | Interest on loans |
| `absencePenaltyNgwe` | BigInt | Penalty for missing meetings |
| `exitPenaltyPercent` | decimal | Penalty for leaving before cycle end |
| `whatsappReminders` | bool | Enable automated messages |
| `reminderDaysBefore` | int | How many days before due date to send reminder |

## Cycle Length (auto)

```
cycle_length_rounds = maxMembers / payoutRecipientsCount
```

E.g. 10 members, 2 recipients per round → 5 rounds per cycle.

## Rule

A settings change that would invalidate an in-progress cycle is **rejected**. (E.g. you can't change `payoutRecipientsCount` while a cycle is `in_progress`.)
