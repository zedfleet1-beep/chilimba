# Reports (Phase 2)

Covers **plan §7.14 (Reports)**. Module is not implemented in Phase 1.

## Per-Group Reports

- **Cycle summary** — total collected, total paid out, balance
- **Member statement** — all contributions, payouts, penalties per member
- **Outstanding contributions** — who hasn't paid for current round
- **Loan book** — all active loans, repayment status (if loans enabled)

## Export

- **PDF** (server-side PDF library — TBD: pdfkit vs puppeteer)
- **WhatsApp share** — sends a summary message to the group owner

## Auto-Generated Monthly Summary

Sent on the 1st of each month via WhatsApp to every group owner:

```
{group_name} — Monthly Summary
Month: {month}

Total collected: {amount}
Contributions received: {count}/{total_expected}
Late contributions: {count}
Penalties issued: {count}
Loans outstanding: {amount}

View full report: {link}
```
