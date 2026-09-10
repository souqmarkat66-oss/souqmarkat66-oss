import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSingleRowResult,
  parseCoinAmount,
  parseLedgerAmount,
  sameGiftEventIdentity,
} from "./wallet-ledger";

test("parses PostgreSQL numeric EGP values returned as strings", () => {
  assert.equal(parseLedgerAmount("12.50", "balance"), 12.5);
  assert.equal(parseLedgerAmount(4, "balance"), 4);
});

test("rejects invalid numeric values instead of treating them as zero", () => {
  assert.throws(() => parseLedgerAmount(null, "balance"), /Invalid balance/);
  assert.throws(() => parseLedgerAmount("not-a-number", "balance"), /Invalid balance/);
});

test("keeps gift replay identity strict and coin values integral", () => {
  const event = {
    sender_user_id: "sender",
    recipient_user_id: "broadcaster",
    stream_id: "42",
    gift_type: "rose",
    gross_coins: "25",
  };
  assert.equal(
    sameGiftEventIdentity(event, {
      senderUserId: "sender",
      recipientUserId: "broadcaster",
      streamId: 42,
      giftType: "rose",
      grossCoins: 25,
    }),
    true,
  );
  assert.equal(
    sameGiftEventIdentity(event, {
      senderUserId: "sender",
      recipientUserId: "broadcaster",
      streamId: 42,
      giftType: "rose",
      grossCoins: 50,
    }),
    false,
  );
  assert.equal(parseCoinAmount("25"), 25);
  assert.throws(() => parseCoinAmount(2.5), /Invalid coin amount/);
});

test("requires one row from a parameterized RETURNING query", () => {
  assert.deepEqual(
    assertSingleRowResult({ rowCount: 1, rows: [{ balance: "3" }] }, "wallet debit"),
    { balance: "3" },
  );
  assert.throws(
    () => assertSingleRowResult({ rowCount: 0, rows: [] }, "wallet debit"),
    /unexpected row count/,
  );
  // node-pg returns an array for an unparameterized multi-statement query.
  assert.throws(
    () => assertSingleRowResult([{ rowCount: 1, rows: [{}] }], "wallet debit"),
    /multiple statement results/,
  );
});