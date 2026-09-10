import { getProviderSecret } from "./secretVault";
import { resolveAfsEnvironment, type AfsMode } from "./afsEnvironment";
/**
 * Small, deliberately isolated COPYandPAY client. Provider responses are only
 * consumed server-side; callers should expose their own safe status messages.
 */
async function config() {
  const { baseUrl } = resolveAfsEnvironment(process.env);
  const entityId = await getProviderSecret("afs_entity_id");
  // Accept either the raw token or the exact "Bearer <token>" value commonly
  // copied from AFS examples, while always sending one Authorization prefix.
  const accessToken = (await getProviderSecret("afs_access_token"))?.replace(/^Bearer\s+/i, "");
  if (!entityId || !accessToken) throw new Error("AFS payment service is not configured");
  return { baseUrl, entityId, accessToken };
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
  const { baseUrl, entityId, accessToken } = await config();
  if (!Number.isFinite(amountEGP) || amountEGP <= 0) {
    throw new Error("مبلغ عملية الدفع غير صالح");
  }
  const form = new URLSearchParams({
    entityId,
    // Live settlement validates this amount exactly. Sandbox results never
    // reach real wallet, coin or service fulfillment.
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
  const { baseUrl, entityId, accessToken } = await config();
  // checkoutId originates exclusively from our database. Encoding also prevents
  // it from ever changing the provider resource path.
  const safeId = encodeURIComponent(checkoutId);
  return providerRequest(`${baseUrl}/v1/checkouts/${safeId}/payment?entityId=${encodeURIComponent(entityId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function getAfsEntityId() {
  return (await config()).entityId;
}

export async function getAfsWidget(checkoutId: string, orderMode?: AfsMode) {
  if (orderMode && orderMode !== resolveAfsEnvironment(process.env).mode) {
    throw new Error("هذه العملية تخص بيئة دفع مختلفة. ابدأ عملية جديدة من صفحة المدفوعات.");
  }
  const { baseUrl } = await config();
  return {
    widgetUrl: `${baseUrl}/v1/paymentWidgets.js?checkoutId=${encodeURIComponent(checkoutId)}`,
    isTestMode: baseUrl.includes("test.oppwa.com"),
  };
}