import { strict as assert } from "node:assert";
import test from "node:test";
import {
  buildExpiredRechargeCodeResponse,
  buildRechargeRedemptionResponse,
} from "./recharge-code";

test("redeem responses never expose the rotated admin inventory code", () => {
  const successfulResponse = buildRechargeRedemptionResponse(100);
  const expiredResponse = buildExpiredRechargeCodeResponse();

  assert.equal(Object.hasOwn(successfulResponse, "replacementCode"), false);
  assert.equal(Object.hasOwn(expiredResponse, "replacementCode"), false);
  assert.doesNotMatch(successfulResponse.message, /كود جديد|إصدار/);
});