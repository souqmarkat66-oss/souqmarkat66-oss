import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, AlertTriangle, TrendingUp, Users, DollarSign, Image as ImageIcon } from "lucide-react";

type AiSettings = {
  imageQuality: "low" | "medium" | "high";
  imageSize: string;
  dailyCapUsd: number;
  monthlyCapUsd: number;
  killSwitch: boolean;
};

type UsageStats = {
  today: { byType: { type: string; count: number; cost: number }[]; total: { count: number; cost: number } };
  month: { byType: { type: string; count: number; cost: number }[]; total: { count: number; cost: number } };
  topUsers: { user_id: string; first_name: string; last_name: string; count: number; cost: number }[];
};

const QUALITY_COSTS: Record<string, { label: string; cost: string; color: string }> = {
  low: { label: "اقتصادي", cost: "~$0.011", color: "text-green-600" },
  medium: { label: "متوسط (موصى به)", cost: "~$0.042", color: "text-blue-600" },
  high: { label: "عالي", cost: "~$0.167", color: "text-red-600" },
};

export default function AdminAiControl() {
  const { toast } = useToast();
  const [local, setLocal] = useState<AiSettings | null>(null);

  const { data: settings } = useQuery<AiSettings>({ queryKey: ["/api/admin/ai-settings"] });
  const { data: stats } = useQuery<UsageStats>({ queryKey: ["/api/admin/ai-usage-stats"], refetchInterval: 30000 });

  useEffect(() => {
    if (settings && !local) setLocal(settings);
  }, [settings, local]);

  const saveMutation = useMutation({
    mutationFn: async (body: AiSettings) => {
      return apiRequest("POST", "/api/admin/ai-settings", body);
    },
    onSuccess: () => {
      toast({ title: "تم الحفظ", description: "إعدادات الذكاء الاصطناعي تم تحديثها" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-settings"] });
    },
  });

  if (!local) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  const todayCost = stats?.today.total.cost || 0;
  const monthCost = stats?.month.total.cost || 0;
  const dailyPct = Math.min(100, (todayCost / local.dailyCapUsd) * 100);
  const monthlyPct = Math.min(100, (monthCost / local.monthlyCapUsd) * 100);

  return (
    <div className="container max-w-4xl mx-auto p-4 space-y-4" dir="rtl">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-black">التحكم في الذكاء الاصطناعي</h1>
      </div>

      {local.killSwitch && (
        <Card className="p-4 bg-red-50 border-red-300 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <div className="flex-1">
            <p className="font-bold text-red-800">خدمة الذكاء الاصطناعي موقوفة حالياً</p>
            <p className="text-xs text-red-600">المستخدمون لن يتمكنوا من توليد الصور أو النصوص</p>
          </div>
        </Card>
      )}

      {/* Usage stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">استهلاك اليوم</span>
            <DollarSign className="w-4 h-4 text-green-600" />
          </div>
          <div className="text-2xl font-black" data-testid="text-today-cost">${todayCost.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground">{stats?.today.total.count || 0} طلب</div>
          <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className={`h-full ${dailyPct > 80 ? "bg-red-500" : dailyPct > 50 ? "bg-orange-500" : "bg-green-500"}`} style={{ width: `${dailyPct}%` }} />
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">من ${local.dailyCapUsd} حد يومي</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">استهلاك الشهر</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black" data-testid="text-month-cost">${monthCost.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground">{stats?.month.total.count || 0} طلب</div>
          <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className={`h-full ${monthlyPct > 80 ? "bg-red-500" : monthlyPct > 50 ? "bg-orange-500" : "bg-green-500"}`} style={{ width: `${monthlyPct}%` }} />
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">من ${local.monthlyCapUsd} حد شهري</div>
        </Card>
      </div>

      {/* Kill switch */}
      <Card className="p-4 flex items-center justify-between">
        <div>
          <p className="font-bold">إيقاف الذكاء الاصطناعي فوراً</p>
          <p className="text-xs text-muted-foreground">يوقف توليد الصور للمستخدمين مؤقتاً</p>
        </div>
        <Switch
          checked={local.killSwitch}
          onCheckedChange={(v) => setLocal({ ...local, killSwitch: v })}
          data-testid="switch-kill"
        />
      </Card>

      {/* Image quality */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <ImageIcon className="w-5 h-5 text-primary" />
          <h3 className="font-bold">جودة الصور المولّدة</h3>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {(["low", "medium", "high"] as const).map((q) => (
            <button
              key={q}
              onClick={() => setLocal({ ...local, imageQuality: q })}
              className={`p-3 rounded-xl border-2 text-center transition-all ${
                local.imageQuality === q ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"
              }`}
              data-testid={`btn-quality-${q}`}
            >
              <div className="font-bold text-sm">{QUALITY_COSTS[q].label}</div>
              <div className={`text-xs mt-1 ${QUALITY_COSTS[q].color}`}>{QUALITY_COSTS[q].cost}</div>
            </button>
          ))}
        </div>

        <Label className="text-xs">حجم الصورة</Label>
        <select
          className="w-full p-2 border rounded-lg mt-1"
          value={local.imageSize}
          onChange={(e) => setLocal({ ...local, imageSize: e.target.value })}
          data-testid="select-size"
        >
          <option value="1024x1024">1024×1024 (الأرخص)</option>
          <option value="1024x1536">1024×1536 (طولي)</option>
          <option value="1536x1024">1536×1024 (عرضي - أغلى)</option>
        </select>
      </Card>

      {/* Caps */}
      <Card className="p-4 space-y-3">
        <h3 className="font-bold">حدود الإنفاق</h3>
        <div>
          <Label className="text-xs">الحد اليومي (دولار)</Label>
          <Input
            type="number"
            value={local.dailyCapUsd}
            onChange={(e) => setLocal({ ...local, dailyCapUsd: parseFloat(e.target.value) || 0 })}
            data-testid="input-daily-cap"
          />
        </div>
        <div>
          <Label className="text-xs">الحد الشهري (دولار)</Label>
          <Input
            type="number"
            value={local.monthlyCapUsd}
            onChange={(e) => setLocal({ ...local, monthlyCapUsd: parseFloat(e.target.value) || 0 })}
            data-testid="input-monthly-cap"
          />
        </div>
      </Card>

      {/* Top users */}
      {stats && stats.topUsers.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-5 h-5 text-primary" />
            <h3 className="font-bold">أكثر المستخدمين استهلاكاً (هذا الشهر)</h3>
          </div>
          <div className="space-y-2">
            {stats.topUsers.map((u, i) => (
              <div key={u.user_id} className="flex items-center justify-between text-sm border-b pb-2" data-testid={`row-user-${u.user_id}`}>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-5">#{i + 1}</span>
                  <span className="font-medium">{u.first_name || ""} {u.last_name || ""}</span>
                </div>
                <div className="text-left">
                  <div className="font-bold text-sm">${u.cost.toFixed(2)}</div>
                  <div className="text-[10px] text-muted-foreground">{u.count} طلب</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Button
        className="w-full"
        size="lg"
        onClick={() => saveMutation.mutate(local)}
        disabled={saveMutation.isPending}
        data-testid="btn-save"
      >
        {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
        حفظ الإعدادات
      </Button>
    </div>
  );
}
