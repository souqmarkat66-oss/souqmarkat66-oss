import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Wallet, Plus, ArrowUpCircle, ArrowDownCircle, Clock, CheckCircle2,
  XCircle, Upload, X, Copy, Loader2, Banknote, Smartphone, CreditCard
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

const PAYMENT_METHODS = [
  {
    value: "vodafone",
    label: "فودافون كاش",
    emoji: "📱",
    number: "01098553911",
    color: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900",
    textColor: "text-red-700 dark:text-red-400",
    instructions: "حوّل المبلغ على رقم فودافون كاش",
  },
  {
    value: "instapay",
    label: "InstaPay",
    emoji: "💳",
    number: "01285558567",
    color: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900",
    textColor: "text-blue-700 dark:text-blue-400",
    instructions: "حوّل المبلغ عبر تطبيق InstaPay",
  },
  {
    value: "souq",
    label: "سوق ماركات / البنك الأهلي المصري",
    emoji: "🏦",
    number: "01285558567",
    color: "bg-primary/5 border-primary/20",
    textColor: "text-primary",
    instructions: "ادفع عبر تطبيق سوق ماركات أو تحويل بنكي إلى البنك الأهلي المصري",
  },
];

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  pending:  { label: "قيد المراجعة", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", icon: Clock },
  approved: { label: "مقبول",         color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",   icon: CheckCircle2 },
  rejected: { label: "مرفوض",         color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",           icon: XCircle },
};

export default function WalletPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showTopup, setShowTopup] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState("vodafone");
  const [amount, setAmount]       = useState("");
  const [payRef, setPayRef]       = useState("");
  const [screenshotUrl, setScreenshotUrl]       = useState("");
  const [screenshotPreview, setScreenshotPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: walletData, isLoading } = useQuery<{
    balance: number;
    topUps: any[];
    spendings: any[];
  }>({
    queryKey: ["/api/wallet/balance"],
    enabled: !!user,
  });

  const topUpMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/wallet/top-up", data),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
      toast({
        title: "✅ تم إرسال طلب الشحن",
        description: `رقم الطلب: ${data.orderNumber} — سيتم المراجعة وإضافة الرصيد قريباً`,
      });
      setShowTopup(false);
      setAmount("");
      setPayRef("");
      setScreenshotUrl("");
      setScreenshotPreview("");
    },
    onError: () => toast({ variant: "destructive", title: "خطأ في إرسال الطلب" }),
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
      toast({ title: "✅ تم رفع الإيصال" });
    } catch {
      toast({ variant: "destructive", title: "فشل رفع الصورة" });
      setScreenshotPreview("");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitTopup = () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({ variant: "destructive", title: "أدخل مبلغاً صحيحاً" });
      return;
    }
    topUpMutation.mutate({
      amountEGP: parseFloat(amount),
      paymentMethod: selectedMethod,
      paymentRef: payRef || undefined,
      screenshotUrl: screenshotUrl || undefined,
    });
  };

  const copyNumber = (num: string) => {
    navigator.clipboard.writeText(num);
    toast({ title: "✅ تم نسخ الرقم" });
  };

  const balance = walletData?.balance || 0;
  const topUps = walletData?.topUps || [];
  const spendings = walletData?.spendings || [];

  // Merge and sort all transactions
  const allTx = [
    ...topUps.map(t => ({
      ...t,
      txType: "topup",
      date: new Date(t.created_at),
      amount: t.amount_egp,
      label: `شحن — ${t.payment_method}`,
      statusInfo: STATUS_MAP[t.status] || STATUS_MAP.pending,
    })),
    ...spendings.map(t => ({
      ...t,
      txType: "spending",
      date: new Date(t.created_at || t.createdAt),
      amount: t.amount_egp || t.amountEgp,
      label: t.description || "خصم خدمة",
      statusInfo: { label: "مكتمل", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400", icon: CheckCircle2 },
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const methodObj = PAYMENT_METHODS.find(m => m.value === selectedMethod)!;

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4" dir="rtl">
        <Wallet className="w-12 h-12 text-muted-foreground opacity-40" />
        <p className="text-muted-foreground">يجب تسجيل الدخول للوصول لمحفظتك</p>
        <Button onClick={() => window.location.href = "/login"}>تسجيل الدخول</Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold">محفظتي</h1>
            <p className="text-xs text-muted-foreground">رصيدك بالجنيه المصري</p>
          </div>
        </div>
        <Button onClick={() => setShowTopup(true)} data-testid="btn-topup-wallet" className="gap-2">
          <Plus className="w-4 h-4" />
          اشحن المحفظة
        </Button>
      </div>

      {/* Balance Card */}
      <div className="rounded-3xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground p-6 mb-6 shadow-xl shadow-primary/20">
        <p className="text-sm opacity-80 mb-1">الرصيد الحالي</p>
        {isLoading ? (
          <div className="h-12 bg-white/20 animate-pulse rounded-xl w-40" />
        ) : (
          <p className="text-5xl font-extrabold tabular-nums" data-testid="text-wallet-balance">
            {balance.toLocaleString("ar-EG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            <span className="text-2xl mr-2 opacity-80">ج.م</span>
          </p>
        )}
        <p className="text-xs opacity-70 mt-3">يُستخدم تلقائياً عند تعزيز الإعلانات والخدمات المدفوعة</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="border rounded-2xl p-4 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
          <p className="text-xs text-green-700 dark:text-green-400 font-semibold flex items-center gap-1">
            <ArrowUpCircle className="w-3.5 h-3.5" /> إجمالي الشحن
          </p>
          <p className="text-xl font-bold text-green-700 dark:text-green-400 mt-1">
            {topUps.filter(t => t.status === "approved").reduce((s: number, t: any) => s + (t.amount_egp || 0), 0).toLocaleString()} ج.م
          </p>
        </div>
        <div className="border rounded-2xl p-4 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
          <p className="text-xs text-red-700 dark:text-red-400 font-semibold flex items-center gap-1">
            <ArrowDownCircle className="w-3.5 h-3.5" /> إجمالي الإنفاق
          </p>
          <p className="text-xl font-bold text-red-700 dark:text-red-400 mt-1">
            {spendings.reduce((s: number, t: any) => s + (t.amount_egp || t.amountEgp || 0), 0).toLocaleString()} ج.م
          </p>
        </div>
      </div>

      {/* Transaction History */}
      <div className="border rounded-2xl overflow-hidden bg-background">
        <div className="px-4 py-3 border-b bg-muted/20 flex items-center gap-2">
          <Banknote className="w-4 h-4 text-muted-foreground" />
          <span className="font-bold text-sm">سجل المعاملات</span>
          {allTx.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">{allTx.length}</Badge>
          )}
        </div>

        {isLoading ? (
          <div className="p-4 space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        ) : allTx.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Wallet className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">لا توجد معاملات بعد</p>
            <p className="text-xs mt-1">اشحن محفظتك للبدء</p>
          </div>
        ) : (
          <div className="divide-y">
            {allTx.map((tx: any, i) => {
              const StatusIcon = tx.statusInfo.icon;
              const isCredit = tx.txType === "topup" && tx.status === "approved";
              const isPending = tx.txType === "topup" && tx.status === "pending";
              return (
                <div key={`${tx.txType}-${tx.id}-${i}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors" data-testid={`row-tx-${tx.id}`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                    tx.txType === "spending" ? "bg-red-100 dark:bg-red-900/30" :
                    tx.status === "approved" ? "bg-green-100 dark:bg-green-900/30" :
                    tx.status === "rejected" ? "bg-red-100 dark:bg-red-900/30" :
                    "bg-yellow-100 dark:bg-yellow-900/30"
                  }`}>
                    {tx.txType === "spending" ? (
                      <ArrowDownCircle className="w-4 h-4 text-red-500" />
                    ) : (
                      <ArrowUpCircle className={`w-4 h-4 ${
                        tx.status === "approved" ? "text-green-500" :
                        tx.status === "rejected" ? "text-red-500" : "text-yellow-500"
                      }`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{tx.label}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {tx.order_number && (
                        <span className="font-mono text-[10px] text-muted-foreground">{tx.order_number}</span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {format(tx.date, "dd/MM/yyyy HH:mm", { locale: ar })}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`text-sm font-bold tabular-nums ${
                      tx.txType === "spending" ? "text-red-500" :
                      tx.status === "approved" ? "text-green-600 dark:text-green-400" :
                      "text-muted-foreground"
                    }`}>
                      {tx.txType === "spending" ? "-" : (tx.status === "approved" ? "+" : "")}{(tx.amount || 0).toLocaleString()} ج.م
                    </span>
                    <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tx.statusInfo.color}`}>
                      <StatusIcon className="w-2.5 h-2.5" />
                      {tx.statusInfo.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Top-up Dialog */}
      <Dialog open={showTopup} onOpenChange={setShowTopup}>
        <DialogContent dir="rtl" className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" /> شحن المحفظة
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">

            {/* Method selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold">اختر طريقة الدفع</label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map(m => (
                  <button
                    key={m.value}
                    onClick={() => setSelectedMethod(m.value)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-right transition-all ${
                      selectedMethod === m.value
                        ? "bg-primary text-primary-foreground border-primary shadow"
                        : "border-border hover:border-primary/40"
                    }`}
                    data-testid={`btn-method-${m.value}`}
                  >
                    <span className="text-xl">{m.emoji}</span>
                    <span className="text-xs font-bold leading-tight">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Payment instructions */}
            <div className={`rounded-2xl border p-4 ${methodObj.color}`}>
              <p className={`text-xs font-bold mb-1 ${methodObj.textColor}`}>
                {methodObj.emoji} {methodObj.instructions}:
              </p>
              <div className="flex items-center gap-2 bg-white/60 dark:bg-black/20 rounded-xl px-3 py-2">
                <span className="font-mono font-bold text-sm flex-1 select-all">{methodObj.number}</span>
                <button
                  onClick={() => copyNumber(methodObj.number)}
                  className="p-1 rounded-lg hover:bg-primary/10 transition-colors"
                  data-testid="btn-copy-payment-number"
                >
                  <Copy className="w-3.5 h-3.5 text-primary" />
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                بعد الدفع، أدخل المبلغ ورقم العملية وارفع صورة الإيصال
              </p>
            </div>

            {/* Amount */}
            <div className="space-y-1">
              <label className="text-xs font-bold">المبلغ (ج.م)</label>
              <Input
                type="number"
                min="1"
                placeholder="مثال: 200"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="text-left font-mono"
                data-testid="input-topup-amount"
              />
            </div>

            {/* Payment Ref */}
            <div className="space-y-1">
              <label className="text-xs font-bold">رقم العملية / المرجع <span className="text-muted-foreground font-normal">(اختياري)</span></label>
              <Input
                placeholder="أدخل رقم العملية بعد الدفع"
                value={payRef}
                onChange={e => setPayRef(e.target.value)}
                data-testid="input-topup-ref"
              />
            </div>

            {/* Screenshot upload */}
            <div className="space-y-2">
              <label className="text-xs font-bold">صورة الإيصال <span className="text-muted-foreground font-normal">(موصى به)</span></label>
              <input type="file" accept="image/*" ref={fileRef} className="hidden" onChange={handleFileUpload} />

              {screenshotPreview ? (
                <div className="relative">
                  <img src={screenshotPreview} alt="إيصال" className="w-full max-h-40 object-contain rounded-xl border" />
                  <button
                    onClick={() => { setScreenshotUrl(""); setScreenshotPreview(""); if (fileRef.current) fileRef.current.value = ""; }}
                    className="absolute top-2 left-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow"
                    data-testid="btn-remove-screenshot"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-full border-2 border-dashed rounded-2xl py-6 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                  data-testid="btn-upload-screenshot"
                >
                  {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                  <span className="text-xs font-medium">{uploading ? "جارٍ الرفع..." : "ارفع صورة الإيصال"}</span>
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowTopup(false)}>إلغاء</Button>
              <Button
                className="flex-1 gap-2"
                disabled={!amount || topUpMutation.isPending}
                onClick={handleSubmitTopup}
                data-testid="btn-submit-topup"
              >
                {topUpMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <><Plus className="w-4 h-4" /> إرسال طلب الشحن</>
                )}
              </Button>
            </div>

            <p className="text-[10px] text-muted-foreground text-center">
              سيتم مراجعة طلبك وإضافة الرصيد فور تأكيد الأدمن • عادةً خلال دقائق
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
