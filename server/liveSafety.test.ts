import test from "node:test";
import assert from "node:assert/strict";
import {
  giftTargetStillAvailable,
  isAuthenticatedBroadcaster,
  isAuthenticatedRoomMember,
  pendingBattleChallengeMatches,
  type PendingBattleChallenge,
} from "./liveSafety";

const room = {
  broadcasterId: "host-socket",
  cohostIds: ["guest-socket"],
  viewers: new Set(["viewer-socket"]),
};

test("room moderation requires an authenticated broadcaster", () => {
  assert.equal(
    isAuthenticatedBroadcaster(room, {
      socketId: "host-socket",
      authUserId: "host-user",
      authGeneration: 4,
    }),
    true,
  );
  assert.equal(
    isAuthenticatedBroadcaster(room, {
      socketId: "host-socket",
      authUserId: "host-user",
      authGeneration: null,
    }),
    false,
  );
  assert.equal(
    isAuthenticatedBroadcaster(room, {
      socketId: "viewer-socket",
      authUserId: "viewer-user",
      authGeneration: 4,
    }),
    false,
  );
});

test("poll voting only accepts an authenticated member of the live room", () => {
  assert.equal(
    isAuthenticatedRoomMember(room, {
      socketId: "viewer-socket",
      authUserId: "viewer-user",
      authGeneration: 2,
    }),
    true,
  );
  assert.equal(
    isAuthenticatedRoomMember(room, {
      socketId: "unknown-socket",
      authUserId: "viewer-user",
      authGeneration: 2,
    }),
    false,
  );
  assert.equal(
    isAuthenticatedRoomMember(room, {
      socketId: "guest-socket",
      authUserId: "",
      authGeneration: 2,
    }),
    false,
  );
});

const challenge: PendingBattleChallenge = {
  challengeId: "challenge-1",
  challengerSocketId: "challenger-socket",
  challengerStreamId: "101",
  challengerUserId: "challenger-user",
  challengerAuthGeneration: 8,
  targetSocketId: "target-socket",
  targetStreamId: "202",
  targetUserId: "target-user",
  targetAuthGeneration: 11,
  expiresAt: 10_000,
};

test("cross-stream responses cannot spoof the target or challenge token", () => {
  assert.equal(
    pendingBattleChallengeMatches(
      challenge,
      {
        challengeId: "challenge-1",
        challengerSocketId: "challenger-socket",
        responderStreamId: "202",
      },
      "target-socket",
      9_999,
    ),
    true,
  );
  assert.equal(
    pendingBattleChallengeMatches(
      challenge,
      {
        challengerSocketId: "other-socket",
        responderStreamId: "202",
      },
      "target-socket",
      9_999,
    ),
    false,
  );
  assert.equal(
    pendingBattleChallengeMatches(
      challenge,
      {
        challengeId: "challenge-1",
        challengerSocketId: "challenger-socket",
        responderStreamId: "202",
      },
      "attacker-socket",
      9_999,
    ),
    false,
  );
  assert.equal(
    pendingBattleChallengeMatches(
      challenge,
      {
        challengeId: "forged",
        challengerSocketId: "challenger-socket",
        responderStreamId: "202",
      },
      "target-socket",
      9_999,
    ),
    false,
  );
  assert.equal(
    pendingBattleChallengeMatches(
      challenge,
      {
        challengerSocketId: "challenger-socket",
        responderStreamId: "202",
      },
      "target-socket",
      10_000,
    ),
    false,
  );
});

test("gift target generation rejects disconnects and session replacement", () => {
  const snapshot = {
    room,
    broadcasterSocketId: "host-socket",
    broadcasterUserId: "host-user",
    broadcasterAuthGeneration: 4,
    recipientSocketId: "guest-socket",
    recipientUserId: "guest-user",
    recipientAuthGeneration: 9,
  };
  const current = {
    room,
    broadcasterSocketId: "host-socket",
    broadcasterUserId: "host-user",
    broadcasterAuthGeneration: 4,
    recipientSocketId: "guest-socket",
    recipientUserId: "guest-user",
    recipientAuthGeneration: 9,
    recipientAdmitted: true,
  };
  assert.equal(giftTargetStillAvailable(snapshot, current), true);
  assert.equal(
    giftTargetStillAvailable(snapshot, { ...current, recipientAdmitted: false }),
    false,
  );
  assert.equal(
    giftTargetStillAvailable(snapshot, { ...current, recipientAuthGeneration: 10 }),
    false,
  );
  assert.equal(
    giftTargetStillAvailable(snapshot, {
      ...current,
      room: { ...room },
    }),
    false,
  );
});