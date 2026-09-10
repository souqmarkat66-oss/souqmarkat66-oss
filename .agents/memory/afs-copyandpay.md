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