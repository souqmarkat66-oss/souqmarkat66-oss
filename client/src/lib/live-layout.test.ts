import { test } from "node:test";
import assert from "node:assert/strict";
import {
  battleGridFor,
  battleParticipantsForDisplay,
  reserveBattleSeats,
} from "./live-layout";

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

test("public PK roster keeps socket targets while splitting audience and points per participant", () => {
  const teams = {
    A: [{ socketId: "host-socket", userId: "10", name: "اسم قديم", audienceCount: 1 }],
    B: [{ socketId: "guest-socket", userId: "20", name: "ضيف", audienceCount: 2 }],
  };

  assert.deepEqual(
    battleParticipantsForDisplay(
      teams,
      {
        "10": {
          userId: "10",
          displayName: "المذيع",
          team: "A",
          slot: 0,
          score: 125,
          audienceCount: 340,
        },
        "20": {
          userId: "20",
          displayName: "الضيف",
          team: "B",
          slot: 0,
          score: 75,
          audienceCount: 89,
        },
      },
      { "10": 999, "20": 999 },
    ),
    [
      {
        socketId: "host-socket",
        userId: "10",
        name: "المذيع",
        audienceCount: 340,
        team: "A",
        score: 125,
      },
      {
        socketId: "guest-socket",
        userId: "20",
        name: "الضيف",
        audienceCount: 89,
        team: "B",
        score: 75,
      },
    ],
  );
});

test("public PK display falls back to public player scores without changing socket identity", () => {
  assert.deepEqual(
    battleParticipantsForDisplay(
      {
        A: [],
        B: [{ socketId: "guest-socket", userId: "20", name: "ضيف", audienceCount: 2 }],
      },
      undefined,
      { "20": 40 },
    ),
    [
      {
        socketId: "guest-socket",
        userId: "20",
        name: "ضيف",
        audienceCount: 2,
        team: "B",
        score: 40,
      },
    ],
  );
});
