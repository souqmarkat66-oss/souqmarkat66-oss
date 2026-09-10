import { test } from "node:test";
import assert from "node:assert/strict";
import { AFS_LIVE_URL, AFS_TEST_URL, afsOrderMode, assertAfsLiveSettlement, bindAfsEnvironment, resolveAfsEnvironment, sameAfsReference } from "./afsEnvironment";
import { verifyAfsSandboxOrder } from "./afsSandbox";

test("production sandbox requires explicit opt-in and never falls back implicitly", () => {
  assert.throws(() => resolveAfsEnvironment({ NODE_ENV: "production" }));
  assert.throws(() => resolveAfsEnvironment({ NODE_ENV: "production", AFS_BASE_URL: AFS_TEST_URL }));
  assert.equal(resolveAfsEnvironment({ NODE_ENV: "production", AFS_BASE_URL: AFS_TEST_URL, AFS_ALLOW_TEST_MODE: "true" }).mode, "test");
  assert.equal(resolveAfsEnvironment({ NODE_ENV: "production", AFS_BASE_URL: AFS_LIVE_URL }).mode, "live");
  assert.throws(() => resolveAfsEnvironment({ NODE_ENV: "development", AFS_BASE_URL: AFS_LIVE_URL }));
  assert.throws(() => resolveAfsEnvironment({ AFS_BASE_URL: AFS_TEST_URL + "/attacker" }));
});

test("test orders can never settle after switching to Live; live orders cannot settle in Test", () => {
  const sandbox = { service_reference: bindAfsEnvironment(null, "test") };
  for (const mode of ["test", "live"] as const) assert.throws(() => assertAfsLiveSettlement(sandbox, mode));
  assert.throws(() => assertAfsLiveSettlement({}, "test"));
  assert.doesNotThrow(() => assertAfsLiveSettlement({}, "live"));
  assert.throws(() => afsOrderMode({ service_reference: { _afsEnvironment: "invalid" } }));
});

test("retry comparison retains service intent and separates environments", () => {
  assert.equal(sameAfsReference({ adId: 5, durationDays: 7 }, { durationDays: 7, adId: 5, _afsEnvironment: "live" }), true);
  assert.equal(sameAfsReference(null, bindAfsEnvironment(null, "test")), false);
  assert.equal(sameAfsReference({ adId: 5 }, { adId: 6 }), false);
});

test("sandbox success only marks a non-settled test order, never a ledger or service", async () => {
  const calls: string[] = [];
  const result = await verifyAfsSandboxOrder({ id: 1, checkout_id: "test-id", service_reference: bindAfsEnvironment(null, "test") }, async sql => {
    calls.push(sql);
    return { rows: [{ service_reference: { _afsTestResult: "paid" } }] };
  }, async () => ({ result: { code: "000.000.000" } }));
  assert.equal(result.status, "test");
  assert.equal(result.testOutcome, "paid");
  assert.equal(result.serviceActivated, false);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /UPDATE afs_payment_orders SET status='failed'/);
  assert.doesNotMatch(calls[0], /coin_wallets|revenue_transactions|coin_transactions|UPDATE ads|UPDATE users/);
});

test("repeat verification uses saved test outcome, without provider or financial writes", async () => {
  const result = await verifyAfsSandboxOrder({ id: 1, service_reference: { _afsEnvironment: "test", _afsTestResult: "paid" } },
    async () => { throw new Error("Unexpected write"); }, async () => { throw new Error("Unexpected provider call"); });
  assert.equal(result.status, "test");
  assert.equal(result.serviceActivated, false);
});

test("sandbox handler rejects live orders and leaves pending tests unfulfilled", async () => {
  const noWrite = async () => { throw new Error("Unexpected write"); };
  await assert.rejects(verifyAfsSandboxOrder({}, noWrite, async () => ({})));
  const result = await verifyAfsSandboxOrder({ id: 1, service_reference: { _afsEnvironment: "test" } }, noWrite,
    async () => ({ result: { code: "000.200.000" } }));
  assert.equal(result.status, "pending");
  assert.equal(result.serviceActivated, false);
});