---
name: Frontend module recovery
description: Safe recovery boundaries for lazy page downloads around payment flows
---

Retry transient JavaScript module downloads only; do not automatically reload the whole application or replay API mutations as a recovery strategy.

**Why:** An expired or interrupted lazy-page download can blank React's root, but automatic reloads can discard in-progress financial forms and obscure whether a payment request was submitted.

**How to apply:** Bound code-download retries, propagate persistent failures to a visible recovery screen, and make full-page reload an explicit user action. Remind users to check existing payment status before attempting another payment.