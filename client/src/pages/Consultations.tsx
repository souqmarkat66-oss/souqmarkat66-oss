import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  MessageSquare, Upload, X, FileText, Image, Clock, CheckCircle2,
  XCircle, Plus, Send, Star, Package, Loader2, ChevronDown, ChevronUp,
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

const PACKAGES = [
  {
    id: "basic",
    label: "📦 باكج أساسي",
    price: 150,
    desc: "استشارة نصية + تعديل واحد",
    features: ["رد خلال 24 ساعة", "استشارة مكتوبة", "تعديل واحد مجاناً"],
    color: "from-blue-500 to-blue-600",
  },
  {
    id: "standard",
    label: "⭐ باكج قياسي",
    price: 350,
    desc: "استشارة كاملة + ملفات + 3 تعديلات",
    features: ["رد خلال 12 ساعة", "مراجعة ملفات وصور", "3 تعديلات", "متابعة أسبوعية"],
    color: "from-purple-500 to-purple-600",
    popular: true,
  },
  {
    id: "premium",
    label: "💎 باكج بريميم",
    price: 700,
    desc: "خدمة VIP كاملة + دعم مستمر",
    features: ["رد خلال 6 ساعات", "مراجعة شاملة", "تعديلات غير محدودة", "متابعة شهرية", "مكالمة مباشرة"],
    color: "from-yellow-500 to-orange-500",
  },
  {
    id: "custom",
    label: "🛠️ مخصص",
    price: 0,
    desc: "سعر مخصص حسب المشروع",
    features: ["حسب الاتفاق", "مرونة كاملة"],
    color: "from-gray-500 to-gray-600",
  },
];

const PAYMENT_METHODS = [
  { value: "vodafone",  label: "📱 فودافون كاش",    number: "01098553911" },
  { value: "etisalat",  label: "📲 اتصالات e& كاش", number: "01126665741" },
  { value: "instapay",  label: "💳 InstaPay",        number: "01285558567" },
];

const STATUS_MAP: Record<string, { label: string; icon: any; color: string }> = {
  pending:   { label: "قيد المراجعة", icon: Clock,         color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  approved:  { label: "مقبول",        icon: CheckCircle2,  color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  rejected:  { label: "مرفوض",        icon: XCircle,       color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  in_review: { label: "جاري المراجعة",icon: MessageSquare, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
};

export default function Consultations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = (user as any)?.email === "souqmarkat66@gmail.com";

  const [showNew, setShowNew] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Form state
  const [selectedPkg, setSelectedPkg] = useState<string>("");
  const [customPrice, setCustomPrice] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fileUrls, setFileUrls] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadingScreen, setUploadingScreen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const screenRef = useRef<HTMLInputElement>(null);

  // Admin reply state
  const [adminReply, setAdminReply] = useState<Record<number, string>>({});
  const [adminNote, setAdminNote] = useState<Record<number, string>>({});

  const { data: consultations = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/consultations"],
    queryFn: () => fetch("/api/consultations", { credentials: "include" }).then(r => r.json()),
  });

  const pkg = PACKAGES.find(p => p.id === selectedPkg);
  const amount = selectedPkg === "custom" ? parseFloat(customPrice || "0") : (pkg?.price || 0);

  const uploadFile = async (file: File, forScreenshot = false) => {
    const fd = new FormData();
    fd.append("file", file);
    if (forScreenshot) setUploadingScreen(true); else setUploading(true);
    try {
      const r = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
      const d = await r.json();
      return d.url as string;
    } finally {
      if (forScreenshot) setUploadingScreen(false); else setUploading(false);
    }
  };

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const urls: string[] = [];
    for (const f of files.slice(0, 5)) {
      const url = await uploadFile(f);
      if (url) urls.push(url);
    }
    setFileUrls(prev => [...prev, ...urls].slice(0, 10));
    toast({ title: `✅ تم رفع ${urls.length} ملف` });
  };

  const handleScreenshot = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = await uploadFile(f, true);
    if (url) setScreenshotUrl(url);
  };

  const submitMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/consultations", {
      packageId: selectedPkg,
      packageLabel: pkg?.label || selectedPkg,
      amountEGP: amount,
      title,
      description,
      fileUrls,
      paymentRef,
      paymentMethod,
      paymentScreenshotUrl: screenshotUrl,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultations"] });
      toast({ title: "✅ تم إرسال طلب الاستشارة بنجاح" });
      setShowNew(false);
      resetForm();
    },
    onError: () => toast({ variant: "destructive", title: "❌ فشل إرسال الطلب" }),
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, status, reply, note }: { id: number; status: string; reply?: string; note?: string }) =>
      apiRequest("PUT", `/api/consultations/${id}`, { status, reply, adminNote: note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultations"] });
      toast({ title: "✅ تم تحديث الاستشارة" });
    },
  });

  const resetForm = () => {
    setSelectedPkg(""); setCustomPrice(""); setTitle(""); setDescription("");
    setFileUrls([]); setPaymentRef(""); setPaymentMethod(""); setScreenshotUrl("");
  };

  const isImage = (url: string) => /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url);

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-primary" />
            الاستشارات والخدمات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">اطلب استشارة احترافية وأرسل ملفاتك</p>
        </div>
        {user && (
          <Button onClick={() => setShowNew(true)} data-testid="btn-new-consultation">
            <Plus className="w-4 h-4 ms-1" /> طلب جديد
          </Button>
        )}
      </div>

      {/* Packages Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {PACKAGES.map(p => (
          <div key={p.id} className={`relative rounded-2xl bg-gradient-to-br ${p.color} p-4 text-white shadow-lg`}>
            {p.popular && (
              <span className="absolute -top-2 end-3 bg-white text-primary text-[10px] font-bold rounded-full px-2 py-0.5 shadow">
                الأكثر طلباً
              </span>
            )}
            <div className="text-lg font-bold mb-1">{p.label}</div>
            <div className="text-2xl font-black mb-1">{p.price > 0 ? `${p.price} ج.م` : "حسب الاتفاق"}</div>
            <div className="text-xs opacity-80">{p.desc}</div>
          </div>
        ))}
      </div>

      {/* Consultations List */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : consultations.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>لا توجد استشارات بعد</p>
          {user && <Button className="mt-4" onClick={() => setShowNew(true)}>ابدأ أول استشارة</Button>}
        </div>
      ) : (
        <div className="space-y-4">
          {consultations.map((c: any) => {
            const status = STATUS_MAP[c.status] || STATUS_MAP.pending;
            const files: string[] = c.file_urls ? JSON.parse(c.file_urls) : [];
            const isExpanded = expandedId === c.id;
            return (
              <div key={c.id} className="border rounded-2xl bg-card shadow-sm overflow-hidden">
                <button
                  className="w-full p-4 flex items-start gap-3 text-right hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm">{c.title}</span>
                      <Badge className={`text-[10px] px-2 py-0.5 rounded-full border-none ${status.color}`}>
                        <status.icon className="w-3 h-3 me-0.5 inline" />{status.label}
                      </Badge>
                      {c.package_label && (
                        <Badge variant="secondary" className="text-[10px]">{c.package_label}</Badge>
                      )}
                      {c.amount_egp > 0 && (
                        <span className="text-xs font-bold text-green-600">{parseFloat(c.amount_egp).toLocaleString()} ج.م</span>
                      )}
                    </div>
                    {isAdmin && <div className="text-xs text-muted-foreground mt-0.5">{c.user_name}</div>}
                    <div className="text-xs text-muted-foreground mt-1">
                      {c.created_at && format(new Date(c.created_at), "d MMM yyyy - hh:mm a", { locale: ar })}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t space-y-4">
                    {/* Description */}
                    {c.description && (
                      <div className="mt-3">
                        <p className="text-xs font-bold text-muted-foreground mb-1">تفاصيل الطلب</p>
                        <p className="text-sm bg-muted/40 rounded-xl p-3">{c.description}</p>
                      </div>
                    )}

                    {/* Attached Files */}
                    {files.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-muted-foreground mb-2">الملفات المرفقة ({files.length})</p>
                        <div className="flex flex-wrap gap-2">
                          {files.map((url, i) => (
                            isImage(url) ? (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                <img src={url} alt="" className="w-20 h-20 object-cover rounded-xl border hover:opacity-80 transition-opacity" />
                              </a>
                            ) : (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 bg-muted/60 rounded-xl px-3 py-2 text-xs hover:bg-muted transition-colors">
                                <FileText className="w-4 h-4 text-primary" />
                                ملف {i + 1}
                              </a>
                            )
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Payment info */}
                    {c.payment_ref && (
                      <div className="bg-muted/40 rounded-xl p-3 text-xs space-y-1">
                        <p className="font-bold">معلومات الدفع</p>
                        <p>طريقة الدفع: {c.payment_method || "-"}</p>
                        <p>مرجع الدفع: <span className="font-mono font-bold">{c.payment_ref}</span></p>
                        {c.payment_screenshot_url && (
                          <a href={c.payment_screenshot_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary hover:underline">
                            <Image className="w-3 h-3" /> عرض إيصال الدفع
                          </a>
                        )}
                      </div>
                    )}

                    {/* Admin reply */}
                    {c.reply && (
                      <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-xl p-3">
                        <p className="text-xs font-bold text-green-700 dark:text-green-400 mb-1">✅ رد المتخصص</p>
                        <p className="text-sm text-green-800 dark:text-green-300">{c.reply}</p>
                      </div>
                    )}
                    {c.admin_note && (
                      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                        <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">📝 ملاحظة</p>
                        <p className="text-sm">{c.admin_note}</p>
                      </div>
                    )}

                    {/* Admin Controls */}
                    {isAdmin && (
                      <div className="border-t pt-3 space-y-3">
                        <p className="text-xs font-bold text-muted-foreground">لوحة الإدارة</p>
                        <Textarea
                          placeholder="الرد على الاستشارة..."
                          value={adminReply[c.id] ?? c.reply ?? ""}
                          onChange={e => setAdminReply(prev => ({ ...prev, [c.id]: e.target.value }))}
                          className="text-sm resize-none"
                          rows={3}
                        />
                        <Input
                          placeholder="ملاحظة إدارية (اختياري)..."
                          value={adminNote[c.id] ?? c.admin_note ?? ""}
                          onChange={e => setAdminNote(prev => ({ ...prev, [c.id]: e.target.value }))}
                          className="text-sm"
                        />
                        <div className="flex gap-2 flex-wrap">
                          <Button size="sm" variant="default"
                            onClick={() => replyMutation.mutate({ id: c.id, status: "approved", reply: adminReply[c.id] || c.reply, note: adminNote[c.id] || c.admin_note })}
                            disabled={replyMutation.isPending}>
                            <CheckCircle2 className="w-3.5 h-3.5 ms-1" /> قبول وإرسال الرد
                          </Button>
                          <Button size="sm" variant="outline"
                            onClick={() => replyMutation.mutate({ id: c.id, status: "in_review", reply: adminReply[c.id] || c.reply, note: adminNote[c.id] || c.admin_note })}
                            disabled={replyMutation.isPending}>
                            <MessageSquare className="w-3.5 h-3.5 ms-1" /> قيد المراجعة
                          </Button>
                          <Button size="sm" variant="destructive"
                            onClick={() => replyMutation.mutate({ id: c.id, status: "rejected", note: adminNote[c.id] || c.admin_note })}
                            disabled={replyMutation.isPending}>
                            <XCircle className="w-3.5 h-3.5 ms-1" /> رفض
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Consultation Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              <span className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                طلب استشارة جديدة
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Package Selection */}
            <div>
              <label className="text-sm font-bold mb-2 block">اختر الباكج</label>
              <div className="grid grid-cols-2 gap-2">
                {PACKAGES.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPkg(p.id)}
                    className={`relative rounded-xl p-3 text-right border-2 transition-all text-sm ${selectedPkg === p.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                    data-testid={`pkg-${p.id}`}
                  >
                    {p.popular && (
                      <span className="absolute -top-1.5 end-2 bg-primary text-white text-[9px] font-bold rounded-full px-1.5 py-0.5">★ شائع</span>
                    )}
                    <div className="font-bold">{p.label}</div>
                    <div className="text-primary font-black text-lg">{p.price > 0 ? `${p.price} ج.م` : "حسب الاتفاق"}</div>
                    <div className="text-xs text-muted-foreground">{p.desc}</div>
                    <ul className="mt-1 space-y-0.5">
                      {p.features.map((f, i) => <li key={i} className="text-[10px] text-muted-foreground">• {f}</li>)}
                    </ul>
                  </button>
                ))}
              </div>
            </div>

            {selectedPkg === "custom" && (
              <div>
                <label className="text-sm font-bold mb-1 block">المبلغ المتفق عليه (ج.م)</label>
                <Input type="number" placeholder="0" value={customPrice} onChange={e => setCustomPrice(e.target.value)} data-testid="input-custom-price" />
              </div>
            )}

            {/* Title & Description */}
            <div>
              <label className="text-sm font-bold mb-1 block">عنوان الاستشارة *</label>
              <Input placeholder="وصف مختصر لطلبك..." value={title} onChange={e => setTitle(e.target.value)} data-testid="input-consult-title" />
            </div>
            <div>
              <label className="text-sm font-bold mb-1 block">تفاصيل إضافية</label>
              <Textarea
                placeholder="اشرح طلبك بالتفصيل، أي معلومات تساعد المتخصص..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                className="resize-none"
                data-testid="input-consult-desc"
              />
            </div>

            {/* File Upload */}
            <div>
              <label className="text-sm font-bold mb-2 block">الملفات المرفقة (صور، PDF، إلخ) — حتى 10 ملفات</label>
              <input ref={fileRef} type="file" multiple accept="image/*,application/pdf,.doc,.docx,.xlsx,.pptx" className="hidden" onChange={handleFiles} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading || fileUrls.length >= 10}
                className="w-full border-2 border-dashed border-border rounded-xl p-4 flex flex-col items-center gap-2 hover:border-primary transition-colors disabled:opacity-50"
                data-testid="btn-upload-files"
              >
                {uploading ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : <Upload className="w-6 h-6 text-muted-foreground" />}
                <span className="text-sm text-muted-foreground">{uploading ? "جاري الرفع..." : "اضغط لرفع ملفاتك"}</span>
                <span className="text-xs text-muted-foreground/60">صور، PDF، Word، Excel — حتى 10 ملفات</span>
              </button>

              {fileUrls.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {fileUrls.map((url, i) => (
                    <div key={i} className="relative group">
                      {isImage(url) ? (
                        <img src={url} alt="" className="w-16 h-16 object-cover rounded-lg border" />
                      ) : (
                        <div className="w-16 h-16 flex flex-col items-center justify-center bg-muted rounded-lg border text-xs text-muted-foreground">
                          <FileText className="w-5 h-5 mb-0.5" />
                          <span>ملف {i + 1}</span>
                        </div>
                      )}
                      <button
                        onClick={() => setFileUrls(prev => prev.filter((_, j) => j !== i))}
                        className="absolute -top-1 -start-1 w-4 h-4 bg-red-500 text-white rounded-full hidden group-hover:flex items-center justify-center"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payment */}
            {amount > 0 && (
              <div className="bg-muted/40 rounded-xl p-4 space-y-3 border">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">المبلغ المطلوب</span>
                  <span className="text-2xl font-black text-primary">{amount.toLocaleString()} ج.م</span>
                </div>

                <div>
                  <label className="text-sm font-bold mb-1 block">طريقة الدفع</label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger data-testid="select-payment-method">
                      <SelectValue placeholder="اختر طريقة الدفع" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map(m => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label} — {m.number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {paymentMethod && (
                  <div className="bg-background rounded-lg p-3 border text-sm">
                    <p className="font-bold mb-1">ارسل المبلغ على:</p>
                    <p className="font-mono font-black text-lg text-primary">
                      {PAYMENT_METHODS.find(m => m.value === paymentMethod)?.number}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">ثم ارفع صورة الإيصال وأدخل مرجع الدفع</p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-bold mb-1 block">مرجع الدفع / رقم العملية</label>
                  <Input placeholder="مثال: TRX123456789" value={paymentRef} onChange={e => setPaymentRef(e.target.value)} data-testid="input-payment-ref" />
                </div>

                <div>
                  <label className="text-sm font-bold mb-1 block">صورة إيصال الدفع</label>
                  <input ref={screenRef} type="file" accept="image/*" className="hidden" onChange={handleScreenshot} />
                  {screenshotUrl ? (
                    <div className="relative inline-block">
                      <img src={screenshotUrl} alt="إيصال" className="h-24 rounded-lg border object-cover" />
                      <button onClick={() => setScreenshotUrl("")} className="absolute -top-1 -end-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => screenRef.current?.click()}
                      disabled={uploadingScreen}
                      className="w-full border-2 border-dashed border-border rounded-xl p-3 flex items-center justify-center gap-2 hover:border-primary transition-colors text-sm text-muted-foreground"
                      data-testid="btn-upload-screenshot"
                    >
                      {uploadingScreen ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />}
                      {uploadingScreen ? "جاري الرفع..." : "ارفع صورة الإيصال"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Submit */}
            <Button
              className="w-full"
              disabled={!selectedPkg || !title || submitMutation.isPending}
              onClick={() => submitMutation.mutate()}
              data-testid="btn-submit-consultation"
            >
              {submitMutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin ms-1" /> جاري الإرسال...</>
                : <><Send className="w-4 h-4 ms-1" /> إرسال الطلب</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
