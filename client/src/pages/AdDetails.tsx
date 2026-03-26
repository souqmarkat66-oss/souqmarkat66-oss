import { useState } from "react";
import { useRoute } from "wouter";
import { useAd } from "@/hooks/use-ads";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/components/LanguageProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Calendar, Share2, PhoneCall, CreditCard, Banknote, MessageCircle, ExternalLink, CheckCircle } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { LikeCommentBar } from "@/components/LikeCommentBar";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const PLATFORM_PAYMENTS = [
  { label: "فودافون كاش", number: "01098553911", color: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900 text-red-700 dark:text-red-400", emoji: "📱" },
  { label: "اتصالات e& كاش", number: "0112666571", color: "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900 text-orange-700 dark:text-orange-400", emoji: "📲" },
  { label: "InstaPay", number: "01285558567", color: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-400", emoji: "💳" },
];

function PaymentSection({ ad, user }: { ad: any; user: any }) {
  const { toast } = useToast();
  const [payerName, setPayerName] = useState("");
  const [payerPhone, setPayerPhone] = useState("");
  const [paidAmount, setPaidAmount] = useState(ad.priceEGP?.toString() || "");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [open, setOpen] = useState(false);

  const confirmMutation = useMutation({
    mutationFn: () => apiRequest('/api/payment-notifications', 'POST', {
      adId: ad.id,
      payerName, payerPhone, paidAmount: parseFloat(paidAmount), paymentMethod,
    }),
    onSuccess: () => {
      setOpen(false);
      toast({ title: "✅ تم إرسال إشعار الدفع لصاحب الإعلان. سيتواصل معك قريباً." });
    },
    onError: () => toast({ variant: "destructive", title: "خطأ في إرسال إشعار الدفع" }),
  });

  return (
    <div className="mt-6 space-y-4">
      {/* Price Badge */}
      {ad.priceEGP > 0 && (
        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/5 border border-green-300 dark:border-green-800 rounded-2xl">
          <Banknote className="w-6 h-6 text-green-600 flex-shrink-0" />
          <div>
            <div className="text-2xl font-extrabold text-green-600">{ad.priceEGP?.toLocaleString('ar-EG')} ج.م</div>
            <div className="text-xs text-muted-foreground">السعر بالجنيه المصري</div>
          </div>
        </div>
      )}

      {/* WhatsApp Button */}
      {ad.whatsappNumber && (
        <a
          href={`https://wa.me/2${ad.whatsappNumber.replace(/^0/, '')}?text=مرحباً، رأيت إعلانك "${ad.title}" على شبكة سوق للإعلانات`}
          target="_blank" rel="noopener noreferrer"
        >
          <Button className="w-full gap-2 bg-green-500 hover:bg-green-600 text-white rounded-2xl h-12">
            <MessageCircle className="w-5 h-5" />
            تواصل عبر واتساب {ad.whatsappNumber}
          </Button>
        </a>
      )}

      {/* External Payment Link */}
      {ad.paymentLink && (
        <a href={ad.paymentLink} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" className="w-full gap-2 rounded-2xl h-11">
            <ExternalLink className="w-4 h-4" />
            رابط الدفع المباشر
          </Button>
        </a>
      )}

      {/* Platform Payment Methods */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <CreditCard className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-sm">طرق الدفع عبر المنصة</h3>
        </div>
        <div className="space-y-2">
          {PLATFORM_PAYMENTS.map(pm => (
            <button
              key={pm.label}
              onClick={() => { setPaymentMethod(pm.label); setOpen(true); }}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all hover:shadow-md text-right ${pm.color}`}
              data-testid={`pay-${pm.label}`}
            >
              <span className="text-xl">{pm.emoji}</span>
              <div className="flex-1">
                <div className="text-xs font-bold">{pm.label}</div>
                <div className="text-sm font-mono font-bold">{pm.number}</div>
              </div>
              <div className="text-xs opacity-70">اضغط للتأكيد</div>
            </button>
          ))}
        </div>
      </div>

      {/* Payment Confirmation Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تأكيد الدفع — {paymentMethod}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-yellow-50 dark:bg-yellow-950/20 rounded-xl p-3">
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                ⚠️ قبل الإرسال، تأكد من تحويل المبلغ لرقم المنصة أعلاه، ثم أدخل بياناتك لتأكيد الدفع.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">اسمك الكامل</label>
              <Input value={payerName} onChange={e => setPayerName(e.target.value)} placeholder="أحمد محمد علي" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">رقم هاتفك</label>
              <Input value={payerPhone} onChange={e => setPayerPhone(e.target.value)} placeholder="01xxxxxxxxx" className="mt-1 font-mono" dir="ltr" />
            </div>
            <div>
              <label className="text-sm font-medium">المبلغ المدفوع (ج.م)</label>
              <Input type="number" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} placeholder={ad.priceEGP?.toString() || "0"} className="mt-1" />
            </div>
            <Button
              className="w-full gap-2" onClick={() => confirmMutation.mutate()}
              disabled={!payerName || !payerPhone || !paidAmount || confirmMutation.isPending}
            >
              <CheckCircle className="w-4 h-4" /> أرسل تأكيد الدفع
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdDetails() {
  const [match, params] = useRoute("/ads/:id");
  const id = parseInt(params?.id || "0");
  const { data: ad, isLoading } = useAd(id);
  const { user } = useAuth();
  const { toast } = useToast();

  if (isLoading) {
    return (
      <div className="container px-4 py-12 max-w-4xl">
        <Skeleton className="h-8 w-32 mb-8" />
        <Skeleton className="aspect-video w-full rounded-3xl mb-8" />
        <Skeleton className="h-10 w-3/4 mb-4" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  if (!ad) {
    return (
      <div className="container px-4 py-20 text-center" dir="rtl">
        <h1 className="text-2xl font-bold">الإعلان غير موجود</h1>
        <Link href="/ads">
          <Button variant="link" className="mt-4">العودة للإعلانات</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container px-4 py-12 max-w-4xl" dir="rtl">
      <Link href="/ads">
        <Button variant="ghost" className="gap-2 mb-6 hover:bg-muted pr-0">
          <ArrowLeft className="w-4 h-4 rotate-180" />
          العودة للإعلانات
        </Button>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <div className="bg-card border rounded-3xl overflow-hidden shadow-sm">
            {/* Media */}
            <div className="aspect-video bg-black relative">
              {ad.mediaType === 'video' ? (
                <video src={ad.mediaUrl} className="w-full h-full object-contain" controls autoPlay />
              ) : (
                <img src={ad.mediaUrl} alt={ad.title} className="w-full h-full object-contain bg-black/5" />
              )}
            </div>

            <div className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-primary/20 text-primary bg-primary/5">
                    {ad.language === 'ar' ? '🇸🇦 عربي' : '🇺🇸 English'}
                  </Badge>
                  {ad.targetRegion && (
                    <Badge variant="secondary" className="text-xs">📍 {ad.targetRegion}</Badge>
                  )}
                  {ad.priceEGP > 0 && (
                    <Badge className="bg-green-500 text-white">{ad.priceEGP?.toLocaleString()} ج.م</Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {ad.createdAt && format(new Date(ad.createdAt), 'dd MMM yyyy', { locale: ar })}
                  </div>
                  <Button
                    variant="outline" size="sm" className="gap-1.5 h-7 rounded-full text-xs"
                    onClick={() => { navigator.clipboard.writeText(window.location.href); toast({ title: "تم نسخ رابط الإعلان!" }); }}
                  >
                    <Share2 className="w-3 h-3" /> مشاركة
                  </Button>
                </div>
              </div>

              <h1 className="text-2xl md:text-3xl font-bold mb-4 leading-tight">{ad.title}</h1>
              <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{ad.description}</p>

              {/* Like/Comment */}
              <div className="mt-6">
                <LikeCommentBar targetType="ad" targetId={ad.id} initialLikes={ad.likesCount || 0} />
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar — Payment */}
        <div className="lg:col-span-1">
          <Card className="rounded-3xl sticky top-20">
            <CardContent className="p-4">
              <h2 className="font-bold text-base mb-1 flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-primary" /> التواصل والدفع
              </h2>
              <p className="text-xs text-muted-foreground mb-3">
                تواصل مع صاحب الإعلان أو ادفع مباشرةً عبر المنصة
              </p>
              <PaymentSection ad={ad} user={user} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
