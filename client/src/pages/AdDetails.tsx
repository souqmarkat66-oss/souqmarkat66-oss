import { useState, useRef, useEffect } from "react";
import { useRoute } from "wouter";
import { useAd } from "@/hooks/use-ads";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/components/LanguageProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Calendar, Share2, PhoneCall, CreditCard, Banknote, MessageCircle, ExternalLink, CheckCircle, Volume2, VolumeX, Play, ChevronLeft, ChevronRight, Smartphone, Download, AlertTriangle, User, Heart, QrCode, Star, Tag, RefreshCw } from "lucide-react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { LikeCommentBar } from "@/components/LikeCommentBar";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Textarea } from "@/components/ui/textarea";
import { AdCard } from "@/components/AdCard";
import { QRCodeSVG } from "qrcode.react";

const PLATFORM_PAYMENTS = [
  { label: "فودافون كاش", number: "01098553911", color: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900 text-red-700 dark:text-red-400", emoji: "📱" },
  { label: "اتصالات e& كاش", number: "01126665741", color: "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900 text-orange-700 dark:text-orange-400", emoji: "📲" },
  { label: "InstaPay", number: "01285558567", color: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-400", emoji: "💳" },
];

function PaymentSection({ ad, user }: { ad: any; user: any }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [payerName, setPayerName] = useState("");
  const [payerPhone, setPayerPhone] = useState("");
  const [paidAmount, setPaidAmount] = useState(ad.priceEGP?.toString() || "");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgText, setMsgText] = useState("");
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");
  const [offerMsg, setOfferMsg] = useState("");

  const sendMsgMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/messages", {
      toUserId: ad.userId,
      message: msgText,
      adId: ad.id,
    }),
    onSuccess: () => {
      setMsgOpen(false);
      setMsgText("");
      toast({ title: "✅ تم إرسال رسالتك للبائع!" });
    },
    onError: () => toast({ variant: "destructive", title: "خطأ في إرسال الرسالة" }),
  });

  const reportMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/fraud/report", {
      targetType: "ad",
      targetId: ad.id,
      reason: reportReason,
    }),
    onSuccess: () => {
      setReportOpen(false);
      setReportReason("");
      toast({ title: "✅ تم إرسال البلاغ. شكراً لمساعدتنا في حماية المنصة." });
    },
    onError: () => toast({ variant: "destructive", title: "خطأ في إرسال البلاغ" }),
  });

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

  const offerMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/offers", {
      adId: ad.id,
      offerAmountEGP: parseFloat(offerAmount),
      message: offerMsg,
    }),
    onSuccess: () => {
      setOfferOpen(false);
      setOfferAmount("");
      setOfferMsg("");
      toast({ title: "✅ تم إرسال عرضك للبائع!" });
    },
    onError: () => toast({ variant: "destructive", title: "خطأ في إرسال العرض" }),
  });

  return (
    <div className="mt-6 space-y-4">

      {/* Seller Actions */}
      {user && ad.userId !== user?.id && (
        <div className="flex gap-2">
          <Button
            className="flex-1 gap-2 bg-green-500 hover:bg-green-600 text-white rounded-xl h-10"
            onClick={() => setMsgOpen(true)}
            data-testid="btn-message-seller"
          >
            <MessageCircle className="w-4 h-4" /> راسل البائع
          </Button>
          <a href={`/profile/${ad.userId}`} className="flex-1">
            <Button variant="outline" className="w-full gap-2 rounded-xl h-10">
              <User className="w-4 h-4" /> ملف البائع
            </Button>
          </a>
        </div>
      )}

      {/* Price Badge */}
      {ad.priceEGP > 0 && (
        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/5 border border-green-300 dark:border-green-800 rounded-2xl">
          <Banknote className="w-6 h-6 text-green-600 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-2xl font-extrabold text-green-600">{ad.priceEGP?.toLocaleString('ar-EG')} ج.م</div>
            <div className="text-xs text-muted-foreground">السعر بالجنيه المصري</div>
          </div>
          {user && ad.userId !== user?.id && (
            <Button size="sm" variant="outline" onClick={() => setOfferOpen(true)} className="gap-1.5 border-orange-400/50 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20">
              <Tag className="w-3.5 h-3.5" /> اعرض سعراً
            </Button>
          )}
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

      {/* Installment Badge */}
      {ad.installmentMonths > 0 && ad.installmentMonthlyEGP > 0 && (
        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-500/10 to-indigo-500/5 border border-blue-300 dark:border-blue-800 rounded-2xl">
          <div className="text-2xl">📅</div>
          <div>
            <div className="font-bold text-blue-700 dark:text-blue-400 text-sm">التقسيط متاح!</div>
            <div className="text-xs text-muted-foreground">
              {ad.installmentMonths} شهر × <span className="font-bold text-blue-600">{ad.installmentMonthlyEGP?.toLocaleString('ar-EG')} ج.م</span> شهرياً
            </div>
          </div>
        </div>
      )}

      {/* App Download Buttons */}
      {(ad.appStoreUrl || ad.googlePlayUrl || ad.appGalleryUrl) && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Smartphone className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold">حمّل التطبيق</span>
          </div>
          {ad.appStoreUrl && (
            <a href={ad.appStoreUrl} target="_blank" rel="noopener noreferrer" data-testid="btn-appstore-link">
              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-black text-white hover:bg-gray-900 active:scale-[0.98] transition-all shadow-md">
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white flex-shrink-0"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                <div className="text-right flex-1">
                  <div className="text-[10px] opacity-70">تحميل على</div>
                  <div className="text-sm font-bold leading-tight">App Store</div>
                </div>
                <Download className="w-4 h-4 opacity-60" />
              </button>
            </a>
          )}
          {ad.googlePlayUrl && (
            <a href={ad.googlePlayUrl} target="_blank" rel="noopener noreferrer" data-testid="btn-googleplay-link">
              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#01875f] text-white hover:bg-[#017a56] active:scale-[0.98] transition-all shadow-md">
                <svg viewBox="0 0 24 24" className="w-6 h-6 flex-shrink-0" fill="white"><path d="M3.18 23.45a2 2 0 0 1-.93-.87V1.42a2 2 0 0 1 .93-.87l11.47 11.45L3.18 23.45zm13.12-6.92L4.43 23.35l9.1-9.09 2.77 2.27zm2.43-5.14c.4.28.65.72.65 1.21s-.25.93-.65 1.21l-2 1.3-3.06-3.05 3.06-3.06 2 1.39zM4.43.65l11.87 6.82-2.77 2.27L4.43.65z"/></svg>
                <div className="text-right flex-1">
                  <div className="text-[10px] opacity-70">تحميل على</div>
                  <div className="text-sm font-bold leading-tight">Google Play</div>
                </div>
                <Download className="w-4 h-4 opacity-60" />
              </button>
            </a>
          )}
          {ad.appGalleryUrl && (
            <a href={ad.appGalleryUrl} target="_blank" rel="noopener noreferrer" data-testid="btn-appgallery-link">
              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#cf0a2c] text-white hover:bg-[#b50926] active:scale-[0.98] transition-all shadow-md">
                <svg viewBox="0 0 24 24" className="w-6 h-6 flex-shrink-0" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
                <div className="text-right flex-1">
                  <div className="text-[10px] opacity-70">تحميل على</div>
                  <div className="text-sm font-bold leading-tight">AppGallery</div>
                </div>
                <Download className="w-4 h-4 opacity-60" />
              </button>
            </a>
          )}
        </div>
      )}

      {/* External Payment Link */}
      {ad.paymentLink && (
        <a href={ad.paymentLink} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" className="w-full gap-2 rounded-2xl h-11 border-primary/30 text-primary hover:bg-primary/5">
            <ExternalLink className="w-4 h-4" />
            {ad.installmentMonths > 0 ? "ادفع بالتقسيط — تطبيق سوق ماركات" : "رابط الدفع المباشر"}
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

      {/* Report Ad Button */}
      {user && ad.userId !== user?.id && (
        <button
          onClick={() => setReportOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground hover:text-red-500 transition-colors"
          data-testid="btn-report-ad"
        >
          <AlertTriangle className="w-3 h-3" /> الإبلاغ عن إعلان مشبوه
        </button>
      )}

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

      {/* Message Seller Dialog */}
      <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-500" /> مراسلة البائع
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/40 rounded-xl p-3">
              <p className="text-sm font-medium">بخصوص إعلان: {ad.title}</p>
            </div>
            <Textarea
              value={msgText}
              onChange={e => setMsgText(e.target.value)}
              placeholder="اكتب سؤالك أو استفساريك هنا..."
              className="min-h-[120px]"
              data-testid="input-msg-seller"
            />
            <Button
              className="w-full gap-2 bg-green-500 hover:bg-green-600 text-white"
              onClick={() => sendMsgMutation.mutate()}
              disabled={!msgText.trim() || sendMsgMutation.isPending}
            >
              <MessageCircle className="w-4 h-4" /> إرسال الرسالة
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Offer Dialog */}
      <Dialog open={offerOpen} onOpenChange={setOfferOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <Tag className="w-5 h-5" /> تقديم عرض سعر
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-orange-50 dark:bg-orange-950/20 rounded-xl p-3">
              <p className="text-sm text-orange-700 dark:text-orange-400">
                💡 سيصل عرضك مباشرةً للبائع وسيتواصل معك.
              </p>
            </div>
            {ad.priceEGP > 0 && (
              <div className="text-xs text-muted-foreground">السعر المطلوب: <strong>{ad.priceEGP?.toLocaleString()} ج.م</strong></div>
            )}
            <div>
              <label className="text-sm font-medium">عرضك بالجنيه المصري</label>
              <Input
                type="number"
                value={offerAmount}
                onChange={e => setOfferAmount(e.target.value)}
                placeholder="مثال: 1500"
                className="mt-1"
                data-testid="input-offer-amount"
              />
            </div>
            <div>
              <label className="text-sm font-medium">رسالة اختيارية</label>
              <Textarea
                value={offerMsg}
                onChange={e => setOfferMsg(e.target.value)}
                placeholder="أي تفاصيل إضافية..."
                className="mt-1 min-h-[80px]"
                data-testid="input-offer-message"
              />
            </div>
            <Button
              className="w-full gap-2 bg-orange-500 hover:bg-orange-600 text-white"
              onClick={() => offerMutation.mutate()}
              disabled={!offerAmount || parseFloat(offerAmount) <= 0 || offerMutation.isPending}
            >
              <Tag className="w-4 h-4" /> إرسال العرض
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Report Dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" /> بلاغ عن إعلان مشبوه
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-yellow-50 dark:bg-yellow-950/20 rounded-xl p-3">
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                ⚠️ البلاغات الكاذبة تُعرّضك للتعليق. استخدم هذه الميزة بمسؤولية.
              </p>
            </div>
            <Textarea
              value={reportReason}
              onChange={e => setReportReason(e.target.value)}
              placeholder="مثال: إعلان احتيال، سعر مبالغ فيه، محتوى مضلل..."
              className="min-h-[100px]"
              data-testid="input-report-reason"
            />
            <Button
              className="w-full gap-2 bg-red-500 hover:bg-red-600 text-white"
              onClick={() => reportMutation.mutate()}
              disabled={!reportReason.trim() || reportMutation.isPending}
            >
              إرسال البلاغ
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VideoPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [src]);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !muted;
      setMuted(!muted);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setPlaying(true);
    } else {
      videoRef.current.pause();
      setPlaying(false);
    }
  };

  return (
    <div className="relative w-full h-full bg-black group cursor-pointer" onClick={togglePlay}>
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain"
        loop
        playsInline
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      {/* Play/Pause overlay */}
      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Play className="w-8 h-8 text-white fill-white" />
          </div>
        </div>
      )}
      {/* Volume button — always visible */}
      <button
        onClick={e => { e.stopPropagation(); toggleMute(); }}
        className={`absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-2 rounded-full text-white text-xs font-bold transition-all shadow-lg ${
          muted
            ? 'bg-red-500/80 hover:bg-red-500 border border-red-400/50'
            : 'bg-black/60 hover:bg-black/80 border border-white/20'
        }`}
        data-testid="btn-video-mute-toggle"
      >
        {muted ? <><VolumeX className="w-4 h-4" /> انقر للصوت</> : <><Volume2 className="w-4 h-4" /> كتم</>}
      </button>
    </div>
  );
}

function ImageSlideshow({ images }: { images: string[] }) {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    if (images.length <= 1) return;
    const timer = setInterval(() => setCurrent(c => (c + 1) % images.length), 3000);
    return () => clearInterval(timer);
  }, [images.length]);
  if (images.length === 0) return null;
  return (
    <div className="relative w-full h-full bg-black">
      <img src={images[current]} alt="" className="w-full h-full object-contain transition-opacity duration-500" />
      {images.length > 1 && (
        <>
          <button onClick={() => setCurrent(c => (c - 1 + images.length) % images.length)} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => setCurrent(c => (c + 1) % images.length)} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white"><ChevronRight className="w-4 h-4" /></button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {images.map((_, i) => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === current ? 'bg-white w-3' : 'bg-white/50'}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StarRating({ value, onChange, readonly }: { value: number; onChange?: (v: number) => void; readonly?: boolean }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          onClick={() => !readonly && onChange?.(i)}
          onMouseEnter={() => !readonly && setHovered(i)}
          onMouseLeave={() => !readonly && setHovered(0)}
          className={`transition-colors ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'}`}
          disabled={readonly}
        >
          <Star
            className={`w-5 h-5 ${(hovered || value) >= i ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}
          />
        </button>
      ))}
    </div>
  );
}

export default function AdDetails() {
  const [match, params] = useRoute("/ads/:id");
  const id = parseInt(params?.id || "0");
  const { data: ad, isLoading } = useAd(id);
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [qrOpen, setQrOpen] = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [myReview, setMyReview] = useState("");
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  // Increment view count on page load
  useEffect(() => {
    if (id) {
      fetch(`/api/ads/${id}/view`, { method: "POST" }).catch(() => {});
    }
  }, [id]);

  const { data: favCheck } = useQuery<{ favorited: boolean }>({
    queryKey: ["/api/favorites", id, "check"],
    queryFn: () => fetch(`/api/favorites/${id}/check`, { credentials: "include" }).then(r => r.json()),
    enabled: !!user && !!id,
  });

  const { data: ratingsData } = useQuery<{ ratings: any[]; avg: number; count: number }>({
    queryKey: ["/api/ratings/ad", id],
    queryFn: () => fetch(`/api/ratings/ad/${id}`).then(r => r.json()),
    enabled: !!id,
  });

  const { data: similarAds = [] } = useQuery<any[]>({
    queryKey: ["/api/ads", id, "similar"],
    queryFn: () => fetch(`/api/ads/${id}/similar`).then(r => r.json()),
    enabled: !!id,
  });

  const { data: myOffers = [] } = useQuery<any[]>({
    queryKey: ["/api/offers/ad", id],
    queryFn: () => fetch(`/api/offers/ad/${id}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!user && !!id && !!(ad?.userId === user?.id),
  });

  const favMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/favorites/${id}`),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/favorites", id, "check"] });
      toast({ title: data.favorited ? "❤️ أُضيف للمفضلة!" : "تم الإزالة من المفضلة" });
    },
  });

  const ratingMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/ratings", { targetType: "ad", targetId: id, rating: myRating, review: myReview }),
    onSuccess: () => {
      setRatingSubmitted(true);
      qc.invalidateQueries({ queryKey: ["/api/ratings/ad", id] });
      toast({ title: "✅ تم إرسال تقييمك!" });
    },
  });

  const offerStatusMutation = useMutation({
    mutationFn: ({ offerId, status }: { offerId: number; status: string }) => apiRequest("PATCH", `/api/offers/${offerId}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/offers/ad", id] });
      toast({ title: "✅ تم تحديث حالة العرض" });
    },
  });

  const adUrl = typeof window !== "undefined" ? window.location.href : "";

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
            <div className="aspect-video bg-black relative overflow-hidden rounded-t-3xl">
              {ad.mediaType === 'video' ? (
                <VideoPlayer src={ad.mediaUrl} />
              ) : ad.mediaUrl ? (
                <ImageSlideshow images={[ad.mediaUrl]} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                  <span className="text-6xl">📷</span>
                </div>
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
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {ad.createdAt && format(new Date(ad.createdAt), 'dd MMM yyyy', { locale: ar })}
                  </div>
                  {/* Favorites */}
                  {user && (
                    <button
                      onClick={() => favMutation.mutate()}
                      className={`flex items-center gap-1 h-7 px-2 rounded-full border transition-all ${favCheck?.favorited ? 'bg-red-50 border-red-200 text-red-500 dark:bg-red-900/20 dark:border-red-800' : 'border-border text-muted-foreground hover:text-red-500'}`}
                      data-testid="btn-favorite-ad"
                    >
                      <Heart className={`w-3 h-3 ${favCheck?.favorited ? 'fill-current' : ''}`} />
                      {favCheck?.favorited ? 'في المفضلة' : 'أضف للمفضلة'}
                    </button>
                  )}
                  {/* Share */}
                  <Button
                    variant="outline" size="sm" className="gap-1.5 h-7 rounded-full text-xs"
                    onClick={() => { navigator.clipboard.writeText(window.location.href); toast({ title: "تم نسخ رابط الإعلان!" }); }}
                  >
                    <Share2 className="w-3 h-3" /> نسخ الرابط
                  </Button>
                  {/* WhatsApp Share */}
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`شوف الإعلان ده: "${ad.title}" - ${window.location.href}`)}`}
                    target="_blank" rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="sm" className="gap-1.5 h-7 rounded-full text-xs border-green-300 text-green-700 hover:bg-green-50">
                      <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                      واتساب
                    </Button>
                  </a>
                  {/* QR Code */}
                  <Button variant="outline" size="sm" className="gap-1.5 h-7 rounded-full text-xs" onClick={() => setQrOpen(true)}>
                    <QrCode className="w-3 h-3" /> QR
                  </Button>
                </div>
              </div>

              <h1 className="text-2xl md:text-3xl font-bold mb-4 leading-tight">{ad.title}</h1>
              <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{ad.description}</p>

              {/* Like/Comment */}
              <div className="mt-6">
                <LikeCommentBar targetType="ad" targetId={ad.id} initialLikes={ad.likesCount || 0} />
              </div>

              {/* ── RATINGS SECTION ── */}
              <div className="mt-8 border-t border-border/40 pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                  <h3 className="font-bold text-base">تقييمات الإعلان</h3>
                  {ratingsData && ratingsData.count > 0 && (
                    <div className="flex items-center gap-1.5 mr-auto">
                      <StarRating value={Math.round(ratingsData.avg)} readonly />
                      <span className="text-sm font-bold text-yellow-600">{ratingsData.avg.toFixed(1)}</span>
                      <span className="text-xs text-muted-foreground">({ratingsData.count} تقييم)</span>
                    </div>
                  )}
                </div>

                {/* Add Rating */}
                {user && ad.userId !== user.id && !ratingSubmitted && (
                  <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800/40 rounded-2xl p-4 mb-4">
                    <p className="text-sm font-medium mb-3">قيّم هذا الإعلان</p>
                    <StarRating value={myRating} onChange={setMyRating} />
                    {myRating > 0 && (
                      <div className="mt-3 space-y-2">
                        <Input
                          placeholder="اكتب رأيك (اختياري)..."
                          value={myReview}
                          onChange={e => setMyReview(e.target.value)}
                          className="text-sm"
                          data-testid="input-rating-review"
                        />
                        <Button
                          size="sm"
                          className="gap-1.5 bg-yellow-500 hover:bg-yellow-600 text-white"
                          onClick={() => ratingMutation.mutate()}
                          disabled={ratingMutation.isPending}
                          data-testid="btn-submit-rating"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> إرسال التقييم
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                {ratingSubmitted && (
                  <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 rounded-xl p-3 mb-4 text-sm text-green-700 dark:text-green-400">
                    ✅ شكراً! تم إضافة تقييمك.
                  </div>
                )}

                {/* Ratings List */}
                {ratingsData && ratingsData.ratings.length > 0 ? (
                  <div className="space-y-3">
                    {ratingsData.ratings.slice(0, 5).map((r: any) => (
                      <div key={r.id} className="flex gap-3 bg-muted/30 rounded-xl p-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                          {r.user_name?.[0] || "؟"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">{r.user_name}</span>
                            <StarRating value={r.rating} readonly />
                          </div>
                          {r.review && <p className="text-xs text-muted-foreground line-clamp-2">{r.review}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">لا توجد تقييمات بعد. كن أول من يقيّم!</p>
                )}
              </div>

              {/* ── OWNER OFFERS RECEIVED ── */}
              {ad.userId === user?.id && myOffers.length > 0 && (
                <div className="mt-8 border-t border-border/40 pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Tag className="w-5 h-5 text-orange-500" />
                    <h3 className="font-bold text-base">عروض الأسعار المستلمة</h3>
                    <Badge variant="secondary">{myOffers.length}</Badge>
                  </div>
                  <div className="space-y-3">
                    {myOffers.map((offer: any) => (
                      <div key={offer.id} className="border border-border/50 rounded-xl p-3 flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-green-600">{offer.offer_amount_egp?.toLocaleString()} ج.م</span>
                            <Badge variant={offer.status === "accepted" ? "default" : offer.status === "rejected" ? "destructive" : "secondary"} className="text-xs">
                              {offer.status === "accepted" ? "مقبول" : offer.status === "rejected" ? "مرفوض" : "في الانتظار"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">{offer.from_user_name}</p>
                          {offer.message && <p className="text-xs text-muted-foreground mt-1">{offer.message}</p>}
                        </div>
                        {offer.status === "pending" && (
                          <div className="flex gap-1.5">
                            <Button size="sm" className="h-7 text-xs bg-green-500 hover:bg-green-600 text-white" onClick={() => offerStatusMutation.mutate({ offerId: offer.id, status: "accepted" })}>قبول</Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs border-red-300 text-red-600 hover:bg-red-50" onClick={() => offerStatusMutation.mutate({ offerId: offer.id, status: "rejected" })}>رفض</Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
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

      {/* ── SIMILAR ADS ── */}
      {similarAds.length > 0 && (
        <div className="mt-12">
          <div className="flex items-center gap-3 mb-5">
            <RefreshCw className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold">إعلانات مشابهة</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {similarAds.map((sad, i) => <AdCard key={sad.id} ad={sad} index={i} />)}
          </div>
        </div>
      )}

      {/* QR Code Dialog */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent dir="rtl" className="max-w-xs text-center">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2">
              <QrCode className="w-5 h-5" /> QR كود الإعلان
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="p-4 bg-white rounded-2xl shadow-inner border">
              <QRCodeSVG value={adUrl || "https://asouq.shop"} size={200} />
            </div>
            <p className="text-xs text-muted-foreground">امسح الكود لفتح الإعلان</p>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => { navigator.clipboard.writeText(adUrl); toast({ title: "تم نسخ الرابط!" }); }}
            >
              <Share2 className="w-3.5 h-3.5" /> نسخ الرابط
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
