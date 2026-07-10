import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useState } from "react";
import { useWalletSocket } from "@/hooks/use-wallet-socket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Megaphone, Eye, Heart, MessageSquare, BarChart2, TrendingUp,
  DollarSign, Radio, Film, Tv, PlusCircle, ArrowUpRight,
  Loader2, Star, Users, MousePointerClick, Wallet, PieChart,
  ShieldCheck, Clock, AlertTriangle, RefreshCw, Pencil, Trash2, X
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";

const ADMIN_ID = "54219806";

function pct(curr: number, prev: number) {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
}

function MetricCard({ label, value, prev, fmt, color, icon: Icon, sub }: {
  label: string; value: number; prev?: number; fmt?: (v: number) => string;
  color: string; icon: any; sub?: string;
}) {
  const formatted = fmt ? fmt(value) : value.toLocaleString("ar-EG");
  const showChange = prev !== undefined;
  const change = showChange ? pct(value, prev!) : 0;
  const up = change >= 0;
  return (
    <Card className="border-border/60 rounded-2xl">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: color + "22" }}>
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
          {showChange && (
            <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${up ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-500"}`}>
              {up ? "▲" : "▼"} {Math.abs(change).toFixed(1)}%
            </span>
          )}
        </div>
        <div className="text-xl font-extrabold" dir="ltr">{formatted}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
        {sub && <div className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

type Tab = "overview" | "advertiser" | "publisher" | "prices" | "myads";

function SubscriptionCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sub, isLoading: subLoading } = useQuery<any>({
    queryKey: ["/api/subscription/status"],
    queryFn: () => fetch("/api/subscription/status", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 60_000,
  });

  const renewMutation = useMutation({
    mutationFn: () => fetch("/api/subscription/renew", { method: "POST", credentials: "include" }).then(async r => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "حدث خطأ");
      return data;
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/revenue"] });
      toast({ title: "✅ تم تجديد الاشتراك", description: `خُصم ${data.deducted} ج.م من محفظتك` });
    },
    onError: (e: Error) => {
      toast({ title: "❌ فشل التجديد", description: e.message, variant: "destructive" });
    },
  });

  if (subLoading) return (
    <Card className="border-border/60 rounded-2xl animate-pulse bg-muted/30 h-24" />
  );
  if (!sub) return null;
  if (sub.isAdmin) return null;

  // In trial
  if (sub.inTrial) {
    return (
      <Card className="border-blue-500/40 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl">
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500/15">
              <Clock className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="font-bold text-sm">الفترة التجريبية المجانية</p>
              <p className="text-xs text-muted-foreground">
                متبقي <span className="font-bold text-blue-500">{sub.trialDaysLeft} يوم</span> من التجربة المجانية
              </p>
              <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                بعدها: 250 ج.م أسبوعياً من المحفظة للذكاء الاصطناعي والبوست
              </p>
            </div>
          </div>
          <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30 text-xs shrink-0">مجاني</Badge>
        </CardContent>
      </Card>
    );
  }

  // Active subscription
  if (sub.hasActiveSub) {
    return (
      <Card className="border-green-500/40 bg-green-50/50 dark:bg-green-950/20 rounded-2xl">
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-500/15">
              <ShieldCheck className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="font-bold text-sm">اشتراك فعّال ✅</p>
              <p className="text-xs text-muted-foreground">
                صالح لـ <span className="font-bold text-green-500">{sub.subDaysLeft} يوم</span> آخر
              </p>
              <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                رصيد المحفظة: {Number(sub.balance).toFixed(2)} ج.م
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-green-500/40 text-green-600 hover:bg-green-500/10 text-xs shrink-0"
            onClick={() => renewMutation.mutate()}
            disabled={renewMutation.isPending || sub.balance < 250}
          >
            {renewMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            <span className="mr-1">جدّد مبكراً</span>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Expired
  const canAfford = sub.balance >= 250;
  return (
    <Card className="border-red-500/50 bg-red-50/50 dark:bg-red-950/20 rounded-2xl">
      <CardContent className="p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500/15">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <p className="font-bold text-sm text-red-600">الاشتراك منتهي ⛔</p>
            <p className="text-xs text-muted-foreground">
              الذكاء الاصطناعي والبوست متوقفان
            </p>
            <p className="text-[11px] mt-0.5">
              {canAfford
                ? <span className="text-muted-foreground">رصيدك: <b className="text-foreground">{Number(sub.balance).toFixed(2)} ج.م</b> — اضغط جدّد الاشتراك</span>
                : <span className="text-red-500">رصيدك {Number(sub.balance).toFixed(2)} ج.م — تحتاج {250 - Number(sub.balance)} ج.م إضافية</span>
              }
            </p>
          </div>
        </div>
        <Button
          size="sm"
          className="bg-red-500 hover:bg-red-600 text-white text-xs shrink-0"
          onClick={() => renewMutation.mutate()}
          disabled={renewMutation.isPending || !canAfford}
        >
          {renewMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          جدّد — 250 ج.م
        </Button>
      </CardContent>
    </Card>
  );
}

export default function MyDashboard() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [editingAd, setEditingAd] = useState<any>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", priceEGP: "", whatsappNumber: "", status: "active" });

  const updateAdMutation = useMutation({
    mutationFn: (vars: { id: number; data: any }) =>
      apiRequest("PUT", `/api/ads/${vars.id}`, vars.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ads/mine"] });
      setEditingAd(null);
      toast({ title: "✅ تم تحديث الإعلان بنجاح" });
    },
    onError: () => toast({ title: "❌ فشل تحديث الإعلان", variant: "destructive" }),
  });

  const deleteAdMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/ads/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ads/mine"] });
      toast({ title: "🗑️ تم حذف الإعلان" });
    },
    onError: () => toast({ title: "❌ فشل الحذف", variant: "destructive" }),
  });

  function openEdit(ad: any) {
    setEditingAd(ad);
    setEditForm({
      title: ad.title || "",
      description: ad.description || "",
      priceEGP: ad.priceEgp != null ? String(ad.priceEgp) : "",
      whatsappNumber: ad.whatsappNumber || "",
      status: ad.status || "active",
    });
  }

  // ── تحديث المحفظة لحظياً عبر Socket.IO ──────────────────────
  useWalletSocket(user?.id);

  const { data: ads = [] } = useQuery<any[]>({
    queryKey: ["/api/ads/mine"],
    queryFn: () => fetch("/api/ads/mine", { credentials: "include" }).then(r => r.json()),
    enabled: !!user,
  });

  const { data: campaigns = [] } = useQuery<any[]>({
    queryKey: ["/api/campaigns"],
    queryFn: () => fetch("/api/campaigns", { credentials: "include" }).then(r => r.json()),
    enabled: !!user,
  });

  const { data: channels = [] } = useQuery<any[]>({
    queryKey: ["/api/channels"],
    queryFn: () => fetch("/api/channels", { credentials: "include" }).then(r => r.json()),
    enabled: !!user,
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery<any>({
    queryKey: ["/api/my/analytics"],
    queryFn: () => fetch("/api/my/analytics", { credentials: "include" }).then(r => r.json()),
    enabled: !!user,
  });

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );

  if (!user) { window.location.href = "/login"; return null; }
  if (user.id === ADMIN_ID) { window.location.href = "/admin"; return null; }

  const myAds = Array.isArray(ads) ? ads : [];
  const myChannels = Array.isArray(channels) ? channels.filter((c: any) => c.userId === user.id) : [];
  const myCampaigns = Array.isArray(campaigns) ? campaigns : [];

  const totalViews    = myAds.reduce((s: number, a: any) => s + (a.viewsCount  || 0), 0);
  const totalLikes    = myAds.reduce((s: number, a: any) => s + (a.likesCount  || 0), 0);
  const totalEarnings = myChannels.reduce((s: number, c: any) => s + (parseFloat(c.earningsEGP) || 0), 0);
  const totalSubs     = myChannels.reduce((s: number, c: any) => s + (c.subscriberCount || 0), 0);

  const adv = analytics?.advertiser;
  const pub = analytics?.publisher;

  const { data: pricing = {} } = useQuery<Record<string, string>>({
    queryKey: ["/api/pricing"],
    queryFn: () => fetch("/api/pricing").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const TABS: { key: Tab; label: string; icon: any; color: string }[] = [
    { key: "overview",   label: "نظرة عامة",  icon: PieChart,      color: "text-primary"   },
    { key: "myads",      label: "إعلاناتي",   icon: Megaphone,     color: "text-violet-500" },
    { key: "advertiser", label: "كمعلن",       icon: BarChart2,     color: "text-teal-500"  },
    { key: "publisher",  label: "كناشر",       icon: DollarSign,    color: "text-green-500" },
    { key: "prices",     label: "الأسعار",     icon: Wallet,        color: "text-amber-500" },
  ];

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container mx-auto px-4 py-6 max-w-5xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-extrabold flex items-center gap-2">
              <BarChart2 className="w-6 h-6 text-primary" />
              تقاريري ولوحتي
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              مرحباً {user.firstName}! — آخر 7 أيام مقارنةً بالأسبوع الماضي
            </p>
          </div>
          <Link href="/create">
            <Button size="sm" className="gap-2">
              <PlusCircle className="w-4 h-4" /> إعلان جديد
            </Button>
          </Link>
        </div>

        {/* Subscription Status */}
        <div className="mb-4">
          <SubscriptionCard />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-muted/40 rounded-xl p-1 w-fit">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.key
                  ? "bg-background shadow text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className={`w-3.5 h-3.5 ${tab === t.key ? t.color : ""}`} />
              {t.label}
            </button>
          ))}
        </div>

        {/* ══ OVERVIEW TAB ══════════════════════════════════════ */}
        {tab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard icon={Megaphone}  label="إعلاناتي"    value={myAds.length}       color="#8b5cf6" />
              <MetricCard icon={Eye}        label="المشاهدات"   value={totalViews}          color="#3b82f6" />
              <MetricCard icon={Heart}      label="الإعجابات"   value={totalLikes}          color="#ec4899" />
              <MetricCard icon={Tv}         label="قنواتي"      value={myChannels.length}   color="#ef4444" />
              <MetricCard icon={Users}      label="المشتركون"   value={totalSubs}           color="#f59e0b" />
              <MetricCard icon={BarChart2}  label="الحملات"     value={myCampaigns.length}  color="#14b8a6" />
              <MetricCard icon={DollarSign} label="أرباحي (ج.م)" value={totalEarnings}     fmt={v => `${v.toFixed(2)} ج.م`} color="#10b981" />
              <MetricCard icon={Film}       label="ريلزاتي"    value={0}                   color="#f97316" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { href: "/create",       icon: PlusCircle, label: "إعلان جديد",    color: "text-violet-500" },
                { href: "/campaigns",    icon: BarChart2,  label: "إدارة الحملات", color: "text-teal-500"   },
                { href: "/revenue",      icon: DollarSign, label: "الإيرادات",     color: "text-green-500"  },
                { href: "/stream/start", icon: Radio,      label: "بدء البث",      color: "text-red-500"    },
              ].map(item => (
                <Link key={item.href} href={item.href}>
                  <Card className="border-border/50 hover:border-primary/40 transition-colors cursor-pointer group">
                    <CardContent className="p-3 flex items-center gap-2">
                      <item.icon className={`w-4 h-4 ${item.color} group-hover:scale-110 transition-transform`} />
                      <span className="text-sm font-medium">{item.label}</span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            {myAds.length === 0 && myCampaigns.length === 0 && myChannels.length === 0 && (
              <Card className="border-dashed border-2 border-border/50">
                <CardContent className="py-12 text-center">
                  <Megaphone className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                  <h3 className="text-lg font-bold mb-1">ابدأ رحلتك الإعلانية</h3>
                  <p className="text-sm text-muted-foreground mb-4">أنشئ إعلانك الأول وابدأ في استقطاب العملاء</p>
                  <Link href="/create">
                    <Button className="gap-2"><PlusCircle className="w-4 h-4" /> إنشاء إعلان الآن</Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ══ MY ADS TAB ════════════════════════════════════════ */}
        {tab === "myads" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-violet-500" /> إعلاناتي ({myAds.length})
              </h2>
              <Link href="/create">
                <Button size="sm" className="gap-2 bg-violet-600 hover:bg-violet-700">
                  <PlusCircle className="w-4 h-4" /> إعلان جديد
                </Button>
              </Link>
            </div>

            {myAds.length === 0 ? (
              <Card className="border-dashed border-2 border-border/50">
                <CardContent className="py-14 text-center">
                  <Megaphone className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-muted-foreground mb-4">لا توجد إعلانات بعد</p>
                  <Link href="/create">
                    <Button className="gap-2"><PlusCircle className="w-4 h-4" /> أنشئ إعلانك الأول</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {myAds.map((ad: any) => (
                  <Card key={ad.id} className="border border-border/60 hover:border-violet-300 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex gap-3 items-start">
                        {/* صورة الإعلان */}
                        {ad.mediaUrl && (
                          <img
                            src={ad.mediaUrl}
                            alt={ad.title}
                            className="w-16 h-16 rounded-lg object-cover shrink-0 border border-border/40"
                          />
                        )}
                        {/* تفاصيل */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div>
                              <h3 className="font-bold text-sm leading-tight line-clamp-1">{ad.title}</h3>
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{ad.description}</p>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 w-8 p-0 border-violet-300 text-violet-600 hover:bg-violet-50"
                                data-testid={`btn-edit-ad-${ad.id}`}
                                onClick={() => openEdit(ad)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 w-8 p-0 border-red-300 text-red-500 hover:bg-red-50"
                                data-testid={`btn-delete-ad-${ad.id}`}
                                onClick={() => {
                                  if (confirm("هل تريد حذف هذا الإعلان نهائياً؟")) {
                                    deleteAdMutation.mutate(ad.id);
                                  }
                                }}
                                disabled={deleteAdMutation.isPending}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                          {/* إحصائيات */}
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            {ad.priceEgp && (
                              <span className="text-xs font-bold text-green-600">
                                💰 {Number(ad.priceEgp).toLocaleString()} ج.م
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Eye className="w-3 h-3" /> {ad.viewsCount ?? 0}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Heart className="w-3 h-3" /> {ad.likesCount ?? 0}
                            </span>
                            <Badge
                              variant={ad.status === "active" ? "default" : "secondary"}
                              className={`text-[10px] px-1.5 py-0 ${ad.status === "active" ? "bg-green-500/15 text-green-700 border-green-200" : ""}`}
                            >
                              {ad.status === "active" ? "✅ نشط" : "⏸ متوقف"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ ADVERTISER TAB ════════════════════════════════════ */}
        {tab === "advertiser" && (
          <div className="space-y-5">
            {analyticsLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
            ) : !adv || adv.totalCampaigns === 0 ? (
              <Card className="border-dashed border-2 border-border/50">
                <CardContent className="py-14 text-center">
                  <Megaphone className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                  <h3 className="text-base font-bold mb-1">لا توجد حملات إعلانية بعد</h3>
                  <p className="text-sm text-muted-foreground mb-4">أنشئ حملتك الأولى لتبدأ في الإعلان</p>
                  <Link href="/campaigns">
                    <Button className="gap-2"><PlusCircle className="w-4 h-4" /> إنشاء حملة</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <MetricCard icon={Megaphone}        label="إجمالي الحملات"  value={adv.totalCampaigns}  color="#14b8a6" />
                  <MetricCard icon={Eye}              label="المشاهدات (7 أيام)" value={adv.imp7d}     prev={adv.impPrev7d}    color="#6366f1" />
                  <MetricCard icon={MousePointerClick} label="النقرات (7 أيام)"  value={adv.clicks7d}  prev={adv.clicksPrev7d}  color="#3b82f6" />
                  <MetricCard icon={TrendingUp}       label="CTR"               value={adv.imp7d > 0 ? (adv.clicks7d / adv.imp7d) * 100 : 0}
                    fmt={v => `${v.toFixed(2)}%`} color="#f59e0b" />
                  <MetricCard icon={DollarSign}       label="الإنفاق (7 أيام)" value={adv.spent7d}   prev={adv.spentPrev7d}   fmt={v => `${v.toFixed(2)} ج.م`} color="#ef4444" />
                  <MetricCard icon={Wallet}           label="الميزانية الكلية"  value={adv.totalBudget} fmt={v => `${v.toFixed(2)} ج.م`} color="#10b981" />
                </div>

                {adv.dailyChart?.length > 0 && (
                  <Card className="rounded-2xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Eye className="w-4 h-4 text-indigo-500" /> المشاهدات والنقرات اليومية (آخر 14 يوم)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={adv.dailyChart}>
                          <defs>
                            <linearGradient id="impGradAdv" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="clkGradAdv" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#88888822" />
                          <XAxis dataKey="dayLabel" tick={{ fontSize: 10, fill: "#888" }} />
                          <YAxis tick={{ fontSize: 10, fill: "#888" }} />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Area type="monotone" dataKey="impressions" name="مشاهدات" stroke="#6366f1" strokeWidth={2} fill="url(#impGradAdv)" dot={{ r: 2 }} />
                          <Area type="monotone" dataKey="clicks" name="نقرات" stroke="#3b82f6" strokeWidth={2} fill="url(#clkGradAdv)" dot={{ r: 2 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-2">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-teal-500" /> تفاصيل الحملات
                  </h3>
                  {myCampaigns.slice(0, 8).map((c: any) => {
                    const ctr = c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(2) : "0";
                    const progress = c.budgetEGP > 0 ? Math.min(100, ((c.spentEGP || 0) / c.budgetEGP) * 100) : 0;
                    return (
                      <Card key={c.id} className="border-border/50 rounded-xl">
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-semibold text-sm">{c.name}</div>
                            <Badge variant="outline" className={`text-[10px] ${
                              c.status === "active" ? "bg-green-500/15 text-green-600 border-green-500/30"
                              : c.status === "pending" ? "bg-yellow-500/15 text-yellow-600 border-yellow-500/30"
                              : "bg-gray-500/15 text-gray-500"
                            }`}>
                              {c.status === "active" ? "نشطة" : c.status === "pending" ? "معلقة" : c.status}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-4 gap-2 text-center mb-2">
                            {[
                              { label: "انطباع", value: (c.impressions || 0).toLocaleString("ar-EG") },
                              { label: "نقرة",   value: (c.clicks || 0).toLocaleString("ar-EG") },
                              { label: "CTR",    value: `${ctr}%` },
                              { label: "إنفاق",  value: `${(parseFloat(c.spentEGP) || 0).toFixed(1)} ج.م` },
                            ].map(s => (
                              <div key={s.label} className="bg-muted/30 rounded-lg p-1.5">
                                <div className="text-xs font-bold">{s.value}</div>
                                <div className="text-[10px] text-muted-foreground">{s.label}</div>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                            </div>
                            <span className="text-[10px] text-muted-foreground">{progress.toFixed(0)}% من الميزانية</span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  <Link href="/campaigns">
                    <Button variant="outline" size="sm" className="w-full gap-2 mt-1">
                      إدارة كل الحملات <ArrowUpRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══ PUBLISHER TAB ═════════════════════════════════════ */}
        {tab === "publisher" && (
          <div className="space-y-5">
            {analyticsLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
            ) : myChannels.length === 0 ? (
              <Card className="border-dashed border-2 border-border/50">
                <CardContent className="py-14 text-center">
                  <Tv className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                  <h3 className="text-base font-bold mb-1">لا توجد قنوات بعد</h3>
                  <p className="text-sm text-muted-foreground mb-4">أنشئ قناتك وابدأ كسب الأرباح من الإعلانات</p>
                  <Link href="/channels">
                    <Button className="gap-2"><PlusCircle className="w-4 h-4" /> إنشاء قناة</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <MetricCard icon={Tv}          label="قنواتي"               value={myChannels.length}           color="#ef4444" />
                  <MetricCard icon={DollarSign}  label="أرباح 7 أيام"        value={pub?.totalEarnings7d || 0}   prev={pub?.totalEarningsPrev7d} fmt={v => `${v.toFixed(2)} ج.م`} color="#10b981" />
                  <MetricCard icon={Eye}         label="مشاهدات على قنواتي"  value={pub?.totalImp7d || 0}        color="#6366f1" />
                  <MetricCard icon={MousePointerClick} label="نقرات على قنواتي" value={pub?.totalClicks7d || 0} color="#3b82f6" />
                </div>

                {pub?.dailyChart?.length > 0 && (
                  <Card className="rounded-2xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-green-500" /> أرباحي اليومية (آخر 14 يوم)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={pub.dailyChart}>
                          <defs>
                            <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#88888822" />
                          <XAxis dataKey="dayLabel" tick={{ fontSize: 10, fill: "#888" }} />
                          <YAxis tick={{ fontSize: 10, fill: "#888" }} />
                          <Tooltip formatter={(v: any) => [`${Number(v).toFixed(3)} ج.م`, "الأرباح"]} />
                          <Area type="monotone" dataKey="earnings" name="أرباح" stroke="#10b981" strokeWidth={2} fill="url(#earnGrad)" dot={{ r: 3 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {pub?.dailyChart?.length > 0 && (
                  <Card className="rounded-2xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Eye className="w-4 h-4 text-indigo-500" /> مشاهدات ونقرات قنواتي
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={pub.dailyChart}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#88888822" />
                          <XAxis dataKey="dayLabel" tick={{ fontSize: 10, fill: "#888" }} />
                          <YAxis tick={{ fontSize: 10, fill: "#888" }} />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="impressions" name="مشاهدات" fill="#6366f1" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="clicks" name="نقرات" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-2">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Tv className="w-4 h-4 text-red-500" /> تفاصيل قنواتي
                  </h3>
                  {myChannels.map((ch: any) => {
                    const chAnalytics = pub?.channels?.find((c: any) => c.id === ch.id);
                    const earn7d = parseFloat(chAnalytics?.earnings_7d || 0);
                    const imp7d  = parseInt(chAnalytics?.imp_7d || 0);
                    const ctr    = imp7d > 0 ? ((parseInt(chAnalytics?.clicks_7d || 0) / imp7d) * 100).toFixed(2) : "0";
                    return (
                      <Card key={ch.id} className="border-border/50 rounded-xl">
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white font-bold text-sm">
                                {ch.name?.[0] || "Q"}
                              </div>
                              <div>
                                <div className="font-semibold text-sm flex items-center gap-1.5">
                                  {ch.name}
                                  {ch.isVerified && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                                  {ch.isMonetized && <DollarSign className="w-3 h-3 text-green-500" />}
                                </div>
                                <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                                  <span className="flex items-center gap-0.5"><Users className="w-3 h-3" />{ch.subscriberCount || 0}</span>
                                  <span>·</span>
                                  <span>أرباح كلية: {(parseFloat(ch.earningsEGP) || 0).toFixed(3)} ج.م</span>
                                </div>
                              </div>
                            </div>
                            <Link href={`/channels/${ch.id}`}>
                              <Button variant="ghost" size="icon" className="w-7 h-7">
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              </Button>
                            </Link>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-green-500/5 rounded-lg p-2 text-center">
                              <div className="text-sm font-bold text-green-600">{earn7d.toFixed(3)} ج.م</div>
                              <div className="text-[10px] text-muted-foreground">أرباح 7 أيام</div>
                            </div>
                            <div className="bg-indigo-500/5 rounded-lg p-2 text-center">
                              <div className="text-sm font-bold text-indigo-500">{imp7d.toLocaleString("ar-EG")}</div>
                              <div className="text-[10px] text-muted-foreground">مشاهدات</div>
                            </div>
                            <div className="bg-amber-500/5 rounded-lg p-2 text-center">
                              <div className="text-sm font-bold text-amber-500">{ctr}%</div>
                              <div className="text-[10px] text-muted-foreground">CTR</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                <Card className="rounded-2xl border border-green-500/20 bg-green-500/5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <DollarSign className="w-8 h-8 text-green-500" />
                      <div>
                        <div className="font-bold text-sm">حصتك من الأرباح 60%</div>
                        <div className="text-xs text-muted-foreground">كناشر، تحصل على 60% من قيمة الإعلانات التي تُعرض على قنواتك</div>
                      </div>
                      <Link href="/revenue">
                        <Button variant="outline" size="sm" className="gap-1 mr-auto flex-shrink-0">
                          سحب <ArrowUpRight className="w-3 h-3" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {/* ══ PRICES TAB ════════════════════════════════════════ */}
        {tab === "prices" && (
          <div className="space-y-5" dir="rtl">
            <p className="text-sm text-muted-foreground">الأسعار أدناه تُحدَّث تلقائياً من لوحة التحكم.</p>

            {/* الخدمات الإعلانية */}
            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-primary" /> الخدمات الإعلانية
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-right px-4 py-2 font-medium">الخدمة</th>
                      <th className="text-right px-4 py-2 font-medium">السعر</th>
                      <th className="text-right px-4 py-2 font-medium hidden sm:table-cell">الوصف</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: "📢 نشر إعلان 7 أيام",     price: `${pricing.listingPrice7d ?? '400'} ج.م`,  desc: "🌱 خطة أساسية — يُخصم من المحفظة" },
                      { label: "📢 نشر إعلان 15 يوماً",   price: `${pricing.listingPrice15d ?? '700'} ج.م`, desc: "⚡ خطة مميزة — يُخصم من المحفظة" },
                      { label: "📢 نشر إعلان 30 يوماً",   price: `${pricing.listingPrice30d ?? '900'} ج.م`, desc: "🔥 خطة احترافية — يُخصم من المحفظة" },
                      { label: "⚡ تعزيز إعلان (Boost)",  price: `${pricing.boostPriceEgp ?? '250'} ج.م`,   desc: "ظهور في المقدمة لمدة 7 أيام" },
                      { label: "🔥 إشعار ناري (Fire)",    price: `${pricing.firePriceEgp ?? '100'} ج.م`,    desc: "إشعار فوري لجميع المستخدمين" },
                      { label: "🔄 تجديد 7 أيام",         price: `${pricing.renewalPrice7d ?? '20'} ج.م`,   desc: "تمديد صلاحية إعلانك" },
                      { label: "🔄 تجديد 15 يوماً",       price: `${pricing.renewalPrice15d ?? '35'} ج.م`,  desc: "تمديد صلاحية إعلانك" },
                      { label: "🔄 تجديد 30 يوماً",       price: `${pricing.renewalPrice30d ?? '60'} ج.م`,  desc: "تمديد صلاحية إعلانك" },
                      { label: "📣 حملة إعلانية (CPM)",   price: `${pricing.cpmRateEgp ?? '15'} ج.م/1000`, desc: "لكل 1000 مشاهدة" },
                      { label: "📣 حملة إعلانية (CPC)",   price: `${pricing.cpcRateEgp ?? '0.75'} ج.م`,     desc: "لكل نقرة" },
                    ].map((row, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                        <td className="px-4 py-2.5 font-medium">{row.label}</td>
                        <td className="px-4 py-2.5 font-bold text-primary">{row.price}</td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs hidden sm:table-cell">{row.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* خدمات الذكاء الاصطناعي */}
            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Star className="w-4 h-4 text-violet-500" /> خدمات الذكاء الاصطناعي
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-right px-4 py-2 font-medium">الخدمة</th>
                      <th className="text-right px-4 py-2 font-medium">السعر</th>
                      <th className="text-right px-4 py-2 font-medium hidden sm:table-cell">الوصف</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: "🖼️ توليد صورة",         price: `${pricing.aiPriceImage ?? '10'} ج.م`,         desc: "صورة إعلانية بالذكاء" },
                      { label: "🎬 توليد فيديو",         price: `${pricing.aiPriceVideo ?? '25'} ج.م`,         desc: "مقطع فيديو قصير" },
                      { label: "✨ تأثير متحرك",          price: `${pricing.aiPriceAnimation ?? '20'} ج.م`,     desc: "صورة بتأثير بصري" },
                      { label: "✍️ كتابة محتوى",        price: `${pricing.aiPriceContent ?? '5'} ج.م`,          desc: "نص إعلاني احترافي" },
                      { label: "🤖 كريدت ذكاء اصطناعي", price: `${pricing.aiPricePerCreditEgp ?? '5'} ج.م/كريدت`, desc: `${pricing.aiFreeCredits ?? '3'} كريدت مجاناً عند التسجيل` },
                    ].map((row, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                        <td className="px-4 py-2.5 font-medium">{row.label}</td>
                        <td className="px-4 py-2.5 font-bold text-violet-600">{row.price}</td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs hidden sm:table-cell">{row.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* الاشتراك والمحفظة */}
            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-green-500" /> الاشتراك والمحفظة
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-right px-4 py-2 font-medium">البند</th>
                      <th className="text-right px-4 py-2 font-medium">القيمة</th>
                      <th className="text-right px-4 py-2 font-medium hidden sm:table-cell">الوصف</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: "🔑 الاشتراك الأسبوعي",    price: `${pricing.subscriptionPriceEgp ?? '250'} ج.م/أسبوع`, desc: "للوصول لخدمات الذكاء والتعزيز" },
                      { label: "💰 الحد الأدنى للسحب",    price: `${pricing.walletMinWithdrawalEgp ?? '100'} ج.م`,       desc: "أقل مبلغ يمكن سحبه" },
                    ].map((row, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                        <td className="px-4 py-2.5 font-medium">{row.label}</td>
                        <td className="px-4 py-2.5 font-bold text-green-600">{row.price}</td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs hidden sm:table-cell">{row.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        <TableBody>
           {data.map((row: any) => 
  <TableRow key={row.id}>
    <TableCell className="text-right px-4 py-2 font-medium">
      {row.label}
    </TableCell>

    <TableCell className="text-right px-4 py-2 font-medium">
      {row.value}
    </TableCell>

    <TableCell className="text-right px-4 py-2 font-medium hidden sm:table-cell">
      {row.price}
    </TableCell>
  </TableRow>
))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  </div>

      </div>
    </div>

    {/* ══ نافذة تعديل الإعلان ══════════════════════════════════ */}
    <Dialog open={!!editingAd} onOpenChange={open => { if (!open) setEditingAd(null); }}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-violet-500" /> تعديل الإعلان
          </DialogTitle>
        </DialogHeader>

        {editingAd && (
          <div className="space-y-4 py-2">
            {/* العنوان */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-title">عنوان الإعلان *</Label>
              <Input
                id="edit-title"
                data-testid="input-edit-title"
                value={editForm.title}
                onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                placeholder="عنوان الإعلان"
              />
            </div>

            {/* الوصف */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-desc">وصف الإعلان *</Label>
              <Textarea
                id="edit-desc"
                data-testid="input-edit-description"
                value={editForm.description}
                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                placeholder="اكتب وصف الإعلان..."
                rows={4}
              />
            </div>

            {/* السعر ورقم الواتساب */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-price">السعر (ج.م)</Label>
                <Input
                  id="edit-price"
                  data-testid="input-edit-price"
                  type="number"
                  min="0"
                  value={editForm.priceEGP}
                  onChange={e => setEditForm(f => ({ ...f, priceEGP: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-whatsapp">رقم الواتساب</Label>
                <Input
                  id="edit-whatsapp"
                  data-testid="input-edit-whatsapp"
                  value={editForm.whatsappNumber}
                  onChange={e => setEditForm(f => ({ ...f, whatsappNumber: e.target.value }))}
                  placeholder="01xxxxxxxxx"
                  dir="ltr"
                />
              </div>
            </div>

            {/* الحالة */}
            <div className="space-y-1.5">
              <Label>حالة الإعلان</Label>
              <div className="flex gap-3">
                {[
                  { val: "active",   label: "✅ نشط",    cls: "border-green-400 bg-green-50 text-green-700" },
                  { val: "inactive", label: "⏸ متوقف", cls: "border-gray-400 bg-gray-50 text-gray-600" },
                ].map(opt => (
                  <button
                    key={opt.val}
                    data-testid={`btn-status-${opt.val}`}
                    onClick={() => setEditForm(f => ({ ...f, status: opt.val }))}
                    className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                      editForm.status === opt.val ? opt.cls : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        

        <DialogFooter className="gap-2 flex-row-reverse">
          <Button
            data-testid="btn-save-edit"
            onClick={() => {
              if (!editForm.title.trim() || !editForm.description.trim()) {
                toast({ title: "⚠️ العنوان والوصف مطلوبان", variant: "destructive" });
                return;
              }
              updateAdMutation.mutate({
                id: editingAd.id,
                data: {
                  title: editForm.title.trim(),
                  description: editForm.description.trim(),
                  priceEGP: editForm.priceEGP ? parseFloat(editForm.priceEGP) : null,
                  whatsappNumber: editForm.whatsappNumber.trim() || null,
                  status: editForm.status,
                },
              });
            }}
            disabled={updateAdMutation.isPending}
            className="bg-violet-600 hover:bg-violet-700 gap-2"
          >
            {updateAdMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
            حفظ التعديلات
          </Button>
          <Button variant="outline" onClick={() => setEditingAd(null)} data-testid="btn-cancel-edit">
            <X className="w-4 h-4 ml-1" /> إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
)}
