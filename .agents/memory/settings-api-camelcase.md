---
name: Settings API camelCase keys
description: /api/settings returns camelCase keys (not snake_case) due to deepToCamel middleware
---

The global `deepToCamel()` middleware in `server/routes.ts` auto-converts ALL JSON responses
from snake_case → camelCase before sending to the client.

**Why:** Drizzle stores keys as snake_case in DB but frontend conventions prefer camelCase.

**How to apply:**
- When reading settings in frontend, use camelCase:
  - `settings?.contactWhatsapp` NOT `settings?.contact_whatsapp`
  - `settings?.promoBannerEnabled` NOT `settings?.promo_banner_enabled`
  - `settings?.featureAds` NOT `settings?.feature_ads`
- Backend seeds/storage always use snake_case (that's what goes to DB)
- The /api/pricing endpoint also goes through deepToCamel BUT its keys already are
  snake_case style like `boost_price_egp` → becomes `boostPriceEgp` in frontend!
  Wait - actually /api/pricing is returned via res.json() which goes through the middleware.
  Check how MyDashboard reads pricing keys - they use snake_case `pricing.boost_price_egp`.
  This means either pricing is exempt or it's set up differently. Verify before using.
