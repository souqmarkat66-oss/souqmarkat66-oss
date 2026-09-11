/**
 * Values in the personal report can come from Drizzle (camelCase numbers) or
 * raw pg queries (camelCase strings after the response middleware). Keep all
 * rendering code on one predictable shape and never let malformed accounting
 * data throw from a React render.
 */
export function finiteReportNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function reportString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}

export function reportField<T = unknown>(
  row: Record<string, unknown> | null | undefined,
  camelName: string,
  snakeName: string,
): T | undefined {
  if (!row) return undefined;
  return (row[camelName] ?? row[snakeName]) as T | undefined;
}

export type RevenueReportTransaction = {
  id: string | number;
  type: string;
  amountEGP: number;
  description: string;
  createdAt: string | Date | null;
  [key: string]: unknown;
};

export function normalizeRevenueTransaction(
  value: unknown,
  index = 0,
): RevenueReportTransaction {
  const row = value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};
  const id = reportField(row, "id", "id");
  return {
    ...row,
    id: id == null ? `transaction-${index}` : id as string | number,
    type: reportString(reportField(row, "type", "type"), "adjustment"),
    amountEGP: finiteReportNumber(reportField(row, "amountEGP", "amount_egp")),
    description: reportString(reportField(row, "description", "description"), "معاملة مالية"),
    createdAt: (reportField(row, "createdAt", "created_at") ?? null) as string | Date | null,
  };
}

export type RevenueActivity = {
  id: string | number;
  source: string;
  kind: string;
  asset: string;
  amount: number;
  signedAmount: number;
  moneyAmount: number | null;
  status: string;
  description: string;
  reference: string;
  createdAt: string | Date | null;
  [key: string]: unknown;
};

export function normalizeRevenueActivity(value: unknown, index = 0): RevenueActivity {
  const row = value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};
  const amount = finiteReportNumber(reportField(row, "amount", "amount"));
  const signedValue = reportField(row, "signedAmount", "signed_amount");
  return {
    ...row,
    id: (reportField(row, "id", "id") ?? `activity-${index}`) as string | number,
    source: reportString(reportField(row, "source", "source")),
    kind: reportString(reportField(row, "kind", "kind"), "adjustment"),
    asset: reportString(reportField(row, "asset", "asset"), "EGP"),
    amount,
    signedAmount: signedValue == null ? amount : finiteReportNumber(signedValue),
    moneyAmount: reportField(row, "moneyAmount", "money_amount") == null
      ? null
      : finiteReportNumber(reportField(row, "moneyAmount", "money_amount")),
    status: reportString(reportField(row, "status", "status"), "completed"),
    description: reportString(reportField(row, "description", "description"), "نشاط مالي"),
    reference: reportString(reportField(row, "reference", "reference")),
    createdAt: (reportField(row, "createdAt", "created_at") ?? null) as string | Date | null,
  };
}

export function normalizeRevenueTransactions(value: unknown): RevenueReportTransaction[] {
  return Array.isArray(value) ? value.map(normalizeRevenueTransaction) : [];
}

export function normalizeRevenueActivityList(value: unknown): RevenueActivity[] {
  if (Array.isArray(value)) return value.map(normalizeRevenueActivity);
  if (value && typeof value === "object") {
    const rows = (value as Record<string, unknown>).activities;
    return Array.isArray(rows) ? rows.map(normalizeRevenueActivity) : [];
  }
  return [];
}

export type RevenueReportRole = "advertiser" | "publisher" | "both";
export type RevenueReportTab = "advertiser" | "publisher";
export const REVENUE_REPORT_PENDING_PREFERENCE_KEY = "souq:revenue-report:pending";
const REVENUE_REPORT_PREFERENCE_PREFIX = "souq:revenue-report:user:";

/**
 * The custom login flow currently persists most accounts as `user`, so that
 * value is intentionally treated as unknown rather than being guessed from
 * whether a report happens to contain rows.  Only explicit account roles can
 * restrict the available reports; an explicit browser preference only picks
 * the initial tab for an otherwise dual-role account.
 */
export function normalizeRevenueReportRole(value: unknown): RevenueReportRole {
  const role = reportString(value).trim().toLowerCase();
  if (role === "advertiser") return "advertiser";
  if (role === "publisher" || role === "channel" || role === "creator") return "publisher";
  return "both";
}

/**
 * This is a UI preference only.  It never grants report/API access and is
 * intentionally separate from `users.role`, which remains an auth/admin
 * capability field.
 */
export function normalizeRevenueTabPreference(value: unknown): RevenueReportTab | null {
  const tab = reportString(value).trim().toLowerCase();
  if (tab === "advertiser") return "advertiser";
  if (tab === "publisher" || tab === "channel" || tab === "creator") return "publisher";
  return null;
}

export function revenueReportPreferenceKey(userId: unknown): string | null {
  const normalized = reportString(userId).trim();
  return normalized ? `${REVENUE_REPORT_PREFERENCE_PREFIX}${encodeURIComponent(normalized)}` : null;
}

export function resolveRevenueTabState(
  value: unknown,
  loading = false,
  preferredTab?: unknown,
): {
  role: RevenueReportRole;
  defaultTab: RevenueReportTab;
  publisherEnabled: boolean;
  advertiserEnabled: boolean;
} {
  const role = normalizeRevenueReportRole(value);
  const preference = normalizeRevenueTabPreference(preferredTab);
  return {
    role,
    // A persisted server role has priority.  A browser/login preference is
    // consulted only for legacy `user` accounts whose role is unknown.
    defaultTab: role === "publisher" ? "publisher"
      : role === "advertiser" ? "advertiser"
      : preference || "advertiser",
    // Keep both tabs usable while capabilities are loading.  An unavailable
    // capability response also normalizes to `both`, which is safer than
    // hiding a valid empty-state report.
    publisherEnabled: loading || role !== "advertiser",
    advertiserEnabled: loading || role !== "publisher",
  };
}

export type RevenueOwnAdStats = {
  adCount: number;
  views: number;
  likes: number;
  comments: number;
  inboundMessages: number;
};

export function normalizeRevenueOwnAdStats(value: unknown): RevenueOwnAdStats {
  const row = value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};
  return {
    adCount: finiteReportNumber(reportField(row, "adCount", "ad_count")),
    views: finiteReportNumber(reportField(row, "views", "views_count")),
    likes: finiteReportNumber(reportField(row, "likes", "likes_count")),
    comments: finiteReportNumber(reportField(row, "comments", "comments_count")),
    inboundMessages: finiteReportNumber(reportField(row, "inboundMessages", "inbound_messages")),
  };
}

export function formatReportMoney(value: unknown, fractionDigits = 2): string {
  return finiteReportNumber(value).toLocaleString("ar-EG", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatReportMoneyOrUnavailable(value: number | null | undefined, fractionDigits = 2): string {
  return value == null ? "غير متاح" : formatReportMoney(value, fractionDigits);
}

export function formatReportDate(value: unknown): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" });
}
