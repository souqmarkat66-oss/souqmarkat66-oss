import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Megaphone, Wallet, Clock, DollarSign, Loader2 } from "lucide-react";
import type { TickerAd } from "@shared/schema";

const schema = z.object({
  text: z.string().min(5, "النص يجب أن يكون 5 أحرف على الأقل").max(220, "حد أقصى 220 حرف"),
  budgetEGP: z.coerce.number().min(1, "الميزانية مطلوبة"),
});
type FormValues = z.infer<typeof schema>;

const STATUS_LABEL: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "تمت الموافقة — بانتظار البدء",
  active: "🔴 نشط الآن",
  paused: "متوقف مؤقتاً",
  completed: "مكتمل (الميزانية انتهت)",
  rejected: "مرفوض",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "bg-blue-500",
  approved: "bg-amber-500",
  active: "bg-green-600",
  paused: "bg-gray-500",
  completed: "bg-zinc-700",
  rejected: "bg-red-500",
};

export default function TickerAds() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: balance } = useQuery<{ balance: number } | number>({
    queryKey: ["/api/wallet/balance"],
    queryFn: () => fetch("/api/wallet/balance", { credentials: "include" }).then(r => r.ok ? r.json() : { balance: 0 }),
  });
  const balanceEGP = typeof balance === "number" ? balance : (balance?.balance ?? 0);

  // Live price-per-second (admin-controlled, refreshes every 10s)
  const { data: priceData } = useQuery<{ pricePerSecondEGP: number }>({
    queryKey: ["/api/ticker-ads/price"],
    queryFn: () => fetch("/api/ticker-ads/price").then(r => r.json()),
    refetchInterval: 10000,
  });
  const currentPrice = priceData?.pricePerSecondEGP ?? 1;

  const { data: myAds = [], isLoading } = useQuery<TickerAd[]>({
    queryKey: ["/api/ticker-ads/my"],
    queryFn: () => fetch("/api/ticker-ads/my", { credentials: "include" }).then(r => r.json()),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { text: "", budgetEGP: 50 },
  });

  const createMutation = useMutation({
    mutationFn: async (vals: FormValues) => {
      const r = await apiRequest("POST", "/api/ticker-ads", vals);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "تم إرسال الإعلان للمراجعة", description: "سيظهر فور موافقة الإدارة وبدء التشغيل." });
      form.reset();
      qc.invalidateQueries({ queryKey: ["/api/ticker-ads/my"] });
    },
    onError: (err: any) => {
      const msg = err?.message?.includes("402") ? "رصيد المحفظة غير كافٍ" : (err?.message || "حدث خطأ");
      toast({ title: "فشل الإرسال", description: msg, variant: "destructive" });
    },
  });

  const onSubmit = (vals: FormValues) => {
    if (vals.budgetEGP > balanceEGP) {
      toast({ title: "رصيد غير كافٍ", description: `رصيدك ${balanceEGP} ج.م — اشحن المحفظة أولاً`, variant: "destructive" });
      return;
    }
    createMutation.mutate(vals);
  };

  const budget = form.watch("budgetEGP") || 0;
  const estSeconds = currentPrice > 0 ? Math.floor(budget / currentPrice) : 0;

  return (
    <div className="container mx-auto py-6 px-3 max-w-4xl space-y-6" dir="rtl">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/40 flex items-center justify-center">
          <Megaphone className="w-6 h-6 text-red-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold" data-testid="title-ticker-ads">إعلانات الشريط العاجل</h1>
          <p className="text-sm text-muted-foreground">إعلان نصي يظهر فوق كل البثوث لحظياً — تدفع بالثانية الفعلية</p>
        </div>
      </div>

      <Card className="border-2 border-red-200 dark:border-red-900/40">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="w-4 h-4" /> رصيدك الحالي
            </CardTitle>
            <span className="text-2xl font-bold text-green-600" data-testid="text-wallet-balance">
              {balanceEGP.toFixed(2)} ج.م
            </span>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>إنشاء إعلان شريط عاجل جديد</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="text" render={({ field }) => (
                <FormItem>
                  <FormLabel>نص الإعلان (يظهر متحركاً للمشاهدين)</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} placeholder="مثال: عرض حصري لفترة محدودة — اضغط هنا للمزيد..." data-testid="input-ticker-text" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="budgetEGP" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> الميزانية (ج.م)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.5" min="1" {...field} data-testid="input-ticker-budget" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="rounded-xl border-2 border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20 p-3 flex flex-col justify-center" data-testid="display-current-price">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="w-3 h-3" /> سعر الثانية (تحدده الإدارة)</div>
                  <div className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1">{currentPrice.toFixed(2)} ج.م</div>
                  <div className="text-[10px] text-muted-foreground">يتغير لحظياً حسب إعدادات المنصة</div>
                </div>
              </div>

              <div className="rounded-xl bg-muted/50 p-3 text-sm flex items-center justify-between">
                <span>مدة الظهور المتوقعة:</span>
                <span className="font-bold text-primary" data-testid="text-estimated-duration">
                  {estSeconds} ثانية ({Math.floor(estSeconds / 60)} د {estSeconds % 60} ث)
                </span>
              </div>

              <Button
                type="submit"
                className="w-full bg-red-600 hover:bg-red-700 text-white"
                disabled={createMutation.isPending}
                data-testid="btn-submit-ticker"
              >
                {createMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin ml-2" /> جاري الإرسال...</>
                ) : (
                  <>إرسال للمراجعة</>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>إعلاناتي السابقة</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          ) : myAds.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">لا توجد إعلانات بعد</p>
          ) : (
            <div className="space-y-3">
              {myAds.map((a) => {
                const remaining = (a.budgetEGP || 0) - (a.spentEGP || 0);
                const pct = a.budgetEGP ? Math.min(100, ((a.spentEGP || 0) / a.budgetEGP) * 100) : 0;
                return (
                  <div key={a.id} className="border rounded-xl p-3 space-y-2" data-testid={`card-my-ticker-${a.id}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium flex-1 line-clamp-2">{a.text}</p>
                      <Badge className={`${STATUS_COLOR[a.status]} text-white shrink-0`}>{STATUS_LABEL[a.status]}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <span>الميزانية: <b>{a.budgetEGP} ج.م</b></span>
                      <span>المنصرف: <b className="text-red-600">{(a.spentEGP || 0).toFixed(2)} ج.م</b></span>
                      <span>المتبقي: <b className="text-green-600">{remaining.toFixed(2)} ج.م</b></span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {a.secondsShown || 0} ثانية ظهور · سعر الثانية {a.pricePerSecondEGP} ج.م
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
