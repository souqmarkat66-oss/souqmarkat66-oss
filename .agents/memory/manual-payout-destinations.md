---
name: Manual payout destination security
description: Durable handling rules for wallet, InstaPay, and card destinations used in manual earnings withdrawals.
---

Treat every manual payout destination as short-lived sensitive data. Encrypt the canonical full value while the withdrawal is pending, expose only a masked suffix in ordinary responses, and irreversibly purge the encrypted value when the request is approved or rejected.

**Why:** The administrator needs the full destination only to execute a pending transfer. Keeping card or account details after finalization creates unnecessary disclosure risk without helping ledger reconciliation.

**How to apply:** Allow full-value reveal only to an authenticated administrator, only for a still-pending request, under the same row lock used by finalization. Record a destination-free audit event, disable caching, clear browser state after use, and retain only the beneficiary name, method, amount, and masked suffix.

All spend and withdrawal debits for one user must share the same transaction-scoped wallet lock. Terminal payment requests must never transition back to pending.

**Why:** Different lock namespaces allow concurrent spending and withdrawal approval to pass independent balance checks; reopening a terminal request can permit a second debit.

**How to apply:** Re-read the applicable ledger balance under the shared user lock, commit the debit and terminal status atomically, and return a conflict for repeated or invalid state transitions.