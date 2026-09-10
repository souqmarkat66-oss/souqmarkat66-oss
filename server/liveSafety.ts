/**
 * Small, dependency-free guards shared by the live socket handlers.
 *
 * Keeping these checks free of Socket.IO/DB imports makes the security
 * invariants easy to exercise with node:test without a database connection.
 */

export const LIVE_BATTLE_CHALLENGE_TTL_MS = 90_000;

export interface AuthenticatedSocketIdentity {
  socketId: string;
  authUserId?: unknown;
  authGeneration?: unknown;
}

export interface LiveRoomMembership {
  broadcasterId: string | null;
  cohostIds: readonly string[];
  viewers: ReadonlySet<string>;
}

export function authGeneration(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const generation = Number(value);
  return Number.isInteger(generation) ? generation : null;
}

export function hasAuthenticatedIdentity(identity: AuthenticatedSocketIdentity): boolean {
  return typeof identity.authUserId === "string"
    && identity.authUserId.length > 0
    && authGeneration(identity.authGeneration) !== null;
}

export function isAuthenticatedBroadcaster(
  room: LiveRoomMembership,
  identity: AuthenticatedSocketIdentity,
): boolean {
  return hasAuthenticatedIdentity(identity) && room.broadcasterId === identity.socketId;
}

export function isAuthenticatedRoomMember(
  room: LiveRoomMembership,
  identity: AuthenticatedSocketIdentity,
): boolean {
  if (!hasAuthenticatedIdentity(identity)) return false;
  return room.broadcasterId === identity.socketId
    || room.cohostIds.includes(identity.socketId)
    || room.viewers.has(identity.socketId);
}

export interface PendingBattleChallenge {
  challengeId: string;
  challengerSocketId: string;
  challengerStreamId: string;
  challengerUserId: string;
  challengerAuthGeneration: number;
  targetSocketId: string;
  targetStreamId: string;
  targetUserId: string;
  targetAuthGeneration: number;
  expiresAt: number;
}

export interface BattleChallengeResponseClaims {
  challengeId?: unknown;
  challengerSocketId?: unknown;
  responderStreamId?: unknown;
}

/**
 * A response is matched against the server-created record, not against
 * browser supplied stream/socket identities.  The optional challengeId lets
 * newer clients use the explicit token while the legacy client contract still
 * works by matching the server-forwarded socket and target stream.
 */
export function pendingBattleChallengeMatches(
  record: PendingBattleChallenge,
  response: BattleChallengeResponseClaims,
  responderSocketId: string,
  now = Date.now(),
): boolean {
  if (record.expiresAt <= now || record.targetSocketId !== responderSocketId) return false;
  if (typeof response.challengeId === "string" && response.challengeId !== record.challengeId) return false;
  return response.challengerSocketId === record.challengerSocketId
    && response.responderStreamId === record.targetStreamId;
}

export interface GiftTargetSnapshot {
  room: object;
  broadcasterSocketId: string;
  broadcasterUserId: string;
  broadcasterAuthGeneration: number;
  recipientSocketId: string;
  recipientUserId: string;
  recipientAuthGeneration: number;
}

export interface GiftTargetState {
  room: object | undefined;
  broadcasterSocketId: string | null;
  broadcasterUserId?: unknown;
  broadcasterAuthGeneration?: unknown;
  recipientSocketId: string;
  recipientUserId?: unknown;
  recipientAuthGeneration?: unknown;
  recipientAdmitted: boolean;
}

/**
 * A gift is tied to the exact in-memory room/participant generation that was
 * resolved before the wallet lock.  Any disconnect, room handoff, or session
 * replacement makes the transaction ineligible for commit.
 */
export function giftTargetStillAvailable(
  snapshot: GiftTargetSnapshot,
  current: GiftTargetState,
): boolean {
  return current.room === snapshot.room
    && current.broadcasterSocketId === snapshot.broadcasterSocketId
    && current.broadcasterUserId === snapshot.broadcasterUserId
    && authGeneration(current.broadcasterAuthGeneration) === snapshot.broadcasterAuthGeneration
    && current.recipientSocketId === snapshot.recipientSocketId
    && current.recipientUserId === snapshot.recipientUserId
    && authGeneration(current.recipientAuthGeneration) === snapshot.recipientAuthGeneration
    && current.recipientAdmitted;
}