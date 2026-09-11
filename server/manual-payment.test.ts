import { strict as assert } from "node:assert";
import test from "node:test";
import { resolveManualPaymentPrice } from "./manual-payment";

test("manual payment pricing is server-authoritative and only AI credits are multi-quantity", () => {
  const settings = {
    boost_price_egp: "250",
    ai_price_per_credit_egp: "5",
    ai_price_content: "7.5",
  };
  assert.deepEqual(
    resolveManualPaymentPrice(settings, "ai_credits", 4, "20.00"),
    { services: ["ai_credits"], quantity: 4, amountEGP: 20 },
  );
  assert.deepEqual(
    resolveManualPaymentPrice(settings, "ad_boost,ai_content", 1, 257.5),
    { services: ["ad_boost", "ai_content"], quantity: 1, amountEGP: 257.5 },
  );
  assert.throws(
    () => resolveManualPaymentPrice(settings, "ai_credits", 4, 0.01),
    /تسعير الخادم/,
  );
  assert.throws(
    () => resolveManualPaymentPrice(settings, "wallet_recharge,ai_credits", 1, 50),
    /طلب مستقل/,
  );
  assert.throws(
    () => resolveManualPaymentPrice({ ai_price_per_credit_egp: "0" }, "ai_credits", 1, 5),
    /إعداد سعر الخدمة/,
  );
  assert.throws(
    () => resolveManualPaymentPrice(settings, "ad_boost", 2, 500),
    /رصيد الذكاء الاصطناعي فقط/,
  );
  assert.throws(
    () => resolveManualPaymentPrice(settings, "ai_credits,ai_content", 2, 25),
    /رصيد الذكاء الاصطناعي فقط/,
  );
  assert.throws(
    () => resolveManualPaymentPrice(settings, "wallet_recharge", 1, "10.001"),
    /قرشين/,
  );
});

test("reference-only wallet recharge remains valid while a proof stays optional", () => {
  assert.deepEqual(
    resolveManualPaymentPrice({}, "wallet_recharge", undefined, "11.25"),
    { services: ["wallet_recharge"], quantity: 1, amountEGP: 11.25 },
  );
});