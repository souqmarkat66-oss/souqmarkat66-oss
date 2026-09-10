/**
 * Small guards shared by money-moving routes.
 *
 * pg returns numeric columns as strings in some deployments and as numbers in
 * others (depending on the column type and pg type parsers).  Treating a
 * missing/invalid value as zero is dangerous for a debit, so parsing is
 * deliberately strict.
 */
export function parseLedgerAmount(value: unknown, field = "ledger amount"): number {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
    throw new Error(`Invalid ${field}`);
  }
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) {
    throw new Error(`Invalid ${field}`);
  }
  return amount;
}

export function parseCoinAmount(value: unknown, field = "coin amount"): number {
  const coins = parseLedgerAmount(value, field);
  if (!Number.isInteger(coins) || coins <= 0) {
    throw new Error(`Invalid ${field}`);
  }
  return coins;
}

export function sameGiftEventIdentity(
  existing: Record<string, unknown> | undefined,
  expected: {
    senderUserId: string;
    recipientUserId: string;
    streamId: number;
    giftType: string;
    grossCoins: number;
  },
): boolean {
  return !!existing
    && String(existing.sender_user_id) === expected.senderUserId
    && String(existing.recipient_user_id) === expected.recipientUserId
    && Number(existing.stream_id) === expected.streamId
    && String(existing.gift_type) === expected.giftType
    && Number(existing.gross_coins) === expected.grossCoins;
}

type PgResultLike = {
  rows?: readonly unknown[];
  rowCount?: number | null;
};

/**
 * A query with RETURNING must produce exactly one row before the caller can
 * report a successful transfer.  Do not accept an array of results: node-pg
 * uses that shape for an unparameterized multi-statement query, and reading
 * `.rows` or `.rowCount` from it would silently skip the mutation check.
 */
export function assertSingleRowResult(
  result: unknown,
  operation: string,
): Record<string, unknown> {
  if (Array.isArray(result)) {
    throw new Error(`${operation} returned multiple statement results`);
  }
  const candidate = result as PgResultLike | null;
  const rows = candidate?.rows;
  if (!Array.isArray(rows)) {
    throw new Error(`${operation} returned no row result`);
  }
  const count = typeof candidate?.rowCount === "number" ? candidate.rowCount : rows.length;
  if (count !== 1 || rows.length !== 1 || !rows[0] || typeof rows[0] !== "object") {
    throw new Error(`${operation} affected an unexpected row count`);
  }
  return rows[0] as Record<string, unknown>;
}