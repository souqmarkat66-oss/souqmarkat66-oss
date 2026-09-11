import { test } from "node:test";
import assert from "node:assert/strict";
import {
  finiteReportNumber,
  formatReportDate,
  formatReportMoney,
  normalizeRevenueActivity,
  normalizeRevenueActivityList,
  normalizeRevenueTransaction,
} from "./revenue-report";

test("personal report numeric guards tolerate null, malformed, and pg string values", () => {
  assert.equal(finiteReportNumber(null), 0);
  assert.equal(finiteReportNumber(undefined), 0);
  assert.equal(finiteReportNumber(""), 0);
  assert.equal(finiteReportNumber("not-a-number"), 0);
  assert.equal(finiteReportNumber("12.50"), 12.5);
  assert.equal(finiteReportNumber("Infinity", 7), 7);
  assert.equal(finiteReportNumber(null, 9), 9);
});

test("report normalizers consume the current deepToCamel API shape", () => {
  const transaction = normalizeRevenueTransaction({
    id: 4,
    type: "earning",
    amountEGP: "18.25",
    description: null,
    createdAt: "2026-01-02T03:04:05.000Z",
  });
  assert.equal(transaction.amountEGP, 18.25);
  assert.equal(transaction.description, "معاملة مالية");

  const activity = normalizeRevenueActivity({
    id: "revenue_transaction:4",
    source: "revenue_transaction",
    kind: "revenue",
    asset: "EGP",
    amount: "18.25",
    signedAmount: "18.25",
    moneyAmount: "18.25",
    status: "completed",
    description: "هدايا من بث مباشر",
    createdAt: "2026-01-02T03:04:05.000Z",
  });
  assert.equal(activity.amount, 18.25);
  assert.equal(activity.signedAmount, 18.25);
  assert.equal(activity.moneyAmount, 18.25);
  assert.equal(activity.kind, "revenue");
});

test("invalid report timestamps are ignored instead of throwing during render", () => {
  assert.equal(formatReportDate(null), "");
  assert.equal(formatReportDate("not-a-date"), "");
});

test("normalizes numeric strings before replacing the original toFixed render crash", () => {
  const rawApiValue = "2.375";
  assert.throws(() => (rawApiValue as unknown as number).toFixed(3), TypeError);
  assert.equal(formatReportMoney(finiteReportNumber(rawApiValue), 3), "٢٫٣٧٥");
});

test("accepts paginated unified activity metadata without dropping coin/gift rows", () => {
  const rows = normalizeRevenueActivityList({
    activities: [
      { id: "gift:1", kind: "gift_sent", asset: "COIN", amount: "25", signedAmount: "-25" },
      { id: "code:1", kind: "coin_recharge", asset: "COIN", amount: "100", signedAmount: "100" },
      { id: "card:1", source: "afs_card", kind: "coin_purchase", asset: "COIN", amount: "500", signedAmount: "500" },
    ],
    hasMore: true,
    limit: 100,
    offset: 0,
  });
  assert.deepEqual(rows.map(row => row.kind), ["gift_sent", "coin_recharge", "coin_purchase"]);
  assert.equal(rows[2].source, "afs_card");
});