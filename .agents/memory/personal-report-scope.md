---
name: Personal financial reporting boundaries
description: Why personal financial reports must not inherit administrator-wide activity scope
---

A personal financial report must remain scoped to the authenticated account even when that account is an administrator. Keep administrator-wide reporting a separate explicit experience.

**Why:** Reusing administrator-capable payment endpoints during the report repair mixed global activity and withdrawal requests with self-only balance totals. The user wants each account's own deposits, withdrawals, earnings, coin activity, and history together, not an administrative ledger.

**How to apply:** Verify both admin-self and ordinary-user paths whenever personal reports reuse shared payment queries. Do not count pending requests or sandbox attempts as settled financial movements, and derive headline totals from the complete ledger rather than loaded history pages.