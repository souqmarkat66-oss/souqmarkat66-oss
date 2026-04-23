import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Megaphone, Eye, Heart, MessageSquare, BarChart2, TrendingUp,
  DollarSign, Radio, Film, Tv, PlusCircle, ArrowUpRight,
  Loader2, Star, Users, MousePointerClick, Wallet, PieChart, Utensils,
  Clock, CheckCircle2, XCircle, ImageIcon
} from "lucide-react";
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

type Tab = "overview" | "advertiser" | "publisher";

export default function MyDashboard() {
  const { user, isLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");

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

  const TABS: { key: Tab; label: string; icon: any; color: string }[] = [
    { key: "overview",   label: "نظرة عامة",  icon: PieChart,      color: "text-primary"   },
    { key: "advertiser", label: "كمعلن",       icon: Megaphone,     color: "text-teal-500"  },
    { key: "publisher",  label: "كناشر",       icon: DollarSign,    color: "text-green-500" },
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
                { href: "/create",          icon: PlusCircle, label: "إعلان جديد",      color: "text-violet-500" },
                { href: "/campaigns",      icon: BarChart2,  label: "إدارة الحملات",  color: "text-teal-500"   },
                { href: "/menu-generator", icon: Utensils,   label: "🍽️ منيو ذكي",    color: "text-orange-500" },
                { href: "/stream/start",   icon: Radio,      label: "بدء البث",        color: "text-red-500"    },
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

            {/* ══ ALL MY ADS — with status labels ══ */}
            {myAds.length > 0 && (() => {
              const pendingAds = myAds.filter((a: any) => a.status === "pending" || a.status === "review");
              const activeAds  = myAds.filter((a: any) => a.status === "active");
              const rejectedAds = myAds.filter((a: any) => a.status === "rejected");
              return (
                <div className="space-y-4">
                  {/* Pending */}
                  {pendingAds.length > 0 && (
                    <Card className="border-yellow-400/50 bg-yellow-50/50 dark:bg-yellow-950/20 rounded-2xl">
                      <CardHeader className="pb-2 pt-4 px-4">
                        <CardTitle className="text-sm flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                          <Clock className="w-4 h-4 animate-pulse" />
                          قيد المراجعة ({pendingAds.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-4 space-y-2">
                        {pendingAds.map((ad: any) => (
                          <Link key={ad.id} href={`/ads/${ad.id}`}>
                            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-black/20 border border-yellow-300/50 hover:border-yellow-400 transition-colors cursor-pointer">
                              {ad.mediaUrl ? (
                                <img src={ad.mediaUrl} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" onError={e => { (e.target as any).style.display='none'; }} />
                              ) : (
                                <div className="w-12 h-12 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center flex-shrink-0">
                                  <ImageIcon className="w-5 h-5 text-yellow-500" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold truncate">{ad.title}</p>
                                <p className="text-xs text-muted-foreground truncate">{ad.description}</p>
                              </div>
                              <Badge className="bg-yellow-400/20 text-yellow-700 dark:text-yellow-400 border-yellow-400/40 text-[10px] flex-shrink-0">
                                ⏳ قيد المراجعة
                              </Badge>
                            </div>
                          </Link>
                        ))}
                        <p className="text-[11px] text-yellow-600/70 dark:text-yellow-400/60 text-center mt-1">سيتم مراجعة إعلاناتك خلال 24 ساعة وتفعيلها تلقائياً</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Active */}
                  {activeAds.length > 0 && (
                    <Card className="border-green-400/40 bg-green-50/30 dark:bg-green-950/10 rounded-2xl">
                      <CardHeader className="pb-2 pt-4 px-4">
                        <CardTitle className="text-sm flex items-center gap-2 text-green-700 dark:text-green-400">
                          <CheckCircle2 className="w-4 h-4" />
                          إعلانات نشطة ({activeAds.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-4 space-y-2">
                        {activeAds.slice(0, 5).map((ad: any) => (
                          <Link key={ad.id} href={`/ads/${ad.id}`}>
                            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-black/20 border border-green-300/30 hover:border-green-400 transition-colors cursor-pointer">
                              {ad.mediaUrl ? (
                                <img src={ad.mediaUrl} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" onError={e => { (e.target as any).style.display='none'; }} />
                              ) : (
                                <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                                  <Megaphone className="w-5 h-5 text-green-500" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold truncate">{ad.title}</p>
                                <p className="text-xs text-muted-foreground">{(ad.viewsCount||0).toLocaleString("ar-EG")} مشاهدة · {(ad.likesCount||0)} إعجاب</p>
                              </div>
                              <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30 text-[10px] flex-shrink-0">
                                ✅ نشط
                              </Badge>
                            </div>
                          </Link>
                        ))}
                        {activeAds.length > 5 && (
                          <Link href="/my-content">
                            <p className="text-center text-xs text-primary hover:underline mt-1">عرض كل الإعلانات ({activeAds.length})</p>
                          </Link>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Rejected */}
                  {rejectedAds.length > 0 && (
                    <Card className="border-red-400/40 bg-red-50/30 dark:bg-red-950/10 rounded-2xl">
                      <CardHeader className="pb-2 pt-4 px-4">
                        <CardTitle className="text-sm flex items-center gap-2 text-red-600 dark:text-red-400">
                          <XCircle className="w-4 h-4" />
                          مرفوضة ({rejectedAds.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-4 space-y-2">
                        {rejectedAds.map((ad: any) => (
                          <Link key={ad.id} href={`/ads/${ad.id}`}>
                            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-black/20 border border-red-300/30 hover:border-red-400 transition-colors cursor-pointer">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold truncate">{ad.title}</p>
                              </div>
                              <Badge className="bg-red-500/15 text-red-600 border-red-500/30 text-[10px] flex-shrink-0">❌ مرفوض</Badge>
                            </div>
                          </Link>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>
              );
            })()}

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

      </div>
    </div>
  );
}
