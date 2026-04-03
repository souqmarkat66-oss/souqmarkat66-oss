import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Smartphone, Apple, Download, CheckCircle2, Upload, X, ImageIcon, ChevronLeft, ChevronRight, Loader2, ShoppingBag } from "lucide-react";
import { SiGoogleplay, SiHuawei } from "react-icons/si";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const PLAY_STORE  = "https://play.google.com/store/apps/details?id=com.apmo.souqmarket";
const APP_STORE   = "https://apps.apple.com/eg/app/as-souqmarket/id6740153334";
const HUAWEI_STORE = "https://app.as-souqmarkat.com/?from-splash=false";

interface Props {
  price?:     number;
  label?:     string;
  className?: string;
  size?:      "sm" | "default" | "lg";
  variant?:   "default" | "outline" | "secondary";
  adId?:      number;
  defaultService?: string;
}

const SERVICE_TYPES = [
  { value: "ad_boost",   emoji: "⚡", name: "تعزيز الإعلان",    desc: "ظهور مميز في الصدارة",       settingKey: "boost_price_egp" },
  { value: "renewal",    emoji: "🔄", name: "تجديد 30 يوم",    desc: "تمديد صلاحية إعلانك",        settingKey: "renewal_price_30" },
  { value: "campaign",   emoji: "📣", name: "حملة إعلانية",    desc: "استهدف جمهورك بدقة",         settingKey: "campaign_min_budget_egp" },
  { value: "ai_image",   emoji: "🖼️", name: "صورة بالذكاء",    desc: "توليد صورة احترافية",        settingKey: "ai_price_image" },
  { value: "ai_video",   emoji: "🎬", name: "فيديو بالذكاء",   desc: "إنشاء مقطع فيديو",           settingKey: "ai_price_video" },
  { value: "ai_content", emoji: "✍️", name: "محتوى بالذكاء",  desc: "كتابة نص إعلاني احترافي",   settingKey: "ai_price_content" },
  { value: "ai_credits", emoji: "🤖", name: "رصيد ذكاء",       desc: "كريديتات إضافية للـ AI",     settingKey: "ai_price_per_credit_egp" },
];

export function PayFromAppButton({ price, label, className = "", size = "default", variant = "default", adId, defaultService }: Props) {
  const [open, setOpen]           = useState(false);
  const [step, setStep]           = useState(1);           // 1=services, 2=pay+upload, 3=success
  const [selectedService, setSelectedService] = useState(defaultService || "");
  const [manualAmount, setManualAmount]       = useState(price ? String(price) : "");
  const [adIdInput, setAdIdInput]             = useState(adId ? String(adId) : "");
  const [screenshotUrl, setScreenshotUrl]     = useState("");
  const [screenshotPreview, setScreenshotPreview] = useState("");
  const [uploading, setUploading]             = useState(false);
  const fileRef                               = useRef<HTMLInputElement>(null);
  const { toast }                             = useToast();
  const qc                                    = useQueryClient();

  const { data: pricing = {} } = useQuery<Record<string, string>>({
    queryKey: ["/api/pricing"],
    enabled: open,
  });

  const getPrice = (settingKey: string) => {
    const v = pricing[settingKey];
    return v ? parseFloat(v) : null;
  };

  const selectedSvc = SERVICE_TYPES.find(s => s.value === selectedService);
  const finalAmount = manualAmount
    ? parseFloat(manualAmount)
    : (selectedSvc ? (getPrice(selectedSvc.settingKey) ?? price ?? 0) : (price ?? 0));

  const submitMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/payments", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/payments"] });
      setStep(3);
    },
    onError: () => toast({ variant: "destructive", title: "خطأ", description: "فشل إرسال الطلب، حاول مجدداً" }),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const preview = URL.createObjectURL(file);
      setScreenshotPreview(preview);
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) throw new Error();
      const { url } = await res.json();
      setScreenshotUrl(url);
      toast({ title: "✅ تم رفع الفاتورة" });
    } catch {
      toast({ variant: "destructive", title: "فشل رفع الصورة" });
      setScreenshotPreview("");
    } finally { setUploading(false); }
  };

  const handleSubmit = () => {
    if (!screenshotUrl) {
      toast({ variant: "destructive", title: "ارفع صورة الفاتورة أولاً" });
      return;
    }
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.floor(1000 + Math.random() * 9000);
    submitMutation.mutate({
      type: "top_up",
      method: "souq",
      amountEGP: finalAmount,
      serviceType: selectedService || "other",
      adId: adIdInput ? parseInt(adIdInput) : (adId ?? null),
      screenshotUrl,
      orderNumber: `ORD-${datePart}-${rand}`,
      notes: `دفع عبر تطبيق سوق ماركات — ${selectedSvc?.name || "خدمة"}`,
    });
  };

  const reset = () => {
    setStep(1); setSelectedService(defaultService || ""); setManualAmount(price ? String(price) : "");
    setAdIdInput(adId ? String(adId) : ""); setScreenshotUrl(""); setScreenshotPreview("");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <>
      <button
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(true); reset(); }}
        className={`flex items-center justify-center gap-2 rounded-full font-bold transition-all
          ${size === "sm" ? "text-xs py-1.5 px-3" : size === "lg" ? "text-base py-3 px-6" : "text-sm py-2 px-4"}
          ${variant === "outline"
            ? "border-2 border-primary text-primary hover:bg-primary hover:text-white"
            : variant === "secondary"
            ? "bg-muted text-foreground hover:bg-muted/80"
            : "bg-gradient-to-r from-primary to-secondary text-white hover:opacity-90 shadow-md"}
          ${className}`}
        data-testid="btn-pay-from-app"
      >
        <ShoppingBag className={size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} />
        {label || "ادفع من تطبيق سوق"}
      </button>

      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) reset(); }}>
        <DialogContent dir="rtl" className="max-w-md rounded-3xl p-0 overflow-hidden" aria-describedby={undefined}>
          {/* Header */}
          <div className="bg-gradient-to-br from-primary to-secondary p-5 text-white relative overflow-hidden">
            <div className="absolute inset-0 opacity-10 pointer-events-none"
              style={{ backgroundImage: "radial-gradient(circle at 20% 80%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
            <div className="relative flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center shrink-0 shadow-lg">
                <ShoppingBag className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-black">ادفع عبر سوق ماركات</h2>
                <p className="text-xs opacity-75">دفع آمن · تفعيل فوري بعد المراجعة</p>
              </div>
              {/* Step indicator */}
              <div className="flex gap-1">
                {[1,2,3].map(s => (
                  <div key={s} className={`w-2 h-2 rounded-full transition-all ${s <= step ? "bg-white" : "bg-white/30"}`} />
                ))}
              </div>
            </div>
          </div>

          {/* ─── Step 1: اختر الخدمة ─── */}
          {step === 1 && (
            <div className="p-5 space-y-4">
              <div>
                <h3 className="font-bold text-sm mb-1">1️⃣ اختر الخدمة المطلوبة</h3>
                <p className="text-xs text-muted-foreground mb-3">ستجد نفس الخدمة في تطبيق سوق ماركات</p>
                <div className="space-y-2 max-h-64 overflow-y-auto pl-1">
                  {SERVICE_TYPES.map(svc => {
                    const svcPrice = getPrice(svc.settingKey);
                    return (
                      <button
                        key={svc.value}
                        onClick={() => {
                          setSelectedService(svc.value);
                          if (svcPrice) setManualAmount(String(svcPrice));
                        }}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-right transition-all ${
                          selectedService === svc.value
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40 bg-background"
                        }`}
                        data-testid={`svc-${svc.value}`}
                      >
                        <span className="text-2xl flex-shrink-0">{svc.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm">{svc.name}</p>
                          <p className="text-xs text-muted-foreground">{svc.desc}</p>
                        </div>
                        {svcPrice ? (
                          <span className="text-sm font-extrabold text-primary whitespace-nowrap">{svcPrice} ج.م</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">متغير</span>
                        )}
                        {selectedService === svc.value && (
                          <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* رقم الإعلان (اختياري) */}
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">رقم الإعلان (اختياري)</label>
                <Input
                  type="number"
                  placeholder="مثال: 48"
                  value={adIdInput}
                  onChange={e => setAdIdInput(e.target.value)}
                  className="h-9 text-sm"
                  dir="ltr"
                />
              </div>

              {/* المبلغ */}
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">المبلغ (ج.م)</label>
                <Input
                  type="number"
                  placeholder="أدخل المبلغ"
                  value={manualAmount}
                  onChange={e => setManualAmount(e.target.value)}
                  className="h-9 text-sm font-bold"
                  dir="ltr"
                />
              </div>

              <Button
                className="w-full gap-2"
                disabled={!selectedService}
                onClick={() => setStep(2)}
                data-testid="btn-next-step2"
              >
                التالي — ادفع في التطبيق
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* ─── Step 2: ادفع في التطبيق وارفع الفاتورة ─── */}
          {step === 2 && (
            <div className="p-5 space-y-4">
              <button onClick={() => setStep(1)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <ChevronRight className="w-3 h-3" /> رجوع
              </button>

              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-3 flex items-center gap-3">
                <span className="text-2xl">{selectedSvc?.emoji}</span>
                <div>
                  <p className="font-bold text-sm">{selectedSvc?.name}</p>
                  {finalAmount > 0 && <p className="text-primary font-extrabold text-lg">{finalAmount} ج.م</p>}
                </div>
              </div>

              {/* 2A: حمّل التطبيق */}
              <div>
                <h3 className="font-bold text-sm mb-2">2️⃣ حمّل تطبيق سوق ماركات وادفع</h3>
                <div className="space-y-2">
                  <a href={PLAY_STORE} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 w-full bg-[#01875f] hover:bg-[#017a57] text-white rounded-xl px-4 py-2.5 transition-colors">
                    <SiGoogleplay className="w-6 h-6 flex-shrink-0" />
                    <div className="text-right flex-1"><div className="text-[10px] opacity-70">متوفر على</div><div className="font-bold text-sm">Google Play</div></div>
                    <Download className="w-4 h-4 opacity-70" />
                  </a>
                  <a href={APP_STORE} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 w-full text-white rounded-xl px-4 py-2.5 transition-all hover:opacity-90 hover:scale-[1.01]"
                    style={{ background: "linear-gradient(135deg, #1c1c1e 0%, #3a3a3c 100%)" }}>
                    <Apple className="w-6 h-6 flex-shrink-0" />
                    <div className="text-right flex-1"><div className="text-[10px] opacity-70">متوفر على</div><div className="font-bold text-sm">App Store</div></div>
                    <Download className="w-4 h-4 opacity-70" />
                  </a>
                  <a href={HUAWEI_STORE} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 w-full bg-[#cf0a2c] hover:bg-[#b0091f] text-white rounded-xl px-4 py-2.5 transition-colors">
                    <SiHuawei className="w-6 h-6 flex-shrink-0" />
                    <div className="text-right flex-1"><div className="text-[10px] opacity-70">متوفر على</div><div className="font-bold text-sm">AppGallery</div></div>
                    <Download className="w-4 h-4 opacity-70" />
                  </a>
                </div>
              </div>

              {/* 2B: ارفع الفاتورة */}
              <div>
                <h3 className="font-bold text-sm mb-1">3️⃣ ارفع صورة الفاتورة من التطبيق</h3>
                <p className="text-xs text-muted-foreground mb-2">بعد الدفع في التطبيق، التقط صورة للفاتورة وارفعها هنا</p>

                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />

                {screenshotPreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-primary/30">
                    <img src={screenshotPreview} alt="الفاتورة" className="w-full max-h-36 object-cover" />
                    <button
                      onClick={() => { setScreenshotUrl(""); setScreenshotPreview(""); if (fileRef.current) fileRef.current.value = ""; }}
                      className="absolute top-2 left-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    {screenshotUrl && (
                      <div className="absolute top-2 right-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" /> تم الرفع
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="w-full border-2 border-dashed border-primary/40 hover:border-primary rounded-xl py-6 flex flex-col items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
                    data-testid="btn-upload-invoice"
                  >
                    {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
                    <span className="text-sm font-medium">{uploading ? "جاري الرفع..." : "اضغط لرفع صورة الفاتورة"}</span>
                    <span className="text-xs">PNG / JPG / WEBP</span>
                  </button>
                )}
              </div>

              <Button
                className="w-full gap-2"
                onClick={handleSubmit}
                disabled={!screenshotUrl || submitMutation.isPending}
                data-testid="btn-submit-payment"
              >
                {submitMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الإرسال...</> : "إرسال طلب التفعيل 🚀"}
              </Button>

              <p className="text-[10px] text-center text-muted-foreground">
                سيتحقق الأدمن من الفاتورة خلال دقائق ويفعّل الخدمة تلقائياً
              </p>
            </div>
          )}

          {/* ─── Step 3: تم الإرسال ─── */}
          {step === 3 && (
            <div className="p-8 flex flex-col items-center text-center gap-4">
              <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold mb-1">تم إرسال طلبك! 🎉</h3>
                <p className="text-sm text-muted-foreground">سيتحقق الأدمن من فاتورة سوق ماركات</p>
                <p className="text-sm text-muted-foreground">وسيتم تفعيل <strong>{selectedSvc?.name}</strong> تلقائياً</p>
              </div>
              <div className="w-full bg-muted/50 rounded-xl p-3 text-xs text-right space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">الخدمة</span><span className="font-bold">{selectedSvc?.emoji} {selectedSvc?.name}</span></div>
                {finalAmount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">المبلغ</span><span className="font-bold text-primary">{finalAmount} ج.م</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">الحالة</span><Badge className="bg-yellow-100 text-yellow-700 text-[10px]">⏳ قيد المراجعة</Badge></div>
              </div>
              <Button className="w-full" onClick={() => setOpen(false)} data-testid="btn-close-success">حسناً، شكراً!</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
