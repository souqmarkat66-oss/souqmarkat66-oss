import { useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";

export default function AfsPaymentResult() {
  const search = useSearch();
  const orderId = new URLSearchParams(search).get("orderId");
  const called = useRef(false);
  const verify = useMutation({
    mutationFn: async () => {
      if (!orderId) throw new Error("رقم عملية الدفع غير موجود");
      const response = await fetch(`/api/payments/afs/${encodeURIComponent(orderId)}/verify`, { method: "POST", credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "تعذر التحقق من الدفع");
      return body;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments/unified"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coins/wallet"] });
      if (result.status === "paid") queryClient.invalidateQueries({ queryKey: ["/api/coins/transactions"] });
    },
  });
  useEffect(() => { if (!called.current && orderId) { called.current = true; verify.mutate(); } }, [orderId]);
  const result = verify.data;
  const pending = result?.status === "pending";
  const paid = result?.status === "paid";
  const Icon = paid ? CheckCircle2 : pending ? Clock : verify.isPending ? Loader2 : XCircle;
  return <div dir="rtl" className="max-w-md mx-auto px-4 py-12 text-center">
    <div className={`border rounded-2xl p-7 ${paid ? "border-green-300" : pending ? "border-amber-300" : "border-red-300"}`}>
      <Icon className={`w-14 h-14 mx-auto mb-4 ${verify.isPending ? "animate-spin" : paid ? "text-green-600" : pending ? "text-amber-600" : "text-red-600"}`} />
      <h1 className="font-extrabold text-xl mb-2">{verify.isPending ? "جارٍ التحقق من الدفع" : paid ? "تم الدفع بنجاح" : pending ? "الدفع قيد المعالجة" : "لم يتم تأكيد الدفع"}</h1>
      <p className="text-sm text-muted-foreground mb-6">{verify.error instanceof Error ? verify.error.message : result?.message || "انتظر لحظات..."}</p>
      <div className="flex flex-col gap-2">
        {(pending || verify.isError) && (
          <Button
            variant="outline"
            disabled={verify.isPending}
            onClick={() => verify.mutate()}
          >
            إعادة التحقق
          </Button>
        )}
        <Button asChild><Link href="/payments">العودة إلى المدفوعات</Link></Button>
      </div>
    </div>
  </div>;
}