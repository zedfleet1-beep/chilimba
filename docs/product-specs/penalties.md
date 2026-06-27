# Penalties (Phase 2)

Covers **plan §7.13 (Penalties)**. Module is not implemented in Phase 1. This is the contract.

## Types

- `late_contribution` — auto-created when a contribution is recorded late
- `meeting_absence` — manually recorded by treasurer
- `early_exit` — calculated on member removal mid-cycle

## Amount Sources

- `late_contribution`: from `group_settings.latePenaltyNgwe`
- `meeting_absence`: from `group_settings.absencePenaltyNgwe`
- `early_exit`: `member_savings * group_settings.exitPenaltyPercent`

## Resolution

- Treasurer marks as `paid` (cash collected outside system)
- Owner can `waive` with reason
- Unpaid penalties block payout: member cannot receive a payout round while they have unpaid penalties
