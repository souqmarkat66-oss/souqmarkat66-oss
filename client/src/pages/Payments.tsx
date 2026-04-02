import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CreditCard, Search, Plus, Receipt, Clock, CheckCircle2, XCircle, Smartphone, Upload, X, ImageIcon, Tag, CheckSquare, Square, Calculator } from "lucide-react";
import { PayFromAppButton } from "@/components/PayFromAppButton";

const SERVICE_TYPE_LABELS: Record<string, string> = {
  ad_boost:   "⚡ تعزيز إعلان",
  campaign:   "📣 حملة إعلانية",
  renewal:    "🔄 تجديد إعلان",
  ai_image:   "🖼️ ذكاء: صورة",
  ai_video:   "🎬 ذكاء: فيديو",
  ai_content: "✍️ ذكاء: محتوى",
  ai_credits: "🤖 رصيد ذكاء",
  withdrawal: "🏧 سحب أرباح",
  other:      "📦 أخرى",
};

function buildServiceTypes(p: Record<string, string>) {
  const num = (v: string | undefined) => v ? parseFloat(v) : 0;
  const fmt = (v: string | undefined, suffix = " ج.م") => v ? `${parseFloat(v)} ${suffix}` : "";
  return {
    top_up: [
      { value: "ad_boost",   label: "⚡ تعزيز إعلان",    price: fmt(p.boost_price_egp),         desc: "ظهور مميز لإعلانك",        amount: num(p.boost_price_egp) },
      { value: "campaign",   label: "📣 حملة إعلانية",    price: `من ${fmt(p.campaign_min_budget_egp)}`, desc: "CPM=" + fmt(p.cpm_rate_egp) + " / نقرة=" + fmt(p.cpc_rate_egp), amount: num(p.campaign_min_budget_egp) },
      { value: "renewal",    label: "🔄 تجديد 30 يوم",    price: fmt(p.renewal_price_30),        desc: "تمديد صلاحية إعلانك",       amount: num(p.renewal_price_30) },
      { value: "ai_image",   label: "🖼️ ذكاء: صورة",     price: fmt(p.ai_price_image),          desc: "توليد صورة بالذكاء",        amount: num(p.ai_price_image) },
      { value: "ai_video",   label: "🎬 ذكاء: فيديو",     price: fmt(p.ai_price_video),          desc: "إنشاء مقطع فيديو",          amount: num(p.ai_price_video) },
      { value: "ai_content", label: "✍️ ذكاء: محتوى",    price: fmt(p.ai_price_content),        desc: "كتابة نص إعلاني",           amount: num(p.ai_price_content) },
      { value: "ai_credits", label: "🤖 رصيد ذكاء",      price: fmt(p.ai_price_per_credit_egp) + "/كريدت", desc: `${p.ai_free_credits || 3} مجاناً`, amount: num(p.ai_price_per_credit_egp) },
      { value: "other",      label: "📦 أخرى",            price: "",                              desc: "أي خدمة أخرى",              amount: 0 },
    ],
    withdrawal: [
      { value: "withdrawal", label: "🏧 سحب أرباح",  price: `أدنى ${fmt(p.wallet_min_withdrawal_egp || "100")}`, desc: "تحويل أرباحك", amount: 0 },
      { value: "other",      label: "📦 أخرى",        price: "",                                                   desc: "",              amount: 0 },
    ],
  };
}

const METHOD_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  vodafone:  { label: "فودافون كاش",    emoji: "📱", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  etisalat:  { label: "اتصالات e& كاش", emoji: "📲", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  instapay:  { label: "InstaPay",        emoji: "💳", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  souq:      { label: "سوق ماركات",      emoji: "🛒", color: "bg-primary/10 text-primary" },
};

const STATUS_MAP: Record<string, { label: string; icon: any; color: string }> = {
  pending:  { label: "قيد المراجعة", icon: Clock,          color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  approved: { label: "مقبول",         icon: CheckCircle2,   color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  rejected: { label: "مرفوض",         icon: XCircle,        color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

const PAYMENT_METHODS = [
  { value: "vodafone",  label: "📱 فودافون كاش",    number: "01098553911" },
  { value: "etisalat",  label: "📲 اتصالات e& كاش", number: "01126665741" },
  { value: "instapay",  label: "💳 InstaPay",        number: "01285558567" },
  { value: "souq",      label: "🛒 سوق ماركات",      number: "" },
];

export default function Payments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ type: "top_up", method: "vodafone", phoneNumber: "", adId: "" });
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [manualAmount, setManualAmount] = useState("");
  const [amountOverride, setAmountOverride] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [screenshotPreview, setScreenshotPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: payments = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/payments"],
  });

  const { data: ads = [] } = useQuery<any[]>({
    queryKey: ["/api/ads"],
  });

  const { data: pricing = {} } = useQuery<Record<string, string>>({
    queryKey: ["/api/pricing"],
  });

  const serviceList = buildServiceTypes(pricing)[formData.type === "top_up" ? "top_up" : "withdrawal"];

  // Auto-calculate total from selected services
  const autoTotal = serviceList
    .filter(s => selectedServices.has(s.value))
    .reduce((sum, s) => sum + (s.amount || 0), 0);

  const effectiveAmount = amountOverride ? manualAmount : (autoTotal > 0 ? String(autoTotal) : manualAmount);

  // Reset services when type changes
  useEffect(() => {
    setSelectedServices(new Set());
    setManualAmount("");
    setAmountOverride(false);
  }, [formData.type]);

  // When selected services change, sync auto total into manual if no override
  useEffect(() => {
    if (!amountOverride && autoTotal > 0) {
      setManualAmount(String(autoTotal));
    }
  }, [autoTotal, amountOverride]);

  const toggleService = (value: string) => {
    setSelectedServices(prev => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
    setAmountOverride(false);
  };

  const selectAll = () => {
    setSelectedServices(new Set(serviceList.map(s => s.value)));
    setAmountOverride(false);
  };

  const clearAll = () => {
    setSelectedServices(new Set());
    setManualAmount("");
    setAmountOverride(false);
  };

  const allSelected = serviceList.every(s => selectedServices.has(s.value));
  const noneSelected = selectedServices.size === 0;

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/payments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      toast({ title: "✅ تم إرسال طلب الدفع", description: "سيتم مراجعته فوراً وتفعيل الخدمة عند القبول" });
      setShowForm(false);
      setFormData({ type: "top_up", method: "vodafone", phoneNumber: "", adId: "" });
      setSelectedServices(new Set());
      setManualAmount("");
      setAmountOverride(false);
      setScreenshotUrl("");
      setScreenshotPreview("");
    },
    onError: () => toast({ title: "خطأ", description: "فشل إرسال الطلب", variant: "destructive" }),
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
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      setScreenshotUrl(url);
      toast({ title: "✅ تم رفع الإيصال بنجاح" });
    } catch {
      toast({ title: "خطأ", description: "فشل رفع الصورة", variant: "destructive" });
      setScreenshotPreview("");
    } finally {
      setUploading(false);
    }
  };

  const removeScreenshot = () => {
    setScreenshotUrl("");
    setScreenshotPreview("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const filtered = payments.filter(p =>
    !search ||
    p.orderNumber?.toLowerCase().includes(search.toLowerCase()) ||
    String(p.adId || "").includes(search) ||
    String(p.id).includes(search)
  );

  const selectedMethod = PAYMENT_METHODS.find(m => m.value === formData.method);
  const userAds = ads.filter((a: any) => a.userId === (user as any)?.id);

  // Breakdown of selected services with prices
  const selectedWithPrices = serviceList.filter(s => selectedServices.has(s.value) && s.amount > 0);
  const hasZeroPriceSelected = serviceList.some(s => selectedServices.has(s.value) && s.amount === 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Receipt className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold">جدول المدفوعات</h1>
            <p className="text-xs text-muted-foreground">تتبّع طلبات الدفع والتحميل</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)} data-testid="btn-new-payment" className="gap-2">
          <Plus className="w-4 h-4" />
          طلب دفع جديد
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "إجمالي الطلبات", value: payments.length, color: "text-foreground" },
          { label: "مقبولة", value: payments.filter(p => p.status === "approved").length, color: "text-green-600" },
          { label: "قيد المراجعة", value: payments.filter(p => p.status === "pending").length, color: "text-yellow-600" },
        ].map(stat => (
          <div key={stat.label} className="border rounded-xl p-3 text-center bg-muted/20">
            <div className={`text-2xl font-extrabold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="ابحث برقم الطلب أو رقم الإعلان..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pr-9 text-sm"
          data-testid="input-search-payments"
        />
      </div>

      {/* Table */}
      <div className="border rounded-xl overflow-hidden bg-background">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                <th className="text-right px-4 py-3 font-bold">رقم الطلب</th>
                <th className="text-right px-4 py-3 font-bold">رقم الإعلان</th>
                <th className="text-right px-4 py-3 font-bold">النوع</th>
                <th className="text-right px-4 py-3 font-bold">الخدمة</th>
                <th className="text-right px-4 py-3 font-bold">المبلغ (ج.م)</th>
                <th className="text-right px-4 py-3 font-bold">طريقة الدفع</th>
                <th className="text-right px-4 py-3 font-bold">الحالة</th>
                <th className="text-right px-4 py-3 font-bold">الإيصال</th>
                <th className="text-right px-4 py-3 font-bold">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="border-b">
                    {[...Array(9)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-muted animate-pulse rounded w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-muted-foreground">
                    <Receipt className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">لا توجد طلبات دفع بعد</p>
                    <p className="text-xs mt-1">اضغط "طلب دفع جديد" للبدء</p>
                  </td>
                </tr>
              ) : filtered.map((p: any) => {
                const method = METHOD_LABELS[p.method] || { label: p.method, emoji: "💰", color: "" };
                const status = STATUS_MAP[p.status] || STATUS_MAP.pending;
                const StatusIcon = status.icon;
                const svcLabels = p.serviceType
                  ? p.serviceType.split(",").map((s: string) => SERVICE_TYPE_LABELS[s.trim()] || s.trim()).join(" + ")
                  : null;
                return (
                  <tr key={p.id} className="border-b hover:bg-muted/10 transition-colors" data-testid={`row-payment-${p.id}`}>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded font-bold">
                        {p.orderNumber || `ORD-${String(p.id).padStart(6,"0")}`}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {p.adId ? (
                        <span className="font-mono text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-bold">
                          #{p.adId}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold">
                        {p.type === "withdrawal" ? "🏧 سحب" : "💰 إيداع"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {svcLabels ? (
                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                          {svcLabels}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-bold text-green-600">
                      {p.amountEGP?.toLocaleString()} ج.م
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-bold ${method.color}`}>
                        {method.emoji} {method.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-bold ${status.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {p.screenshotUrl ? (
                        <a href={p.screenshotUrl} target="_blank" rel="noopener noreferrer">
                          <img src={p.screenshotUrl} alt="إيصال" className="w-10 h-10 object-cover rounded-lg border hover:opacity-80 transition-opacity cursor-zoom-in" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(p.createdAt).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Payment Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent dir="rtl" className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              طلب دفع جديد
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">

            {/* Type */}
            <div className="flex gap-2">
              {[
                { value: "top_up", label: "💰 إيداع رصيد" },
                { value: "withdrawal", label: "🏧 سحب رصيد" },
              ].map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setFormData(f => ({ ...f, type: t.value }))}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${formData.type === t.value ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"}`}
                  data-testid={`btn-type-${t.value}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Service Multi-Select */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  الخدمات المطلوبة
                  {selectedServices.size > 0 && (
                    <span className="mr-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                      {selectedServices.size}
                    </span>
                  )}
                </label>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={allSelected ? clearAll : selectAll}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 ${allSelected ? "bg-primary/10 text-primary border-primary/30" : "border-border hover:border-primary/40 hover:bg-primary/5"}`}
                    data-testid="btn-select-all-services"
                  >
                    {allSelected ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                    {allSelected ? "إلغاء الكل" : "اختيار الكل"}
                  </button>
                  {!noneSelected && !allSelected && (
                    <button
                      type="button"
                      onClick={clearAll}
                      className="text-[10px] font-bold px-2 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30 transition-all"
                      data-testid="btn-clear-services"
                    >
                      مسح
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {serviceList.map(s => {
                  const isSelected = selectedServices.has(s.value);
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => toggleService(s.value)}
                      className={`flex flex-col items-start py-2 px-2.5 rounded-xl border text-right transition-all relative ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "border-border hover:border-primary/40 hover:bg-primary/5"
                      }`}
                      data-testid={`btn-service-${s.value}`}
                    >
                      {isSelected && (
                        <span className="absolute top-1.5 left-1.5 w-4 h-4 rounded-full bg-white/30 flex items-center justify-center">
                          <CheckSquare className="w-2.5 h-2.5 text-white" />
                        </span>
                      )}
                      <span className="text-xs font-bold leading-tight">{s.label}</span>
                      {s.price && (
                        <span className={`text-[10px] font-mono mt-0.5 ${isSelected ? "text-primary-foreground/80" : "text-primary"}`}>
                          {s.price}
                        </span>
                      )}
                      {s.desc && (
                        <span className={`text-[9px] leading-tight mt-0.5 ${isSelected ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                          {s.desc}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Total Breakdown */}
            {selectedServices.size > 0 && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-primary mb-2">
                  <Calculator className="w-3.5 h-3.5" />
                  تفاصيل المبلغ الإجمالي
                </div>
                {selectedWithPrices.map(s => (
                  <div key={s.value} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className="font-bold font-mono">{s.amount.toLocaleString()} ج.م</span>
                  </div>
                ))}
                {hasZeroPriceSelected && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">خدمات بسعر مخصص</span>
                    <span className="text-muted-foreground text-[10px]">أدخل المبلغ يدوياً</span>
                  </div>
                )}
                {selectedWithPrices.length > 1 && (
                  <div className="border-t border-primary/20 pt-1.5 flex items-center justify-between text-sm font-extrabold">
                    <span className="text-primary">الإجمالي التلقائي</span>
                    <span className="text-primary font-mono">{autoTotal.toLocaleString()} ج.م</span>
                  </div>
                )}
              </div>
            )}

            {/* Ad ID (optional) */}
            <div className="space-y-1">
              <label className="text-xs font-bold flex items-center gap-1">📋 رقم الإعلان (اختياري)</label>
              {userAds.length > 0 ? (
                <Select value={formData.adId} onValueChange={v => setFormData(f => ({ ...f, adId: v }))}>
                  <SelectTrigger className="text-xs h-9" data-testid="select-ad-id">
                    <SelectValue placeholder="اختر إعلان (اختياري)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون إعلان محدد</SelectItem>
                    {userAds.map((a: any) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        #{a.id} — {a.title?.slice(0, 30)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type="number"
                  placeholder="أدخل رقم الإعلان..."
                  value={formData.adId}
                  onChange={e => setFormData(f => ({ ...f, adId: e.target.value }))}
                  className="text-xs h-9"
                  data-testid="input-ad-id"
                />
              )}
            </div>

            {/* Amount */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold">💵 المبلغ الإجمالي (جنيه مصري)</label>
                {autoTotal > 0 && amountOverride && (
                  <button
                    type="button"
                    onClick={() => { setAmountOverride(false); setManualAmount(String(autoTotal)); }}
                    className="text-[10px] text-primary underline"
                    data-testid="btn-reset-amount"
                  >
                    إعادة الحساب التلقائي
                  </button>
                )}
              </div>
              <div className="relative">
                <Input
                  type="number"
                  min="10"
                  placeholder={autoTotal > 0 ? `مجموع الخدمات: ${autoTotal} ج.م` : "مثال: 500"}
                  value={effectiveAmount}
                  onChange={e => { setManualAmount(e.target.value); setAmountOverride(true); }}
                  className={`text-sm h-9 ${autoTotal > 0 && !amountOverride ? "border-primary/50 bg-primary/5" : ""}`}
                  data-testid="input-amount"
                />
                {autoTotal > 0 && !amountOverride && (
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-primary font-bold bg-primary/10 px-1.5 py-0.5 rounded">
                    تلقائي
                  </span>
                )}
              </div>
              {autoTotal > 0 && !amountOverride && (
                <p className="text-[10px] text-muted-foreground">
                  المبلغ محسوب تلقائياً من الخدمات المختارة · يمكنك تعديله يدوياً
                </p>
              )}
            </div>

            {/* Method */}
            <div className="space-y-1">
              <label className="text-xs font-bold">💳 طريقة الدفع</label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map(m => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setFormData(f => ({ ...f, method: m.value }))}
                    className={`flex flex-col items-start p-2.5 rounded-xl border text-xs font-bold transition-all ${formData.method === m.value ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/40"}`}
                    data-testid={`btn-method-${m.value}`}
                  >
                    {m.label}
                    {m.number && <span className="font-mono text-[10px] text-muted-foreground mt-0.5">{m.number}</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Phone */}
            {formData.method !== "souq" && (
              <div className="space-y-1">
                <label className="text-xs font-bold flex items-center gap-1">
                  <Smartphone className="w-3 h-3" />
                  رقم المحفظة الخاصة بك
                </label>
                <Input
                  type="tel"
                  placeholder="01XXXXXXXXX"
                  value={formData.phoneNumber}
                  onChange={e => setFormData(f => ({ ...f, phoneNumber: e.target.value }))}
                  className="text-sm h-9 font-mono"
                  dir="ltr"
                  data-testid="input-phone"
                />
                {selectedMethod?.number && (
                  <p className="text-[10px] text-muted-foreground">
                    حوّل المبلغ على: <span className="font-mono font-bold">{selectedMethod.number}</span>
                  </p>
                )}
              </div>
            )}

            {/* Screenshot Upload */}
            <div className="space-y-2">
              <label className="text-xs font-bold flex items-center gap-1">
                <ImageIcon className="w-3 h-3" />
                صورة إيصال الدفع <span className="text-primary font-bold">(مطلوبة)</span>
              </label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
                data-testid="input-screenshot"
              />
              {screenshotPreview ? (
                <div className="relative rounded-xl overflow-hidden border border-primary/30">
                  <img src={screenshotPreview} alt="إيصال الدفع" className="w-full max-h-48 object-contain bg-muted/20" />
                  <button
                    type="button"
                    onClick={removeScreenshot}
                    className="absolute top-2 left-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
                    data-testid="btn-remove-screenshot"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  {screenshotUrl && (
                    <div className="absolute bottom-2 right-2 bg-green-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                      ✓ تم الرفع
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-full h-24 border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-primary/60 hover:bg-primary/5 transition-all"
                  data-testid="btn-upload-screenshot"
                >
                  {uploading ? (
                    <div className="text-xs text-muted-foreground">جاري الرفع...</div>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-primary/60" />
                      <span className="text-xs text-muted-foreground">اضغط لرفع صورة الإيصال</span>
                      <span className="text-[10px] text-muted-foreground/60">PNG, JPG, WEBP</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Pay from App */}
            {effectiveAmount && Number(effectiveAmount) > 0 && (
              <div className="text-center space-y-1">
                <p className="text-xs text-muted-foreground">— أو ادفع مباشرة من التطبيق —</p>
                <PayFromAppButton price={Number(effectiveAmount)} className="w-full" />
              </div>
            )}

            {/* Submit */}
            <Button
              className="w-full gap-2"
              disabled={!effectiveAmount || Number(effectiveAmount) <= 0 || !screenshotUrl || uploading || createMutation.isPending}
              onClick={() => createMutation.mutate({
                type: formData.type,
                amountEGP: Number(effectiveAmount),
                method: formData.method,
                phoneNumber: formData.phoneNumber || undefined,
                adId: formData.adId && formData.adId !== "none" ? Number(formData.adId) : undefined,
                serviceType: selectedServices.size > 0 ? Array.from(selectedServices).join(",") : undefined,
                screenshotUrl: screenshotUrl || undefined,
              })}
              data-testid="btn-submit-payment"
            >
              {createMutation.isPending ? "جاري الإرسال..." : (
                <>
                  📤 إرسال الطلب
                  {effectiveAmount && Number(effectiveAmount) > 0 && (
                    <span className="mr-1 bg-white/20 px-2 py-0.5 rounded-lg font-mono text-sm">
                      {Number(effectiveAmount).toLocaleString()} ج.م
                    </span>
                  )}
                </>
              )}
            </Button>
            <p className="text-[10px] text-center text-muted-foreground">
              سيصلك إشعار فور مراجعة الطلب · التفعيل فوري عند القبول
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
