import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import AdminPinLock from "@/components/AdminPinLock";
import {
  LayoutDashboard, Users, Megaphone, Film, Tv, Radio, Flag, Banknote,
  ShieldX, Settings, Bell, BarChart2, Eye, TrendingUp, DollarSign,
  CheckCircle, XCircle, Loader2, ShieldAlert, Search, Edit2, Save, X,
  ArrowUpRight, ArrowDownLeft, Trash2, PauseCircle, PlayCircle, Send,
  AlertTriangle, Activity, Menu, ChevronLeft, VideoOff, PieChart,
  Star, MessageSquare, Clock, BanIcon, UserCheck, FolderOpen, FileImage,
  FileVideo, File, Lock, Phone, Mail, Shield, RefreshCw, ToggleLeft, ToggleRight, Zap,
  Sparkles, Image, Video, Wand2, FileText, Gift, Check
} from "lucide-react";

const ADMIN_ID = "54219806";
const ADMIN_EMAIL = "souqmarkat66@gmail.com";

// ── Nav items ─────────────────────────────────────────────────
const NAV = [
  { key: "dashboard",      label: "الرئيسية",            icon: LayoutDashboard, color: "text-blue-400" },
  { key: "users",          label: "المستخدمون",           icon: Users,           color: "text-purple-400" },
  { key: "ads",            label: "الإعلانات",            icon: Megaphone,       color: "text-orange-400" },
  { key: "reels",          label: "الريلز",               icon: Film,            color: "text-pink-400" },
  { key: "channels",       label: "القنوات",              icon: Tv,              color: "text-indigo-400" },
  { key: "streams",        label: "البث المباشر",          icon: Radio,           color: "text-red-400" },
  { key: "campaigns",      label: "الحملات الإعلانية",    icon: BarChart2,       color: "text-teal-400" },
  { key: "payments",       label: "طلبات السحب",          icon: Banknote,        color: "text-green-400" },
  { key: "boostorders",    label: "طلبات التعزيز",         icon: Zap,             color: "text-orange-400" },
  { key: "payreceipts",    label: "إيصالات الدفع",          icon: Banknote,        color: "text-emerald-500" },
  { key: "renewalorders",  label: "طلبات التجديد",           icon: RefreshCw,       color: "text-blue-400" },
  { key: "reports",        label: "البلاغات",             icon: Flag,            color: "text-yellow-400" },
  { key: "fraud",          label: "كشف الاحتيال",         icon: ShieldX,         color: "text-red-500" },
  { key: "revenue",        label: "الإيرادات",            icon: DollarSign,      color: "text-emerald-400" },
  { key: "broadcast",      label: "إشعارات جماعية",       icon: Bell,            color: "text-cyan-400" },
  { key: "media",          label: "مكتبة الملفات",         icon: FolderOpen,      color: "text-lime-400" },
  { key: "pricing",        label: "إدارة الأسعار",          icon: DollarSign,      color: "text-yellow-400" },
  { key: "aipricing",      label: "أسعار الذكاء الاصطناعي", icon: Sparkles,       color: "text-violet-400" },
  { key: "settings",       label: "إعدادات المنصة",       icon: Settings,        color: "text-gray-400" },
  { key: "activity",       label: "سجل النشاط",           icon: Activity,        color: "text-slate-400" },
];

// ── Helpers ────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active:    { label: "نشط",     cls: "bg-green-500/15 text-green-600 border-green-500/30" },
    inactive:  { label: "غير نشط", cls: "bg-gray-500/15 text-gray-500 border-gray-500/30" },
    paused:    { label: "متوقف",   cls: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30" },
    pending:   { label: "معلق",    cls: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
    approved:  { label: "مقبول",   cls: "bg-green-500/15 text-green-600 border-green-500/30" },
    rejected:  { label: "مرفوض",   cls: "bg-red-500/15 text-red-600 border-red-500/30" },
    resolved:  { label: "محلول",   cls: "bg-green-500/15 text-green-600 border-green-500/30" },
    dismissed: { label: "مرفوض",   cls: "bg-gray-500/15 text-gray-500 border-gray-500/30" },
    live:      { label: "مباشر",   cls: "bg-red-500/15 text-red-600 border-red-500/30" },
    ended:     { label: "منتهي",   cls: "bg-gray-500/15 text-gray-500 border-gray-500/30" },
    suspended: { label: "معلق",    cls: "bg-red-500/15 text-red-600 border-red-500/30" },
    hidden:    { label: "مخفي",    cls: "bg-gray-500/15 text-gray-500 border-gray-500/30" },
    completed: { label: "مكتمل",   cls: "bg-gray-500/15 text-gray-500 border-gray-500/30" },
  };
  const info = map[status] ?? { label: status, cls: "bg-gray-500/15 text-gray-500" };
  return <span className={`text-xs border rounded-full px-2 py-0.5 font-medium ${info.cls}`}>{info.label}</span>;
}

function StatCard({ icon: Icon, label, value, color, sub }: any) {
  return (
    <Card className="rounded-2xl border border-border/50 hover:shadow-md transition-all duration-200">
      <CardContent className="p-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color.replace('text-', 'bg-').replace('-400', '-500/10').replace('-500', '-500/10').replace('-600', '-500/10')}`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1 opacity-70">{sub}</div>}
      </CardContent>
    </Card>
  );
}

// ── Main Component ─────────────────────────────────────────────
export default function AdminPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [section, setSection] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const isAdmin = user?.id === ADMIN_ID || user?.email === ADMIN_EMAIL;

  // Log admin action helper
  const logAction = useCallback(async (action: string, target: string, details = "") => {
    await fetch("/api/admin/activity-log", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, target, details }),
    }).catch(() => {});
  }, []);

  if (isAdmin && !pinUnlocked) {
    return <AdminPinLock onUnlocked={() => setPinUnlocked(true)} />;
  }

  if (user === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    // Redirect non-admins to their personal dashboard immediately
    window.location.replace("/my-dashboard");
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background" dir="rtl">
      {/* ── Sidebar ───────────────────────────────────────────── */}
      <aside className={`${sidebarOpen ? "w-60" : "w-16"} flex-shrink-0 bg-card border-l border-border flex flex-col transition-all duration-300 overflow-hidden`}>
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center flex-shrink-0">
            <ShieldX className="w-4 h-4 text-white" />
          </div>
          {sidebarOpen && (
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm truncate">لوحة التحكم</div>
              <div className="text-xs text-muted-foreground truncate">Souq Ads Network</div>
            </div>
          )}
          <Button variant="ghost" size="icon" className="w-7 h-7 flex-shrink-0" onClick={() => setSidebarOpen(o => !o)}>
            <Menu className="w-4 h-4" />
          </Button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
          {NAV.map(item => (
            <button
              key={item.key}
              onClick={() => setSection(item.key)}
              data-testid={`nav-${item.key}`}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 text-right
                ${section === item.key
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
            >
              <item.icon className={`w-4 h-4 flex-shrink-0 ${section === item.key ? "text-primary" : item.color}`} />
              {sidebarOpen && <span className="truncate">{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Footer */}
        {sidebarOpen && (
          <div className="px-4 py-3 border-t border-border">
            <div className="text-xs text-muted-foreground">أحمد محمد</div>
            <div className="text-xs text-muted-foreground opacity-60">ID: {ADMIN_ID}</div>
          </div>
        )}
      </aside>

      {/* ── Main Content ──────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-lg">{NAV.find(n => n.key === section)?.label}</h1>
            <p className="text-xs text-muted-foreground">شبكة سوق للإعلانات — لوحة الإدارة</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-muted-foreground">متصل</span>
          </div>
        </div>

        {/* Sections */}
        <div className="p-6">
          {section === "dashboard"  && <DashboardSection />}
          {section === "users"      && <UsersSection logAction={logAction} />}
          {section === "ads"        && <AdsSection logAction={logAction} />}
          {section === "reels"      && <ReelsSection logAction={logAction} />}
          {section === "channels"   && <ChannelsSection logAction={logAction} />}
          {section === "streams"    && <StreamsSection logAction={logAction} />}
          {section === "campaigns"  && <CampaignsSection logAction={logAction} />}
          {section === "payments"   && <PaymentsSection logAction={logAction} />}
          {section === "boostorders" && <BoostOrdersSection logAction={logAction} />}
          {section === "payreceipts"   && <PayReceiptsSection />}
          {section === "renewalorders" && <RenewalOrdersSection />}
          {section === "reports"       && <ReportsSection logAction={logAction} />}
          {section === "fraud"      && <FraudSection />}
          {section === "revenue"    && <RevenueSection />}
          {section === "broadcast"  && <BroadcastSection logAction={logAction} />}
          {section === "media"      && <MediaSection logAction={logAction} />}
          {section === "pricing"    && <PricingSection />}
          {section === "aipricing"  && <AiPricingSection />}
          {section === "settings"   && <SettingsSection logAction={logAction} />}
          {section === "activity"   && <ActivitySection />}
        </div>
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════
function DashboardSection() {
  const { data: stats } = useQuery<any>({
    queryKey: ["/api/admin/stats"],
    queryFn: () => fetch("/api/admin/stats", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30000,
  });
  const { data: adminRevenue } = useQuery<any>({
    queryKey: ["/api/admin/revenue"],
    queryFn: () => fetch("/api/admin/revenue", { credentials: "include" }).then(r => r.json()),
  });

  return (
    <div className="space-y-6">
      {/* Primary stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          <StatCard icon={Users}      label="المستخدمون"      value={stats.totalUsers ?? "—"}        color="text-purple-500" />
          <StatCard icon={Megaphone}  label="الإعلانات"       value={stats.totalAds}                 color="text-orange-500" />
          <StatCard icon={Tv}         label="القنوات"          value={stats.totalChannels}             color="text-indigo-500" />
          <StatCard icon={Film}       label="الريلز"           value={stats.totalReels}               color="text-pink-500" />
          <StatCard icon={Radio}      label="بث مباشر حالي"    value={stats.liveStreams}              color="text-red-500"    sub="🔴 مباشر الآن" />
          <StatCard icon={BarChart2}  label="حملات نشطة"       value={stats.activeCampaigns}          color="text-teal-500" />
          <StatCard icon={Flag}       label="بلاغات معلقة"     value={stats.pendingReports}           color="text-yellow-500" />
          <StatCard icon={Eye}        label="مشاهدات كلية"     value={Number(stats.totalImpressions || 0).toLocaleString()} color="text-blue-500" />
          <StatCard icon={Banknote}   label="إيرادات المنصة"   value={`${(stats.totalRevenueEGP || 0).toFixed(0)} ج.م`}    color="text-emerald-500" />
          <StatCard icon={Clock}      label="طلبات سحب معلقة"  value={stats.pendingPayments}          color="text-amber-500" />
        </div>
      )}

      {/* Revenue quick view */}
      {adminRevenue && (
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { label: "إجمالي الإنفاق الإعلاني", value: adminRevenue.summary.totalSpentEGP.toFixed(2), unit: "ج.م", icon: Banknote, cls: "border-blue-500/20 from-blue-500/5" },
            { label: "دخل المنصة (40%)",         value: adminRevenue.summary.platformRevenueEGP.toFixed(2), unit: "ج.م", icon: DollarSign, cls: "border-emerald-500/20 from-emerald-500/5" },
            { label: "أرباح الناشرين (60%)",      value: adminRevenue.summary.publishersRevenueEGP.toFixed(2), unit: "ج.م", icon: TrendingUp, cls: "border-green-500/20 from-green-500/5" },
          ].map(r => (
            <Card key={r.label} className={`rounded-2xl border bg-gradient-to-br ${r.cls} to-transparent`}>
              <CardContent className="p-5 flex items-center gap-4">
                <r.icon className="w-8 h-8 text-muted-foreground" />
                <div>
                  <div className="text-2xl font-bold">{r.value} <span className="text-sm font-normal text-muted-foreground">{r.unit}</span></div>
                  <div className="text-xs text-muted-foreground">{r.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Recent transactions */}
      {adminRevenue?.recentTransactions?.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">آخر المعاملات المالية</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {adminRevenue.recentTransactions.slice(0, 20).map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-muted/40 text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center ${tx.type === "earning" ? "bg-green-500/10" : "bg-red-500/10"}`}>
                      {tx.type === "earning" ? <ArrowUpRight className="w-3.5 h-3.5 text-green-500" /> : <ArrowDownLeft className="w-3.5 h-3.5 text-red-500" />}
                    </div>
                    <div>
                      <div className="font-medium text-xs">{tx.description}</div>
                      <div className="text-[10px] text-muted-foreground">{tx.created_at ? format(new Date(tx.created_at), "dd/MM/yy HH:mm", { locale: ar }) : ""}</div>
                    </div>
                  </div>
                  <div className={`font-bold text-xs ${tx.type === "earning" ? "text-green-600" : "text-red-500"}`}>
                    {tx.type === "earning" ? "+" : "-"}{Number(tx.amount_egp || 0).toFixed(3)} ج.م
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════════════
function UsersSection({ logAction }: { logAction: any }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [searchQ, setSearchQ] = useState("");

  const { data: users = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/users", searchQ],
    queryFn: () => fetch(`/api/admin/users?search=${encodeURIComponent(searchQ)}`, { credentials: "include" }).then(r => r.json()),
  });

  const updateUser = useMutation({
    mutationFn: ({ id, data }: any) =>
      fetch(`/api/admin/users/${id}`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "✅ تم تحديث المستخدم" });
      logAction("update_user", vars.id, JSON.stringify(vars.data));
    },
  });

  const resetPassword = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/users/${id}/reset-password`, { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "🔑 تم مسح كلمة المرور — سيُطلب من المستخدم إعداد كلمة جديدة" });
      logAction("reset_password", id);
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input placeholder="🔍 ابحث بالاسم أو الإيميل..." value={search} onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === "Enter" && setSearchQ(search)} className="flex-1" data-testid="input-users-search" />
        <Button onClick={() => setSearchQ(search)} data-testid="btn-users-search"><Search className="w-4 h-4 me-1" />بحث</Button>
        {searchQ && <Button variant="outline" onClick={() => { setSearchQ(""); setSearch(""); }}><X className="w-4 h-4" /></Button>}
      </div>

      {isLoading ? <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : (
        <div className="space-y-2">
          {users.map((u: any) => (
            <Card key={u.id} className="rounded-xl" data-testid={`user-card-${u.id}`}>
              <CardContent className="p-4 flex items-center gap-4">
                {u.profile_image_url
                  ? <img src={u.profile_image_url} className="w-10 h-10 rounded-full object-cover flex-shrink-0" alt="" />
                  : <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-lg font-bold">{(u.first_name || u.email || "?")[0]}</div>
                }
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{u.first_name} {u.last_name}</span>
                    {u.is_banned && <span className="text-xs bg-red-500/15 text-red-600 border border-red-500/30 rounded-full px-2 py-0.5">🚫 محظور</span>}
                    {u.id === ADMIN_ID && <span className="text-xs bg-primary/15 text-primary border border-primary/30 rounded-full px-2 py-0.5">👑 أدمن</span>}
                    {!u.has_password && u.id !== ADMIN_ID && <span className="text-xs bg-yellow-500/15 text-yellow-600 border border-yellow-500/30 rounded-full px-2 py-0.5">⚠️ بدون كلمة مرور</span>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                    {u.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{u.email}</span>}
                    {u.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{u.phone}</span>}
                  </div>
                  <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span>📢 {u.ads_count} إعلان</span>
                    <span>📺 {u.channels_count} قناة</span>
                    <span>🎬 {u.reels_count} ريل</span>
                    <span>💰 {Number(u.total_earnings || 0).toFixed(2)} ج.م</span>
                    <span>{u.created_at ? format(new Date(u.created_at), "dd/MM/yyyy", { locale: ar }) : ""}</span>
                  </div>
                </div>
                {u.id !== ADMIN_ID && (
                  <div className="flex gap-1.5 flex-shrink-0 flex-col sm:flex-row">
                    <Button
                      size="sm" variant="outline" className="gap-1 text-xs"
                      disabled={resetPassword.isPending}
                      onClick={() => { if (confirm(`إعادة تعيين كلمة مرور ${u.first_name}؟`)) resetPassword.mutate(u.id); }}
                      data-testid={`btn-reset-pwd-${u.id}`}
                      title="إعادة تعيين كلمة المرور"
                    >
                      <Lock className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm" variant={u.is_banned ? "outline" : "destructive"} className="gap-1 text-xs"
                      disabled={updateUser.isPending}
                      onClick={() => updateUser.mutate({ id: u.id, data: { isBanned: !u.is_banned } })}
                      data-testid={`btn-ban-${u.id}`}
                    >
                      {u.is_banned ? <><UserCheck className="w-3 h-3" /> رفع الحظر</> : <><BanIcon className="w-3 h-3" /> حظر</>}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {users.length === 0 && !isLoading && (
            <div className="text-center py-16 text-muted-foreground"><Users className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>لا توجد نتائج</p></div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ADS
// ═══════════════════════════════════════════════════════════════
function AdsSection({ logAction }: { logAction: any }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  const { data: ads = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/admin/ads", searchQ],
    queryFn: () => fetch(`/api/admin/ads?search=${encodeURIComponent(searchQ)}`, { credentials: "include" }).then(r => r.json()),
  });

  const updateAd = useMutation({
    mutationFn: ({ id, data }: any) =>
      fetch(`/api/admin/ads/${id}`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: (_, vars) => { refetch(); setEditId(null); setEditForm({}); toast({ title: "✅ تم تحديث الإعلان" }); logAction("update_ad", `ad#${vars.id}`, JSON.stringify(vars.data)); },
  });

  const deleteAd = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin/ads/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: (_, id) => { refetch(); toast({ title: "🗑️ تم حذف الإعلان" }); logAction("delete_ad", `ad#${id}`); },
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input placeholder="🔍 ابحث عن إعلان..." value={search} onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === "Enter" && setSearchQ(search)} className="flex-1" />
        <Button onClick={() => setSearchQ(search)}><Search className="w-4 h-4 me-1" />بحث</Button>
        {searchQ && <Button variant="outline" onClick={() => { setSearchQ(""); setSearch(""); }}><X className="w-4 h-4" /></Button>}
      </div>

      {isLoading ? <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : (
        <div className="space-y-2">
          {ads.map((ad: any) => (
            <Card key={ad.id} className="rounded-xl" data-testid={`admin-ad-${ad.id}`}>
              <CardContent className="p-4">
                {editId === ad.id ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-1"><Badge variant="outline" className="text-xs">تعديل #{ad.id}</Badge></div>
                    <Input value={editForm.title ?? ad.title} onChange={e => setEditForm((f: any) => ({ ...f, title: e.target.value }))} placeholder="العنوان" />
                    <div className="grid grid-cols-2 gap-3">
                      <Input type="number" step="0.5" value={editForm.priceEGP ?? (ad.price_egp || "")} onChange={e => setEditForm((f: any) => ({ ...f, priceEGP: e.target.value }))} placeholder="السعر (ج.م)" />
                      <Select value={editForm.status ?? ad.status} onValueChange={v => setEditForm((f: any) => ({ ...f, status: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">✅ نشط</SelectItem>
                          <SelectItem value="paused">⏸️ متوقف</SelectItem>
                          <SelectItem value="rejected">❌ مرفوض</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white" disabled={updateAd.isPending} onClick={() => updateAd.mutate({ id: ad.id, data: editForm })}>
                        {updateAd.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}&nbsp;حفظ
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setEditId(null); setEditForm({}); }}><X className="w-3 h-3" /></Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    {ad.media_url && ad.media_type === "image" && (
                      <img src={ad.media_url} alt="" className="w-14 h-14 rounded-xl object-cover bg-muted flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold truncate text-sm">{ad.title}</span>
                        <StatusBadge status={ad.status} />
                      </div>
                      <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                        <span>#{ad.id}</span>
                        {ad.price_egp && <span className="text-green-600 font-medium">{ad.price_egp} ج.م</span>}
                        <span>👁️ {ad.views_count || 0}</span>
                        <span>❤️ {ad.likes_count || 0}</span>
                        <span>{ad.created_at ? format(new Date(ad.created_at), "dd/MM/yyyy", { locale: ar }) : ""}</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <Button size="sm" variant="outline" className="text-xs" onClick={() => { setEditId(ad.id); setEditForm({ title: ad.title, priceEGP: ad.price_egp || "", status: ad.status }); }}>
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant={ad.status === "active" ? "secondary" : "default"} className="text-xs"
                        onClick={() => updateAd.mutate({ id: ad.id, data: { status: ad.status === "active" ? "paused" : "active" } })}>
                        {ad.status === "active" ? <PauseCircle className="w-3 h-3" /> : <PlayCircle className="w-3 h-3" />}
                      </Button>
                      <Button size="sm" variant="destructive" className="text-xs" onClick={() => { if (confirm("حذف الإعلان نهائياً؟")) deleteAd.mutate(ad.id); }}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {ads.length === 0 && !isLoading && (
            <div className="text-center py-16 text-muted-foreground"><Megaphone className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>لا توجد إعلانات</p></div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// REELS
// ═══════════════════════════════════════════════════════════════
function ReelsSection({ logAction }: { logAction: any }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: reels = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/admin/reels"],
    queryFn: () => fetch("/api/admin/reels", { credentials: "include" }).then(r => r.json()),
  });

  const updateReel = useMutation({
    mutationFn: ({ id, status }: any) =>
      fetch(`/api/admin/reels/${id}`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).then(r => r.json()),
    onSuccess: (_, vars) => { refetch(); toast({ title: "✅ تم تحديث الريل" }); logAction("update_reel", `reel#${vars.id}`, vars.status); },
  });

  const deleteReel = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/reels/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: (_, id) => { refetch(); toast({ title: "🗑️ تم حذف الريل" }); logAction("delete_reel", `reel#${id}`); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">إجمالي {reels.length} ريل</p>
      </div>
      {isLoading ? <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {reels.map((r: any) => (
            <Card key={r.id} className="rounded-xl overflow-hidden" data-testid={`reel-card-${r.id}`}>
              <div className="aspect-[9/16] max-h-56 relative bg-black">
                {r.video_url && (
                  <video src={r.video_url} className="w-full h-full object-cover" muted playsInline />
                )}
                <div className="absolute top-2 right-2"><StatusBadge status={r.status} /></div>
              </div>
              <CardContent className="p-3">
                <div className="font-semibold text-sm truncate mb-1">{r.title}</div>
                <div className="flex gap-3 text-xs text-muted-foreground mb-3">
                  <span>👁️ {r.views_count || 0}</span>
                  <span>❤️ {r.likes_count || 0}</span>
                  <span>💬 {r.comments_count || 0}</span>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" className="flex-1 text-xs"
                    onClick={() => updateReel.mutate({ id: r.id, status: r.status === "active" ? "hidden" : "active" })}>
                    {r.status === "active" ? "🙈 إخفاء" : "👁️ إظهار"}
                  </Button>
                  <Button size="sm" variant="destructive" className="text-xs"
                    onClick={() => { if (confirm("حذف الريل نهائياً؟")) deleteReel.mutate(r.id); }}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {reels.length === 0 && !isLoading && (
            <div className="col-span-3 text-center py-16 text-muted-foreground"><Film className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>لا توجد ريلز</p></div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CHANNELS
// ═══════════════════════════════════════════════════════════════
function ChannelsSection({ logAction }: { logAction: any }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: channels = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/channels"],
    queryFn: () => fetch("/api/admin/channels", { credentials: "include" }).then(r => r.json()),
  });

  const updateChannel = useMutation({
    mutationFn: ({ id, data }: any) =>
      fetch(`/api/admin/channels/${id}`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ["/api/admin/channels"] }); toast({ title: "✅ تم تحديث القناة" }); logAction("update_channel", `ch#${vars.id}`); },
  });

  return (
    <div className="space-y-3">
      {isLoading ? <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : channels.map((ch: any) => (
        <Card key={ch.id} className="rounded-xl" data-testid={`admin-channel-${ch.id}`}>
          <CardContent className="p-4 flex items-center gap-4">
            {ch.avatarUrl
              ? <img src={ch.avatarUrl} className="w-11 h-11 rounded-full object-cover flex-shrink-0" alt="" />
              : <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center flex-shrink-0"><Tv className="w-5 h-5 text-muted-foreground" /></div>
            }
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                <span className="font-semibold text-sm">{ch.name}</span>
                {ch.isVerified  && <span className="text-xs bg-blue-500/10 text-blue-600 border border-blue-500/20 rounded-full px-2 py-0.5">✓ موثق</span>}
                {ch.isMonetized && <span className="text-xs bg-green-500/10 text-green-600 border border-green-500/20 rounded-full px-2 py-0.5">💰 ممول</span>}
                <StatusBadge status={ch.status} />
              </div>
              <div className="text-xs text-muted-foreground">
                {ch.subscriberCount?.toLocaleString()} متابع · {Number(ch.earningsEGP || 0).toFixed(2)} ج.م أرباح
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap justify-end flex-shrink-0">
              <Button size="sm" variant="outline" className="text-xs"
                onClick={() => updateChannel.mutate({ id: ch.id, data: { isVerified: !ch.isVerified } })}>
                {ch.isVerified ? "❌ إلغاء توثيق" : "✅ توثيق"}
              </Button>
              <Button size="sm" variant="outline" className="text-xs"
                onClick={() => updateChannel.mutate({ id: ch.id, data: { isMonetized: !ch.isMonetized } })}>
                {ch.isMonetized ? "❌ إلغاء تمويل" : "💰 تمويل"}
              </Button>
              <Button size="sm" variant={ch.status === "active" ? "destructive" : "default"} className="text-xs"
                onClick={() => updateChannel.mutate({ id: ch.id, data: { status: ch.status === "active" ? "suspended" : "active" } })}>
                {ch.status === "active" ? "🚫 تعليق" : "✅ تفعيل"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      {channels.length === 0 && !isLoading && (
        <div className="text-center py-16 text-muted-foreground"><Tv className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>لا توجد قنوات</p></div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STREAMS
// ═══════════════════════════════════════════════════════════════
function StreamsSection({ logAction }: { logAction: any }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: streams = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/streams"],
    queryFn: () => fetch("/api/admin/streams", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 15000,
  });

  const updateStream = useMutation({
    mutationFn: ({ id, status }: any) =>
      fetch(`/api/admin/streams/${id}`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).then(r => r.json()),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ["/api/admin/streams"] }); toast({ title: vars.status === "ended" ? "🛑 تم إيقاف البث" : "✅ تم تحديث البث" }); logAction("update_stream", `stream#${vars.id}`, vars.status); },
  });

  const liveCount = streams.filter((s: any) => s.status === "live").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {liveCount > 0 && <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-full">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs text-red-600 font-medium">{liveCount} بث مباشر حالياً</span>
        </div>}
        <span className="text-sm text-muted-foreground">إجمالي {streams.length} بث</span>
      </div>

      {isLoading ? <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : (
        <div className="space-y-2">
          {streams.map((s: any) => (
            <Card key={s.id} className="rounded-xl" data-testid={`stream-${s.id}`}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${s.status === "live" ? "bg-red-500/10" : "bg-muted"}`}>
                  <Radio className={`w-5 h-5 ${s.status === "live" ? "text-red-500" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-sm truncate">{s.title}</span>
                    <StatusBadge status={s.status} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    👁️ {s.viewerCount || 0} مشاهد · ❤️ {s.likesCount || 0} · {s.startedAt ? format(new Date(s.startedAt), "dd/MM HH:mm", { locale: ar }) : ""}
                  </div>
                </div>
                {s.status === "live" && (
                  <Button size="sm" variant="destructive" className="text-xs flex-shrink-0"
                    onClick={() => { if (confirm("إيقاف البث المباشر نهائياً؟")) updateStream.mutate({ id: s.id, status: "ended" }); }}>
                    <VideoOff className="w-3 h-3 me-1" /> إيقاف
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
          {streams.length === 0 && !isLoading && (
            <div className="text-center py-16 text-muted-foreground"><Radio className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>لا توجد بثوث</p></div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CAMPAIGNS
// ═══════════════════════════════════════════════════════════════
function CampaignsSection({ logAction }: { logAction: any }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: campaigns = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/campaigns"],
    queryFn: () => fetch("/api/admin/campaigns", { credentials: "include" }).then(r => r.json()),
  });

  const updateCampaign = useMutation({
    mutationFn: ({ id, status }: any) =>
      fetch(`/api/admin/campaigns/${id}`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).then(r => r.json()),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ["/api/admin/campaigns"] }); toast({ title: "✅ تم تحديث الحملة" }); logAction("update_campaign", `camp#${vars.id}`, vars.status); },
  });

  const pending = campaigns.filter((c: any) => c.status === "pending");
  const others = campaigns.filter((c: any) => c.status !== "pending");

  return (
    <div className="space-y-5">
      {pending.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-yellow-600 mb-3 flex items-center gap-2"><Clock className="w-4 h-4" /> تنتظر المراجعة ({pending.length})</h3>
          <div className="space-y-2">
            {pending.map((c: any) => <CampaignCard key={c.id} c={c} updateCampaign={updateCampaign} />)}
          </div>
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">جميع الحملات ({campaigns.length})</h3>
        <div className="space-y-2">
          {others.map((c: any) => <CampaignCard key={c.id} c={c} updateCampaign={updateCampaign} />)}
        </div>
      </div>
      {campaigns.length === 0 && !isLoading && (
        <div className="text-center py-16 text-muted-foreground"><BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>لا توجد حملات</p></div>
      )}
    </div>
  );
}

function CampaignCard({ c, updateCampaign }: any) {
  const spent = Number(c.spentEGP || 0);
  const budget = Number(c.budgetEGP || 1);
  const pct = Math.min(100, (spent / budget) * 100);
  return (
    <Card className="rounded-xl" data-testid={`camp-${c.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {c.mediaUrl && <img src={c.mediaUrl} alt="" className="w-12 h-12 rounded-xl object-cover bg-muted flex-shrink-0" />}
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-semibold text-sm">{c.name}</span>
                <StatusBadge status={c.status} />
              </div>
              <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                <span>👁️ {c.impressions?.toLocaleString()}</span>
                <span>🖱️ {c.clicks?.toLocaleString()}</span>
                <span>💸 {spent.toFixed(2)} / {budget.toFixed(2)} ج.م</span>
              </div>
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden w-48">
                <div className={`h-full rounded-full ${pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-500" : "bg-primary"}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
          <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
            {c.status === "pending" && <>
              <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white text-xs" onClick={() => updateCampaign.mutate({ id: c.id, status: "active" })}><CheckCircle className="w-3 h-3 me-1" />موافقة</Button>
              <Button size="sm" variant="destructive" className="text-xs" onClick={() => updateCampaign.mutate({ id: c.id, status: "rejected" })}><XCircle className="w-3 h-3 me-1" />رفض</Button>
            </>}
            {c.status === "active"  && <Button size="sm" variant="outline" className="text-xs" onClick={() => updateCampaign.mutate({ id: c.id, status: "paused" })}>⏸️ إيقاف</Button>}
            {c.status === "paused"  && <Button size="sm" variant="outline" className="text-xs" onClick={() => updateCampaign.mutate({ id: c.id, status: "active" })}>▶️ تفعيل</Button>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// PAYMENTS
// ═══════════════════════════════════════════════════════════════
const SERVICE_TYPE_LABELS: Record<string, string> = {
  ad_boost:   "تعزيز إعلان",
  campaign:   "حملة إعلانية",
  renewal:    "تجديد إعلان",
  ai_image:   "ذكاء اصطناعي: صورة",
  ai_video:   "ذكاء اصطناعي: فيديو",
  ai_content: "ذكاء اصطناعي: محتوى",
  ai_credits: "شحن رصيد ذكاء",
  withdrawal: "سحب أرباح",
  other:      "أخرى",
};

function PaymentsSection({ logAction }: { logAction: any }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: payments = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/payments"],
    queryFn: () => fetch("/api/admin/payments", { credentials: "include" }).then(r => r.json()),
  });

  const updatePayment = useMutation({
    mutationFn: ({ id, status }: any) =>
      fetch(`/api/admin/payments/${id}`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).then(r => r.json()),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ["/api/admin/payments"] }); toast({ title: vars.status === "approved" ? "✅ تمت الموافقة" : "❌ تم الرفض" }); logAction("update_payment", `pay#${vars.id}`, vars.status); },
  });

  const pending = payments.filter((p: any) => p.status === "pending");
  const done = payments.filter((p: any) => p.status !== "pending");

  const methodLabel: Record<string, string> = { vodafone: "فودافون كاش", etisalat: "اتصالات كاش", instapay: "إنستاباي", souq: "محفظة سوق" };

  return (
    <div className="space-y-5">
      {pending.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-yellow-600 mb-3 flex items-center gap-2"><Clock className="w-4 h-4" /> معلقة ({pending.length})</h3>
          <div className="space-y-2">
            {pending.map((p: any) => (
              <Card key={p.id} className="rounded-xl border-yellow-500/20" data-testid={`payment-${p.id}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-bold text-lg text-green-600">{p.amountEGP} ج.م</span>
                        <StatusBadge status={p.status} />
                        <span className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{p.type === 'top_up' ? '💰 شحن' : '🏧 سحب'}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {methodLabel[p.method] || p.method} · {p.phoneNumber} · {p.createdAt ? format(new Date(p.createdAt), "dd MMM yyyy", { locale: ar }) : ""}
                      </div>
                      {p.serviceType && (
                        <span className="inline-block mt-1 text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                          🎯 {SERVICE_TYPE_LABELS[p.serviceType] || p.serviceType}
                        </span>
                      )}
                      <div className="text-xs text-muted-foreground opacity-60 mt-0.5">ORD: {p.orderNumber || p.id} · ID: {p.userId}</div>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white text-xs" onClick={() => updatePayment.mutate({ id: p.id, status: "approved" })}><CheckCircle className="w-3 h-3 me-1" />موافقة</Button>
                      <Button size="sm" variant="destructive" className="text-xs" onClick={() => updatePayment.mutate({ id: p.id, status: "rejected" })}><XCircle className="w-3 h-3 me-1" />رفض</Button>
                    </div>
                  </div>
                  {p.screenshotUrl && (
                    <a href={p.screenshotUrl} target="_blank" rel="noopener noreferrer" className="block">
                      <img
                        src={p.screenshotUrl}
                        alt="إيصال الدفع"
                        className="w-full max-h-52 object-contain rounded-xl border bg-muted/20 cursor-zoom-in hover:opacity-90 transition-opacity"
                        data-testid={`screenshot-payment-${p.id}`}
                      />
                      <p className="text-[10px] text-primary mt-1 text-center">📎 صورة إيصال الدفع — اضغط للتكبير</p>
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">سجل الطلبات ({done.length})</h3>
        <div className="space-y-2">
          {done.map((p: any) => (
            <Card key={p.id} className="rounded-xl opacity-80">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{p.amountEGP} ج.م</span>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="text-xs text-muted-foreground">{methodLabel[p.method] || p.method} · {p.phoneNumber}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      {payments.length === 0 && !isLoading && (
        <div className="text-center py-16 text-muted-foreground"><Banknote className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>لا توجد طلبات</p></div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════════
function ReportsSection({ logAction }: { logAction: any }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: reports = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/reports"],
    queryFn: () => fetch("/api/admin/reports", { credentials: "include" }).then(r => r.json()),
  });

  const updateReport = useMutation({
    mutationFn: ({ id, status }: any) =>
      fetch(`/api/admin/reports/${id}`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).then(r => r.json()),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ["/api/admin/reports"] }); toast({ title: "✅ تم تحديث البلاغ" }); logAction("update_report", `report#${vars.id}`, vars.status); },
  });

  const pending = reports.filter((r: any) => r.status === "pending");
  const done = reports.filter((r: any) => r.status !== "pending");

  const targetTypeLabel: Record<string, string> = { ad: "إعلان", stream: "بث", channel: "قناة", user: "مستخدم", comment: "تعليق", reel: "ريل" };

  return (
    <div className="space-y-5">
      {pending.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-yellow-600 mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> معلقة ({pending.length})</h3>
          <div className="space-y-2">
            {pending.map((r: any) => (
              <Card key={r.id} className="rounded-xl border-yellow-500/20" data-testid={`report-${r.id}`}>
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                    <Flag className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-sm">{targetTypeLabel[r.targetType] || r.targetType} #{r.targetId}</span>
                      <StatusBadge status={r.status} />
                    </div>
                    <p className="text-sm">{r.reason}</p>
                    <p className="text-xs text-muted-foreground mt-1">{r.createdAt ? format(new Date(r.createdAt), "dd MMM yyyy HH:mm", { locale: ar }) : ""}</p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white text-xs" onClick={() => updateReport.mutate({ id: r.id, status: "resolved" })}><CheckCircle className="w-3 h-3 me-1" />حل</Button>
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => updateReport.mutate({ id: r.id, status: "dismissed" })}><XCircle className="w-3 h-3 me-1" />رفض</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">سجل البلاغات ({done.length})</h3>
        <div className="space-y-2">
          {done.map((r: any) => (
            <Card key={r.id} className="rounded-xl opacity-70">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{targetTypeLabel[r.targetType] || r.targetType} #{r.targetId}</span>
                  <span className="text-xs text-muted-foreground mx-2">—</span>
                  <span className="text-xs text-muted-foreground truncate">{r.reason}</span>
                </div>
                <StatusBadge status={r.status} />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      {reports.length === 0 && !isLoading && (
        <div className="text-center py-16 text-muted-foreground"><Flag className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>لا توجد بلاغات</p></div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAUD
// ═══════════════════════════════════════════════════════════════
function FraudSection() {
  const { data: fraudStats } = useQuery<any>({
    queryKey: ["/api/admin/fraud-stats"],
    queryFn: () => fetch("/api/admin/fraud-stats", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30000,
  });
  const { data: alerts = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/fraud-alerts"],
    queryFn: () => fetch("/api/admin/fraud-alerts", { credentials: "include" }).then(r => r.json()),
  });

  return (
    <div className="space-y-6">
      {fraudStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={ShieldX}     label="نقرات وهمية"    value={Number(fraudStats.fraud_clicks || 0).toLocaleString()}      color="text-red-500" />
          <StatCard icon={AlertTriangle} label="مشاهدات وهمية" value={Number(fraudStats.fraud_impressions || 0).toLocaleString()} color="text-orange-500" />
          <StatCard icon={ShieldX}     label="إجمالي الاحتيال" value={Number(fraudStats.total_fraud || 0).toLocaleString()}       color="text-red-700" />
          <StatCard icon={CheckCircle} label="تفاعل حقيقي"    value={Number(fraudStats.total_legit || 0).toLocaleString()}       color="text-green-500" />
        </div>
      )}

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldX className="w-5 h-5 text-red-500" /> سجل التنبيهات (آخر 200)</CardTitle></CardHeader>
        <CardContent>
          {alerts.length === 0
            ? <div className="text-center py-10 text-muted-foreground text-sm">لا توجد تنبيهات احتيال ✅</div>
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-muted-foreground text-right">
                    <th className="pb-2 font-medium">الحملة</th>
                    <th className="pb-2 font-medium">IP</th>
                    <th className="pb-2 font-medium">النوع</th>
                    <th className="pb-2 font-medium">التفاصيل</th>
                    <th className="pb-2 font-medium">الوقت</th>
                  </tr></thead>
                  <tbody>
                    {alerts.map((a: any) => (
                      <tr key={a.id} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="py-2 font-medium">{a.campaign_name || `#${a.campaign_id}`}</td>
                        <td className="py-2 font-mono text-xs text-muted-foreground">{a.ip_address}</td>
                        <td className="py-2"><StatusBadge status={a.alert_type === "click" ? "active" : "paused"} /></td>
                        <td className="py-2 text-xs text-muted-foreground max-w-[200px] truncate">{a.details}</td>
                        <td className="py-2 text-xs text-muted-foreground">{a.created_at ? format(new Date(a.created_at), "dd/MM HH:mm", { locale: ar }) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// REVENUE
// ═══════════════════════════════════════════════════════════════
function RevenueSection() {
  const { data: rev } = useQuery<any>({
    queryKey: ["/api/admin/revenue"],
    queryFn: () => fetch("/api/admin/revenue", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30000,
  });

  if (!rev) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Banknote}   label="إجمالي الإنفاق الإعلاني" value={`${rev.summary.totalSpentEGP.toFixed(2)} ج.م`}     color="text-blue-500" />
        <StatCard icon={DollarSign} label="دخل المنصة (40%)"         value={`${rev.summary.platformRevenueEGP.toFixed(2)} ج.م`} color="text-emerald-500" />
        <StatCard icon={TrendingUp} label="أرباح الناشرين (60%)"      value={`${rev.summary.publishersRevenueEGP.toFixed(2)} ج.م`} color="text-green-500" />
        <StatCard icon={PieChart}   label="الميزانية الإجمالية"       value={`${rev.summary.totalBudgetEGP.toFixed(2)} ج.م`}     color="text-purple-500" />
        <StatCard icon={Eye}        label="مشاهدات حقيقية"            value={rev.summary.totalImpressions.toLocaleString()}       color="text-teal-500" />
        <StatCard icon={BarChart2}  label="نقرات حقيقية"              value={rev.summary.totalClicks.toLocaleString()}            color="text-indigo-500" />
        <StatCard icon={ShieldX}    label="محاولات احتيال"            value={rev.summary.fraudTotal.toLocaleString()}             color="text-red-500" />
        <StatCard icon={Megaphone}  label="الحملات الكلية"            value={rev.summary.totalCampaigns}                          color="text-orange-500" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Tv className="w-4 h-4 text-green-500" /> أعلى القنوات ربحاً</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(rev.channelRevenue || []).filter((c: any) => Number(c.earnings_egp) > 0).slice(0, 10).map((ch: any, i: number) => (
                <div key={ch.id} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/40">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-5 text-center font-bold">{i + 1}</span>
                    <div>
                      <div className="text-sm font-medium">{ch.name}</div>
                      <div className="text-xs text-muted-foreground">{Number(ch.impression_count || 0).toLocaleString()} مشاهدة</div>
                    </div>
                  </div>
                  <div className="text-green-600 font-bold text-sm">{Number(ch.earnings_egp || 0).toFixed(2)} ج.م</div>
                </div>
              ))}
              {(rev.channelRevenue || []).filter((c: any) => Number(c.earnings_egp) > 0).length === 0 && (
                <p className="text-center py-6 text-muted-foreground text-sm">لا توجد أرباح بعد</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Megaphone className="w-4 h-4 text-blue-500" /> أكبر المعلنين إنفاقاً</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(rev.advertiserSpend || []).filter((a: any) => Number(a.total_spent) > 0).slice(0, 10).map((adv: any, i: number) => (
                <div key={adv.advertiser_id} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/40">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-5 text-center font-bold">{i + 1}</span>
                    <div>
                      <div className="text-xs font-mono text-muted-foreground truncate max-w-[130px]">{adv.advertiser_id}</div>
                      <div className="text-xs text-muted-foreground">{Number(adv.campaign_count || 0)} حملة</div>
                    </div>
                  </div>
                  <div className="text-blue-600 font-bold text-sm">{Number(adv.total_spent || 0).toFixed(2)} ج.م</div>
                </div>
              ))}
              {(rev.advertiserSpend || []).filter((a: any) => Number(a.total_spent) > 0).length === 0 && (
                <p className="text-center py-6 text-muted-foreground text-sm">لا توجد بيانات بعد</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-sm">آخر 50 معاملة مالية</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {(rev.recentTransactions || []).map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-muted/40 text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center ${tx.type === "earning" ? "bg-green-500/10" : "bg-red-500/10"}`}>
                    {tx.type === "earning" ? <ArrowUpRight className="w-3.5 h-3.5 text-green-500" /> : <ArrowDownLeft className="w-3.5 h-3.5 text-red-500" />}
                  </div>
                  <div>
                    <div className="font-medium text-xs">{tx.description}</div>
                    <div className="text-[10px] text-muted-foreground">{tx.created_at ? format(new Date(tx.created_at), "dd/MM/yy HH:mm", { locale: ar }) : ""}</div>
                  </div>
                </div>
                <div className={`font-bold text-xs ${tx.type === "earning" ? "text-green-600" : "text-red-500"}`}>
                  {tx.type === "earning" ? "+" : "-"}{Number(tx.amount_egp || 0).toFixed(3)} ج.م
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// BROADCAST
// ═══════════════════════════════════════════════════════════════
function BroadcastSection({ logAction }: { logAction: any }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ title: "", body: "", link: "" });
  const [sent, setSent] = useState<{ count: number } | null>(null);

  const broadcast = useMutation({
    mutationFn: (data: any) =>
      fetch("/api/admin/notifications/broadcast", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: (res) => {
      setSent(res);
      setForm({ title: "", body: "", link: "" });
      toast({ title: `✅ تم إرسال الإشعار لـ ${res.sent} مستخدم` });
      logAction("broadcast_notification", "all_users", form.title);
    },
    onError: () => toast({ title: "❌ فشل الإرسال", variant: "destructive" }),
  });

  return (
    <div className="max-w-2xl space-y-5">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Bell className="w-5 h-5 text-cyan-500" /> إرسال إشعار جماعي</CardTitle>
          <p className="text-sm text-muted-foreground">يُرسَل الإشعار لجميع المستخدمين المسجلين في المنصة</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">عنوان الإشعار *</label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="مثال: تحديث جديد متاح الآن!" data-testid="input-broadcast-title" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">نص الإشعار *</label>
            <Textarea rows={4} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="اكتب تفاصيل الإشعار هنا..." data-testid="input-broadcast-body" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">رابط (اختياري)</label>
            <Input value={form.link} onChange={e => setForm(f => ({ ...f, link: e.target.value }))} placeholder="/channels أو /ads" data-testid="input-broadcast-link" />
          </div>
          <Button
            className="gap-2 w-full" disabled={!form.title.trim() || !form.body.trim() || broadcast.isPending}
            onClick={() => broadcast.mutate(form)} data-testid="btn-broadcast-send"
          >
            {broadcast.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            إرسال الإشعار لجميع المستخدمين
          </Button>

          {sent && (
            <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <p className="text-sm text-green-700">تم إرسال الإشعار بنجاح لـ <strong>{sent.count}</strong> مستخدم</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════
function SettingsSection({ logAction }: { logAction: any }) {
  const { toast } = useToast();
  const [form, setForm] = useState<Record<string, string>>({});

  const { data: settings, refetch } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
    queryFn: () => fetch("/api/settings").then(r => r.json()),
  });

  const save = useMutation({
    mutationFn: (data: Record<string, string>) =>
      fetch("/api/settings/bulk", { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { refetch(); setForm({}); toast({ title: "✅ تم حفظ الإعدادات" }); logAction("update_settings", "platform_settings", JSON.stringify(Object.keys(form))); },
  });

  const get = (key: string, def: string) => form[key] !== undefined ? form[key] : (settings?.[key] ?? def);
  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const toggleFeature = async (key: string, current: string) => {
    const newVal = current === "1" ? "0" : "1";
    await fetch("/api/settings/bulk", {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: newVal }),
    });
    refetch();
    logAction("toggle_feature", key, newVal === "1" ? "تفعيل" : "إيقاف");
    toast({ title: newVal === "1" ? `✅ تم تفعيل الخاصية` : `⏸️ تم إيقاف الخاصية` });
  };

  const features = [
    { key: "feature_reels",         label: "ريلز",            desc: "السماح برفع ومشاهدة الريلز",           icon: Film },
    { key: "feature_livestream",    label: "البث المباشر",    desc: "السماح بإنشاء وعرض البث المباشر",       icon: Radio },
    { key: "feature_channels",      label: "القنوات",          desc: "السماح بإنشاء قنوات جديدة",             icon: Tv },
    { key: "feature_ai",            label: "الذكاء الاصطناعي", desc: "خدمة توليد المحتوى بالذكاء الاصطناعي", icon: ShieldAlert },
    { key: "feature_messages",      label: "الرسائل",          desc: "الرسائل المباشرة بين المستخدمين",       icon: MessageSquare },
    { key: "feature_registration",  label: "التسجيل",         desc: "السماح بإنشاء حسابات جديدة",            icon: UserCheck },
    { key: "feature_ads",           label: "الإعلانات",        desc: "عرض ونشر الإعلانات على المنصة",        icon: Megaphone },
    { key: "feature_campaigns",     label: "الحملات الإعلانية", desc: "إنشاء وتشغيل الحملات المدفوعة",      icon: BarChart2 },
    { key: "boost_enabled",         label: "تعزيز الإعلانات 🚀", desc: "السماح لأصحاب الإعلانات بتعزيز إعلاناتهم (مرة كل 30 يوم)", icon: Zap },
  ];

  const numFields = [
    { key: "cpm_rate_egp",            label: "سعر الألف مشاهدة (CPM)",       suffix: "ج.م",         default: "15",   group: "الأسعار" },
    { key: "publisher_rev_share",     label: "نسبة الناشر من الإعلانات",    suffix: "مثال: 0.60",  default: "0.60", group: "الأسعار" },
    { key: "boost_price_egp",         label: "سعر تعزيز الإعلان 🚀",         suffix: "ج.م (0 = مجاني)", default: "0", group: "الأسعار" },
    { key: "min_withdrawal_egp",      label: "الحد الأدنى للسحب",            suffix: "ج.م",         default: "50",   group: "المحفظة" },
    { key: "ai_free_credits",         label: "رصيد AI المجاني (يوزر جديد)",  suffix: "رصيد",        default: "3",    group: "الذكاء الاصطناعي" },
    { key: "ai_price_per_credit_egp", label: "سعر رصيد AI الإضافي",          suffix: "ج.م/رصيد",   default: "5",    group: "الذكاء الاصطناعي" },
  ];

  const groups = [...new Set(numFields.map(f => f.group))];

  return (
    <div className="max-w-2xl space-y-6">

      {/* ── Feature Toggles ── */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <ToggleRight className="w-4 h-4 text-primary" />
            تفعيل / إيقاف الخصائص
          </CardTitle>
          <p className="text-xs text-muted-foreground">التغييرات تؤثر فوراً على جميع المستخدمين</p>
        </CardHeader>
        <CardContent className="space-y-2">
          {features.map(({ key, label, desc, icon: Icon }) => {
            const isOn = get(key, "1") === "1";
            return (
              <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isOn ? "bg-green-500/15" : "bg-gray-500/15"}`}>
                    <Icon className={`w-4 h-4 ${isOn ? "text-green-500" : "text-gray-400"}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleFeature(key, get(key, "1"))}
                  className="flex items-center gap-1.5 text-xs font-medium transition-colors"
                  data-testid={`toggle-${key}`}
                >
                  {isOn ? (
                    <><ToggleRight className="w-8 h-8 text-green-500" /><span className="text-green-600">مفعّل</span></>
                  ) : (
                    <><ToggleLeft className="w-8 h-8 text-gray-400" /><span className="text-gray-500">موقوف</span></>
                  )}
                </button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ── Numeric Settings ── */}
      {groups.map(group => (
        <Card key={group} className="rounded-2xl">
          <CardHeader><CardTitle className="text-sm">{group}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {numFields.filter(f => f.group === group).map(field => (
              <div key={field.key}>
                <label className="text-sm font-medium mb-1 block">{field.label}</label>
                <div className="flex gap-2">
                  <Input
                    type="number" step="0.01"
                    value={get(field.key, field.default)}
                    onChange={e => set(field.key, e.target.value)}
                    placeholder={field.default}
                    data-testid={`setting-${field.key}`}
                  />
                  <span className="text-xs text-muted-foreground self-center whitespace-nowrap min-w-fit">{field.suffix}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <Button
        className="w-full gap-2" disabled={Object.keys(form).length === 0 || save.isPending}
        onClick={() => save.mutate(form)} data-testid="btn-save-settings"
      >
        {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        حفظ الإعدادات
      </Button>
      <p className="text-xs text-muted-foreground text-center">تغيير سعر CPM يؤثر على الحملات الجديدة فقط</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MEDIA LIBRARY
// ═══════════════════════════════════════════════════════════════
function MediaSection({ logAction }: { logAction: any }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [searchQ, setSearchQ] = useState("");

  const { data: files = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/admin/files", searchQ],
    queryFn: () => fetch("/api/admin/files", { credentials: "include" }).then(r => r.json()),
  });

  const deleteFile = useMutation({
    mutationFn: (id: number) => fetch(`/api/files/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: (_, id) => { refetch(); toast({ title: "🗑️ تم حذف الملف" }); logAction("delete_file", `file#${id}`); },
    onError: () => toast({ title: "❌ فشل الحذف", variant: "destructive" }),
  });

  const filtered = files.filter(f =>
    !searchQ || f.original_name?.toLowerCase().includes(searchQ.toLowerCase()) ||
    f.first_name?.toLowerCase().includes(searchQ.toLowerCase()) ||
    f.email?.toLowerCase().includes(searchQ.toLowerCase())
  );

  const totalSize = files.reduce((s, f) => s + Number(f.file_size || 0), 0);
  const images = files.filter(f => f.mime_type?.startsWith("image/")).length;
  const videos = files.filter(f => f.mime_type?.startsWith("video/")).length;

  function FileIcon({ mime }: { mime: string }) {
    if (mime?.startsWith("image/")) return <FileImage className="w-5 h-5 text-blue-400" />;
    if (mime?.startsWith("video/")) return <FileVideo className="w-5 h-5 text-pink-400" />;
    return <File className="w-5 h-5 text-gray-400" />;
  }

  function formatBytes(b: number) {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={FolderOpen}  label="إجمالي الملفات"  value={files.length}                color="text-lime-500" />
        <StatCard icon={FileImage}   label="صور"             value={images}                      color="text-blue-500" />
        <StatCard icon={FileVideo}   label="فيديوهات"        value={videos}                      color="text-pink-500" />
        <StatCard icon={File}        label="الحجم الكلي"     value={formatBytes(totalSize)}      color="text-orange-500" />
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <Input placeholder="🔍 ابحث باسم الملف أو المستخدم..." value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === "Enter" && setSearchQ(search)} className="flex-1" />
        <Button onClick={() => setSearchQ(search)}><Search className="w-4 h-4 me-1" />بحث</Button>
        {searchQ && <Button variant="outline" onClick={() => { setSearchQ(""); setSearch(""); }}><X className="w-4 h-4" /></Button>}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map((f: any) => (
            <Card key={f.id} className="rounded-xl" data-testid={`file-${f.id}`}>
              <CardContent className="p-3 flex items-center gap-3">
                {/* Preview */}
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {f.mime_type?.startsWith("image/")
                    ? <img src={f.url} alt="" className="w-full h-full object-cover rounded-lg" />
                    : <FileIcon mime={f.mime_type} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{f.original_name || f.filename}</div>
                  <div className="flex gap-3 text-xs text-muted-foreground flex-wrap mt-0.5">
                    <span>{formatBytes(Number(f.file_size || 0))}</span>
                    <span>{f.mime_type}</span>
                    {(f.first_name || f.email) && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {f.first_name ? `${f.first_name}` : f.email}
                      </span>
                    )}
                    <span>{f.created_at ? format(new Date(f.created_at), "dd/MM/yy HH:mm", { locale: ar }) : ""}</span>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <a href={f.url} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline" className="text-xs"><Eye className="w-3 h-3 me-1" />عرض</Button>
                  </a>
                  <Button size="sm" variant="destructive" className="text-xs"
                    disabled={deleteFile.isPending}
                    onClick={() => { if (confirm("حذف الملف نهائياً؟")) deleteFile.mutate(f.id); }}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && !isLoading && (
            <div className="text-center py-16 text-muted-foreground">
              <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>لا توجد ملفات</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ACTIVITY LOG
// ═══════════════════════════════════════════════════════════════
function ActivitySection() {
  const { data: log = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/activity-log"],
    queryFn: () => fetch("/api/admin/activity-log", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30000,
  });

  const actionLabel: Record<string, string> = {
    update_user: "تحديث مستخدم", delete_ad: "حذف إعلان", update_ad: "تحديث إعلان",
    delete_reel: "حذف ريل", update_reel: "تحديث ريل", update_channel: "تحديث قناة",
    update_campaign: "تحديث حملة", update_payment: "تحديث سحب", update_report: "تحديث بلاغ",
    broadcast_notification: "إشعار جماعي", update_settings: "تعديل الإعدادات", update_stream: "تحديث بث",
  };

  const actionColor: Record<string, string> = {
    delete_ad: "text-red-500", delete_reel: "text-red-500", broadcast_notification: "text-cyan-500",
    update_settings: "text-yellow-500",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="w-5 h-5 text-muted-foreground" />
        <h3 className="font-semibold">سجل نشاط الأدمن</h3>
        <Badge variant="secondary" className="text-xs">{log.length} إجراء</Badge>
      </div>

      {isLoading ? <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : (
        <Card className="rounded-2xl">
          <CardContent className="p-0">
            {log.length === 0
              ? <div className="text-center py-16 text-muted-foreground"><Activity className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>لا يوجد نشاط بعد</p></div>
              : (
                <div className="divide-y divide-border">
                  {log.map((entry: any, i: number) => (
                    <div key={entry.id || i} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Activity className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-medium ${actionColor[entry.action] || "text-foreground"}`}>
                            {actionLabel[entry.action] || entry.action}
                          </span>
                          {entry.target && <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{entry.target}</span>}
                        </div>
                        {entry.details && <p className="text-xs text-muted-foreground truncate max-w-xs">{entry.details}</p>}
                      </div>
                      <div className="text-xs text-muted-foreground flex-shrink-0">
                        {entry.created_at ? format(new Date(entry.created_at), "dd/MM HH:mm", { locale: ar }) : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── 🚀 Boost Orders Section ──────────────────────────────────────
function BoostOrdersSection({ logAction }: { logAction: any }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: orders = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/boost/orders"],
    queryFn: () => fetch("/api/boost/orders", { credentials: "include" }).then(r => r.json()),
  });

  const updateOrder = async (id: number, status: string) => {
    const res = await fetch(`/api/boost/orders/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      qc.invalidateQueries({ queryKey: ["/api/boost/orders"] });
      toast({ title: status === "confirmed" ? "✅ تم تأكيد التعزيز وبدأ الوصول!" : "❌ تم رفض الطلب" });
      logAction(status === "confirmed" ? "boost_confirm" : "boost_reject", `order_${id}`, "");
    } else {
      toast({ variant: "destructive", title: "فشل تحديث الطلب" });
    }
  };

  const pending = orders.filter((o: any) => o.status === "pending");
  const done    = orders.filter((o: any) => o.status !== "pending");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-5 h-5 text-orange-500" />
        <h2 className="font-bold text-lg">طلبات التعزيز المدفوع</h2>
        {pending.length > 0 && (
          <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pending.length} معلق</span>
        )}
      </div>

      {isLoading && <div className="text-center py-12 text-muted-foreground">جارٍ التحميل...</div>}

      {!isLoading && pending.length === 0 && done.length === 0 && (
        <Card className="rounded-2xl border border-border/50">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
            لا يوجد طلبات تعزيز حتى الآن
          </CardContent>
        </Card>
      )}

      {pending.length > 0 && (
        <Card className="rounded-2xl border border-orange-200 dark:border-orange-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-orange-600">🕐 طلبات قيد المراجعة ({pending.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.map((o: any) => (
              <div key={o.id} className="p-3 rounded-xl bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 space-y-2">
                {/* Row 1: order info */}
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-orange-700 dark:text-orange-400" data-testid={`text-order-number-${o.id}`}>{o.order_number}</span>
                      <span className="text-xs text-muted-foreground">إعلان #{o.ad_id}</span>
                      <span className="text-xs font-bold text-green-600">{o.amount} ج.م</span>
                      {o.payment_method && (
                        <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full font-bold">{o.payment_method}</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {o.first_name} {o.last_name} — مرجع: <span className="font-mono font-bold">{o.payment_ref}</span>
                    </div>
                    {o.ad_title && <div className="text-xs text-muted-foreground">"{o.ad_title}"</div>}
                    <div className="text-xs text-muted-foreground">{o.created_at ? format(new Date(o.created_at), "dd/MM HH:mm", { locale: ar }) : ""}</div>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => updateOrder(o.id, "confirmed")}
                      className="px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-bold transition-all flex items-center gap-1"
                      data-testid={`btn-confirm-boost-${o.id}`}
                    >
                      <CheckCircle className="w-3 h-3" /> تأكيد ✓
                    </button>
                    <button
                      onClick={() => updateOrder(o.id, "rejected")}
                      className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all flex items-center gap-1"
                      data-testid={`btn-reject-boost-${o.id}`}
                    >
                      <XCircle className="w-3 h-3" /> رفض ✗
                    </button>
                  </div>
                </div>
                {/* Row 2: receipt screenshot */}
                {o.payment_screenshot_url && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 font-semibold">📸 صورة الإيصال:</p>
                    <a href={o.payment_screenshot_url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={o.payment_screenshot_url}
                        alt="إيصال الدفع"
                        className="w-full max-h-48 object-contain rounded-lg border border-orange-200 dark:border-orange-800 cursor-pointer hover:opacity-90 transition-opacity"
                        data-testid={`img-boost-receipt-${o.id}`}
                      />
                    </a>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {done.length > 0 && (
        <Card className="rounded-2xl border border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-muted-foreground">سجل الطلبات المكتملة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {done.slice(0, 30).map((o: any) => (
              <div key={o.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30 border border-border/40">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs">{o.order_number}</span>
                    <span className="text-xs text-muted-foreground">إعلان #{o.ad_id}</span>
                    <span className="font-bold text-xs">{o.amount} ج.م</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{o.first_name} {o.last_name} — {o.payment_ref}</div>
                </div>
                <StatusBadge status={o.status === "confirmed" ? "approved" : o.status === "rejected" ? "rejected" : "pending"} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// PAY RECEIPTS SECTION — جدول إيصالات الدفع
// ══════════════════════════════════════════════════════════════
function PayReceiptsSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [zoom, setZoom] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const { data: receipts = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/payment-receipts"],
    queryFn: () => fetch("/api/admin/payment-receipts").then(r => r.json()).then(d => Array.isArray(d) ? d : []),
    refetchInterval: 30000,
  });

  const handleConfirm = async (id: number, sourceType: string) => {
    setConfirming(id);
    try {
      let r: Response;
      if (sourceType === "pn") {
        r = await fetch(`/api/payment-notifications/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "confirmed" }),
        });
      } else {
        r = await fetch(`/api/messages/${id}/confirm-payment`, { method: "POST" });
      }
      if (!r.ok) throw new Error("فشل التأكيد");
      toast({ title: "✅ تم تأكيد الدفع بنجاح", description: "تم إرسال إشعار للمستخدم" });
      qc.invalidateQueries({ queryKey: ["/api/admin/payment-receipts"] });
    } catch {
      toast({ title: "خطأ", description: "فشل تأكيد الدفع", variant: "destructive" });
    } finally {
      setConfirming(null);
    }
  };

  const filtered = receipts.filter((r: any) => {
    if (!search) return true;
    const name = `${r.first_name || ""} ${r.last_name || ""} ${r.payer_name || ""} ${r.payer_phone || ""} ${r.username || ""} ${r.phone_number || ""} ${r.email || ""}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const pending = receipts.filter((r: any) => !r.is_read).length;

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">إيصالات الدفع 💳</h2>
          <p className="text-sm text-muted-foreground">لقطات الشاشة والإيصالات المرسلة من المستخدمين</p>
        </div>
        <div className="flex items-center gap-3">
          {pending > 0 && (
            <Badge className="bg-orange-500 text-white text-sm px-3 py-1">
              {pending} في الانتظار
            </Badge>
          )}
          <Badge variant="outline" className="text-sm px-3 py-1">
            الإجمالي: {receipts.length}
          </Badge>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="rounded-2xl border border-border/50 bg-orange-500/10">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-400">{pending}</div>
            <div className="text-xs text-muted-foreground mt-1">في الانتظار</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-border/50 bg-green-500/10">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-400">{receipts.filter((r: any) => r.is_read).length}</div>
            <div className="text-xs text-muted-foreground mt-1">تم التأكيد</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-border/50 bg-blue-500/10">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-400">{receipts.length}</div>
            <div className="text-xs text-muted-foreground mt-1">إجمالي الإيصالات</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="بحث باسم أو موبايل أو إيميل..."
          className="pr-10 rounded-xl"
          data-testid="input-search-receipts"
        />
      </div>

      {/* Receipts list */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-400" /></div>
      ) : filtered.length === 0 ? (
        <Card className="rounded-2xl border border-dashed border-border/50">
          <CardContent className="py-16 text-center text-muted-foreground">
            <Banknote className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>لا توجد إيصالات دفع بعد</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r: any) => (
            <Card
              key={`${r.source_type || "dm"}-${r.id}`}
              className={`rounded-2xl border transition-all ${
                !r.is_read
                  ? "border-orange-500/60 bg-orange-500/5 shadow-md"
                  : "border-border/40 bg-muted/20"
              }`}
              data-testid={`card-receipt-${r.source_type || "dm"}-${r.id}`}
            >
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  {/* Screenshot thumbnail */}
                  {r.image_url && (
                    <div
                      className="flex-shrink-0 cursor-zoom-in"
                      onClick={() => setZoom(r.image_url)}
                      data-testid={`img-receipt-${r.id}`}
                    >
                      <img
                        src={r.image_url}
                        alt="إيصال دفع"
                        className="w-24 h-24 md:w-32 md:h-32 object-cover rounded-xl border border-border/50 hover:opacity-80 transition-opacity"
                      />
                      <p className="text-xs text-center text-muted-foreground mt-1">اضغط للتكبير</p>
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* User info */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm">
                        {r.source_type === "pn"
                          ? (r.payer_name || (r.first_name ? `${r.first_name} ${r.last_name || ""}` : "—"))
                          : `${r.first_name || ""} ${r.last_name || ""}`}
                      </span>
                      {r.source_type === "pn" && r.payment_method && (
                        <Badge variant="outline" className="text-xs border-blue-400 text-blue-600">{r.payment_method}</Badge>
                      )}
                      {r.source_type === "pn" && r.paid_amount && (
                        <Badge className="bg-green-600/10 text-green-700 text-xs border border-green-400">
                          {Number(r.paid_amount).toLocaleString("ar-EG")} ج.م
                        </Badge>
                      )}
                      {r.source_type === "pn" && (
                        <Badge variant="outline" className="text-xs border-purple-400 text-purple-600">من الإعلان</Badge>
                      )}
                      {!r.is_read && (
                        <Badge className="bg-orange-500 text-white text-xs">قيد المراجعة ⏳</Badge>
                      )}
                      {r.is_read && (
                        <Badge className="bg-green-600 text-white text-xs">✅ تم التأكيد</Badge>
                      )}
                    </div>

                    {/* Contact */}
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {(r.source_type === "pn" ? r.payer_phone : r.phone) && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {r.source_type === "pn" ? r.payer_phone : r.phone}
                        </span>
                      )}
                      {r.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {r.email}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {r.created_at ? format(new Date(r.created_at), "dd MMM yyyy - HH:mm", { locale: ar }) : "—"}
                      </span>
                    </div>

                    {/* Message preview */}
                    {r.message && r.message !== "📸 إيصال دفع" && (
                      <p className="text-xs bg-muted/40 rounded-lg px-3 py-2 border border-border/30 line-clamp-2">
                        {r.message}
                      </p>
                    )}

                    {/* User ID */}
                    {r.from_user_id && (
                      <p className="text-xs text-muted-foreground font-mono">ID: {r.from_user_id}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 justify-start md:items-end">
                    {!r.is_read && (
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white text-xs rounded-xl"
                        onClick={() => handleConfirm(r.id, r.source_type || "dm")}
                        disabled={confirming === r.id}
                        data-testid={`btn-confirm-receipt-${r.id}`}
                      >
                        {confirming === r.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <CheckCircle className="w-3 h-3" />
                        )}
                        تأكيد الدفع ✓
                      </Button>
                    )}
                    {r.image_url && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs rounded-xl"
                        onClick={() => setZoom(r.image_url)}
                        data-testid={`btn-zoom-receipt-${r.id}`}
                      >
                        <Eye className="w-3 h-3" /> عرض الصورة
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Zoom lightbox */}
      {zoom && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setZoom(null)}
        >
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <button
              className="absolute -top-10 left-0 text-white text-sm flex items-center gap-2 hover:text-gray-300"
              onClick={() => setZoom(null)}
            >
              <X className="w-4 h-4" /> إغلاق
            </button>
            <img
              src={zoom}
              alt="إيصال دفع — عرض كامل"
              className="w-full max-h-[80vh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// PRICING MANAGEMENT SECTION
// ══════════════════════════════════════════════════════════
function PricingSection() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: settings, isLoading } = useQuery<Record<string, string>>({
    queryKey: ["/api/admin/pricing"],
    queryFn: () => fetch("/api/admin/pricing", { credentials: "include" }).then(r => r.json()).then(d => typeof d === 'object' && !Array.isArray(d) ? d : {}),
  });

  const [vals, setVals] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settings) setVals(settings);
  }, [settings]);

  const v = (key: string, def: string) => vals[key] ?? def;
  const set = (key: string, val: string) => setVals(prev => ({ ...prev, [key]: val }));

  const saveMutation = useMutation({
    mutationFn: () => fetch("/api/admin/pricing", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: vals }),
    }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "✅ تم حفظ الأسعار بنجاح" });
      qc.invalidateQueries({ queryKey: ["/api/admin/pricing"] });
    },
    onError: () => toast({ title: "❌ فشل الحفظ", variant: "destructive" }),
  });

  if (isLoading) return <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>;

  const PriceCard = ({ icon: Icon, color, label, desc, children }: { icon: any; color: string; label: string; desc: string; children: React.ReactNode }) => (
    <Card className="border-border/60 rounded-2xl overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm">{label}</p>
            <p className="text-xs text-muted-foreground">{desc}</p>
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  );

  const NumInput = ({ k, label, unit, def, step = "0.5" }: { k: string; label: string; unit: string; def: string; step?: string }) => (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground flex-1">{label}</span>
      <div className="flex items-center gap-1">
        <Input
          type="number" min="0" step={step}
          value={v(k, def)}
          onChange={e => set(k, e.target.value)}
          className="w-24 text-center font-bold"
          data-testid={`input-pricing-${k}`}
        />
        <span className="text-xs text-muted-foreground w-10">{unit}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 p-1" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/5 border border-yellow-200/40 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-1">
          <DollarSign className="w-6 h-6 text-yellow-500" />
          <h2 className="font-bold text-xl">إدارة أسعار المنصة</h2>
        </div>
        <p className="text-sm text-muted-foreground">تحكم كامل في جميع أسعار الخدمات — الأسعار تؤثر فوراً على ما يراه العملاء</p>
      </div>

      {/* ── قسم الحملات الإعلانية ── */}
      <div>
        <h3 className="font-bold text-base mb-3 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-teal-500" /> الحملات الإعلانية (CPM / CPC)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PriceCard icon={TrendingUp} color="bg-teal-500" label="سعر الـ CPM" desc="تكلفة 1000 ظهور للإعلان">
            <NumInput k="cpm_rate_egp" label="سعر كل 1000 ظهور" unit="ج.م" def="15" step="0.5" />
          </PriceCard>
          <PriceCard icon={Eye} color="bg-blue-500" label="سعر الـ CPC" desc="تكلفة كل نقرة على الإعلان">
            <NumInput k="cpc_rate_egp" label="سعر كل نقرة" unit="ج.م" def="0.75" step="0.05" />
          </PriceCard>
          <PriceCard icon={ArrowUpRight} color="bg-emerald-500" label="نسبة الناشر" desc="النسبة المئوية من إيرادات الإعلان للناشر">
            <NumInput k="publisher_share_pct" label="نسبة الناشر من كل إعلان" unit="%" def="60" step="1" />
          </PriceCard>
          <PriceCard icon={DollarSign} color="bg-cyan-500" label="الحد الأدنى للميزانية" desc="أقل ميزانية يمكن ضبطها للحملة">
            <NumInput k="campaign_min_budget_egp" label="الحد الأدنى" unit="ج.م" def="50" step="5" />
          </PriceCard>
        </div>
      </div>

      {/* ── تعزيز الإعلان ── */}
      <div>
        <h3 className="font-bold text-base mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-orange-500" /> تعزيز الإعلان (Boost)
        </h3>
        <PriceCard icon={Zap} color="bg-orange-500" label="إعدادات التعزيز" desc="سعر وتفعيل خاصية تعزيز الإعلانات">
          <NumInput k="boost_price_egp" label="سعر التعزيز" unit="ج.م" def="0" step="5" />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">تفعيل التعزيز</span>
            <button
              onClick={() => set("boost_enabled", v("boost_enabled", "1") === "0" ? "1" : "0")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-colors ${v("boost_enabled", "1") !== "0" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}
              data-testid="btn-toggle-boost"
            >
              {v("boost_enabled", "1") !== "0" ? <><ToggleRight className="w-4 h-4" /> مفعّل</> : <><ToggleLeft className="w-4 h-4" /> معطّل</>}
            </button>
          </div>
        </PriceCard>
      </div>

      {/* ── تجديد الإعلانات ── */}
      <div>
        <h3 className="font-bold text-base mb-3 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-blue-500" /> تجديد الإعلانات
        </h3>
        <PriceCard icon={RefreshCw} color="bg-blue-500" label="أسعار تجديد الإعلان" desc="تكلفة تمديد مدة الإعلان لكل فترة">
          <NumInput k="renewal_price_30" label="تجديد 30 يوماً" unit="ج.م" def="50" step="5" />
          <NumInput k="renewal_price_60" label="تجديد 60 يوماً" unit="ج.م" def="90" step="5" />
          <NumInput k="renewal_price_90" label="تجديد 90 يوماً" unit="ج.م" def="130" step="5" />
        </PriceCard>
      </div>

      {/* ── المحفظة ── */}
      <div>
        <h3 className="font-bold text-base mb-3 flex items-center gap-2">
          <Banknote className="w-4 h-4 text-green-500" /> المحفظة والرصيد
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PriceCard icon={ArrowDownLeft} color="bg-green-600" label="الحد الأدنى للسحب" desc="أقل مبلغ يمكن طلب سحبه من المحفظة">
            <NumInput k="wallet_min_withdrawal_egp" label="الحد الأدنى" unit="ج.م" def="100" step="10" />
          </PriceCard>
          <PriceCard icon={ArrowUpRight} color="bg-purple-500" label="الحد الأقصى للإيداع" desc="أقصى مبلغ يمكن إيداعه في طلب واحد">
            <NumInput k="wallet_max_deposit_egp" label="الحد الأقصى" unit="ج.م" def="10000" step="500" />
          </PriceCard>
        </div>
      </div>

      {/* ── الذكاء الاصطناعي ── */}
      <div>
        <h3 className="font-bold text-base mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-500" /> الذكاء الاصطناعي
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PriceCard icon={Gift} color="bg-violet-500" label="استخدامات مجانية" desc="عدد مرات الاستخدام المجاني لكل مستخدم جديد">
            <NumInput k="ai_free_credits" label="عدد الاستخدامات" unit="مرة" def="3" step="1" />
          </PriceCard>
          <PriceCard icon={DollarSign} color="bg-violet-600" label="سعر الكريديت" desc="سعر الكريديت الواحد بالجنيه المصري">
            <NumInput k="ai_price_per_credit_egp" label="سعر الكريديت" unit="ج.م" def="5" step="0.5" />
          </PriceCard>
          <PriceCard icon={Image} color="bg-pink-500" label="توليد صورة" desc="عدد الكريديتات لتوليد صورة">
            <NumInput k="ai_price_image" label="كريديتات الصورة" unit="كريديت" def="1" step="1" />
          </PriceCard>
          <PriceCard icon={Video} color="bg-red-500" label="توليد فيديو" desc="عدد الكريديتات لتوليد فيديو">
            <NumInput k="ai_price_video" label="كريديتات الفيديو" unit="كريديت" def="3" step="1" />
          </PriceCard>
          <PriceCard icon={FileText} color="bg-indigo-500" label="كتابة محتوى" desc="عدد الكريديتات لكتابة المحتوى">
            <NumInput k="ai_price_content" label="كريديتات المحتوى" unit="كريديت" def="1" step="1" />
          </PriceCard>
          <PriceCard icon={Gift} color="bg-amber-500" label="مكافأة الإحالة" desc="مبلغ مكافأة الإحالة للمستخدم بالجنيه">
            <NumInput k="ai_referral_bonus_egp" label="مكافأة الإحالة" unit="ج.م" def="10" step="5" />
          </PriceCard>
        </div>
      </div>

      {/* Save */}
      <Button
        className="w-full gap-2 h-12 text-base font-bold bg-yellow-500 hover:bg-yellow-600 text-black"
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        data-testid="btn-save-pricing"
      >
        {saveMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
        حفظ جميع الأسعار
      </Button>
    </div>
  );
}

// AI PRICING SECTION
// ──────────────────────────────────────────────────────────
function AiPricingSection() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: settings, isLoading } = useQuery<Record<string, string>>({
    queryKey: ["/api/admin/ai-pricing"],
    queryFn: () => fetch("/api/admin/ai-pricing", { credentials: "include" }).then(r => r.json()).then(d => typeof d === 'object' && !Array.isArray(d) ? d : {}),
  });

  const [vals, setVals] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settings) setVals(settings);
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () => fetch("/api/admin/ai-pricing", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: vals }),
    }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "✅ تم حفظ أسعار الذكاء الاصطناعي" });
      qc.invalidateQueries({ queryKey: ["/api/admin/ai-pricing"] });
    },
    onError: () => toast({ title: "❌ فشل الحفظ", variant: "destructive" }),
  });

  const FIELDS = [
    { key: "ai_free_credits", label: "عدد الاستخدامات المجانية للمستخدم الجديد", icon: Gift, unit: "استخدام", desc: "عدد مرات استخدام الذكاء الاصطناعي مجاناً لكل مستخدم" },
    { key: "ai_price_per_credit_egp", label: "سعر الكريديت الواحد (عام)", icon: DollarSign, unit: "ج.م", desc: "السعر الافتراضي للكريديت الواحد بالجنيه المصري" },
    { key: "ai_price_image", label: "توليد صورة احترافية (كريديت)", icon: Image, unit: "كريديت", desc: "تصميم صورة إعلانية أو ترويجية بالذكاء الاصطناعي" },
    { key: "ai_price_post", label: "كتابة بوست احترافي (كريديت)", icon: FileText, unit: "كريديت", desc: "كتابة محتوى تسويقي وإعلانات نصية بجودة عالية" },
    { key: "ai_price_content", label: "كتابة وصف إعلان (كريديت)", icon: Wand2, unit: "كريديت", desc: "توليد وصف احترافي للمنتج أو الخدمة" },
    { key: "ai_price_video", label: "توليد فيديو سينمائي (كريديت)", icon: Video, unit: "كريديت", desc: "فيديو إعلاني سينمائي بصوت وصورة عالية الجودة" },
    { key: "ai_price_animation", label: "إنشاء أنيميشن متحرك (كريديت)", icon: Sparkles, unit: "كريديت", desc: "محتوى متحرك صوت وصورة — أنيميشن احترافي" },
    { key: "ai_referral_bonus_egp", label: "مكافأة الإحالة (جنيه)", icon: Gift, unit: "ج.م", desc: "المبلغ الذي يحصل عليه المُحيل عند انضمام صديقه" },
  ];

  if (isLoading) return <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="space-y-6 p-1" dir="rtl">
      <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/5 border border-violet-200/40 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="w-6 h-6 text-violet-500" />
          <h2 className="font-bold text-xl">أسعار خدمات الذكاء الاصطناعي</h2>
        </div>
        <p className="text-sm text-muted-foreground">تحكم كامل في تسعير جميع خدمات الذكاء الاصطناعي — كلما زاد الكريديت، ارتفعت جودة الخدمة</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FIELDS.map(({ key, label, icon: Icon, unit, desc }) => (
          <Card key={key} className="border-border/60 rounded-2xl overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-violet-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm leading-tight">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={vals[key] ?? ""}
                  onChange={e => setVals(prev => ({ ...prev, [key]: e.target.value }))}
                  className="text-center font-bold text-lg"
                  data-testid={`input-ai-price-${key}`}
                />
                <span className="text-sm text-muted-foreground font-medium shrink-0">{unit}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-800 dark:text-amber-400 mb-1">نظام الشرائح التسعيرية</p>
            <ul className="text-amber-700 dark:text-amber-500 space-y-1 text-xs list-disc list-inside">
              <li>المستخدم الجديد يحصل على عدد استخدامات مجانية تحددها أنت</li>
              <li>بعد انتهاء الاستخدامات المجانية، يُطلب الدفع بالكريديت</li>
              <li>كل خدمة تستهلك عدداً معيناً من الكريديتات تحددها أنت هنا</li>
              <li>المستخدم الذي يدفع أكثر يحصل على جودة أعلى في المخرجات</li>
            </ul>
          </div>
        </div>
      </div>

      <Button
        className="w-full gap-2 h-12 text-base font-bold"
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        data-testid="btn-save-ai-pricing"
      >
        {saveMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
        حفظ الأسعار
      </Button>
    </div>
  );
}

// ── RENEWAL ORDERS SECTION ───────────────────────────────────────────────────
function RenewalOrdersSection() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: orders = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/renewal/orders"],
    queryFn: () => fetch("/api/renewal/orders", { credentials: "include" }).then(r => r.json()).then(d => Array.isArray(d) ? d : []),
    refetchInterval: 30000,
  });

  const confirmMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      fetch(`/api/renewal/orders/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).then(r => r.json()),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/renewal/orders"] });
      toast({ title: vars.status === 'confirmed' ? "✅ تم تأكيد التجديد وتفعيله" : "❌ تم رفض الطلب" });
    },
  });

  const pending = orders.filter((o: any) => o.status === 'pending');
  const confirmed = orders.filter((o: any) => o.status === 'confirmed');

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <RefreshCw className="w-6 h-6 text-blue-500" />
            طلبات التجديد
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {pending.length} طلب قيد الانتظار · {confirmed.length} مؤكد
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["/api/renewal/orders"] })}>
          <RefreshCw className="w-4 h-4 ml-1" /> تحديث
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">جارٍ التحميل...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <RefreshCw className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p>لا توجد طلبات تجديد بعد</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order: any) => (
            <Card key={order.id} className={`border ${order.status === 'pending' ? 'border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/10' : order.status === 'confirmed' ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800 opacity-60'}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1 text-sm flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        order.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : order.status === 'confirmed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {order.status === 'pending' ? '⏳ قيد الانتظار' : order.status === 'confirmed' ? '✅ مؤكد' : '❌ مرفوض'}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">{order.order_number}</span>
                    </div>
                    <div className="font-semibold">{order.first_name} {order.last_name}</div>
                    <div className="text-muted-foreground text-xs">{order.phone}</div>
                    <div className="flex gap-4 mt-2 text-xs">
                      <span>📢 إعلان: <strong>#{order.ad_id}</strong></span>
                      <span>📅 مدة: <strong>{order.duration_days} يوماً</strong></span>
                      <span>💰 المبلغ: <strong className="text-blue-600">{order.amount} ج.م</strong></span>
                    </div>
                    {order.ad_title && (
                      <div className="text-xs text-muted-foreground mt-1">عنوان الإعلان: {order.ad_title}</div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleString('ar-EG')}
                    </div>
                  </div>

                  {order.status === 'pending' && (
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        className="bg-green-500 hover:bg-green-600 text-white h-8 px-3 text-xs gap-1"
                        disabled={confirmMut.isPending}
                        onClick={() => confirmMut.mutate({ id: order.id, status: 'confirmed' })}
                        data-testid={`btn-confirm-renewal-${order.id}`}
                      >
                        <Check className="w-3 h-3" /> تأكيد
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-300 text-red-600 hover:bg-red-50 h-8 px-3 text-xs gap-1"
                        disabled={confirmMut.isPending}
                        onClick={() => confirmMut.mutate({ id: order.id, status: 'rejected' })}
                        data-testid={`btn-reject-renewal-${order.id}`}
                      >
                        <X className="w-3 h-3" /> رفض
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
