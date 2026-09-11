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
