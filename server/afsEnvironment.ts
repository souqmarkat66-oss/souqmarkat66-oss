export type AfsMode = "test" | "live";
export const AFS_TEST_URL = "https://eu-test.oppwa.com";
export const AFS_LIVE_URL = "https://eu-prod.oppwa.com";

export function resolveAfsEnvironment(env: Record<string, string | undefined>) {
  const configured = env.AFS_BASE_URL?.trim();
  if (env.NODE_ENV === "production" && !configured) throw new Error("بوابة الدفع الإنتاجية غير مهيأة");
  const url = new URL(configured || AFS_TEST_URL);
  if (url.username || url.password || url.search || url.hash ||
      url.pathname !== "/" || ![AFS_TEST_URL, AFS_LIVE_URL].includes(url.origin)) {
    throw new Error("AFS payment configuration is invalid");
  }
  const mode: AfsMode = url.origin === AFS_TEST_URL ? "test" : "live";
  if (env.NODE_ENV === "production" && mode === "test" && env.AFS_ALLOW_TEST_MODE !== "true") {
    throw new Error("وضع اختبار AFS يحتاج تفعيلًا صريحًا");
  }
  if (env.NODE_ENV !== "production" && mode === "live") {
    throw new Error("يُمنع استخدام بوابة الدفع الحقيقية خارج بيئة الإنتاج");
  }
  return { baseUrl: url.origin, mode };
}

// Historical production orders predate this metadata and belong to Live.
// New orders always carry a server-owned mode; switching environments cannot
// turn a sandbox checkout into a real wallet/service credit.
export function afsOrderMode(order: { service_reference?: any }): AfsMode {
  const mode = order.service_reference?._afsEnvironment;
  if (mode === undefined || mode === null) return "live";
  if (mode !== "test" && mode !== "live") throw new Error("Invalid stored AFS environment");
  return mode;
}

export function bindAfsEnvironment(reference: Record<string, unknown> | null, mode: AfsMode) {
  return { ...reference, _afsEnvironment: mode };
}

export function sameAfsReference(a: any, b: any) {
  const normalize = (reference: any) => Object.entries({
    ...reference,
    _afsEnvironment: reference?._afsEnvironment || "live",
  }).filter(([key]) => key !== "_afsTestResult").sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

export function assertAfsLiveSettlement(order: { service_reference?: any }, mode: AfsMode) {
  if (mode !== "live" || afsOrderMode(order) !== "live") {
    throw new Error("لا يمكن تسوية دفعة تجريبية في المحفظة الحقيقية");
  }
}