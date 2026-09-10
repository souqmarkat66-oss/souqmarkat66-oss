---
name: AFS COPYandPAY credential format
description: Non-obvious credential formatting behavior observed with the AFS test merchant integration.
---

AFS may provide or copy the test access token as the complete authorization value prefixed with `Bearer`, rather than as the raw token alone. Normalize an optional prefix and surrounding whitespace exactly once before constructing the Authorization header.

**Why:** Sending a second prefix reaches the AFS test endpoint but produces only a generic invalid-or-missing-parameter response, which misleadingly resembles a checkout-field problem.

**How to apply:** Keep accepting both raw-token and prefixed-token secret values. Never log either form, and do not require or store the merchant dashboard password for COPYandPAY API requests.

A read-only probe for a nonexistent checkout is a connectivity check, not proof that the merchant can accept Live payments.

**Why:** The production endpoint can return a structured parameter error without proving successful merchant authorization or checkout creation.

**How to apply:** Report configuration, connectivity, checkout creation, and completed payment verification separately. Never describe a missing-checkout probe as a successful payment test, or create a real charge merely to validate deployment.

AFS result code `200.300.404` is not enough to diagnose authentication: inspect sanitized `parameterErrors` field names before changing credentials or environments.

**Why:** A valid merchant identifier embedded in extra copied text produced this generic error on checkout creation. Using only the intended identifier allowed checkout creation and widget-integrity verification without submitting a card.

**How to apply:** Validate the configured entity identifier's format and configuration-source precedence. Never log parameter values or raw provider responses, and do not silently extract arbitrary credential fragments in application code.

Checkout creation plus an HTTP-200 widget download with matching SRI is still not proof that COPYandPAY renders a usable card form.

**Why:** The provider can return correctly signed JavaScript that renders “invalid or missing entity type” instead of card fields. This was reproduced in a minimal isolated browser page with VISA/MASTER, independent of the application's React lifecycle.

**How to apply:** Verify actual card-field rendering in a browser without submitting card details. If the minimal Live widget reproduces a provider entity-type error, require AFS to verify the Live COPYandPAY channel/entity and matching credentials; do not assume another build, brand removal, or disabling SRI will repair merchant provisioning.

An explicitly owner-authorized sandbox on the published VPS is acceptable only as a non-financial test. Never grant real wallet balance, gift coins, subscriptions, or other services from a sandbox result.

**Why:** A production-hosted integration test shares the application's real accounts and ledger. Successful test card transactions must not become spendable, including after the endpoint is switched back to Live.

**How to apply:** Require explicit production sandbox opt-in, bind each new order to its server-selected environment, label checkout/history/results as test-only, reject cross-environment reuse, and keep sandbox verification outside every financial fulfillment path. Switching back to Live requires a fresh checkout; old test results remain non-financial.