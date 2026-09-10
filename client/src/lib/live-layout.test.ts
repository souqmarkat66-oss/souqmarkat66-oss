import { test } from "node:test";
import assert from "node:assert/strict";
import { battleGridFor, reserveBattleSeats } from "./live-layout";

test("PK modes reserve deterministic non-TikTok split geometry", () => {
  assert.deepEqual(battleGridFor("1v1"), { columns: 2, rows: 1, seatCount: 2 });
  assert.deepEqual(battleGridFor("2v2"), { columns: 2, rows: 2, seatCount: 4 });
});

test("missing cameras do not collapse a PK row or reorder seats", () => {
  assert.deepEqual(
    reserveBattleSeats("2v2", [
      { socketId: "host", name: "المذيع" },
      { socketId: "guest", name: "ضيف" },
    ]),
    [
      { socketId: "host", name: "المذيع" },
      { socketId: "guest", name: "ضيف" },
      { socketId: "empty-seat-2v2-2", name: "في انتظار مشارك" },
      { socketId: "empty-seat-2v2-3", name: "في انتظار مشارك" },
    ],
  );
});
