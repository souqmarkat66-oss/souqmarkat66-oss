import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Loader2, Copy, Tag, Image, Trash2, ToggleLeft, ToggleRight,
  Ticket, AlertCircle, CheckCircle2, Upload, Pencil, CalendarDays, Hash
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { PayFromAppButton } from "@/components/PayFromAppButton";

const DISCOUNT_TYPES = [
  { value: "percentage", label: "نسبة خصم %" },
  { value: "fixed", label: "خصم بالجنيه ج.م" },
  { value: "free_shipping", label: "شحن مجاني" },
  { value: "buy_x_get_y", label: "اشتري X احصل على Y" },
];

function CouponCard({ coupon, onDeleted, onUpdated }: { coupon: any; onDeleted: () => void; onUpdated: (c: any) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [copying, setCopying] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);

  const copyCode = () => {
    navigator.clipboard.writeText(coupon.code);
    setCopying(true);
    toast({ title: "✅ تم نسخ الكود!" });
    setTimeout(() => setCopying(false), 2000);
  };

  const toggleActive = async () => {
    try {
      const updated = await apiRequest("PATCH", `/api/coupons/${coupon.id}`, { isActive: !coupon.is_active }).then(r => r.json());
      onUpdated(updated);
      qc.invalidateQueries({ queryKey: ["/api/coupons"] });
    } catch { toast({ variant: "destructive", title: "خطأ", description: "فشل تحديث الكوبون" }); }
  };

  const deleteCoupon = async () => {
    if (!confirm("هل أنت متأكد من حذف هذا الكوبون؟")) return;
    try {
      await apiRequest("DELETE", `/api/coupons/${coupon.id}`);
      onDeleted();
      qc.invalidateQueries({ queryKey: ["/api/coupons"] });
      toast({ title: "✅ تم حذف الكوبون" });
    } catch { toast({ variant: "destructive", title: "خطأ", description: "فشل حذف الكوبون" }); }
  };

  const uploadImage = async (file: File) => {
    setUploadingImg(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const resp = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await resp.json();
      const updated = await apiRequest("PATCH", `/api/coupons/${coupon.id}`, { imageUrl: data.url }).then(r => r.json());
      onUpdated(updated);
      qc.invalidateQueries({ queryKey: ["/api/coupons"] });
      toast({ title: "✅ تم تحديث الصورة" });
    } catch { toast({ variant: "destructive", title: "خطأ", description: "فشل رفع الصورة" }); }
    setUploadingImg(false);
  };

  const discountBadge = coupon.discount_type === 'percentage' ? `${coupon.discount_value ?? 0}% خصم`
    : coupon.discount_type === 'fixed' ? `${coupon.discount_value ?? 0} ج.م خصم`
    : coupon.discount_type === 'free_shipping' ? 'شحن مجاني'
    : 'عرض خاص';

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
      className="relative bg-card border border-border/60 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
      data-testid={`coupon-card-${coupon.id}`}
    >
      <div className="absolute inset-0 pointer-events-none rounded-3xl border-2 border-dashed border-primary/10" />

      <div className="relative h-40 bg-gradient-to-br from-primary/10 to-primary/5">
        {coupon.image_url ? (
          <img src={coupon.image_url} alt={coupon.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Ticket className="w-14 h-14 text-primary/20" />
          </div>
        )}
        <button
          onClick={() => imgRef.current?.click()}
          className="absolute bottom-2 right-2 bg-black/60 text-white rounded-xl px-2 py-1 text-xs flex items-center gap-1 hover:bg-black/80 transition-colors"
          data-testid={`btn-change-img-${coupon.id}`}
        >
          {uploadingImg ? <Loader2 className="w-3 h-3 animate-spin" /> : <Pencil className="w-3 h-3" />}
          {uploadingImg ? "جاري الرفع..." : "تغيير الصورة"}
        </button>
        <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0])} />

        <div className="absolute top-2 left-2">
          <Badge className={coupon.is_active ? "bg-green-500 text-white" : "bg-gray-400 text-white"}>
            {coupon.is_active ? "✅ نشط" : "⏸ موقف"}
          </Badge>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-bold text-base leading-tight">{coupon.title}</h3>
          <Badge variant="outline" className="shrink-0 text-xs border-primary/30 text-primary">{discountBadge}</Badge>
        </div>

        <button
          onClick={copyCode}
          className="w-full flex items-center justify-between bg-muted/60 border border-dashed border-primary/30 rounded-2xl px-4 py-3 mb-3 group hover:bg-primary/5 transition-colors"
          data-testid={`btn-copy-code-${coupon.id}`}
        >
          <span className="font-mono text-lg font-bold text-primary tracking-widest">{coupon.code}</span>
          {copying ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />}
        </button>

        {coupon.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{coupon.description}</p>}

        <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
          <span className="flex items-center gap-1"><Hash className="w-3 h-3" /> استُخدم {coupon.used_count ?? 0} مرة</span>
          {coupon.expires_at && (
            <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />
              {format(new Date(coupon.expires_at), 'dd MMM yyyy', { locale: ar })}
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <button onClick={toggleActive}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-colors border ${coupon.is_active ? 'border-orange-200 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20' : 'border-green-200 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20'}`}
            data-testid={`btn-toggle-coupon-${coupon.id}`}>
            {coupon.is_active ? <ToggleLeft className="w-3.5 h-3.5" /> : <ToggleRight className="w-3.5 h-3.5" />}
            {coupon.is_active ? "إيقاف" : "تفعيل"}
          </button>
          <button onClick={deleteCoupon}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-medium border border-red-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
            data-testid={`btn-delete-coupon-${coupon.id}`}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function Coupons() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [businessName, setBusinessName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [discountType, setDiscountType] = useState("percentage");
  const [discountValue, setDiscountValue] = useState<string>("");
  const [imageUrl, setImageUrl] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [usageLimit, setUsageLimit] = useState<string>("");
  const [uploadingImg, setUploadingImg] = useState(false);
  const [imgErr, setImgErr] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);
  const [localCoupons, setLocalCoupons] = useState<any[]>([]);
  const [insufficientBalance, setInsufficientBalance] = useState<{ required: number; balance: number } | null>(null);

  const { data: priceData } = useQuery<{ priceEGP: number }>({
    queryKey: ["/api/coupons/price"],
  });
  const priceEGP = priceData?.priceEGP ?? 15;

  const { data: myCoupons = [], isLoading: couponsLoading } = useQuery<any[]>({
    queryKey: ["/api/coupons"],
  });

  useEffect(() => {
    if (myCoupons.length > 0 && localCoupons.length === 0) {
      setLocalCoupons(myCoupons);
    }
  }, [myCoupons]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/coupons/generate", {
        businessName,
        productDescription,
        discountType,
        discountValue: discountValue ? parseFloat(discountValue) : null,
        imageUrl: imageUrl || null,
        expiresAt: expiresAt || null,
        usageLimit: usageLimit ? parseInt(usageLimit) : null,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setLocalCoupons(prev => [data, ...prev]);
      qc.invalidateQueries({ queryKey: ["/api/coupons"] });
      setBusinessName(""); setProductDescription(""); setDiscountValue(""); setImageUrl(""); setExpiresAt(""); setUsageLimit("");
      setInsufficientBalance(null);
      toast({ title: "🎉 تم توليد الكوبون بنجاح!", className: "bg-green-500 text-white border-none" });
    },
    onError: (error: any) => {
      try {
        const msg = error?.message || "";
        const jsonStr = msg.includes(":") ? msg.substring(msg.indexOf(":") + 1).trim() : msg;
        const parsed = JSON.parse(jsonStr);
        if (parsed.message === "insufficient_balance") {
          setInsufficientBalance({ required: parsed.required ?? priceEGP, balance: parsed.balance ?? 0 });
          return;
        }
        toast({ variant: "destructive", title: "خطأ", description: parsed.message || "فشل توليد الكوبون" });
      } catch {
        toast({ variant: "destructive", title: "خطأ", description: error?.message || "فشل توليد الكوبون" });
      }
    }
  });

  const uploadRefImage = async (file: File) => {
    setUploadingImg(true);
    setImgErr(false);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const resp = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await resp.json();
      setImageUrl(data.url);
    } catch { toast({ variant: "destructive", title: "خطأ في رفع الصورة" }); }
    setUploadingImg(false);
  };

  const displayCoupons = localCoupons.length > 0 ? localCoupons : myCoupons;

  return (
    <div className="container px-4 py-10 max-w-5xl" dir="rtl">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Ticket className="w-4 h-4" /> خدمة الكوبونات الذكية
        </div>
        <h1 className="text-3xl font-extrabold mb-2">توليد كوبونات بالذكاء الاصطناعي 🎟️</h1>
        <p className="text-muted-foreground text-lg">أنشئ كوبونات خصم احترافية لنشاطك التجاري بضغطة واحدة — يولّد الذكاء الاصطناعي العنوان والكود والنص التسويقي والشروط تلقائياً.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <Card className="rounded-3xl border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="w-5 h-5 text-primary" />
                مولّد الكوبونات الذكي
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">اسم النشاط التجاري *</label>
                <Input value={businessName} onChange={e => setBusinessName(e.target.value)}
                  placeholder="مثال: متجر الأناقة، مطعم البيت، مركز دكتور أحمد..."
                  className="rounded-xl" data-testid="input-business-name" />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">وصف المنتج أو الخدمة *</label>
                <Textarea value={productDescription} onChange={e => setProductDescription(e.target.value)}
                  placeholder="اشرح ما تبيعه أو تقدمه... كلما زادت التفاصيل كان الكوبون أفضل"
                  className="rounded-xl resize-none" rows={3} data-testid="input-product-description" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">نوع الخصم</label>
                  <Select value={discountType} onValueChange={setDiscountType}>
                    <SelectTrigger className="rounded-xl" data-testid="select-discount-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DISCOUNT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {(discountType === 'percentage' || discountType === 'fixed') && (
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">
                      {discountType === 'percentage' ? 'نسبة الخصم %' : 'قيمة الخصم ج.م'}
                    </label>
                    <Input type="number" value={discountValue} onChange={e => setDiscountValue(e.target.value)}
                      placeholder={discountType === 'percentage' ? "20" : "50"} className="rounded-xl" data-testid="input-discount-value" />
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">صورة الكوبون <span className="text-muted-foreground text-xs">(اختياري)</span></label>
                {imageUrl ? (
                  <div className="relative w-fit">
                    {imgErr ? (
                      <div className="w-24 h-24 rounded-xl border bg-muted flex items-center justify-center text-muted-foreground text-xs">📷</div>
                    ) : (
                      <img src={imageUrl} alt="صورة الكوبون" className="w-24 h-24 object-cover rounded-xl border border-border"
                        onError={() => setImgErr(true)} />
                    )}
                    <button onClick={() => { setImageUrl(""); setImgErr(false); }}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                      data-testid="btn-remove-coupon-img">✕</button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 cursor-pointer border border-dashed border-border rounded-xl p-3 hover:border-primary transition-colors"
                    data-testid="upload-coupon-image">
                    <input ref={imgRef} type="file" accept="image/*" className="hidden"
                      onChange={e => e.target.files?.[0] && uploadRefImage(e.target.files[0])} />
                    {uploadingImg ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Upload className="w-4 h-4 text-muted-foreground" />}
                    <span className="text-sm text-muted-foreground">{uploadingImg ? "جاري الرفع..." : "اختر صورة لعرض مع الكوبون"}</span>
                  </label>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">تاريخ الانتهاء <span className="text-muted-foreground text-xs">(اختياري)</span></label>
                  <Input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className="rounded-xl" data-testid="input-expires-at" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">حد الاستخدام <span className="text-muted-foreground text-xs">(اختياري)</span></label>
                  <Input type="number" value={usageLimit} onChange={e => setUsageLimit(e.target.value)}
                    placeholder="100" className="rounded-xl" data-testid="input-usage-limit" />
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3">
                <div>
                  <p className="text-sm font-bold">سعر الخدمة</p>
                  <p className="text-xs text-muted-foreground">يُخصم من رصيدك تلقائياً</p>
                </div>
                <span className="text-2xl font-extrabold text-primary">{priceEGP} <span className="text-sm">ج.م</span></span>
              </div>

              <AnimatePresence>
                {insufficientBalance && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-2xl p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-red-700 dark:text-red-400">رصيد غير كافٍ</p>
                        <p className="text-sm text-red-600 dark:text-red-400">
                          تحتاج <strong>{insufficientBalance.required} ج.م</strong> — رصيدك الحالي: <strong>{insufficientBalance.balance.toFixed(2)} ج.م</strong>
                        </p>
                        <p className="text-xs text-red-500 mt-1">اشحن رصيدك أو ادفع مباشرة عبر أحد الطرق التالية</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <PayFromAppButton />
                      <Link href="/payments">
                        <Button variant="outline" size="sm" className="w-full border-red-300 text-red-600 hover:bg-red-50" data-testid="btn-go-topup">
                          شحن الرصيد الآن
                        </Button>
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <Button
                className="w-full h-12 text-base font-bold gap-2 shadow-lg shadow-primary/20"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending || !businessName || !productDescription}
                data-testid="btn-generate-coupon"
              >
                {generateMutation.isPending
                  ? <><Loader2 className="w-5 h-5 animate-spin" /> جاري التوليد...</>
                  : <><Sparkles className="w-5 h-5" /> توليد الكوبون بالذكاء الاصطناعي</>
                }
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card className="rounded-3xl border-border/60 shadow-sm">
            <CardContent className="p-5 space-y-3">
              <h3 className="font-bold flex items-center gap-2"><Tag className="w-4 h-4 text-primary" /> كيف يعمل؟</h3>
              {[
                { icon: "1️⃣", text: "أدخل اسم نشاطك التجاري ووصف المنتج أو الخدمة" },
                { icon: "2️⃣", text: "اختر نوع الخصم وقيمته، أضف صورة اختيارياً" },
                { icon: "3️⃣", text: "اضغط «توليد» — يولّد الذكاء الاصطناعي العنوان والكود والنص" },
                { icon: "4️⃣", text: "انسخ الكوبون وشاركه مع عملائك فوراً!" },
              ].map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span>{s.icon}</span>
                  <span className="text-muted-foreground">{s.text}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-primary/20 bg-primary/5 shadow-sm">
            <CardContent className="p-5">
              <h3 className="font-bold flex items-center gap-2 text-primary mb-3">
                <Image className="w-4 h-4" /> يمكنك إضافة صورة!
              </h3>
              <p className="text-sm text-muted-foreground">أضف صورة المنتج أو شعار نشاطك وستظهر مع الكوبون. يمكن تغييرها في أي وقت بعد التوليد.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Ticket className="w-6 h-6 text-primary" />
            كوبوناتي
            {displayCoupons.length > 0 && (
              <Badge variant="secondary" className="mr-2">{displayCoupons.length}</Badge>
            )}
          </h2>
        </div>

        {couponsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 rounded-3xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : displayCoupons.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Ticket className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-lg font-medium">لا توجد كوبونات بعد</p>
            <p className="text-sm">استخدم المولّد أعلاه لإنشاء أول كوبون لنشاطك التجاري</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {displayCoupons.map((c: any) => (
                <CouponCard
                  key={c.id}
                  coupon={c}
                  onDeleted={() => setLocalCoupons(prev => prev.filter(x => x.id !== c.id))}
                  onUpdated={(updated) => setLocalCoupons(prev => prev.map(x => x.id === updated.id ? updated : x))}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
