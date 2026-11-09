# Engineering notes — Campfire Income Statement

**Q1 2026 net income (2026-01-01 through 2026-03-31): USD (44,480.14).**

## Accounting decisions
- Include only **posted** entries dated within the inclusive reporting period. Draft and void entries do not count.
- Use the provided account subtypes; exclude assets, liabilities and equity. Revenue = credits minus debits; expenses = debits minus credits. Contra-revenue discounts reduce revenue; vendor credits reduce expenses.
- Include historical postings to inactive accounts. Do not re-accrue, amortize, or reclassify journal entries based on their memos (including the rent and deferred subscription invoice).
- Use exact Decimal sums and two-place money strings. Validate source data, retain all seven sections, and reload the JSON on each request.

## Independent reconciliation
Original ledger: **15 accounts**, **25 journal entries**, **20 posted in Q1**. I independently tallied posted journal lines in **integer cents**, separately from the application’s Decimal calculation.

| Q1 line | USD |
| --- | ---: |
| Revenue (including returns/discounts) | 37,850.50 |
| Cost of goods sold | 14,272.75 |
| Gross profit | 23,577.75 |
| Operating expenses | 68,100.07 |
| Operating income | (44,522.32) |
| Other income | 42.18 |
| **Net income** | **(44,480.14)** |

Additional tests check alternate months, posting status, inactive accounts, reversals, precision, malformed ledger data, and the API.

## AI assistance and judgment
AI helped draft code, tests, the UI and documentation. I did **not** trust its initially proposed expected totals without checking: I independently recomputed each account and the Q1 bottom line from posted journal lines. This documents a verified result, not an invented AI error.

## Next with more time
Test on the candidate’s restricted Windows environment; expand cross-browser coverage, and review accounting edge cases with an accountant. Hosted Windows, Linux and macOS CI checks are separate from managed-device testing.
