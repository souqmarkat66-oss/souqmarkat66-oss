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
