import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routesSource = readFileSync(resolve(import.meta.dirname, "routes.ts"), "utf8");
const unifiedRoute = routesSource.slice(
  routesSource.indexOf('app.get("/api/payments/unified"'),
  routesSource.indexOf('// ================================================================\n  // AFS / COPYandPAY CARD PAYMENTS'),
);

test("unified activity keeps personal scope explicit and preserves manual service approvals", () => {
  assert.match(unifiedRoute, /resolvePaymentUserScope\(req, isAdminUser\(req\)\)/);
  assert.match(
    unifiedRoute,
    /type = 'withdrawal'[\s\S]*type = 'top_up' AND service_type = 'wallet_recharge'/,
  );
  assert.match(
    unifiedRoute,
    /type = 'top_up' AND service_type IS DISTINCT FROM 'wallet_recharge' THEN 'spending'/,
  );
  assert.doesNotMatch(
    unifiedRoute,
    /NOT \(status = 'approved' AND type IN \('top_up', 'withdrawal'\)\)/,
  );
});

test("unified activity has deterministic pagination and settlement semantics", () => {
  assert.match(unifiedRoute, /ORDER BY created_at DESC NULLS LAST, id DESC/);
  assert.match(unifiedRoute, /LIMIT \$3 OFFSET \$4/);
  assert.match(unifiedRoute, /0::numeric AS signed_amount/);
  assert.match(unifiedRoute, /status = 'paid' AND service_reference->>'_afsEnvironment' IS DISTINCT FROM 'test'/);
  assert.match(unifiedRoute, /WHEN 'ai_charge' THEN 'spending'/);
});