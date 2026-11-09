# Engineering notes — Campfire Income Statement

**Q1 2026 (2026-01-01 through 2026-03-31): net income = USD (44,480.14).**

## Accounting decisions

- Report the original ledger exactly as recorded; do not amortize the 9,000.00 rent, re-accrue deferred subscription billings, or classify transactions based on memo text.
- Include only `posted` entries in the inclusive selected period. Exclude `draft` and `void` entries, regardless of dates.
- Exclude balance-sheet accounts. Revenue is credits minus debits; expenses are debits minus credits. Contra revenue appears as a negative revenue account line. Expense credits reduce expense. Historical lines in inactive accounts remain valid.
- Categorize by account subtype. Monetary calculations use Decimal and output fixed two-place decimal strings. All seven sections are present even when a date range has no posted activity.
- Load and validate the JSON afresh for each request, so updated company information or transactions appear without restarting the backend. Reject malformed and unbalanced ledger data rather than reporting misleading totals.

## Independent correctness check

The original ledger has **15 accounts** and **25 entries**, including **20 posted entries in Q1**. A separate independent tally using integer cents (not the production Python calculation function) verified:

| Item | USD |
| --- | ---: |
| Product revenue / subscriptions / returns | 35,650.75 / 3,000.00 / (800.25) |
| Revenue | 37,850.50 |
| Cost of goods sold | 14,272.75 |
| Gross profit | 23,577.75 |
| Salaries / rent / software / marketing | 55,500.00 / 9,000.00 / 1,099.97 / 2,500.10 |
| Operating expenses | 68,100.07 |
| Operating income | (44,522.32) |
| Other income | 42.18 |
| **Net income** | **(44,480.14)** |

## AI assistance and verification

AI assisted with implementation, architecture, tests, UI, and documentation. One AI result **not treated as trusted** was the written expected account and period totals: these were independently recalculated from the original posted journal lines using integer cents instead of copying the output from the production function. This is an example of an untrusted result and its check, not a claim that AI demonstrably made a mistake.

## With more time

Run and extend automated interaction/browser tests across browsers, add stronger runtime JSON schema validation, and review error states with an accountant.
