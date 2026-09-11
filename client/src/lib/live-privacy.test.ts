import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const liveSource = readFileSync(new URL("../pages/LiveStream.tsx", import.meta.url), "utf8");
const paymentSource = readFileSync(new URL("../pages/Payments.tsx", import.meta.url), "utf8");

test("livestream never mounts the private financial panel or fetches financial reports", () => {
  assert.doesNotMatch(liveSource, /LiveOwnWalletPanel|live-own-withdrawable-earnings|withdrawableBalanceEGP|revenueWallet|\/api\/revenue/);
  assert.doesNotMatch(liveSource, /رصيدك:.*myCoins|المتاح للإنفاق|أرباح قابلة للسحب/);
});

test("live purchase/report links leave financial data outside the stream page", () => {
  assert.match(liveSource, /href="\/payments#coin-purchase"/);
  assert.match(liveSource, /window\.open\("\/payments#wallet-report", "_blank", "noopener,noreferrer"\)/);
  assert.match(paymentSource, /id="wallet-report"/);
  assert.match(paymentSource, /id="coin-purchase"/);
  assert.match(paymentSource, /queryKey: \["\/api\/revenue", "coin-wallet-balance", user\?\.id\]/);
});