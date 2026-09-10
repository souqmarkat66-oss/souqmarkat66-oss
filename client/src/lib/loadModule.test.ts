import { test } from "node:test";
import assert from "node:assert/strict";
import { loadModule, isModuleLoadError } from "./loadModule";

const noWait = async () => {};

test("successful module loads once", async () => {
  let calls = 0;
  assert.equal(await loadModule(async () => { calls++; return "page"; }, noWait), "page");
  assert.equal(calls, 1);
});

test("transient module failure retries once and recovers", async () => {
  let calls = 0;
  const value = await loadModule(async () => {
    if (++calls === 1) throw new TypeError("Failed to fetch dynamically imported module: /Payments.tsx");
    return "page";
  }, noWait);
  assert.equal(value, "page");
  assert.equal(calls, 2);
});

test("persistent download failure rejects after two attempts", async () => {
  let calls = 0;
  await assert.rejects(loadModule(async () => {
    calls++;
    throw new TypeError("Importing a module script failed.");
  }, noWait));
  assert.equal(calls, 2);
});

test("application and payment failures are never retried", async () => {
  for (const error of [new Error("Payment rejected"), new TypeError("Failed to fetch"), new Error("Render error")]) {
    let calls = 0;
    await assert.rejects(loadModule(async () => { calls++; throw error; }, noWait), e => e === error);
    assert.equal(calls, 1);
    assert.equal(isModuleLoadError(error), false);
  }
});