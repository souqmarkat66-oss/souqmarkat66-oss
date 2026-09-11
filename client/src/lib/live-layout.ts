export type BattleMode = "1v1" | "2v2";

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
