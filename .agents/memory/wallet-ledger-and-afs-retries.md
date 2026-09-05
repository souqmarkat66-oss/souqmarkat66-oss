---
name: Wallet ledger and AFS retry safety
description: Financial source-of-truth and retry rules for EGP wallet balances and AFS checkout intents.
---

Use the revenue ledger as the only source of EGP wallet balances. A wallet recharge increases spendable balance but is not earnings and must never increase withdrawable balance.

**Why:** Maintaining a second mutable balance caused card-funded money to be invisible to some services and made admin totals drift from real credits and debits.

**How to apply:** Derive user and admin balances from signed ledger entries. Classify card/manual top-ups as wallet recharges, earnings separately, and subtract spending, withdrawals, and AI charges.

Keep one AFS idempotency key for the lifetime of a payment intent, including network or provider retries. Replace it only after a successful checkout handoff or when an input that defines the intent changes.

**Why:** Generating a fresh key for each retry permits multiple provider checkout orders for what the user sees as one payment.

**How to apply:** Store keys outside render/request-local retry code, send them in the Idempotency-Key header, and enforce uniqueness per user on the server.

Wallet-funded services must serialize debits per user and commit the debit with the durable service result in one database transaction. Validate inputs before charging; complete external generation before opening the transaction, then atomically save its result and debit.

**Why:** Read-then-debit flows allow concurrent requests to overspend, while charging before validation, external generation, or persistence can take money without delivering the paid service.

**How to apply:** Lock the user's wallet for each debit, re-read the ledger balance under that lock, and roll back both the ledger entry and service record if either write fails. Never represent a service payment as wallet recharge or earnings.

Payment outcome notifications and rejection audit records need stable operation-scoped deduplication keys.

**Why:** Provider verification pages and admin review endpoints can be retried, which must not create duplicate user messages, admin alerts, or rejected-payment rows.

**How to apply:** Derive keys from the durable payment/order ID plus outcome and recipient; expose only categorized Arabic decline reasons to users, never raw provider descriptions.