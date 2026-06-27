# Loans (Phase 3)

Covers **plan §7.16 (Loans)**. Module is not implemented in Phase 1 or Phase 2.

## Eligibility

- Member must have been in group for at least 1 full round
- Member must have no unpaid penalties
- Member must have no existing active loan
- Loan amount ≤ `memberTotalSavings * maxLoanMultiplier`
- Loan amount ≤ `groupSettings.loanCeiling` (if set)

## Flow

```
Member requests loan
      │
      ▼
Member nominates sureties (guarantors from same group)
      │
      ▼
Sureties confirm via WhatsApp or app
      │
      ▼
Owner/Treasurer approves
      │
      ▼
Loan disbursed (recorded in `loans`)
      │
      ▼
Monthly repayment tracked
      │
      ▼
Loan fully repaid → status = 'repaid'
```

## Interest

```
totalDue = loanAmount * (1 + interestRate)
e.g. K3,000 at 20% = K3,600 total due
```

## Default

If loan not repaid by `dueDate`: `status = 'defaulted'`, penalty applied, sureties liable.
