export type BattleMode = "1v1" | "2v2";

export const BATTLE_ROUND_SECONDS = 300;
export const BATTLE_ROUND_DURATION_MS = BATTLE_ROUND_SECONDS * 1000;

export interface BattleGrid {
  columns: 2;
  rows: 1 | 2;
  seatCount: 2 | 4;
}

/**
 * PK video is a fixed two-column canvas, not a scrolling/social feed layout.
 * Reserving every seat even while a track is settling keeps participants from
 * jumping between rows when a camera connects or disconnects.
 */
export function battleGridFor(mode: BattleMode): BattleGrid {
  return mode === "2v2"
    ? { columns: 2, rows: 2, seatCount: 4 }
    : { columns: 2, rows: 1, seatCount: 2 };
}

export interface BattleSeat {
  socketId: string;
  name: string;
}

export interface ActiveBattleCoHost extends BattleSeat {
  hasCamera?: boolean;
}

export interface BattleParticipant extends BattleSeat {
  userId: string;
  audienceCount: number;
}

export interface BattleTeams {
  A: BattleParticipant[];
  B: BattleParticipant[];
}

export interface PublicBattleRosterEntry {
  userId: string;
  displayName: string;
  team: "A" | "B";
  slot: number;
  score: number;
  audienceCount: number;
  cameraEnabled?: boolean;
}

export interface BattleDisplayParticipant extends BattleParticipant {
  team: "A" | "B";
  score: number;
}

export interface BattleStartRoster {
  teamA: string[];
  teamB: string[];
}

/**
 * Build the only roster that a broadcaster is allowed to submit when a
 * round starts. The first admitted guest is always team B in 1v1; in 2v2
 * the second guest joins the broadcaster on team A and guests one and three
 * form team B. Socket ids are copied from the admitted-seat roster rather
 * than inferred from an array index at the server.
 */
export function battleStartRoster(
  mode: BattleMode,
  cohosts: readonly ActiveBattleCoHost[],
): BattleStartRoster | null {
  const requiredGuests = mode === "2v2" ? 3 : 1;
  const guests: string[] = [];
  for (const cohost of cohosts) {
    const socketId = String(cohost.socketId || "").trim();
    if (socketId && !guests.includes(socketId)) guests.push(socketId);
    if (guests.length === requiredGuests) break;
  }
  if (guests.length !== requiredGuests) return null;
  return mode === "2v2"
    ? { teamA: [guests[1]], teamB: [guests[0], guests[2]] }
    : { teamA: [], teamB: [guests[0]] };
}

export interface BattleGiftTarget {
  socketId: string;
  name: string;
  team: "A" | "B";
  userId?: string;
}

/**
 * Gift buttons must represent the current server roster one seat at a time.
 * Keeping the broadcaster's real socket id here avoids a null/host alias
 * becoming stale when a guest leaves and another guest takes a seat.
 */
export function battleGiftTargets(teams: BattleTeams): BattleGiftTarget[] {
  return (["A", "B"] as const).flatMap(team =>
    teams[team].map(member => ({
      socketId: member.socketId,
      userId: member.userId,
      name: member.name,
      team,
    })),
  );
}

export function battleGiftTargetIsActive(
  targetSocketId: string | null | undefined,
  teams: BattleTeams | undefined,
): boolean {
  if (!targetSocketId || !teams) return false;
  return battleGiftTargets(teams).some(target => target.socketId === targetSocketId);
}

/**
 * Countdown is calculated from the server deadline. A local interval only
 * controls repaint cadence and can never extend a round past its deadline.
 */
export function battleSecondsRemaining(
  endsAt: number,
  now = Date.now(),
): number {
  if (!Number.isFinite(endsAt)) return 0;
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

function nonNegativeNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * Merge the public, user-keyed roster with the socket-keyed team list.
 *
 * Socket ids are deliberately retained from `teams`: they are needed to bind
 * WebRTC tracks and to target a gift, but they must never be used as a
 * participant's identity. Public names, audience counts, and points come from
 * the server's stable roster when available. This keeps every viewer's PK
 * tiles deterministic even while an older battle-state payload is settling.
 */
export function battleParticipantsForDisplay(
  teams: BattleTeams,
  roster: Readonly<Record<string, PublicBattleRosterEntry>> | undefined,
  playerScores: Readonly<Record<string, number>> = {},
): BattleDisplayParticipant[] {
  return (["A", "B"] as const).flatMap(team =>
    teams[team].map(member => {
      const publicMember = roster?.[String(member.userId)];
      const fallbackScore = playerScores[String(member.userId)];
      return {
        ...member,
        team,
        name: publicMember?.displayName?.trim() || member.name,
        audienceCount: nonNegativeNumber(
          publicMember?.audienceCount ?? member.audienceCount,
        ),
        score: nonNegativeNumber(publicMember?.score ?? fallbackScore),
      };
    }),
  );
}

export function reserveBattleSeats(
  mode: BattleMode,
  members: readonly BattleSeat[],
): BattleSeat[] {
  const { seatCount } = battleGridFor(mode);
  const seats = members.slice(0, seatCount);
  return Array.from({ length: seatCount }, (_, index) =>
    seats[index] || {
      socketId: `empty-seat-${mode}-${index}`,
      name: "في انتظار مشارك",
    },
  );
}
