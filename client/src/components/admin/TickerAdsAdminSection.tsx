import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Check, Play, Pause, X, Trash2, Megaphone, Loader2, ShieldCheck,
  Activity, DollarSign, Radio, Plus, History, AlertOctagon, Settings,
} from "lucide-react";
import type { TickerAd } from "@shared/schema";

const STATUS_LABEL: Record<string, string> = {
  pending: "قيد المراجعة", approved: "معتمد", active: "نشط",
  paused: "متوقف", completed: "مكتمل", rejected: "مرفوض",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "bg-blue-500", approved: "bg-amber-500", active: "bg-green-600",
  paused: "bg-gray-500", completed: "bg-zinc-700", rejected: "bg-red-500",
};

type EnrichedAd = TickerAd & { advertiserName?: string; isAdminAd?: boolean };
type StatsResponse = {
  activeCount: number;
  todayRevenueEGP: number;
  totalRevenueEGP: number;
  active: EnrichedAd[];
};

export default function TickerAdsAdminSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [liveSpend, setLiveSpend] = useState<Record<number, { spentEGP?: number; secondsShown?: number }>>({});
  const [todayLive, setTodayLive] = useState<number | null>(null);
  const [adminText, setAdminText] = useState("");
  const [priceInput, setPriceInput] = useState<string>("");
  // Per-component prev spent cache (avoids stale global state across remounts)
  const prevSpentRef = useRef<Record<number, number>>({});

  // Current admin-controlled price-per-second
  const { data: priceData } = useQuery<{ pricePerSecondEGP: number }>({
    queryKey: ["/api/admin/ticker-ads/price"],
    queryFn: () => fetch("/api/admin/ticker-ads/price", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 10000,
  });
  const currentPrice = priceData?.pricePerSecondEGP ?? 1;
  useEffect(() => { if (priceData) setPriceInput(String(priceData.pricePerSecondEGP)); }, [priceData?.pricePerSecondEGP]);

  const updatePriceM = useMutation({
    mutationFn: async (n: number) => (await apiRequest("PUT", "/api/admin/ticker-ads/price", { pricePerSecondEGP: n })).json(),
    onSuccess: (data: any) => {
      toast({ title: "تم التحديث ✅", description: `سعر الثانية الجديد: ${data?.pricePerSecondEGP} ج.م — يطبق فوراً على كل الإعلانات النشطة` });
      qc.invalidateQueries({ queryKey: ["/api/admin/ticker-ads/price"] });
      qc.invalidateQueries({ queryKey: ["/api/ticker-ads/price"] });
    },
    onError: (e: any) => toast({ title: "فشل التحديث", description: e?.message || "خطأ", variant: "destructive" }),
  });

  // Live stats — refresh every 3s for accurate live monitor
  const { data: stats } = useQuery<StatsResponse>({
    queryKey: ["/api/admin/ticker-ads/stats"],
    queryFn: () => fetch("/api/admin/ticker-ads/stats", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 3000,
  });

  // Pending/approved/etc list
  const { data: ads = [], isLoading } = useQuery<EnrichedAd[]>({
    queryKey: ["/api/admin/ticker-ads/history"],
    queryFn: () => fetch("/api/admin/ticker-ads/history", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 5000,
  });

  // Live tick listener — set up ONCE on mount (no deps to avoid socket churn)
  useEffect(() => {
    const s = io({ path: "/socket.io", transports: ["websocket", "polling"] });
    s.on("ticker:tick", (d: { id: number; spentEGP?: number; secondsShown?: number; remainingEGP?: number; isFree?: boolean }) => {
      setLiveSpend((prev) => ({ ...prev, [d.id]: { spentEGP: d.spentEGP, secondsShown: d.secondsShown } }));
      if (!d.isFree && typeof d.spentEGP === "number") {
        const prevVal = prevSpentRef.current[d.id];
        const delta = typeof prevVal === "number" ? Math.max(0, d.spentEGP - prevVal) : 0;
        if (delta > 0) setTodayLive((cur) => (cur ?? 0) + delta);
        prevSpentRef.current[d.id] = d.spentEGP;
      }
    });
    s.on("ticker:remove", (d: { id: number }) => {
      delete prevSpentRef.current[d.id];
      qc.invalidateQueries({ queryKey: ["/api/admin/ticker-ads/stats"] });
    });
    s.on("ticker:show", () => qc.invalidateQueries({ queryKey: ["/api/admin/ticker-ads/stats"] }));
    return () => { s.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync todayLive to authoritative server value on every stats refresh
  useEffect(() => { if (stats) setTodayLive(stats.todayRevenueEGP); }, [stats?.todayRevenueEGP]);

  const onActionSuccess = () => {
    qc.invalidateQueries({ queryKey: ["/api/admin/ticker-ads/history"] });
    qc.invalidateQueries({ queryKey: ["/api/admin/ticker-ads/stats"] });
  };
  const onActionError = (e: any) => toast({ title: "خطأ", description: e?.message || "فشل التنفيذ", variant: "destructive" });

  const approveM = useMutation({ mutationFn: async (id: number) => (await apiRequest("POST", `/api/admin/ticker-ads/${id}/approve`)).json(), onSuccess: onActionSuccess, onError: onActionError });
  const startM   = useMutation({ mutationFn: async (id: number) => (await apiRequest("POST", `/api/admin/ticker-ads/${id}/start`)).json(),   onSuccess: onActionSuccess, onError: onActionError });
  const stopM    = useMutation({ mutationFn: async (id: number) => (await apiRequest("POST", `/api/admin/ticker-ads/${id}/stop`)).json(),    onSuccess: onActionSuccess, onError: onActionError });
  const rejectM  = useMutation({ mutationFn: async (id: number) => (await apiRequest("POST", `/api/admin/ticker-ads/${id}/reject`)).json(),  onSuccess: onActionSuccess, onError: onActionError });
  const deleteM  = useMutation({ mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/admin/ticker-ads/${id}`)).json(),       onSuccess: onActionSuccess, onError: onActionError });

  // Quick admin-create-and-broadcast (free)
  const createAdminM = useMutation({
    mutationFn: async (text: string) => {
      const r = await apiRequest("POST", "/api/ticker-ads", { text, budgetEGP: 0, pricePerSecondEGP: 0 });
      const ad = await r.json();
      // Auto-start it immediately since admin tickers are auto-approved
      await apiRequest("POST", `/api/admin/ticker-ads/${ad.id}/start`);
      return ad;
    },
    onSuccess: () => {
      toast({ title: "🔴 الشريط شغال دلوقتي", description: "تم بث إعلانك المجاني فوراً" });
      setAdminText("");
      qc.invalidateQueries({ queryKey: ["/api/admin/ticker-ads/history"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/ticker-ads/stats"] });
    },
    onError: (e: any) => toast({ title: "فشل البث", description: e?.message || "خطأ", variant: "destructive" }),
  });

  // Kill all active tickers
  const killAllM = useMutation({
    mutationFn: async () => {
      if (!stats?.active) return;
      await Promise.all(stats.active.map((a) => apiRequest("POST", `/api/admin/ticker-ads/${a.id}/stop`)));
    },
    onSuccess: () => {
      toast({ title: "تم الإيقاف", description: "تم إيقاف كل الإعلانات النشطة" });
      qc.invalidateQueries({ queryKey: ["/api/admin/ticker-ads/history"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/ticker-ads/stats"] });
    },
  });

  const grouped = {
    pending:  ads.filter((a) => a.status === "pending"),
    approved: ads.filter((a) => a.status === "approved"),
    history:  ads.filter((a) => ["completed", "paused", "rejected"].includes(a.status)),
  };

  const todayRev = todayLive ?? stats?.todayRevenueEGP ?? 0;

  return (
    <div className="space-y-5" data-testid="section-ticker-ads-admin">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-950/40 flex items-center justify-center">
          <Megaphone className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold">إعلانات الشريط العاجل</h2>
          <p className="text-xs text-muted-foreground">يظهر فقط فوق مشغل البث المباشر</p>
        </div>
      </div>

      {/* ═══ PRICE CONTROL ═══ */}
      <Card className="border-2 border-amber-300 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="w-4 h-4 text-amber-600" /> مفتاح السعر — تحكم كامل
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            أنت تحدد سعر الثانية الذي يُخصم من المعلنين. أي تغيير يطبّق <b>فوراً</b> على كل الإعلانات النشطة وعند المعلنين الجدد.
          </p>
          <div className="flex items-end gap-2 flex-wrap">
            <div className="flex-1 min-w-[180px]">
              <label className="text-xs text-muted-foreground mb-1 block">سعر الثانية الحالي (ج.م)</label>
              <Input
                type="number" step="0.1" min="0.1"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                data-testid="input-ticker-price-setting"
              />
            </div>
            <Button
              onClick={() => updatePriceM.mutate(Number(priceInput))}
              disabled={updatePriceM.isPending || !priceInput || Number(priceInput) <= 0 || Number(priceInput) === currentPrice}
              className="bg-amber-600 hover:bg-amber-700 text-white"
              data-testid="btn-save-ticker-price"
            >
              {updatePriceM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ السعر الجديد"}
            </Button>
            <div className="text-xs text-muted-foreground">
              السعر النشط دلوقتي: <b className="text-amber-700 dark:text-amber-400">{currentPrice.toFixed(2)} ج.م/ثانية</b>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ STATS ROW ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs opacity-90"><DollarSign className="w-3 h-3" /> أرباح اليوم</div>
            <div className="text-2xl font-bold mt-1" data-testid="text-today-revenue">{todayRev.toFixed(2)} <span className="text-xs">ج.م</span></div>
            <div className="text-[10px] opacity-75 mt-1">يحدث لحظياً</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs opacity-90"><DollarSign className="w-3 h-3" /> الإجمالي الكلي</div>
            <div className="text-2xl font-bold mt-1" data-testid="text-total-revenue">{(stats?.totalRevenueEGP ?? 0).toFixed(2)} <span className="text-xs">ج.م</span></div>
            <div className="text-[10px] opacity-75 mt-1">من أول يوم</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-500 to-rose-600 text-white border-0 col-span-2 md:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs opacity-90"><Radio className="w-3 h-3" /> نشط الآن</div>
            <div className="text-2xl font-bold mt-1" data-testid="text-active-count">{stats?.activeCount ?? 0}</div>
            <div className="text-[10px] opacity-75 mt-1">إعلان مباشر</div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ LIVE MONITOR ═══ */}
      <Card className="border-2 border-red-300 dark:border-red-900/50">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-red-600 animate-pulse" /> الشاشة المباشرة (Live Monitor)
          </CardTitle>
          {(stats?.activeCount ?? 0) > 0 && (
            <Button
              size="sm" variant="destructive"
              onClick={() => killAllM.mutate()}
              disabled={killAllM.isPending}
              data-testid="btn-kill-all"
            >
              <AlertOctagon className="w-3 h-3 ml-1" /> إيقاف فوري للكل
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!stats?.active?.length ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              لا يوجد شريط شغّال حالياً عند المشاهدين
            </div>
          ) : (
            <div className="space-y-2">
              {stats.active.map((ad) => {
                const live = liveSpend[ad.id];
                const spent = live?.spentEGP ?? ad.spentEGP ?? 0;
                const seconds = live?.secondsShown ?? ad.secondsShown ?? 0;
                return (
                  <div key={ad.id} className="rounded-xl bg-gradient-to-r from-red-600 to-rose-600 text-white p-3" data-testid={`monitor-active-${ad.id}`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="bg-white/20 px-2 py-0.5 rounded-full">🔴 LIVE</span>
                        <span>{ad.advertiserName}</span>
                        {ad.isAdminAd && (
                          <Badge className="bg-yellow-400 text-yellow-950 border-0 text-[10px]">
                            <ShieldCheck className="w-2.5 h-2.5 ml-0.5" /> مجاني (أدمن)
                          </Badge>
                        )}
                      </div>
                      <Button
                        size="sm" variant="secondary"
                        onClick={() => stopM.mutate(ad.id)}
                        disabled={stopM.isPending}
                        className="h-7 text-xs"
                        data-testid={`btn-kill-${ad.id}`}
                      >
                        <AlertOctagon className="w-3 h-3 ml-1" /> إيقاف
                      </Button>
                    </div>
                    <div className="bg-white/10 rounded-lg p-2 text-sm font-medium" dir="rtl">
                      {ad.text}
                    </div>
                    <div className="flex items-center justify-between mt-2 text-[11px] opacity-90">
                      <span>⏱️ {seconds} ثانية</span>
                      <span>💸 {ad.isAdminAd ? "0.00 (مجاني)" : `${spent.toFixed(2)} ج.م`}</span>
                      {!ad.isAdminAd && <span>متبقي: {((ad.budgetEGP || 0) - spent).toFixed(2)} ج.م</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ ADMIN QUICK BROADCAST ═══ */}
      <Card className="border-yellow-300 dark:border-yellow-900/40 bg-yellow-50/30 dark:bg-yellow-950/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-yellow-600" /> بث فوري كأدمن (مجاني)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            value={adminText}
            onChange={(e) => setAdminText(e.target.value)}
            placeholder="اكتب رسالة عاجلة هتظهر فوراً عند كل المشاهدين بدون أي خصم..."
            rows={2}
            data-testid="input-admin-broadcast"
          />
          <Button
            onClick={() => createAdminM.mutate(adminText.trim())}
            disabled={adminText.trim().length < 5 || createAdminM.isPending}
            className="bg-red-600 hover:bg-red-700 text-white w-full"
            data-testid="btn-admin-broadcast"
          >
            {createAdminM.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Plus className="w-4 h-4 ml-2" />}
            بث فوري الآن
          </Button>
        </CardContent>
      </Card>

      {isLoading && <div className="text-center py-6"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>}

      {/* ═══ PENDING ═══ */}
      {grouped.pending.length > 0 && (
        <Card className="border-blue-200 dark:border-blue-900/40">
          <CardHeader className="pb-2"><CardTitle className="text-base">قيد المراجعة ({grouped.pending.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {grouped.pending.map((a) => (
              <Row key={a.id} ad={a} live={liveSpend[a.id]}>
                <Button size="sm" onClick={() => approveM.mutate(a.id)} disabled={approveM.isPending}
                  className="bg-green-600 hover:bg-green-700 text-white" data-testid={`btn-approve-ticker-${a.id}`}>
                  <Check className="w-3 h-3 ml-1" /> اعتماد
                </Button>
                <Button size="sm" variant="destructive" onClick={() => rejectM.mutate(a.id)} disabled={rejectM.isPending}
                  data-testid={`btn-reject-ticker-${a.id}`}>
                  <X className="w-3 h-3 ml-1" /> رفض
                </Button>
              </Row>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ═══ APPROVED — READY TO START ═══ */}
      {grouped.approved.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-900/40">
          <CardHeader className="pb-2"><CardTitle className="text-base">جاهز للبدء ({grouped.approved.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {grouped.approved.map((a) => (
              <Row key={a.id} ad={a} live={liveSpend[a.id]}>
                <Button size="sm" onClick={() => startM.mutate(a.id)} disabled={startM.isPending}
                  className="bg-red-600 hover:bg-red-700 text-white" data-testid={`btn-start-ticker-${a.id}`}>
                  <Play className="w-3 h-3 ml-1" /> بدء البث الآن
                </Button>
                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => deleteM.mutate(a.id)} disabled={deleteM.isPending}
                  data-testid={`btn-delete-ticker-${a.id}`}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </Row>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ═══ HISTORY TABLE ═══ */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4" /> سجل العمليات ({grouped.history.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {grouped.history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">لا يوجد سجل بعد</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-right">
                  <tr>
                    <th className="px-3 py-2">المعلن</th>
                    <th className="px-3 py-2">النص</th>
                    <th className="px-3 py-2">الحالة</th>
                    <th className="px-3 py-2">الثواني</th>
                    <th className="px-3 py-2">المبلغ</th>
                    <th className="px-3 py-2">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped.history.map((a) => (
                    <tr key={a.id} className="border-t hover:bg-muted/30" data-testid={`row-history-${a.id}`}>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <span>{a.advertiserName}</span>
                          {a.isAdminAd && <ShieldCheck className="w-3 h-3 text-yellow-600" />}
                        </div>
                      </td>
                      <td className="px-3 py-2 max-w-xs truncate" title={a.text}>{a.text}</td>
                      <td className="px-3 py-2"><Badge className={`${STATUS_COLOR[a.status]} text-white text-[10px]`}>{STATUS_LABEL[a.status]}</Badge></td>
                      <td className="px-3 py-2 text-center">{a.secondsShown || 0}</td>
                      <td className="px-3 py-2 font-bold text-red-600 whitespace-nowrap">
                        {a.isAdminAd ? "—" : `${(a.spentEGP || 0).toFixed(2)} ج.م`}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          {a.status === "paused" && (
                            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => startM.mutate(a.id)} disabled={startM.isPending}>
                              <Play className="w-3 h-3" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-red-600" onClick={() => deleteM.mutate(a.id)} disabled={deleteM.isPending}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
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

function Row({ ad, live, children }: { ad: EnrichedAd; live?: { spentEGP?: number; secondsShown?: number }; children?: React.ReactNode }) {
  const spent = live?.spentEGP ?? ad.spentEGP ?? 0;
  const seconds = live?.secondsShown ?? ad.secondsShown ?? 0;
  const remaining = (ad.budgetEGP || 0) - spent;
  const pct = ad.budgetEGP ? Math.min(100, (spent / ad.budgetEGP) * 100) : 0;
  return (
    <div className="border rounded-xl p-3 space-y-2 bg-card" data-testid={`row-ticker-${ad.id}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium flex-1 line-clamp-2">{ad.text}</p>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge className={`${STATUS_COLOR[ad.status]} text-white`}>{STATUS_LABEL[ad.status]}</Badge>
          {ad.isAdminAd && <Badge className="bg-yellow-400 text-yellow-950 border-0 text-[10px]"><ShieldCheck className="w-2.5 h-2.5 ml-0.5" /> أدمن</Badge>}
        </div>
      </div>
      <div className="text-[11px] text-muted-foreground">
        المعلن: <b className="text-foreground">{ad.advertiserName || ad.advertiserId}</b>
      </div>
      {!ad.isAdminAd && (
        <>
          <div className="grid grid-cols-4 gap-2 text-[11px] text-muted-foreground">
            <span>الميزانية: <b className="text-foreground">{ad.budgetEGP} ج.م</b></span>
            <span>المنصرف: <b className="text-red-600">{spent.toFixed(2)} ج.م</b></span>
            <span>المتبقي: <b className="text-green-600">{remaining.toFixed(2)} ج.م</b></span>
            <span>الثواني: <b className="text-foreground">{seconds}</b></span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-red-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </>
      )}
      <div className="flex items-center gap-2 pt-1">{children}</div>
    </div>
  );
}
