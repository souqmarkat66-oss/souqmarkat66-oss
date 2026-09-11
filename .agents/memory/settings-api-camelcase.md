---
name: Settings API camelCase keys
description: /api/settings returns camelCase keys (not snake_case) due to deepToCamel middleware
---

The global `deepToCamel()` middleware in `server/routes.ts` auto-converts ALL JSON responses
from snake_case → camelCase before sending to the client.

**Why:** Raw SQL rows and already-mapped Drizzle objects pass through the same response converter. Assuming their acronym casing matches caused a live coin-package selector to show no price and prevent submission even though the backend accepted the order.

**How to apply:**
- When reading settings in frontend, use camelCase:
  - `settings?.contactWhatsapp` NOT `settings?.contact_whatsapp`
  - `settings?.promoBannerEnabled` NOT `settings?.promo_banner_enabled`
  - `settings?.featureAds` NOT `settings?.feature_ads`
- Acronyms are not preserved when converting raw SQL keys: `price_egp` becomes
  `priceEgp`, whereas an explicitly projected `amountEGP` remains `amountEGP`.
- Verify the actual endpoint response, not a storage model or another page's
  assumptions. Use a typed response contract and exercise package selection with
  the real response shape; a successful direct submission does not prove that
  the browser's quote calculation allows the user to submit.
