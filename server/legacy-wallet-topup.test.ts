import { strict as assert } from "node:assert";
import test from "node:test";
import {
  legacyPaymentProofLocator,
  legacyWalletTopUpReference,
  parseLegacyWalletTopUpAmount,
} from "./legacy-wallet-topup";

test("legacy wallet references use the same canonical identity as manual queues", () => {
  assert.equal(legacyWalletTopUpReference("  ＡＢＣ-١٢  "), "abc12");
  assert.equal(legacyWalletTopUpReference(""), "");
  assert.equal(legacyWalletTopUpReference(null), "");
  assert.equal(legacyWalletTopUpReference("x".repeat(161)), "");
});

test("legacy receipt locators support historical and current local upload URLs", () => {
  assert.equal(legacyPaymentProofLocator("/uploads/receipt-1.png"), "/uploads/receipt-1.png");
  assert.equal(
    legacyPaymentProofLocator("https://ads-as.com/uploads/receipt-1.png"),
    "/uploads/receipt-1.png",
  );
  assert.equal(
    legacyPaymentProofLocator("https://ads-as.com/api/uploads/receipt-1.png"),
    "/uploads/receipt-1.png",
  );
  assert.equal(legacyPaymentProofLocator("https://example.test/proof.png"), null);
  assert.equal(legacyPaymentProofLocator("/uploads/../private.png"), null);
  assert.equal(legacyPaymentProofLocator("/uploads/receipt/other.png"), null);
});

test("legacy wallet approvals accept bounded exact-piaster amounts only", () => {
  assert.equal(parseLegacyWalletTopUpAmount("75.50"), 75.5);
  assert.equal(parseLegacyWalletTopUpAmount(1_000_000), 1_000_000);
  for (const value of [0, -1, 1_000_000.01, 1.001, "not-a-number", null]) {
    assert.throws(() => parseLegacyWalletTopUpAmount(value), /Invalid wallet top-up amount/);
  }
});