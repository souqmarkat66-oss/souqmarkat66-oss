import { afsOrderMode } from "./afsEnvironment";

type Query = (sql: string, params: any[]) => Promise<{ rows: any[] }>;

/** Deliberately has no wallet, coins, service, notification or ledger access. */
export async function verifyAfsSandboxOrder(
  order: any, query: Query, getStatus: (checkoutId: string) => Promise<Record<string, any>>,
) {
  if (afsOrderMode(order) !== "test") throw new Error("Not a sandbox order");
  let outcome = order.service_reference?._afsTestResult;
  if (!outcome) {
    const provider = await getStatus(order.checkout_id);
    const code = typeof provider.result?.code === "string" ? provider.result.code : "";
    outcome = /^(000\.000\.|000\.100\.1|000\.[36])/.test(code) ? "paid" :
      /^(000\.200|000\.400|800\.400|100\.400\.500)/.test(code) ? "pending" : "failed";
    if (outcome !== "pending") {
      // Financial status is deliberately non-paid: reports and accounting can
      // never count test money. The separate metadata preserves the test result.
      const saved = await query(
        `UPDATE afs_payment_orders SET status='failed',
           result_code='SANDBOX_ONLY', result_description='اختبار فقط — لا تسوية مالية',
           service_reference = service_reference || jsonb_build_object('_afsTestResult', $2::text)
         WHERE id=$1 AND service_reference->>'_afsEnvironment'='test'
           AND service_reference->>'_afsTestResult' IS NULL
         RETURNING service_reference`, [order.id, outcome],
      );
      if (!saved.rows[0]) {
        const existing = await query(`SELECT service_reference FROM afs_payment_orders WHERE id=$1`, [order.id]);
        outcome = existing.rows[0]?.service_reference?._afsTestResult;
        if (!outcome) throw new Error("Unable to persist sandbox outcome");
      }
    }
  }
  return {
    status: outcome === "pending" ? "pending" : "test",
    testOutcome: outcome,
    isTestMode: true,
    serviceActivated: false,
    message: outcome === "pending"
      ? "عملية اختبار فقط وما زالت قيد المعالجة. لن يُضاف رصيد حقيقي."
      : outcome === "paid"
        ? "نجح اختبار البطاقة. لم يُضف رصيد أو عملات ولم تُفعّل خدمة حقيقية."
        : "لم ينجح اختبار البطاقة. لم يتغير رصيدك أو أي خدمة حقيقية.",
  };
}