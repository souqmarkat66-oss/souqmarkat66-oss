/**
 * Small, deliberately isolated COPYandPAY client. Provider responses are only
 * consumed server-side; callers should expose their own safe status messages.
 */
const DEFAULT_BASE_URL = "https://eu-test.oppwa.com";
const PRODUCTION_BASE_URL = "https://eu-prod.oppwa.com";
const ALLOWED_BASE_URLS = new Set([
  "https://eu-test.oppwa.com",
  PRODUCTION_BASE_URL,
]);

function config() {
  const configuredBaseUrl = process.env.AFS_BASE_URL?.trim();
  // Development may deliberately use the provider sandbox, but a published
  // build must never silently fall back to test mode. Production checkout
  // stays disabled until production AFS credentials and URL are configured.
  if (process.env.NODE_ENV === "production" && !configuredBaseUrl) {
    throw new Error("بوابة الدفع الإنتاجية غير مهيأة");
  }
  const baseUrl = (configuredBaseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error("AFS payment configuration is invalid");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash
      || (parsed.pathname !== "/" && parsed.pathname !== "")
      || !ALLOWED_BASE_URLS.has(parsed.origin)) {
    throw new Error("AFS payment configuration is invalid");
  }
  if (process.env.NODE_ENV === "production" && parsed.origin !== PRODUCTION_BASE_URL) {
    throw new Error("بوابة الدفع الإنتاجية غير مهيأة");
  }
  if (process.env.NODE_ENV !== "production" && parsed.origin !== DEFAULT_BASE_URL) {
    throw new Error("يُمنع استخدام بوابة الدفع الحقيقية خارج بيئة الإنتاج");
  }
  const entityId = process.env.AFS_ENTITY_ID?.trim();
  // Accept either the raw token or the exact "Bearer <token>" value commonly
  // copied from AFS examples, while always sending one Authorization prefix.
  const accessToken = process.env.AFS_ACCESS_TOKEN?.trim().replace(/^Bearer\s+/i, "");
  if (!entityId || !accessToken) throw new Error("AFS payment service is not configured");
  return { baseUrl: parsed.origin, entityId, accessToken };
}

async function providerRequest(url: string, init: RequestInit) {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new Error("تعذر الاتصال بخدمة الدفع، حاول مرة أخرى");
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) throw new Error("تعذر إنشاء عملية الدفع، حاول مرة أخرى");
  return body as Record<string, any>;
}

export async function prepareAfsCheckout(amountEGP: number) {
  const { baseUrl, entityId, accessToken } = config();
  if (!Number.isFinite(amountEGP) || amountEGP <= 0) {
    throw new Error("مبلغ عملية الدفع غير صالح");
  }
  const form = new URLSearchParams({
    entityId,
    // AFS must charge exactly the amount the server later credits. Test mode
    // never weakens this accounting invariant.
    amount: amountEGP.toFixed(2),
    currency: "EGP",
    paymentType: "DB",
    integrity: "true",
  });
  const body = await providerRequest(`${baseUrl}/v1/checkouts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (typeof body.id !== "string" || !body.id || typeof body.integrity !== "string" || !body.integrity) {
    throw new Error("تعذر إنشاء عملية الدفع، حاول مرة أخرى");
  }
  return {
    checkoutId: body.id,
    integrity: body.integrity,
    widgetUrl: `${baseUrl}/v1/paymentWidgets.js?checkoutId=${encodeURIComponent(body.id)}`,
    isTestMode: baseUrl.includes("test.oppwa.com"),
  };
}

export async function getAfsPaymentStatus(checkoutId: string) {
  const { baseUrl, entityId, accessToken } = config();
  // checkoutId originates exclusively from our database. Encoding also prevents
  // it from ever changing the provider resource path.
  const safeId = encodeURIComponent(checkoutId);
  return providerRequest(`${baseUrl}/v1/checkouts/${safeId}/payment?entityId=${encodeURIComponent(entityId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function getAfsEntityId() {
  return config().entityId;
}

export function getAfsWidget(checkoutId: string) {
  const { baseUrl } = config();
  return {
    widgetUrl: `${baseUrl}/v1/paymentWidgets.js?checkoutId=${encodeURIComponent(checkoutId)}`,
    isTestMode: baseUrl.includes("test.oppwa.com"),
  };
}