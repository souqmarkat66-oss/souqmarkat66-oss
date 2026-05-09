import { useState, useRef, useEffect } from "react";
import { Ad } from "@shared/schema";
import { Link } from "wouter";
import { useLanguage } from "./LanguageProvider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, Trash2, Calendar, Play, Volume2, VolumeX, Loader2, Headphones, Square, Heart, Star, Zap, CreditCard, Copy, Tag } from "lucide-react";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { useAuth } from "@/hooks/use-auth";
import { useDeleteAd } from "@/hooks/use-ads";
import { useToast } from "@/hooks/use-toast";
import { useTTS } from "@/hooks/use-tts";
import { motion } from "framer-motion";
import { LikeCommentBar } from "./LikeCommentBar";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ShareMenu } from "./ShareMenu";
import { PayFromAppButton } from "./PayFromAppButton";

// ── Quick Rating Component (inline, no navigation needed) ─────────────────
function QuickRating({
  adId, ratingData, userId, onRated,
}: {
  adId: number;
  ratingData?: { avg: number; count: number };
  userId?: string;
  onRated: () => void;
}) {
  const { toast } = useToast();
  const [hovered, setHovered] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [myRating, setMyRating] = useState(0);

  const handleRate = async (star: number) => {
    if (!userId) { window.location.href = "/login"; return; }
    if (done) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ targetType: "ad", targetId: adId, rating: star }),
      });
      if (res.ok) {
        setMyRating(star);
        setDone(true);
        onRated();
        toast({ title: `⭐ تم تقييمك بـ ${star} نجوم!` });
      }
    } catch {
      toast({ variant: "destructive", title: "فشل التقييم" });
    } finally { setSubmitting(false); }
  };

  const displayAvg = ratingData?.avg ?? 0;
  const displayCount = ratingData?.count ?? 0;
  // active fill: hover > my submitted > average
  const activeFill = hovered || (done ? myRating : 0) || displayAvg;

  return (
    <div className="flex items-center gap-1 mt-2" onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
      {/* Stars row */}
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(i => {
          const filled = i <= Math.floor(activeFill);
          const half = !filled && i <= activeFill + 0.5;
          return (
            <button
              key={i}
              disabled={submitting || done}
              onClick={() => handleRate(i)}
              onMouseEnter={() => !done && setHovered(i)}
              onMouseLeave={() => !done && setHovered(0)}
              className="focus:outline-none disabled:cursor-default transition-transform hover:scale-125 active:scale-95"
              data-testid={`btn-rate-${adId}-${i}`}
              title={`${i} نجوم`}
            >
              <Star
                className={`w-4 h-4 transition-colors ${
                  filled
                    ? "fill-yellow-400 text-yellow-400"
                    : half
                      ? "fill-yellow-200 text-yellow-400"
                      : "fill-transparent text-gray-300 dark:text-gray-600"
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Score display */}
      {displayCount > 0 ? (
        <div className="flex items-center gap-1 ms-1">
          <span className="text-xs font-bold text-yellow-600 dark:text-yellow-400 tabular-nums">
            {displayAvg.toFixed(1)}
          </span>
          <span className="text-[10px] text-muted-foreground">
            ({displayCount} {displayCount === 1 ? "تقييم" : "تقييمات"})
          </span>
        </div>
      ) : (
        <span className="text-[10px] text-muted-foreground/70 ms-1">
          {done ? "" : userId ? "اضغط نجمة لتقييم" : "لم يُقيَّم بعد"}
        </span>
      )}

      {/* Done badge */}
      {done && (
        <span className="text-[10px] text-green-600 dark:text-green-400 font-bold ms-1 flex items-center gap-0.5">
          ✓ قيّمت بـ {myRating}⭐
        </span>
      )}
    </div>
  );
}

export function AdCard({ ad, index }: { ad: Ad; index: number }) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { mutate: deleteAd } = useDeleteAd();
  const { toast } = useToast();
  const qc = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [imgError, setImgError] = useState(false);
  const tts = useTTS();
  const [cardVoice, setCardVoice] = useState<"nova" | "onyx">("nova");
  const [boosting, setBoosting]     = useState(false);
  const [boosted, setBoosted]       = useState(false);
  const [boostPayDialog, setBoostPayDialog] = useState(false);
  const [boostPrice, setBoostPrice] = useState(0);
  const [payRef, setPayRef]         = useState("");

  const { data: favData } = useQuery<{ favorited: boolean }>({
    queryKey: ["/api/favorites", ad.id, "check"],
    queryFn: () => fetch(`/api/favorites/${ad.id}/check`, { credentials: "include" }).then(r => r.json()),
    enabled: !!user,
  });

  const favMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/favorites/${ad.id}`),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/favorites", ad.id, "check"] });
      qc.invalidateQueries({ queryKey: ["/api/favorites"] });
      toast({ title: data.favorited ? "❤️ أُضيف للمفضلة!" : "تم الإزالة من المفضلة" });
    },
  });

  const { data: ratingData } = useQuery<{ avg: number; count: number }>({
    queryKey: ["/api/ratings/ad", ad.id],
    queryFn: () => fetch(`/api/ratings/ad/${ad.id}`).then(r => r.json()),
    staleTime: 60_000,
  });

  const isOwner = user?.id === ad.userId;
  const isVideo = ad.mediaType === 'video';

  // Sync muted state to DOM (React muted prop bug)
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
    }
  }, [muted]);

  const handlePlayClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
      setPlaying(false);
    } else {
      videoRef.current.muted = false; // unmute on explicit play
      setMuted(false);
      videoRef.current.play().then(() => setPlaying(true)).catch(() => {
        // If autoplay blocked, try muted
        if (!videoRef.current) return;
        videoRef.current.muted = true;
        setMuted(true);
        videoRef.current.play().then(() => setPlaying(true)).catch(() => {
          // Source unsupported / broken — fail silently
          setPlaying(false);
        });
      });
    }
  };

  const handleToggleMute = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newMuted = !muted;
    setMuted(newMuted);
    if (videoRef.current) {
      videoRef.current.muted = newMuted;
      videoRef.current.volume = newMuted ? 0 : 1;
    }
  };

  const handleDelete = () => {
    if (confirm("هل أنت متأكد من الحذف؟")) {
      deleteAd(ad.id, {
        onSuccess: () => toast({ title: "تم الحذف" }),
      });
    }
  };

  const doBoost = async (paymentRef?: string) => {
    setBoosting(true);
    try {
      const res = await fetch(`/api/ads/${ad.id}/boost-notify`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_ref: paymentRef || undefined }),
      });
      const data = await res.json();
      if (res.status === 402 && data.requiresPayment) {
        setBoostPrice(data.price);
        setBoostPayDialog(true);
      } else if (res.status === 429) {
        toast({ variant: "destructive", title: "⏳ حد التعزيز", description: data.message });
      } else if (res.status === 403) {
        toast({ variant: "destructive", title: "🚫 التعزيز معطّل", description: data.message });
      } else if (res.ok) {
        setBoosted(true);
        setBoostPayDialog(false);
        toast({
          title: `🚀 تم إرسال الإشعار!`,
          description: data.notifiedCount > 0
            ? `وصل لـ ${data.notifiedCount} مستخدم`
            : "سيصل لجميع المستخدمين",
        });
      } else {
        toast({ variant: "destructive", title: data.message || "فشل التعزيز" });
      }
    } catch {
      toast({ variant: "destructive", title: "خطأ في الاتصال" });
    } finally { setBoosting(false); }
  };

  const handleBoost = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!user) { window.location.href = "/login"; return; }
    doBoost();
  };

  const hasMedia = ad.mediaUrl && ad.mediaUrl.trim() !== "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Card className={`group overflow-hidden transition-all duration-300 hover:shadow-2xl bg-card h-full flex flex-col rounded-3xl ${ad.isBoosted ? 'border-2 border-yellow-400 shadow-yellow-400/20 shadow-lg hover:border-yellow-300 hover:shadow-yellow-400/40' : ad.isAdminPromo ? 'border-2 border-emerald-400 shadow-emerald-400/10 shadow-md hover:border-emerald-300' : 'border-border/50 hover:border-primary/50 hover:shadow-primary/10'}`}>

        {/* Media Area */}
        <div className="relative aspect-[4/3] bg-muted overflow-hidden">
          {isVideo && hasMedia ? (
            <>
              <video
                ref={videoRef}
                src={ad.mediaUrl}
                className="w-full h-full object-cover"
                loop
                playsInline
                muted
                preload="metadata"
                onEnded={() => setPlaying(false)}
                onPause={() => setPlaying(false)}
                onPlay={() => setPlaying(true)}
              />

              {/* Play/Pause overlay */}
              {!playing && (
                <button
                  onClick={handlePlayClick}
                  className="absolute inset-0 flex items-center justify-center bg-black/10 hover:bg-black/20 transition-colors cursor-pointer"
                  data-testid={`btn-play-video-${ad.id}`}
                >
                  <div className="w-16 h-16 rounded-full bg-white/95 flex items-center justify-center shadow-2xl hover:scale-110 transition-transform">
                    <Play className="w-7 h-7 text-gray-900 fill-gray-900 ms-1" />
                  </div>
                  <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-white text-xs font-bold bg-black/60 rounded-full px-3 py-1 backdrop-blur-sm">
                    🎬 فيديو • اضغط للتشغيل بصوت
                  </span>
                </button>
              )}

              {/* Volume button — always visible when playing */}
              {playing && (
                <button
                  onClick={handleToggleMute}
                  className={`absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-xs font-bold shadow-lg transition-all ${
                    muted
                      ? 'bg-red-500/90 hover:bg-red-500 border border-red-400/50'
                      : 'bg-green-500/90 hover:bg-green-600 border border-green-400/50'
                  }`}
                  data-testid={`btn-mute-${ad.id}`}
                >
                  {muted ? <><VolumeX className="w-3.5 h-3.5" /> انقر للصوت</> : <><Volume2 className="w-3.5 h-3.5" /> صوت شغال</>}
                </button>
              )}

              {/* Pause button when playing */}
              {playing && (
                <button
                  onClick={handlePlayClick}
                  className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                  data-testid={`btn-pause-${ad.id}`}
                >
                  <span className="text-xs">⏸</span>
                </button>
              )}
            </>
          ) : hasMedia && !imgError ? (
            <div className="w-full h-full relative">
              <img
                src={ad.mediaUrl}
                alt={ad.title}
                className="absolute inset-0 w-full h-full object-cover blur-md scale-105 opacity-40"
                aria-hidden
                onError={() => setImgError(true)}
              />
              <img
                src={ad.mediaUrl}
                alt={ad.title}
                className="relative w-full h-full object-contain transition-transform duration-700 group-hover:scale-105"
                onError={() => setImgError(true)}
              />
            </div>
          ) : (
            /* Placeholder when no media */
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-gradient-to-br from-muted to-muted/50">
              <div className="text-4xl mb-2">📢</div>
              <span className="text-xs">إعلان نصي</span>
            </div>
          )}

          {/* Language badge + Boost badge */}
          <div className="absolute top-3 end-3 flex flex-col gap-1.5 items-end">
            {ad.isBoosted && (
              <Badge className="bg-yellow-400 text-yellow-900 shadow-lg px-2.5 py-0.5 rounded-full border-none font-bold text-xs animate-pulse">
                🚀 مميز
              </Badge>
            )}
            {ad.isAdminPromo && !ad.isBoosted && (
              <Badge className="bg-emerald-500 text-white shadow-lg px-2.5 py-0.5 rounded-full border-none font-bold text-xs">
                📢 إعلان ترويجي
              </Badge>
            )}
            <Badge variant="secondary" className="bg-background/90 backdrop-blur-md text-foreground shadow-sm px-3 py-1 rounded-full border-none font-medium text-xs">
              {ad.language === 'ar' ? '🇪🇬 عربي' : '🇺🇸 EN'}
            </Badge>
          </div>

          {/* Favorite button */}
          {user && (
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); favMutation.mutate(); }}
              className={`absolute top-3 start-3 z-20 w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90 ${
                favData?.favorited
                  ? 'bg-red-500 text-white'
                  : 'bg-white/80 backdrop-blur text-gray-500 hover:text-red-500'
              }`}
              data-testid={`btn-favorite-${ad.id}`}
            >
              <Heart className={`w-4 h-4 ${favData?.favorited ? 'fill-current' : ''}`} />
            </button>
          )}

          {/* View button on hover (for non-video or image) */}
          {!isVideo && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
              <Link href={`/ads/${ad.id}`} className="w-full" onClick={e => e.stopPropagation()}>
                <Button variant="secondary" size="sm" className="w-full rounded-full bg-white/20 backdrop-blur-md border-white/30 text-white hover:bg-white/40 gap-2">
                  <Eye className="w-3 h-3" /> {t('common.view')}
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Content */}
        <CardContent className="p-5 flex-1 flex flex-col">
          <Link href={`/ads/${ad.id}`}>
            <h3 className="font-bold text-lg leading-snug line-clamp-2 text-foreground hover:text-primary transition-colors cursor-pointer mb-2">
              {ad.title}
            </h3>
          </Link>
          <p className="text-muted-foreground text-sm line-clamp-2 flex-1">
            {ad.description}
          </p>

          {/* Price + Pay from App */}
          {ad.priceEGP && (
            <div className="mt-2 space-y-2">
              <span className="text-lg font-bold text-green-600 dark:text-green-400">
                {ad.priceEGP.toLocaleString()} ج.م
              </span>
              <PayFromAppButton price={ad.priceEGP} size="sm" className="w-full" />
            </div>
          )}

          {/* ⭐ Star Rating — Quick Rate from Card */}
          <QuickRating adId={ad.id} ratingData={ratingData} userId={user?.id} onRated={() => qc.invalidateQueries({ queryKey: ["/api/ratings/ad", ad.id] })} />

          {/* 🏷️ Coupon Badge */}
          {(ad as any).coupon_code && (
            <div className="flex items-center gap-2 bg-gradient-to-l from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/20 border border-orange-200 dark:border-orange-800/50 rounded-xl p-2 mt-1">
              <div className="w-6 h-6 rounded-lg bg-orange-500 flex items-center justify-center flex-shrink-0">
                <Tag className="w-3 h-3 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-orange-600 dark:text-orange-400 font-semibold">كوبون خصم</p>
                <p className="font-mono font-extrabold text-xs text-orange-800 dark:text-orange-300 truncate">{(ad as any).coupon_code}</p>
              </div>
              {(ad as any).coupon_discount_value && (
                <Badge className="bg-orange-500 text-white text-[10px] px-2 border-none flex-shrink-0">
                  {(ad as any).coupon_discount_type === "percentage"
                    ? `${(ad as any).coupon_discount_value}%`
                    : (ad as any).coupon_discount_type === "fixed"
                    ? `${(ad as any).coupon_discount_value} ج.م`
                    : (ad as any).coupon_discount_type === "free_shipping"
                    ? "شحن مجاني"
                    : "عرض"}
                </Badge>
              )}
              <button
                type="button"
                onClick={e => { e.preventDefault(); e.stopPropagation(); navigator.clipboard.writeText((ad as any).coupon_code); }}
                className="p-1 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors flex-shrink-0"
                data-testid={`btn-copy-coupon-${ad.id}`}
                title="نسخ الكود"
              >
                <Copy className="w-3 h-3 text-orange-500" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40">
            <div className="flex items-center text-xs text-muted-foreground/80 gap-1.5">
              <Calendar className="w-3 h-3" />
              {ad.createdAt && format(new Date(ad.createdAt), 'MMM d', { locale: language === 'ar' ? ar : enUS })}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Eye className="w-3 h-3" />
              {(ad.viewsCount || 0).toLocaleString()}
              {isOwner && (
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground/50 hover:text-destructive rounded-full ms-1" onClick={handleDelete}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>

          <LikeCommentBar targetType="ad" targetId={ad.id} initialLikes={ad.likesCount || 0} ownerId={ad.userId} />

          {/* ── Share & Boost Row ────────────────────────────── */}
          <div className="flex items-center gap-2 mt-2" onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
            {/* Share on social platforms */}
            <ShareMenu
              url={`/ads/${ad.id}`}
              title={ad.title}
              description={ad.description || ""}
              variant="outline"
              size="sm"
              label="شير"
              className="flex-1 justify-center text-xs"
              data-testid={`btn-share-ad-${ad.id}`}
            />

            {/* 🚀 Boost — Ad Owner Only (prominent) */}
            {isOwner && (
              <button
                onClick={handleBoost}
                disabled={boosting || boosted}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-extrabold border-2 transition-all flex-1 justify-center shadow-sm ${
                  boosted
                    ? "bg-green-500 text-white border-green-500 shadow-green-200 dark:shadow-green-900"
                    : "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-orange-400 shadow-orange-200 dark:shadow-orange-900/40"
                } disabled:opacity-70`}
                data-testid={`btn-boost-ad-${ad.id}`}
              >
                {boosting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ...</>
                  : boosted
                  ? <>✅ تم الإرسال</>
                  : <><Zap className="w-4 h-4 fill-current" /> عزّز إعلانك 🚀</>
                }
              </button>
            )}
          </div>

          {/* 🔊 Listen (TTS) button */}
          {user && (
            <div className="mt-2 space-y-1.5" onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
              {/* Gender toggle */}
              {!tts.playing && !tts.loading && (
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setCardVoice("nova")}
                    className={`flex-1 text-xs py-1 rounded-full border font-bold transition-all ${cardVoice === "nova" ? "bg-pink-500 text-white border-pink-500" : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"}`}
                    data-testid={`btn-female-${ad.id}`}
                  >👩 أنثى</button>
                  <button
                    onClick={() => setCardVoice("onyx")}
                    className={`flex-1 text-xs py-1 rounded-full border font-bold transition-all ${cardVoice === "onyx" ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"}`}
                    data-testid={`btn-male-${ad.id}`}
                  >👨 ذكر</button>
                </div>
              )}
              <button
                onClick={() => {
                  if (tts.playing) { tts.stop(); return; }
                  const text = `${ad.title}. ${ad.description || ''}`;
                  tts.generate(text, cardVoice, true).catch(() =>
                    toast({ variant: "destructive", title: "فشل تشغيل الصوت", description: "تأكد من اتصالك بالإنترنت" })
                  );
                }}
                disabled={tts.loading}
                className={`w-full flex items-center justify-center gap-2 rounded-full py-2 text-sm font-bold border transition-all ${
                  tts.playing
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 text-red-600 hover:bg-red-100'
                    : 'bg-primary/5 border-primary/20 text-primary hover:bg-primary/10'
                }`}
                data-testid={`btn-listen-ad-${ad.id}`}
              >
                {tts.loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري التوليد...</>
                  : tts.playing
                  ? <><Square className="w-3.5 h-3.5 fill-current" /> إيقاف</>
                  : <><Headphones className="w-4 h-4" /> استمع بالعربي 🎙</>
                }
              </button>
            </div>
          )}

          {/* WhatsApp CTA */}
          {ad.whatsappNumber && (
            <a
              href={`https://wa.me/2${ad.whatsappNumber.replace(/^0/, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center justify-center gap-2 w-full rounded-full py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-bold transition-colors"
              data-testid={`btn-whatsapp-${ad.id}`}
              onClick={e => e.stopPropagation()}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
              واتساب
            </a>
          )}
        </CardContent>
      </Card>

      {/* ── Boost Payment Dialog ── */}
      <Dialog open={boostPayDialog} onOpenChange={setBoostPayDialog}>
        <DialogContent dir="rtl" className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-orange-500" /> تعزيز الإعلان 🚀
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-orange-600">{boostPrice} ج.م</p>
              <p className="text-xs text-muted-foreground mt-1">رسوم التعزيز — مرة واحدة كل 30 يوم</p>
            </div>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p className="font-bold text-foreground">طرق الدفع المتاحة:</p>
              {[
                { name: "فودافون كاش", num: "01098553911" },
                { name: "اتصالات كاش", num: "01126665741" },
                { name: "إنستاباي",    num: "01285558567" },
              ].map(({ name, num }) => (
                <div key={num} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                  <span>{name}: <span className="font-mono font-bold">{num}</span></span>
                  <button onClick={() => { navigator.clipboard.writeText(num); toast({ title: "✅ تم نسخ الرقم" }); }} className="text-primary hover:text-primary/80">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">رقم العملية / مرجع الدفع</label>
              <input
                value={payRef}
                onChange={e => setPayRef(e.target.value)}
                placeholder="أدخل رقم العملية بعد الدفع"
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                data-testid="input-boost-payref"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setBoostPayDialog(false)}>إلغاء</Button>
              <Button
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white gap-1.5"
                disabled={!payRef.trim() || boosting}
                onClick={() => doBoost(payRef.trim())}
                data-testid="btn-confirm-boost-pay"
              >
                {boosting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CreditCard className="w-4 h-4" /> تأكيد الدفع وتعزيز</>}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center">
              بعد الدفع، سيتم مراجعة رقم العملية وإرسال الإشعار لجميع المستخدمين
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
