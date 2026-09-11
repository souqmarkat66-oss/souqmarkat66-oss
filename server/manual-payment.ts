import { parseLedgerAmount } from "./wallet-ledger";

export const MANUAL_PAYMENT_SERVICES = [
  "wallet_recharge",
  "ad_boost",
  "campaign",
  "renewal",
  "fire_notify",
  "ai_image",
  "ai_video",
  "ai_content",
  "ai_credits",
  "coin_package",
] as const;

export type ManualPaymentService = typeof MANUAL_PAYMENT_SERVICES[number];

function requirePiasterPrecision(amount: number, field: string): number {
  if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-8) {
    throw new Error(`${field} يجب أن يكون بدقة قرشين كحد أقصى`);
  }
  return amount;
}

const priceSettingByService: Record<Exclude<ManualPaymentService, "wallet_recharge" | "coin_package">, { key: string; fallback: number }> = {
  ad_boost: { key: "boost_price_egp", fallback: 250 },
  campaign: { key: "campaign_min_budget_egp", fallback: 100 },
  renewal: { key: "renewal_price_30d", fallback: 60 },
  fire_notify: { key: "fire_price_egp", fallback: 100 },
  ai_image: { key: "ai_price_image", fallback: 10 },
  ai_video: { key: "ai_price_video", fallback: 25 },
  ai_content: { key: "ai_price_content", fallback: 5 },
  ai_credits: { key: "ai_price_per_credit_egp", fallback: 5 },
};

export const AUTOMATIC_MANUAL_SERVICES = new Set<ManualPaymentService>([
  "wallet_recharge",
  "ad_boost",
  "renewal",
  "ai_credits",
  "coin_package",
]);

export function parseManualServices(value: unknown): ManualPaymentService[] {
  const parts = typeof value === "string"
    ? value.split(",").map(part => part.trim()).filter(Boolean)
    : [];
  const unique = Array.from(new Set(parts));
  if (!unique.length || unique.some(service => !MANUAL_PAYMENT_SERVICES.includes(service as ManualPaymentService))) {
    throw new Error("نوع الخدمة غير صالح");
  }
  return unique as ManualPaymentService[];
}

function priceFromSetting(settings: Record<string, string>, key: string, fallback: number): number {
  // An absent setting deliberately uses the documented public default.  A
  // present-but-invalid setting is a configuration error, not permission to
  // charge a surprise fallback price.
  if (settings[key] == null) return fallback;
  const value = requirePiasterPrecision(parseLedgerAmount(settings[key], key), key);
  if (value <= 0 || value > 1_000_000) throw new Error(`إعداد سعر الخدمة ${key} غير صالح`);
  return value;
}

/**
 * The submitted amount is never a price authority.  It is validated against
 * current server settings in minor units, so floats cannot turn a stale UI
 * price into a different order total.
 */
export function resolveManualPaymentPrice(
  settings: Record<string, string>,
  serviceType: unknown,
  quantity: unknown,
  submittedAmount: unknown,
): { services: ManualPaymentService[]; quantity: number; amountEGP: number } {
  const services = parseManualServices(serviceType);
  const parsedQuantity = Number(quantity ?? 1);
  if (!Number.isSafeInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 10_000) {
    throw new Error("كمية الخدمة غير صالحة");
  }
  const hasSubmittedAmount = submittedAmount !== undefined && submittedAmount !== null && submittedAmount !== "";
  const submitted = hasSubmittedAmount
    ? requirePiasterPrecision(parseLedgerAmount(submittedAmount, "manual payment amount"), "المبلغ")
    : 0;
  if (hasSubmittedAmount && submitted <= 0) throw new Error("المبلغ يجب أن يكون أكبر من صفر");

  if (services.includes("wallet_recharge")) {
    if (services.length !== 1 || parsedQuantity !== 1) {
      throw new Error("شحن المحفظة يجب أن يكون في طلب مستقل وبكمية واحدة");
    }
    if (!hasSubmittedAmount) throw new Error("أدخل مبلغ شحن المحفظة");
    return { services, quantity: 1, amountEGP: submitted };
  }
  if (parsedQuantity > 1 && !(services.length === 1 && services[0] === "ai_credits")) {
    throw new Error("الكمية الأكبر من واحد متاحة لشراء رصيد الذكاء الاصطناعي فقط");
  }

  const calculated = services.reduce((sum, service) => {
    if (service === "wallet_recharge" || service === "coin_package") return sum;
    const price = priceSettingByService[service];
    return sum + priceFromSetting(settings, price.key, price.fallback) * parsedQuantity;
  }, 0);
  const amountEGP = Math.round(calculated * 100) / 100;
  if (amountEGP > 1_000_000) throw new Error("قيمة الطلب كبيرة جداً، تواصل مع الإدارة");
  if (services.includes("coin_package")) {
    throw new Error("باقة العملات يجب أن تكون في طلب مستقل");
  }
  if (hasSubmittedAmount && Math.round(submitted * 100) !== Math.round(amountEGP * 100)) {
    throw new Error(`قيمة الطلب لا تطابق تسعير الخادم الحالي (${amountEGP.toFixed(2)} ج.م)`);
  }
  return { services, quantity: parsedQuantity, amountEGP };
}