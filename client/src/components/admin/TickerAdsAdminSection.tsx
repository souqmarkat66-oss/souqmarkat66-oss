import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Check, Play, Pause, X, Trash2, Megaphone, Loader2 } from "lucide-react";
import type { TickerAd } from "@shared/schema";

const STATUS_LABEL: Record<string, string> = {
  pending: "قيد المراجعة", approved: "معتمد", active: "نشط",
  paused: "متوقف", completed: "مكتمل", rejected: "مرفوض",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "bg-blue-500", approved: "bg-amber-500", active: "bg-green-600",
  paused: "bg-gray-500", completed: "bg-zinc-700", rejected: "bg-red-500",
};

export default function TickerAdsAdminSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [liveSpend, setLiveSpend] = useState<Record<number, { spentEGP?: number; secondsShown?: number }>>({});

  const { data: ads = [], isLoading } = useQuery<TickerAd[]>({
    queryKey: ["/api/admin/ticker-ads"],
    queryFn: () => fetch("/api/admin/ticker-ads", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 5000,
  });

  // Live tick listener
  useEffect(() => {
    const s = io({ path: "/socket.io", transports: ["websocket", "polling"] });
    s.on("ticker:tick", (d: { id: number; spentEGP?: number; secondsShown?: number }) => {
      setLiveSpend((prev) => ({ ...prev, [d.id]: { spentEGP: d.spentEGP, secondsShown: d.secondsShown } }));
    });
    return () => { s.disconnect(); };
  }, []);

  const action = (path: string, method: "POST" | "DELETE" = "POST") =>
    useMutation({
      mutationFn: async (id: number) => {
        const r = await apiRequest(method, `/api/admin/ticker-ads/${id}${path}`);
        return r.json();
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/ticker-ads"] }),
      onError: (e: any) => toast({ title: "خطأ", description: e?.message || "فشل التنفيذ", variant: "destructive" }),
    });

  const approveM = action("/approve");
  const startM   = action("/start");
  const stopM    = action("/stop");
  const rejectM  = action("/reject");
  const deleteM  = action("", "DELETE");

  const grouped = {
    pending:  ads.filter((a) => a.status === "pending"),
    approved: ads.filter((a) => a.status === "approved"),
    active:   ads.filter((a) => a.status === "active"),
    other:    ads.filter((a) => !["pending", "approved", "active"].includes(a.status)),
  };

  return (
    <div className="space-y-5" data-testid="section-ticker-ads-admin">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-950/40 flex items-center justify-center">
          <Megaphone className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold">إعلانات الشريط العاجل</h2>
          <p className="text-xs text-muted-foreground">اعتماد + بدء + إيقاف الإعلانات النصية العاجلة على كل البثوث</p>
        </div>
      </div>

      {isLoading && <div className="text-center py-6"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>}

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
              </Row>
            ))}
          </CardContent>
        </Card>
      )}

      {grouped.active.length > 0 && (
        <Card className="border-green-200 dark:border-green-900/40 bg-green-50/30 dark:bg-green-950/10">
          <CardHeader className="pb-2"><CardTitle className="text-base text-green-700">🔴 نشط الآن ({grouped.active.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {grouped.active.map((a) => (
              <Row key={a.id} ad={a} live={liveSpend[a.id]}>
                <Button size="sm" variant="outline" onClick={() => stopM.mutate(a.id)} disabled={stopM.isPending}
                  data-testid={`btn-stop-ticker-${a.id}`}>
                  <Pause className="w-3 h-3 ml-1" /> إيقاف
                </Button>
              </Row>
            ))}
          </CardContent>
        </Card>
      )}

      {grouped.other.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">السجل ({grouped.other.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {grouped.other.map((a) => (
              <Row key={a.id} ad={a} live={liveSpend[a.id]}>
                {a.status === "paused" && (
                  <Button size="sm" onClick={() => startM.mutate(a.id)} disabled={startM.isPending}
                    className="bg-red-600 hover:bg-red-700 text-white" data-testid={`btn-resume-ticker-${a.id}`}>
                    <Play className="w-3 h-3 ml-1" /> استئناف
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => deleteM.mutate(a.id)} disabled={deleteM.isPending}
                  data-testid={`btn-delete-ticker-${a.id}`}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </Row>
            ))}
          </CardContent>
        </Card>
      )}

      {ads.length === 0 && !isLoading && (
        <p className="text-sm text-muted-foreground text-center py-8">لا يوجد إعلانات شريط بعد</p>
      )}
    </div>
  );
}

function Row({ ad, live, children }: { ad: TickerAd; live?: { spentEGP?: number; secondsShown?: number }; children?: React.ReactNode }) {
  const spent = live?.spentEGP ?? ad.spentEGP ?? 0;
  const seconds = live?.secondsShown ?? ad.secondsShown ?? 0;
  const remaining = (ad.budgetEGP || 0) - spent;
  const pct = ad.budgetEGP ? Math.min(100, (spent / ad.budgetEGP) * 100) : 0;
  return (
    <div className="border rounded-xl p-3 space-y-2 bg-card" data-testid={`row-ticker-${ad.id}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium flex-1 line-clamp-2">{ad.text}</p>
        <Badge className={`${STATUS_COLOR[ad.status]} text-white shrink-0`}>{STATUS_LABEL[ad.status]}</Badge>
      </div>
      <div className="grid grid-cols-4 gap-2 text-[11px] text-muted-foreground">
        <span>الميزانية: <b className="text-foreground">{ad.budgetEGP} ج.م</b></span>
        <span>المنصرف: <b className="text-red-600">{spent.toFixed(2)} ج.م</b></span>
        <span>المتبقي: <b className="text-green-600">{remaining.toFixed(2)} ج.م</b></span>
        <span>الثواني: <b className="text-foreground">{seconds}</b></span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-red-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center gap-2 pt-1">{children}</div>
    </div>
  );
}
