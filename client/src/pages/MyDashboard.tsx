import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Megaphone, Eye, Heart, MessageSquare, BarChart2, TrendingUp,
  DollarSign, Radio, Film, Tv, PlusCircle, ArrowUpRight,
  ShieldX, Loader2, Star, Users
} from "lucide-react";

const ADMIN_ID = "54219806";

function StatCard({ icon: Icon, label, value, color, sub }: {
  icon: any; label: string; value: string | number; color: string; sub?: string;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="text-xl font-extrabold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
          {sub && <div className="text-[10px] text-muted-foreground/70">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function MyDashboard() {
  const { user, isLoading } = useAuth();

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

  const { data: reelsData } = useQuery<{ reels: any[] }>({
    queryKey: ["/api/reels"],
    queryFn: () => fetch("/api/reels", { credentials: "include" }).then(r => r.json()),
    enabled: !!user,
  });

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );

  if (!user) {
    window.location.href = "/login";
    return null;
  }

  if (user.id === ADMIN_ID) {
    window.location.href = "/admin";
    return null;
  }

  const myAds = Array.isArray(ads) ? ads : [];
  const myChannels = Array.isArray(channels) ? channels.filter((c: any) => c.userId === user.id) : [];
  const myReels = Array.isArray(reelsData?.reels) ? reelsData.reels.filter((r: any) => r.userId === user.id) : [];
  const myCampaigns = Array.isArray(campaigns) ? campaigns : [];

  const totalViews   = myAds.reduce((s: number, a: any) => s + (a.viewsCount  || 0), 0);
  const totalLikes   = myAds.reduce((s: number, a: any) => s + (a.likesCount  || 0), 0);
  const totalComments= myAds.reduce((s: number, a: any) => s + (a.commentsCount || 0), 0);
  const totalSpent   = myCampaigns.reduce((s: number, c: any) => s + (parseFloat(c.spentEGP) || 0), 0);
  const totalImpressions = myCampaigns.reduce((s: number, c: any) => s + (c.impressions || 0), 0);
  const totalClicks  = myCampaigns.reduce((s: number, c: any) => s + (c.clicks || 0), 0);
  const totalEarnings= myChannels.reduce((s: number, c: any) => s + (parseFloat(c.earningsEGP) || 0), 0);
  const totalSubs    = myChannels.reduce((s: number, c: any) => s + (c.subscriberCount || 0), 0);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container mx-auto px-4 py-6 max-w-5xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold flex items-center gap-2">
              <BarChart2 className="w-6 h-6 text-primary" />
              تقاريري ولوحتي
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              مرحباً {user.firstName}! هذه نتائج نشاطك على المنصة
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/create">
              <Button size="sm" className="gap-2">
                <PlusCircle className="w-4 h-4" /> إعلان جديد
              </Button>
            </Link>
          </div>
        </div>

        {/* ── إعلاناتي ─────────────────────────────────────── */}
        <div className="mb-6">
          <h2 className="text-base font-bold mb-3 flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-violet-500" /> إعلاناتي
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={Megaphone}     label="إجمالي الإعلانات"  value={myAds.length}     color="bg-violet-500" />
            <StatCard icon={Eye}           label="إجمالي المشاهدات"   value={totalViews.toLocaleString()}    color="bg-blue-500"   />
            <StatCard icon={Heart}         label="الإعجابات"           value={totalLikes.toLocaleString()}    color="bg-pink-500"   />
            <StatCard icon={MessageSquare} label="التعليقات"           value={totalComments.toLocaleString()} color="bg-orange-500" />
          </div>
        </div>

        {/* ── حملاتي الإعلانية ──────────────────────────── */}
        {myCampaigns.length > 0 && (
          <div className="mb-6">
            <h2 className="text-base font-bold mb-3 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-teal-500" /> حملاتي الإعلانية
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard icon={BarChart2}   label="إجمالي الحملات"    value={myCampaigns.length}               color="bg-teal-500"    />
              <StatCard icon={Eye}         label="الانطباعات"         value={totalImpressions.toLocaleString()} color="bg-cyan-500"    />
              <StatCard icon={ArrowUpRight}label="النقرات"             value={totalClicks.toLocaleString()}      color="bg-indigo-500"  />
              <StatCard icon={DollarSign}  label="الإنفاق (ج.م)"     value={totalSpent.toFixed(2)}             color="bg-emerald-500" sub={`CTR ${totalImpressions > 0 ? ((totalClicks/totalImpressions)*100).toFixed(2) : "0"}%`} />
            </div>
          </div>
        )}

        {/* ── قنواتي ────────────────────────────────────── */}
        {myChannels.length > 0 && (
          <div className="mb-6">
            <h2 className="text-base font-bold mb-3 flex items-center gap-2">
              <Tv className="w-4 h-4 text-red-500" /> قنواتي
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard icon={Tv}          label="القنوات"             value={myChannels.length}               color="bg-red-500"     />
              <StatCard icon={Users}       label="المشتركون"            value={totalSubs.toLocaleString()}      color="bg-rose-500"    />
              <StatCard icon={Film}        label="الريلز"              value={myReels.length}                  color="bg-pink-500"    />
              <StatCard icon={DollarSign}  label="الأرباح (ج.م)"      value={totalEarnings.toFixed(2)}        color="bg-green-500"   sub="حصتي 60%" />
            </div>
          </div>
        )}

        {/* ── تفاصيل الإعلانات ──────────────────────────── */}
        {myAds.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-violet-500" /> تفاصيل إعلاناتي
              </h2>
              <Link href="/my-content">
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                  عرض الكل <ArrowUpRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
            <div className="space-y-2">
              {myAds.slice(0, 5).map((ad: any) => (
                <Card key={ad.id} className="border-border/50">
                  <CardContent className="p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {ad.mediaUrl && ad.mediaType === "image" && (
                        <img src={ad.mediaUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate">{ad.title}</div>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{ad.viewsCount || 0}</span>
                          <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{ad.likesCount || 0}</span>
                          <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{ad.commentsCount || 0}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge
                        className={`text-[10px] ${ad.status === "active" ? "bg-green-500/15 text-green-600 border-green-500/30" : "bg-gray-500/15 text-gray-500"}`}
                        variant="outline"
                      >
                        {ad.status === "active" ? "نشط" : ad.status}
                      </Badge>
                      <Link href={`/ads/${ad.id}`}>
                        <Button variant="ghost" size="icon" className="w-7 h-7">
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ── حملاتي - تفاصيل ───────────────────────────── */}
        {myCampaigns.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-teal-500" /> تفاصيل الحملات
              </h2>
              <Link href="/campaigns">
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                  إدارة الحملات <ArrowUpRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
            <div className="space-y-2">
              {myCampaigns.slice(0, 5).map((c: any) => {
                const ctr = c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(2) : "0";
                return (
                  <Card key={c.id} className="border-border/50">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold text-sm">{c.name}</div>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${c.status === "active" ? "bg-green-500/15 text-green-600 border-green-500/30" : c.status === "pending" ? "bg-yellow-500/15 text-yellow-600 border-yellow-500/30" : "bg-gray-500/15 text-gray-500"}`}
                        >
                          {c.status === "active" ? "نشطة" : c.status === "pending" ? "معلقة" : c.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        {[
                          { label: "انطباع", value: (c.impressions || 0).toLocaleString() },
                          { label: "نقرة", value: (c.clicks || 0).toLocaleString() },
                          { label: "CTR", value: `${ctr}%` },
                          { label: "إنفاق", value: `${(parseFloat(c.spentEGP) || 0).toFixed(1)} ج.م` },
                        ].map(s => (
                          <div key={s.label} className="bg-muted/30 rounded-lg p-1.5">
                            <div className="text-xs font-bold">{s.value}</div>
                            <div className="text-[10px] text-muted-foreground">{s.label}</div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* ── قنواتي - تفاصيل ───────────────────────────── */}
        {myChannels.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Tv className="w-4 h-4 text-red-500" /> تفاصيل القنوات
              </h2>
            </div>
            <div className="space-y-2">
              {myChannels.map((ch: any) => (
                <Card key={ch.id} className="border-border/50">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {ch.name?.[0] || "Q"}
                      </div>
                      <div>
                        <div className="font-semibold text-sm flex items-center gap-2">
                          {ch.name}
                          {ch.isVerified && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                          {ch.isMonetized && <DollarSign className="w-3 h-3 text-green-500" />}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{ch.subscriberCount || 0} مشترك</span>
                          <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{(parseFloat(ch.earningsEGP) || 0).toFixed(2)} ج.م</span>
                        </div>
                      </div>
                    </div>
                    <Link href={`/channels/${ch.id}`}>
                      <Button variant="ghost" size="icon" className="w-7 h-7">
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {myAds.length === 0 && myCampaigns.length === 0 && myChannels.length === 0 && (
          <Card className="border-dashed border-2 border-border/50">
            <CardContent className="py-12 text-center">
              <Megaphone className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="text-lg font-bold mb-1">ابدأ رحلتك الإعلانية</h3>
              <p className="text-sm text-muted-foreground mb-4">أنشئ إعلانك الأول وابدأ في استقطاب العملاء</p>
              <Link href="/create">
                <Button className="gap-2">
                  <PlusCircle className="w-4 h-4" /> إنشاء إعلان الآن
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* روابط سريعة */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { href: "/create",    icon: PlusCircle, label: "إعلان جديد",    color: "text-violet-500" },
            { href: "/campaigns", icon: BarChart2,  label: "إدارة الحملات", color: "text-teal-500"   },
            { href: "/revenue",   icon: DollarSign, label: "الإيرادات",     color: "text-green-500"  },
            { href: "/stream/start", icon: Radio,   label: "بدء البث",      color: "text-red-500"    },
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

      </div>
    </div>
  );
}
