import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LIVE_PAYMENT_METHODS } from "./live-payment-method";

const paymentsSource = readFileSync(new URL("../pages/Payments.tsx", import.meta.url), "utf8");
const adminSource = readFileSync(new URL("../pages/AdminPanel.tsx", import.meta.url), "utf8");
const liveSource = readFileSync(new URL("../pages/LiveStream.tsx", import.meta.url), "utf8");

test("all live coin selectors submit supported canonical payment methods", () => {
  assert.deepEqual(LIVE_PAYMENT_METHODS, {
    vodafone: "etisalat", vodafone2: "vodafone", instapay: "instapay", bank: "souq",
  });
  assert.match(liveSource, /method: LIVE_PAYMENT_METHODS\[payMethod\]/);
});

test("manual coin purchase screens consume the actual camel-cased package price", () => {
  assert.match(paymentsSource, /selectedCoinPackage\?\.priceEgp/);
  assert.match(liveSource, /selectedPkg\.priceEgp/);
  assert.match(liveSource, /pkg\.priceEgp/);
  for (const source of [paymentsSource, liveSource]) {
    assert.doesNotMatch(source, /(?:pkg|selectedPkg|selectedCoinPackage)\??\.(?:priceEGP|price_egp)/);
    assert.match(source, /useQuery<CoinPackage\[\]>/);
  }
});

test("manual payment uses the camel-cased pricing response and server-priced package fields", () => {
  assert.match(paymentsSource, /pricing\.boostPriceEgp/);
  assert.match(paymentsSource, /pricing\.walletMinWithdrawalEgp/);
  assert.match(paymentsSource, /coinPackageId: selectedServices\.has\("coin_package"\)/);
  assert.match(paymentsSource, /aiCreditsQuantity: selectedServices\.has\("ai_credits"\)/);
  assert.match(paymentsSource, /serviceQuantity: selectedServices\.has\("ai_credits"\) \? undefined : 1/);
  assert.match(paymentsSource, /serverPricedManualOrder \? \{\} : \{ amountEGP/);
  assert.match(paymentsSource, /قيمة التحويل الحالية/);
  assert.match(paymentsSource, /renewalPrice30d/);
  assert.match(paymentsSource, /تمديد صلاحية إعلانك 30 يوماً/);
  assert.doesNotMatch(paymentsSource, /pricing\.boost_price_egp/);
});

test("manual orders require a transfer reference but do not require receipt uploads", () => {
  assert.match(paymentsSource, /أدخل رقم مرجع التحويل/);
  assert.match(paymentsSource, /requiresAd/);
  assert.match(paymentsSource, /اختر الإعلان المطلوب لهذه الخدمة/);
  assert.match(paymentsSource, /purchasedCredits/);
  assert.match(paymentsSource, /صورة إيصال الدفع.*اختيارية/);
  assert.match(liveSource, /serviceType: "coin_package"/);
  assert.match(liveSource, /screenshotUrl: payScreenshotUrl \|\| undefined/);
  assert.doesNotMatch(liveSource, /if \(!payScreenshotUrl\)/);
  assert.doesNotMatch(liveSource, /\/api\/coins\/purchase-order/);
});

test("admin records actual transfer verification and completes each service through its delivery contract", () => {
  assert.match(adminSource, /action: p\.type === "withdrawal" \? "transfer_executed" : "verify_transfer"/);
  assert.match(adminSource, /تحققت فعلياً من وصول التحويل/);
  assert.match(adminSource, /transferReference: p\.type === "withdrawal" \? transferReferences\[p\.id\]\.trim\(\) : undefined/);
  assert.match(adminSource, /رقم مرجع التحويل الصادر الفعلي \(مطلوب\)/);
  assert.match(adminSource, /setTransferReferences/);
  assert.match(adminSource, /\/api\/admin\/payments\/\$\{paymentId\}\/deliveries\/\$\{encodeURIComponent\(serviceType\)\}/);
  assert.match(adminSource, /body: JSON\.stringify\(\{ deliveryNote, deliveryResult \}\)/);
  assert.match(adminSource, /p\.serviceDeliveries/);
  assert.doesNotMatch(adminSource, /serviceFulfillments:/);
  assert.match(adminSource, /"تنفيذ جزئي — راجع التفاصيل"/);
  assert.match(adminSource, /"طلب قديم — راجع التنفيذ"/);
});

test("live recharge restores instant EGP-wallet purchase alongside manual review", () => {
  assert.match(liveSource, /\/api\/coins\/purchase-with-wallet/);
  assert.match(liveSource, /"Idempotency-Key": idempotencyKey/);
  assert.match(liveSource, /body: JSON\.stringify\(\{ packageId \}\)/);
  assert.match(liveSource, /data-testid="btn-live-purchase-from-wallet"/);
  assert.match(liveSource, /data-testid="live-wallet-balance"/);
  assert.match(liveSource, /data-testid="live-coin-balance"/);
  assert.match(liveSource, /queryClient\.invalidateQueries\(\{ queryKey: \["\/api\/coins\/wallet"\] \}\)/);
  assert.match(liveSource, /socket\.on\("gift-accepted"/);
  assert.match(liveSource, /60% للمذيع/);
  assert.match(liveSource, /40% للمنصة/);
});

test("live manual recharge covers every legacy transfer route and remains pending until review", () => {
  assert.match(liveSource, /LIVE_PAYMENT_METHODS\[payMethod\]/);
  assert.match(liveSource, /data-testid={`btn-paymethod-\$\{m\.key\}`}/);
  assert.match(liveSource, /سوق ماركات/);
  assert.match(liveSource, /Vodafone|فودافون/);
  assert.match(liveSource, /Etisalat|اتصالات/);
  assert.match(liveSource, /InstaPay|انستا باي/);
  assert.match(liveSource, /data-testid="input-pay-screenshot"/);
  assert.match(liveSource, /data-testid="manual-purchase-pending-note"/);
  assert.match(liveSource, /setPurchaseDoneMode\("manual"\)/);
});

test("admin exposes canonical wallet requests plus legacy wallet and coin proof queues", () => {
  assert.match(adminSource, /\/api\/admin\/payments/);
  assert.match(adminSource, /payment_requests canonical/);
  assert.match(adminSource, /\/api\/admin\/wallet-topups/);
  assert.match(adminSource, /wallet_top_up_orders/);
  assert.match(adminSource, /\/api\/admin\/coins\/purchase-orders/);
  assert.match(adminSource, /coin_purchase_orders/);
  assert.match(adminSource, /data-testid=\{`img-coin-order-receipt-\$\{order\.id\}`\}/);
  assert.match(adminSource, /data-testid=\{`img-wallet-receipt-\$\{o\.id\}`\}/);
  assert.match(adminSource, /btn-approve-wallet/);
  assert.match(adminSource, /btn-reject-wallet/);
});

test("card copy keeps AFS live verification and does not claim production readiness", () => {
  assert.match(paymentsSource, /AFS الموثّق حيّاً/);
  assert.match(paymentsSource, /وضع الاختبار لا يضيف رصيداً حقيقياً/);
  assert.match(paymentsSource, /\/api\/payments\/afs\/checkout/);
});