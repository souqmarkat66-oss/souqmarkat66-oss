import { test } from "node:test";
import assert from "node:assert/strict";
import { resolvePaymentUserScope } from "./activity-scope";

const request = (sub: string, scope?: string) => ({
  user: { claims: { sub } },
  query: scope === undefined ? {} : { scope },
});

test("admin personal scope is forced to the authenticated admin", () => {
  assert.equal(resolvePaymentUserScope(request("admin-1", "self"), true), "admin-1");
  assert.equal(resolvePaymentUserScope(request("admin-1"), true), null);
  assert.equal(resolvePaymentUserScope(request("admin-1", "all"), true), null);
});

test("normal users remain account-scoped even if they request an all-users scope", () => {
  assert.equal(resolvePaymentUserScope(request("user-1"), false), "user-1");
  assert.equal(resolvePaymentUserScope(request("user-1", "all"), false), "user-1");
});