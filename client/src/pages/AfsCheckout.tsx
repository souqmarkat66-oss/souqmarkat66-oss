import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Loader2, ShieldCheck } from "lucide-react";

export default function AfsCheckout() {
  const { orderId } = useParams<{ orderId: string }>();
  const [paymentTargetActive, setPaymentTargetActive] = useState(false);
  const [widgetState, setWidgetState] = useState<"loading" | "ready" | "error">("loading");
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
    if (!order) return;
    if (!order.widgetUrl || !/^https:\/\//.test(order.widgetUrl)) {
      setWidgetState("error");
      return;
    }
    setWidgetState("loading");
    let settled = false;
    const markReady = () => {
      if (settled) return;
      settled = true;
      setWidgetState("ready");
    };
    const markError = () => {
      if (settled) return;
      settled = true;
      setWidgetState("error");
    };
    (window as any).wpwlOptions = {
      locale: "ar",
      style: "card",
      paymentTarget: "afs-payment-target",
      shopperResultTarget: "afs-payment-target",
      brandDetection: true,
      showCVVHint: true,
      onReady: markReady,
      onError: markError,
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
    const widgetForm = document.querySelector<HTMLFormElement>("form.paymentWidgets");
    const observer = new MutationObserver(() => {
      if (widgetForm?.querySelector(".wpwl-form, .wpwl-container") || widgetForm?.children.length) markReady();
    });
    if (widgetForm) observer.observe(widgetForm, { childList: true, subtree: true });
    const loadingTimeout = window.setTimeout(markError, 12_000);
    script.onload = () => {
      if (widgetForm?.querySelector(".wpwl-form, .wpwl-container") || widgetForm?.children.length) markReady();
    };
    script.onerror = markError;
    document.body.appendChild(script);
    return () => {
      settled = true;
      window.clearTimeout(loadingTimeout);
      observer.disconnect();
      script.onload = null;
      script.onerror = null;
      script.remove();
      delete (window as any).wpwlOptions;
    };
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
        {widgetState === "loading" && (
          <div className="mb-3 flex items-center justify-center gap-2 rounded-xl border bg-muted/20 p-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            جارٍ تحميل نموذج البطاقة الآمن...
          </div>
        )}
        {widgetState === "error" && (
          <div className="mb-3 rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-bold text-red-700">
            تعذر تحميل نموذج AFS. لم يتم سحب أي مبلغ. ارجع لصفحة المدفوعات وحاول مرة أخرى أو استخدم طريقة دفع أخرى.
          </div>
        )}
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