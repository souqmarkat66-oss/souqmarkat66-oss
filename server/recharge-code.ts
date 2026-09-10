export function buildRechargeRedemptionResponse(coins: number) {
  return {
    success: true,
    coins,
    message: `تم إضافة ${coins} عملة لمحفظتك`,
  };
}

export function buildExpiredRechargeCodeResponse() {
  return { message: "الكود منتهي الصلاحية" };
}