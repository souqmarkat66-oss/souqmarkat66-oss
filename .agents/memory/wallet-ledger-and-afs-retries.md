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

The legacy external-wallet transfer/reference/receipt flow must remain a first-class alternative to AFS and internal EGP-to-coin conversion.

**Why:** The owner clarified that “the old wallet” means Vodafone Cash, Etisalat Cash, InstaPay and Souq Market transfers reviewed by an administrator—not Visa and not merely spending an existing site balance. Replacing that path with a new wallet-purchase button did not address the request.

**How to apply:** Verify submission, receipt/reference review, approval, coin or EGP credit, gift spending and withdrawal separately. A payment reference is not proof of settlement. Deposits and coin purchases need verified transfer evidence; withdrawal requests must not require an incoming-payment receipt.

Legacy production identifier columns can mix PostgreSQL text and varchar even when development schemas look uniform.

**Why:** The deployed gift transaction rolled back with PostgreSQL 42P08 because one parameter was inferred as both types across an inserted ledger user ID and a channel lookup. This was confirmed from production errors and reproduced with mixed-type temporary tables.

**How to apply:** Explicitly type parameters used across legacy identifier columns and include mixed-schema integration coverage. Diagnose actual production error codes before guessing that a table or balance is missing.

Accept a transfer reference without an image only as a pending manual-payment claim, never as settlement evidence.

**Why:** The owner explicitly requested reference-only submission as part of the old wallet flow. Optional screenshots must not weaken the administrator's responsibility to match the actual transfer before approval.

**How to apply:** Keep reference replay protection across incoming order sources, validate ownership of any supplied image, and clearly distinguish submission, verified payment, and service delivery.

Never automatically replay historical approved orders merely because their fulfillment metadata is missing.

**Why:** Read-only production inspection found historical approved orders with no fulfillment evidence, including mixed service markers that current validation would reject. Missing metadata cannot establish whether money or a service was already delivered.

**How to apply:** Mark ambiguous historical orders for reconciliation without posting financial movements; require a separate audited reconciliation decision instead of rerunning approval.