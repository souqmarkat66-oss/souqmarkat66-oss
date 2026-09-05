import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Loader2, ShieldCheck } from "lucide-react";

export default function AfsCheckout() {
  const { orderId } = useParams<{ orderId: string }>();
  const [paymentTargetActive, setPaymentTargetActive] = useState(false);
  const { data: order, isLoading, error } = useQuery<any>({
    queryKey: ["/api/payments/afs", orderId],
    queryFn: async () => {
      const response = await fetch(`/api/payments/afs/${orderId}`, { credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "تعذر تحميل عملية الدفع");
      return body;
    },
  });

  useEffect(() => {
    if (!order?.widgetUrl || !/^https:\/\//.test(order.widgetUrl)) return;
    (window as any).wpwlOptions = {
      locale: "ar",
      style: "card",
      paymentTarget: "afs-payment-target",
      shopperResultTarget: "afs-payment-target",
      brandDetection: true,
      showCVVHint: true,
      labels: {
        cardHolder: "اسم حامل البطاقة",
        cardNumber: "رقم البطاقة",
        expiryDate: "تاريخ الانتهاء",
        cvv: "رمز الأمان",
        submit: "ادفع الآن",
      },
    };
    const script = document.createElement("script");
    script.src = order.widgetUrl;
    script.async = true;
    script.crossOrigin = "anonymous";
    if (order.integrity) script.integrity = order.integrity;
    document.body.appendChild(script);
    return () => script.remove();
  }, [order?.widgetUrl, order?.integrity]);

  if (isLoading) return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (error || !order) return <div dir="rtl" className="max-w-md mx-auto p-6 text-center text-destructive">تعذر تحميل صفحة الدفع.</div>;
  if (order.status !== "pending") {
    window.location.replace(`/payments/afs/result?orderId=${order.id}`);
    return null;
  }
  const action = `${window.location.origin}/payments/afs/result?orderId=${encodeURIComponent(order.id)}`;
  return (
    <div dir="rtl" className="max-w-xl mx-auto px-4 py-8">
      <div className="border rounded-2xl p-5 sm:p-7 bg-background shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <ShieldCheck className="w-8 h-8 text-primary" />
          <div>
            <h1 className="font-extrabold text-lg">الدفع بالبطاقة</h1>
            <p className="text-sm text-muted-foreground">دفع آمن عبر AFS COPYandPAY</p>
          </div>
        </div>
        {order.isTestMode && <div className="mb-4 rounded-lg bg-amber-100 text-amber-800 px-3 py-2 text-sm font-bold">وضع الاختبار — لا تستخدم بطاقة حقيقية</div>}
        <div className="mb-4 rounded-xl border bg-muted/20 p-3">
          <p className="font-bold text-sm">ads-as.com</p>
          <p className="text-xs text-muted-foreground">إحدى منصات شركة سوق ماركات</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-extrabold" dir="ltr">
            <span className="rounded bg-blue-700 px-2 py-1 text-white">VISA</span>
            <span className="rounded bg-orange-600 px-2 py-1 text-white">Mastercard</span>
            <span className="rounded bg-emerald-700 px-2 py-1 text-white">Meeza ميزة</span>
          </div>
        </div>
        {order.serviceType && <p className="mb-2 text-sm">الخدمة: <b>{order.serviceType === "ad_boost" ? "تعزيز إعلان" : order.serviceType === "ad_renewal" ? "تجديد إعلان" : order.serviceType === "subscription" ? "اشتراك المنصة" : "خدمة مدفوعة"}</b></p>}
        <p className="mb-5 text-sm">المبلغ: <b>{Number(order.amountEGP).toLocaleString("ar-EG")} ج.م</b></p>
        <form action={action} className="paymentWidgets" data-brands="VISA MASTER MEEZA"></form>
        <iframe
          name="afs-payment-target"
          title="التحقق الآمن من الدفع"
          className={`${paymentTargetActive ? "block" : "hidden"} mt-4 min-h-[620px] w-full rounded-xl border border-border bg-white`}
          onLoad={(event) => {
            try {
              const href = event.currentTarget.contentWindow?.location.href || "";
              if (href && href !== "about:blank") setPaymentTargetActive(true);
            } catch {
              setPaymentTargetActive(true);
            }
          }}
        />
      </div>
    </div>
  );
}