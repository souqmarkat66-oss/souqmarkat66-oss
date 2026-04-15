import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AdCard } from "@/components/AdCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  PlusCircle, Video, Image, Play, Eye, Heart, Trash2, Edit, Pencil,
  LayoutGrid, Radio, User, LogIn, MessageSquare, RefreshCw, Clock, Bookmark, Zap, Loader2, Copy, Check
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { EditAdDialog } from "@/components/EditAdDialog";
import { EditReelDialog } from "@/components/EditReelDialog";

const BOOST_PAYMENTS = [
  { label: "فودافون كاش", number: "01098559311", color: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900 text-red-700 dark:text-red-400", emoji: "📱" },
  { label: "اتصالات e& كاش", number: "01126665741", color: "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900 text-orange-700 dark:text-orange-400", emoji: "📲" },
  { label: "InstaPay", number: "01285558567", color: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-400", emoji: "💳" },
];

export default function MyContent() {
  const { user, isLoading: authLoading } = useAuth();

  if (authLoading) return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <div className="w-8 h-8 animate-spin border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );

  if (!user) return (
    <div className="container px-4 py-20 text-center" dir="rtl">
      <div className="max-w-sm mx-auto">
        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <User className="w-12 h-12 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-3">سجّل دخولك أولاً</h2>
        <p className="text-muted-foreground mb-6">يجب تسجيل الدخول لعرض المحتوى الخاص بك</p>
        <Link href="/login">
          <Button size="lg" className="gap-2 w-full max-w-xs">
            <LogIn className="w-5 h-5" />
            تسجيل الدخول
          </Button>
        </Link>
      </div>
    </div>
  );

  return <AuthenticatedContent user={user} />;
}

function AuthenticatedContent({ user }: { user: any }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editingAd, setEditingAd] = useState<any | null>(null);
  const [editingReel, setEditingReel] = useState<any | null>(null);

  // ── Renewal state ─────────────────────────────────────────────
  const [renewDialog, setRenewDialog] = useState<{ ad: any } | null>(null);
  const [selectedDays, setSelectedDays] = useState<number>(30);
  const [renewLoading, setRenewLoading] = useState(false);
  const [renewResult, setRenewResult] = useState<{ days: number; amount: number; success: boolean } | null>(null);
  const [copiedNum, setCopiedNum] = useState<string | null>(null);

  const { data: renewalSettings } = useQuery<{ options: { days: number; price: number; label: string }[] }>({
    queryKey: ["/api/renewal/settings"],
    queryFn: () => fetch("/api/renewal/settings").then(r => r.json()),
  });

  const handleRenewClick = (ad: any) => {
    setRenewDialog({ ad });
    setSelectedDays(30);
    setRenewResult(null);
  };

  const handleRenewOrder = async () => {
    if (!renewDialog) return;
    const option = renewalSettings?.options.find(o => o.days === selectedDays);
    if (!option) return;
    setRenewLoading(true);
    try {
      const res = await fetch(`/api/ads/${renewDialog.ad.id}/renew-wallet`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationDays: selectedDays }),
      });
      const data = await res.json();
      if (res.ok) {
        setRenewResult({ days: selectedDays, amount: option.price, success: true });
        qc.invalidateQueries({ queryKey: ["/api/ads/mine"] });
        toast({ title: "✅ تم تجديد الإعلان بنجاح", description: `تم خصم ${option.price} ج.م من محفظتك` });
      } else if (res.status === 402 && data.requiresWalletTopup) {
        toast({
          variant: "destructive",
          title: "رصيد غير كافٍ",
          description: data.message,
        });
        setRenewDialog(null);
        window.location.href = "/wallet";
      } else {
        toast({ variant: "destructive", title: data.message || "فشل التجديد" });
      }
    } catch {
      toast({ variant: "destructive", title: "خطأ في الاتصال" });
    } finally { setRenewLoading(false); }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedNum(text);
      setTimeout(() => setCopiedNum(null), 2000);
    });
  };

  // ── Boost state ──────────────────────────────────────────────
  const [boostSettings, setBoostSettings] = useState<{ enabled: boolean; price: number } | null>(null);
  const [boostingId, setBoostingId]       = useState<number | null>(null);
  const [boostedIds, setBoostedIds]       = useState<Set<number>>(new Set());
  const [boostPayDialog, setBoostPayDialog] = useState<{ adId: number; msg: string } | null>(null);
  const [boostPayRef, setBoostPayRef]     = useState("");
  const [boostPayMethod, setBoostPayMethod] = useState<string>("");
  const [boostScreenshotUrl, setBoostScreenshotUrl] = useState<string>("");
  const [boostUploadLoading, setBoostUploadLoading] = useState(false);
  const [boostReceipt, setBoostReceipt]   = useState<{ orderNumber: string; adId: number; amount: number } | null>(null);

  useEffect(() => {
    fetch("/api/boost/settings").then(r => r.json()).then(setBoostSettings).catch(() => {});
  }, []);

  const handleBoostScreenshotUpload = async (file: File) => {
    setBoostUploadLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", credentials: "include", body: fd });
      const data = await res.json();
      if (res.ok && data.url) {
        setBoostScreenshotUrl(data.url);
        toast({ title: "✅ تم رفع الإيصال بنجاح" });
      } else {
        toast({ variant: "destructive", title: "فشل رفع الصورة" });
      }
    } catch {
      toast({ variant: "destructive", title: "خطأ في رفع الصورة" });
    } finally {
      setBoostUploadLoading(false);
    }
  };

  const handleBoost = async (adId: number, paymentRef?: string) => {
    setBoostingId(adId);
    try {
      // If there's a paymentRef, create a formal order (pending admin confirmation)
      if (paymentRef) {
        const res = await fetch("/api/boost/pay-order", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            adId,
            paymentRef,
            amount: boostSettings?.price ?? 0,
            paymentMethod: boostPayMethod,
            screenshotUrl: boostScreenshotUrl,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setBoostPayDialog(null);
          setBoostPayRef("");
          setBoostPayMethod("");
          setBoostScreenshotUrl("");
          setBoostReceipt({ orderNumber: data.orderNumber, adId, amount: data.amount });
        } else {
          toast({ variant: "destructive", title: data.message || "فشل إنشاء الطلب" });
        }
        return;
      }

      // Free boost attempt
      const res = await fetch(`/api/ads/${adId}/boost-notify`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.status === 402 && data.requiresWalletTopup) {
        // Insufficient wallet balance — redirect to wallet top-up
        toast({
          variant: "destructive",
          title: "رصيد غير كافٍ",
          description: data.message,
        });
        window.location.href = "/wallet";
        return;
      } else if (res.status === 402) {
        setBoostPayRef("");
        setBoostPayDialog({ adId, msg: data.message });
      } else if (res.status === 429) {
        if (boostSettings?.price && boostSettings.price > 0) {
          setBoostPayRef("");
          setBoostPayDialog({ adId, msg: data.message + `\n\n💡 يمكنك تجاوز الانتظار بالتعزيز المدفوع مقابل ${boostSettings.price} ج.م فقط` });
        } else {
          toast({ variant: "destructive", title: "⏳ حد التعزيز", description: data.message });
        }
      } else if (res.ok) {
        setBoostedIds(prev => new Set(prev).add(adId));
        toast({
          title: "🚀 تم تعزيز الإعلان!",
          description: data.notifiedCount > 0
            ? `وصل إشعار لـ ${data.notifiedCount} مستخدم — ستزيد مشاهداتك 📈`
            : "سيصل إشعار للمهتمين بالفئة",
        });
      } else {
        toast({ variant: "destructive", title: data.message || "فشل التعزيز" });
      }
    } catch {
      toast({ variant: "destructive", title: "خطأ في الاتصال" });
    } finally { setBoostingId(null); }
  };

  const { data: allAds = [], isLoading: adsLoading } = useQuery<any[]>({
    queryKey: ["/api/ads/mine"],
    queryFn: () => fetch("/api/ads/mine", { credentials: "include" }).then(r => r.json()),
  });

  const { data: reels = [], isLoading: reelsLoading } = useQuery<any[]>({
    queryKey: ["/api/reels"],
    queryFn: () => fetch("/api/reels").then(r => r.json()).then(d => Array.isArray(d) ? d : []),
  });

  const { data: streams = [], isLoading: streamsLoading } = useQuery<any[]>({
    queryKey: ["/api/streams"],
    queryFn: () => fetch("/api/streams").then(r => r.json()),
  });

  // Filter by current user — handle both camelCase (Drizzle) and snake_case (raw SQL) field names
  const myAds = (Array.isArray(allAds) ? allAds : []).filter(ad => (ad.userId ?? ad.user_id) === user.id);
  const myReels = (Array.isArray(reels) ? reels : []).filter((r: any) => (r.userId ?? r.user_id) === user.id);
  const myStreams = (Array.isArray(streams) ? streams : []).filter((s: any) => (s.userId ?? s.user_id) === user.id);

  const deleteAdMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/ads/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/ads/mine"] }); toast({ title: "تم حذف الإعلان" }); },
  });

  const deleteReelMut = useMutation({
    mutationFn: (id: number) => fetch(`/api/reels/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/reels"] }); toast({ title: "تم حذف الريل" }); },
  });

  const { data: favorites = [] } = useQuery<any[]>({
    queryKey: ["/api/favorites"],
    queryFn: () => fetch("/api/favorites", { credentials: "include" }).then(r => r.json()),
  });

  const removeFavMut = useMutation({
    mutationFn: (adId: number) => apiRequest("POST", `/api/favorites/${adId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/favorites"] }); toast({ title: "تم الإزالة من المفضلة" }); },
  });

  // renewAdMut kept for backward compat (admin only)
  const renewAdMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/ads/${id}/renew`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/ads/mine"] }); toast({ title: "✅ تم تجديد الإعلان 7 أيام إضافية!" }); },
  });

  return (
    <div className="container px-4 py-10 max-w-5xl" dir="rtl">
      {/* Profile Header */}
      <div className="flex items-center gap-4 mb-8 p-5 bg-gradient-to-l from-primary/5 to-secondary/5 rounded-2xl border">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-2xl font-extrabold shadow-lg">
          {user.firstName?.[0] || "U"}
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-extrabold">{user.firstName} {user.lastName}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <div className="flex gap-3 mt-2">
            <span className="text-xs font-medium text-primary">{myAds.length} إعلان</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs font-medium text-red-500">{myReels.length} ريلز</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs font-medium text-blue-500">{myStreams.length} بث مباشر</span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Link href="/create">
            <Button size="sm" className="gap-1.5 text-xs" data-testid="btn-my-create-ad">
              <PlusCircle className="w-3.5 h-3.5" /> إعلان جديد
            </Button>
          </Link>
          <Link href="/stream/start">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs bg-red-500/5 border-red-200 text-red-600 hover:bg-red-500/10">
              <Radio className="w-3.5 h-3.5" /> بث مباشر
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="ads" dir="rtl">
        <TabsList className="mb-6 h-11 rounded-xl flex-wrap gap-1">
          <TabsTrigger value="ads" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg text-xs">
            <LayoutGrid className="w-3.5 h-3.5" />
            إعلاناتي
            {myAds.length > 0 && <Badge className="h-4 min-w-[16px] text-[9px] bg-white/20">{myAds.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="favorites" className="gap-1.5 data-[state=active]:bg-red-500 data-[state=active]:text-white rounded-lg text-xs">
            <Bookmark className="w-3.5 h-3.5" />
            المفضلة
            {favorites.length > 0 && <Badge className="h-4 min-w-[16px] text-[9px] bg-white/20">{favorites.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="reels" className="gap-1.5 data-[state=active]:bg-red-500 data-[state=active]:text-white rounded-lg text-xs">
            <Video className="w-3.5 h-3.5" />
            ريلزي
            {myReels.length > 0 && <Badge className="h-4 min-w-[16px] text-[9px] bg-white/20">{myReels.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="streams" className="gap-1.5 data-[state=active]:bg-blue-500 data-[state=active]:text-white rounded-lg text-xs">
            <Radio className="w-3.5 h-3.5" />
            بثي المباشر
            {myStreams.length > 0 && <Badge className="h-4 min-w-[16px] text-[9px] bg-white/20">{myStreams.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* My Ads */}
        <TabsContent value="ads">
          {adsLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1,2,3].map(i => <Skeleton key={i} className="h-64 rounded-2xl" />)}
            </div>
          ) : myAds.length === 0 ? (
            <EmptyState
              emoji="📭"
              title="لم تنشر أي إعلان بعد"
              desc="أنشئ إعلانك الأول الآن وابدأ في الوصول للعملاء"
              action={<Link href="/create"><Button className="gap-2"><PlusCircle className="w-4 h-4" />أنشئ إعلاناً الآن</Button></Link>}
            />
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {myAds.map((ad, i) => (
                <div key={ad.id} className="relative group">
                  <AdCard ad={ad} index={i} />
                  <div className="absolute top-3 left-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link href={`/ads/${ad.id}`}>
                      <button className="w-7 h-7 rounded-full bg-white/90 text-gray-700 flex items-center justify-center shadow hover:bg-white" title="عرض">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </Link>
                    <button
                      className="w-7 h-7 rounded-full bg-blue-500/90 text-white flex items-center justify-center shadow hover:bg-blue-600"
                      title="تعديل"
                      onClick={() => setEditingAd(ad)}
                      data-testid={`btn-edit-ad-${ad.id}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      className="w-7 h-7 rounded-full bg-red-500/90 text-white flex items-center justify-center shadow hover:bg-red-500"
                      title="حذف"
                      onClick={() => { if (confirm("حذف هذا الإعلان؟")) deleteAdMut.mutate(ad.id); }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between px-1 flex-wrap gap-1">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{ad.viewsCount || 0}</span>
                      <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{ad.likesCount || 0}</span>
                      <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{ad.commentsCount || 0}</span>
                      {ad.whatsappClicks > 0 && (
                        <span className="flex items-center gap-1 text-green-600" title="نقرات واتساب">
                          <span>📱</span>{ad.whatsappClicks}
                        </span>
                      )}
                      {ad.viewsCount > 0 && (
                        <span className="text-blue-500" title="نسبة النقر للمشاهدة">
                          CTR: {(((ad.whatsappClicks || 0) / ad.viewsCount) * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant={ad.status === "active" ? "default" : "secondary"} className="text-[10px] h-5">
                        {ad.status === "active" ? "✅ نشط" : ad.status}
                      </Badge>
                      {ad.expires_at && (() => {
                        const exp = new Date(ad.expires_at);
                        const now = new Date();
                        const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / 86400000);
                        const isExpired = daysLeft <= 0;
                        const isSoon = daysLeft > 0 && daysLeft <= 2;
                        return (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                            isExpired ? "bg-red-50 dark:bg-red-900/20 border-red-200 text-red-600" :
                            isSoon ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 text-yellow-700" :
                            "bg-green-50 dark:bg-green-900/20 border-green-200 text-green-600"
                          }`}>
                            {isExpired ? "⛔ انتهى" : `⏱ ${daysLeft} يوم`}
                          </span>
                        );
                      })()}
                      <button
                        onClick={() => handleRenewClick(ad)}
                        className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-600 hover:bg-blue-100 transition-colors"
                        title="تجديد الإعلان مقابل رسوم"
                        data-testid={`btn-renew-ad-${ad.id}`}
                      >
                        <RefreshCw className="w-2.5 h-2.5" /> تجديد
                      </button>
                      {boostSettings?.enabled !== false && (
                        <button
                          onClick={() => handleBoost(ad.id)}
                          disabled={boostingId === ad.id || boostedIds.has(ad.id)}
                          className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                            boostedIds.has(ad.id)
                              ? "bg-green-500/10 border-green-300 text-green-600"
                              : "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-600 hover:bg-orange-100"
                          } disabled:opacity-60`}
                          title={boostSettings?.price ? `تعزيز الإعلان (${boostSettings.price} ج.م للتعزيز الإضافي)` : "تعزيز الإعلان مجاناً"}
                          data-testid={`btn-boost-ad-${ad.id}`}
                        >
                          {boostingId === ad.id
                            ? <><Loader2 className="w-2.5 h-2.5 animate-spin" /> جارٍ...</>
                            : boostedIds.has(ad.id)
                            ? <>✓ عُزِّز</>
                            : <><Zap className="w-2.5 h-2.5" /> عزّز 🚀</>
                          }
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Favorites */}
        <TabsContent value="favorites">
          {favorites.length === 0 ? (
            <EmptyState
              emoji="❤️"
              title="لا توجد إعلانات في مفضلتك بعد"
              desc="اضغط على قلب أي إعلان لحفظه هنا"
              action={<Link href="/ads"><Button variant="outline" className="gap-2"><Bookmark className="w-4 h-4" />تصفح الإعلانات</Button></Link>}
            />
          ) : (
            <div className="space-y-3">
              {favorites.map((fav: any) => (
                <Link key={fav.id} href={`/ads/${fav.ad_id}`}>
                  <Card className="hover:border-primary/40 transition-all cursor-pointer rounded-2xl">
                    <CardContent className="p-4 flex items-center gap-4">
                      {fav.media_url && (
                        <img src={fav.media_url} alt={fav.title} className="w-16 h-16 object-cover rounded-xl flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm line-clamp-1">{fav.title}</h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {fav.price_egp > 0 && <span className="text-xs font-bold text-green-600">{fav.price_egp?.toLocaleString()} ج.م</span>}
                          {fav.target_region && <Badge variant="secondary" className="text-[10px]">📍 {fav.target_region}</Badge>}
                        </div>
                      </div>
                      <button
                        onClick={e => { e.preventDefault(); e.stopPropagation(); removeFavMut.mutate(fav.ad_id); }}
                        className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors flex-shrink-0"
                        data-testid={`btn-remove-fav-${fav.ad_id}`}
                      >
                        <Heart className="w-4 h-4 fill-current" />
                      </button>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* My Reels */}
        <TabsContent value="reels">
          {reelsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => <Skeleton key={i} className="aspect-[9/16] rounded-2xl" />)}
            </div>
          ) : myReels.length === 0 ? (
            <EmptyState
              emoji="🎬"
              title="لم تنشر أي ريلز بعد"
              desc="ارفع أول ريلز لك واجذب المتابعين"
              action={<Link href="/reels"><Button variant="outline" className="gap-2"><Video className="w-4 h-4" />اذهب للريلز</Button></Link>}
            />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {myReels.map((reel: any) => (
                <div key={reel.id} className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-black group cursor-pointer">
                  {/* Thumbnail / preview */}
                  {reel.thumbnailUrl ? (
                    <img src={reel.thumbnailUrl} alt={reel.title} className="w-full h-full object-cover" />
                  ) : reel.videoUrl ? (
                    (() => {
                      try {
                        const parsed = JSON.parse(reel.videoUrl);
                        if (Array.isArray(parsed) && parsed[0]) return <img src={parsed[0]} alt={reel.title} className="w-full h-full object-cover" />;
                      } catch {}
                      return reel.videoUrl.match(/\.(jpg|jpeg|png|gif|webp)/i)
                        ? <img src={reel.videoUrl} alt={reel.title} className="w-full h-full object-cover" />
                        : <video src={reel.videoUrl} className="w-full h-full object-cover" muted />;
                    })()
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-primary/20 to-black">
                      <Video className="w-10 h-10 text-white/50" />
                    </div>
                  )}

                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/60 transition-all" />

                  {/* Action buttons — always visible */}
                  <div className="absolute top-2 inset-x-0 flex justify-between px-2 z-10">
                    <button
                      className="w-8 h-8 rounded-full bg-blue-500/90 text-white flex items-center justify-center shadow active:scale-95"
                      title="تعديل"
                      onClick={e => { e.stopPropagation(); setEditingReel(reel); }}
                      data-testid={`btn-edit-reel-${reel.id}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex gap-1.5">
                      <Link href="/reels">
                        <button
                          className="w-8 h-8 rounded-full bg-white/70 text-gray-700 flex items-center justify-center shadow active:scale-95"
                          title="عرض"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                      </Link>
                      <button
                        className="w-8 h-8 rounded-full bg-red-500/90 text-white flex items-center justify-center shadow active:scale-95"
                        title="حذف"
                        onClick={e => { e.stopPropagation(); if (confirm("حذف هذا الريل؟")) deleteReelMut.mutate(reel.id); }}
                        data-testid={`btn-delete-reel-${reel.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Bottom info */}
                  <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/80 to-transparent z-10">
                    <p className="text-white text-xs font-medium line-clamp-2">{reel.title}</p>
                    <div className="flex items-center gap-2 mt-1 text-white/70 text-[10px]">
                      <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{reel.viewsCount || 0}</span>
                      <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" />{reel.likesCount || 0}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* My Streams */}
        <TabsContent value="streams">
          {streamsLoading ? (
            <div className="grid md:grid-cols-2 gap-4">
              {[1,2].map(i => <Skeleton key={i} className="h-40 rounded-2xl" />)}
            </div>
          ) : myStreams.length === 0 ? (
            <EmptyState
              emoji="📡"
              title="لم تبث مباشرةً بعد"
              desc="ابدأ أول بث مباشر لك الآن وتواصل مع جمهورك"
              action={<Link href="/stream/start"><Button className="gap-2 bg-red-500 hover:bg-red-600 text-white"><Radio className="w-4 h-4" />ابدأ البث الآن</Button></Link>}
            />
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {myStreams.map((stream: any) => (
                <Link href={`/streams/${stream.id}`} key={stream.id}>
                  <Card className="hover:border-primary/50 transition-all cursor-pointer rounded-2xl">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="font-bold text-sm line-clamp-1">{stream.title}</h3>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{stream.description}</p>
                        </div>
                        <Badge variant={stream.status === "live" ? "destructive" : "secondary"} className="text-xs mr-2 flex-shrink-0">
                          {stream.status === "live" ? "🔴 مباشر" : "⏹ منتهي"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3">
                        <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{stream.viewerCount || 0} مشاهد</span>
                        <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{stream.likesCount || 0} إعجاب</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Ad Dialog */}
      {editingAd && (
        <EditAdDialog
          ad={editingAd}
          open={!!editingAd}
          onClose={() => setEditingAd(null)}
        />
      )}

      {/* Edit Reel Dialog */}
      {editingReel && (
        <EditReelDialog
          reel={editingReel}
          open={!!editingReel}
          onClose={() => setEditingReel(null)}
        />
      )}

      {/* ── 🚀 Boost Payment Dialog ── */}
      <Dialog open={!!boostPayDialog} onOpenChange={open => {
        if (!open) { setBoostPayDialog(null); setBoostPayRef(""); setBoostPayMethod(""); setBoostScreenshotUrl(""); }
      }}>
        <DialogContent dir="rtl" className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Zap className="w-5 h-5 text-orange-500" /> تعزيز إضافي مدفوع
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">

            {/* السعر */}
            <div className="bg-orange-50 dark:bg-orange-950/20 rounded-xl p-3 text-center border border-orange-200 dark:border-orange-800">
              <p className="text-3xl font-black text-orange-600">{boostSettings?.price} ج.م</p>
              <p className="text-xs text-muted-foreground mt-1">تعزيز لمدة 30 يوماً — إعلانك في أعلى القائمة 📣</p>
            </div>

            {/* اختيار طريقة الدفع */}
            <div>
              <p className="text-sm font-bold mb-2">💳 اختر طريقة الدفع:</p>
              <div className="space-y-2">
                {BOOST_PAYMENTS.map(pm => (
                  <button
                    key={pm.number}
                    onClick={() => setBoostPayMethod(pm.label)}
                    className={`w-full flex items-center gap-3 rounded-xl px-3 py-3 border-2 text-sm font-medium transition-all ${
                      boostPayMethod === pm.label
                        ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30"
                        : "border-border hover:border-orange-300 bg-background"
                    } ${pm.color}`}
                    data-testid={`btn-boost-method-${pm.label}`}
                  >
                    <span className="text-xl">{pm.emoji}</span>
                    <div className="text-right flex-1">
                      <div className="font-bold">{pm.label}</div>
                      <div className="font-mono text-xs opacity-80">{pm.number}</div>
                    </div>
                    {boostPayMethod === pm.label && (
                      <button
                        onClick={e => { e.stopPropagation(); copyToClipboard(pm.number); }}
                        className="flex items-center gap-1 text-xs px-2 py-1 bg-white/80 dark:bg-black/30 rounded-lg border"
                        data-testid={`btn-copy-boost-${pm.number}`}
                      >
                        {copiedNum === pm.number ? <><Check className="w-3 h-3 text-green-500" /> نُسخ</> : <><Copy className="w-3 h-3" /> نسخ</>}
                      </button>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* رقم العملية */}
            {boostPayMethod && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <div>
                  <p className="text-xs font-semibold mb-1">رقم العملية / المرجع:</p>
                  <input
                    type="text"
                    value={boostPayRef}
                    onChange={e => setBoostPayRef(e.target.value)}
                    placeholder="مثال: 12345678"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-background"
                    data-testid="input-boost-pay-ref-mycontent"
                  />
                </div>

                {/* رفع الإيصال */}
                <div>
                  <p className="text-xs font-semibold mb-1">صورة الإيصال / لقطة الشاشة (اختياري):</p>
                  {boostScreenshotUrl ? (
                    <div className="relative">
                      <img src={boostScreenshotUrl} alt="إيصال" className="w-full h-36 object-cover rounded-lg border" />
                      <button
                        onClick={() => setBoostScreenshotUrl("")}
                        className="absolute top-1 left-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                      >✕</button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-orange-300 rounded-xl cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-colors">
                      {boostUploadLoading
                        ? <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
                        : <>
                          <Image className="w-7 h-7 text-orange-400 mb-1" />
                          <span className="text-xs text-muted-foreground">اضغط لرفع صورة الإيصال</span>
                        </>
                      }
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={boostUploadLoading}
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleBoostScreenshotUpload(f); }}
                        data-testid="input-boost-screenshot"
                      />
                    </label>
                  )}
                </div>
              </div>
            )}

            <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-2 border border-green-200 dark:border-green-800 text-xs text-muted-foreground">
              ⚡ بعد مراجعة الإدارة سيتم تفعيل التعزيز <strong>فوراً</strong> — لا انتظار!
            </div>

            <button
              disabled={!boostPayRef.trim() || !boostPayMethod || boostUploadLoading || boostingId === boostPayDialog?.adId}
              onClick={() => boostPayDialog && handleBoost(boostPayDialog.adId, boostPayRef.trim())}
              className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              data-testid="btn-confirm-boost-payment-mycontent"
            >
              {boostingId === boostPayDialog?.adId
                ? <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ إرسال الطلب...</>
                : <><Zap className="w-4 h-4" /> إرسال طلب التعزيز</>
              }
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── 🧾 Boost Order Receipt Dialog ── */}
      <Dialog open={!!boostReceipt} onOpenChange={open => { if (!open) setBoostReceipt(null); }}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-green-600">
              ✅ تم استلام طلبك بنجاح
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="bg-green-50 dark:bg-green-950/20 rounded-xl p-4 border border-green-200 dark:border-green-800 space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">رقم الطلب</span>
                <span className="font-mono font-black text-green-700 dark:text-green-400 text-base" data-testid="text-boost-order-number">{boostReceipt?.orderNumber}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">رقم الإعلان</span>
                <span className="font-bold" data-testid="text-boost-ad-id">#{boostReceipt?.adId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">المبلغ</span>
                <span className="font-bold text-orange-600">{boostReceipt?.amount} ج.م</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">الحالة</span>
                <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded-full text-xs font-bold">قيد المراجعة</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              📬 تم إرسال الطلب للإدارة — ستصلك إشعاراً بالتأكيد خلال 24 ساعة
            </p>
            <button
              onClick={() => setBoostReceipt(null)}
              className="w-full py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold text-sm transition-all"
              data-testid="btn-close-boost-receipt"
            >
              حسناً، شكراً
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── 🔄 Renewal Payment Dialog ── */}
      <Dialog open={!!renewDialog && !renewResult} onOpenChange={open => { if (!open) setRenewDialog(null); }}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-blue-500" />
              تجديد الإعلان مقابل الدفع
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="bg-blue-50 dark:bg-blue-950/20 rounded-xl p-3 border border-blue-200 dark:border-blue-800 text-sm">
              <span className="font-bold">📢 الإعلان: </span>
              <span className="text-muted-foreground">{renewDialog?.ad?.title}</span>
            </div>

            {/* Duration options */}
            <div>
              <p className="text-sm font-semibold mb-2">اختر مدة التجديد:</p>
              <div className="grid grid-cols-3 gap-2">
                {(renewalSettings?.options ?? [
                  { days: 30, price: 50, label: "30 يوماً" },
                  { days: 60, price: 90, label: "60 يوماً" },
                  { days: 90, price: 130, label: "90 يوماً" },
                ]).map(opt => (
                  <button
                    key={opt.days}
                    onClick={() => setSelectedDays(opt.days)}
                    className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${
                      selectedDays === opt.days
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                        : 'border-border hover:border-blue-300'
                    }`}
                    data-testid={`btn-renew-days-${opt.days}`}
                  >
                    <span className="text-base font-bold text-blue-600">{opt.price}</span>
                    <span className="text-[10px] text-muted-foreground">ج.م</span>
                    <span className="text-xs font-medium mt-1">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Payment methods */}
            <div>
              <p className="text-sm font-semibold mb-2">💳 طرق الدفع:</p>
              <div className="space-y-2">
                {BOOST_PAYMENTS.map(pm => (
                  <div key={pm.number} className={`flex items-center gap-3 p-2.5 rounded-lg border text-sm ${pm.color}`}>
                    <span className="text-lg">{pm.emoji}</span>
                    <span className="font-medium">{pm.label}</span>
                    <button
                      className="ml-auto flex items-center gap-1 font-mono font-bold hover:opacity-70 transition-opacity"
                      onClick={() => copyToClipboard(pm.number)}
                      data-testid={`btn-copy-renewal-${pm.number}`}
                    >
                      {copiedNum === pm.number
                        ? <><Check className="w-3 h-3 text-green-500" /><span className="text-green-600">نُسخ!</span></>
                        : <><Copy className="w-3 h-3" />{pm.number}</>
                      }
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-950/20 rounded-lg p-3 border border-yellow-200 dark:border-yellow-800 text-xs text-muted-foreground">
              💡 ادفع المبلغ المطلوب ثم اضغط "إرسال الطلب" — سيتم تفعيل التجديد خلال 24 ساعة بعد مراجعة الإدارة
            </div>

            <button
              disabled={renewLoading}
              onClick={handleRenewOrder}
              className="w-full py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              data-testid="btn-submit-renew-order"
            >
              {renewLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ إنشاء الطلب...</>
                : <><RefreshCw className="w-4 h-4" /> إرسال طلب التجديد</>
              }
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── ✅ Renewal Order Receipt Dialog ── */}
      <Dialog open={!!renewResult} onOpenChange={open => { if (!open) { setRenewResult(null); setRenewDialog(null); } }}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-green-600">
              ✅ تم تجديد الإعلان بنجاح
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="bg-green-50 dark:bg-green-950/20 rounded-xl p-4 border border-green-200 dark:border-green-800 space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">مدة التجديد</span>
                <span className="font-bold">{renewResult?.days} يوماً</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">المبلغ المخصوم من محفظتك</span>
                <span className="font-bold text-green-700 dark:text-green-400">{renewResult?.amount} ج.م</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">الحالة</span>
                <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full text-xs font-bold">مُجدَّد فوراً ✓</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center bg-blue-50 dark:bg-blue-950/20 rounded-lg p-2 border border-blue-200 dark:border-blue-800">
              🎉 تم تجديد إعلانك مباشرةً من رصيد محفظتك — لا حاجة لانتظار موافقة
            </p>
            <button
              onClick={() => { setRenewResult(null); setRenewDialog(null); }}
              className="w-full py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold text-sm transition-all"
              data-testid="btn-close-renew-receipt"
            >
              ممتاز، شكراً 🙏
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyState({ emoji, title, desc, action }: { emoji: string; title: string; desc: string; action: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-5 text-4xl">{emoji}</div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm mb-6 max-w-xs">{desc}</p>
      {action}
    </div>
  );
}
