import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp, Wallet, ArrowDownLeft, ArrowUpRight, Loader2, CreditCard,
  Banknote, PhoneCall, AlertCircle, BarChart2, Eye, MousePointer,
  ShieldX, Tv, Megaphone, Receipt, Filter, X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

const PAYMENT_METHODS = [
  { value: "vodafone", label: "فودافون كاش", number: "01098553911", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  { value: "etisalat", label: "اتصالات e& كاش", number: "01126665741", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  { value: "instapay", label: "InstaPay", number: "01285558567", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  { value: "visa_bank", label: "فيزا / بنك (عبر سوق ماركات)", number: "", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  { value: "souq", label: "رصيد تطبيق سوق ماركات", number: "", color: "bg-primary/10 text-primary" },
];

function WithdrawDialog({ balanceEGP, label, minWithdrawalEGP = 100 }: { balanceEGP: number; label: string; minWithdrawalEGP?: number }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [phone, setPhone] = useState("");
  const [cardNote, setCardNote] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/payments', {
      type: 'withdrawal', amountEGP: parseFloat(amount),
      method, phoneNumber: method === 'visa_bank' ? cardNote : phone,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/publisher/report'] });
      queryClient.invalidateQueries({ queryKey: ['/api/advertiser/report'] });
      queryClient.invalidateQueries({ queryKey: ['/api/payments'] });
      setOpen(false);
      toast({ title: "✅ تم إرسال طلب السحب، سيتم المراجعة خلال 24 ساعة" });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "خطأ", description: err.message }),
  });

  const selectedMethod = PAYMENT_METHODS.find(m => m.value === method);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid="btn-withdraw">
          <Banknote className="w-4 h-4" /> سحب {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>طلب سحب الرصيد</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="bg-green-50 dark:bg-green-950/20 rounded-xl p-4">
            <div className="text-sm text-muted-foreground">رصيدك المتاح</div>
            <div className="text-2xl font-bold text-green-600">{balanceEGP.toFixed(2)} ج.م</div>
          </div>
          <div>
            <label className="text-sm font-medium">المبلغ (ج.م)</label>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder={`الحد الأدنى ${minWithdrawalEGP} ج.م`} className="mt-1" data-testid="input-withdraw-amount" />
          </div>
          <div>
            <label className="text-sm font-medium">طريقة الاستلام</label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="mt-1" data-testid="select-payment-method"><SelectValue placeholder="اختر طريقة" /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {method && !['souq', 'visa_bank'].includes(method) && (
            <div>
              <label className="text-sm font-medium">رقم المحفظة / الهاتف</label>
              <Input value={phone} onChange={e => setPhone(e.target.value)}
                placeholder={selectedMethod?.number || "01xxxxxxxxx"} className="mt-1 font-mono"
                data-testid="input-wallet-number" />
            </div>
          )}
          {method === 'visa_bank' && (
            <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-xl p-3 space-y-2">
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">💳 فيزا / بنك عبر تطبيق سوق ماركات</p>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-emerald-600 dark:text-emerald-500">✅ بدون رسوم تحويل</span>
                <span className="text-xs text-emerald-600 dark:text-emerald-500">🎁 تكسب نقاط مشتريات على كل عملية سحب تُضاف لرصيد نقاطك في التطبيق</span>
              </div>
              <Input value={cardNote} onChange={e => setCardNote(e.target.value)}
                placeholder="رقم الحساب البنكي أو ملاحظة" className="font-mono text-xs"
                data-testid="input-bank-note" />
            </div>
          )}
          {method === 'souq' && (
            <div className="bg-primary/5 rounded-xl p-3">
              <p className="text-xs text-primary font-bold">🏪 سيُضاف لرصيد تطبيق سوق ماركات فوراً بدون رسوم</p>
            </div>
          )}
          <div className="flex items-start gap-2 bg-yellow-50 dark:bg-yellow-950/20 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
            <p className="text-xs text-yellow-700 dark:text-yellow-400">
               مراجعة الطلبات خلال 24-48 ساعة عمل. الحد الأدنى {minWithdrawalEGP} ج.م.
            </p>
          </div>
          <Button className="w-full" onClick={() => mutation.mutate()}
            disabled={!amount || !method || parseFloat(amount) < minWithdrawalEGP || parseFloat(amount) > balanceEGP || mutation.isPending}
            data-testid="btn-confirm-withdraw">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : null}
            تأكيد طلب السحب
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── كشف حساب مع فلاتر (نوع + من/إلى) ─────────────────────────────────
const TX_PAGE_SIZE = 30;

const TX_TYPE_OPTIONS: { value: 'earning' | 'spending' | 'withdrawal' | 'ai_charge' | 'wallet_recharge'; label: string }[] = [
  { value: 'earning',         label: 'أرباح' },
  { value: 'spending',        label: 'إنفاق' },
  { value: 'withdrawal',      label: 'سحب' },
  { value: 'ai_charge',       label: 'شحن AI' },
  { value: 'wallet_recharge', label: '💰 شحن محفظة' },
];

type RevenueTxFilterType = 'earning' | 'spending' | 'withdrawal' | 'ai_charge' | 'wallet_recharge';
const REVENUE_TX_FILTER_TYPES: readonly RevenueTxFilterType[] = ['earning', 'spending', 'withdrawal', 'ai_charge', 'wallet_recharge'];
type TxKind = 'earning' | 'spending';
function TransactionList({
  defaultType,
  emptyText,
  testIdPrefix,
}: {
  defaultType: TxKind;
  emptyText: string;
  testIdPrefix: string;
}) {
  const { toast } = useToast();
  const [type, setType] = useState<RevenueTxFilterType>(defaultType);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pages, setPages] = useState<any[][]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    p.set('type', type);
    p.set('limit', String(TX_PAGE_SIZE));
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    return p.toString();
  }, [type, from, to]);

  // إعادة تحميل الصفحة الأولى عند تغيّر الفلاتر
  useEffect(() => {
    let cancelled = false;
    setInitialLoading(true);
    setPages([]);
    setHasMore(true);
    (async () => {
      try {
        const res = await fetch(`/api/revenue?${queryString}&offset=0`, { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        setPages([json.transactions || []]);
        setHasMore(!!json.hasMore);
      } catch (e: any) {
        if (!cancelled) toast({ variant: 'destructive', title: 'تعذر تحميل المعاملات', description: e.message });
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [queryString, toast]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const offset = pages.reduce((sum, p) => sum + p.length, 0);
      const res = await fetch(`/api/revenue?${queryString}&offset=${offset}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setPages(prev => [...prev, json.transactions || []]);
      setHasMore(!!json.hasMore);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'تعذر تحميل المزيد', description: e.message });
    } finally {
      setLoadingMore(false);
    }
  };

  const all = pages.flat();
  const hasFilters = !!from || !!to || type !== defaultType;

  return (
    <>
      {/* شريط الفلاتر */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-2 mb-4">
        <div>
          <label className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1">
            <Filter className="w-3 h-3" /> النوع
          </label>
          <Select value={type} onValueChange={(v) => {
            if ((REVENUE_TX_FILTER_TYPES as readonly string[]).includes(v)) {
              setType(v as RevenueTxFilterType);
            }
          }}>
            <SelectTrigger className="h-9 text-xs" data-testid={`${testIdPrefix}-filter-type`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TX_TYPE_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground mb-1 block">من تاريخ</label>
          <Input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)}
            className="h-9 text-xs" data-testid={`${testIdPrefix}-filter-from`} />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground mb-1 block">إلى تاريخ</label>
          <Input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)}
            className="h-9 text-xs" data-testid={`${testIdPrefix}-filter-to`} />
        </div>
        {hasFilters && (
          <div className="flex items-end">
            <Button type="button" variant="outline" size="sm" className="h-9 gap-1"
              onClick={() => { setType(defaultType); setFrom(''); setTo(''); }}
              data-testid={`${testIdPrefix}-filter-reset`}>
              <X className="w-3.5 h-3.5" /> مسح
            </Button>
          </div>
        )}
      </div>

      {initialLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : all.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{hasFilters ? 'لا توجد معاملات تطابق الفلاتر المختارة' : emptyText}</p>
        </div>
      ) : (
        <>
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {all.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-muted/50 text-sm" data-testid={`${testIdPrefix}-tx-${t.id}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                    (t.type === 'earning' || t.type === 'wallet_recharge') ? 'bg-green-100 dark:bg-green-900/30'
                    : 'bg-red-100 dark:bg-red-900/30'
                  }`}>
                    {(t.type === 'earning' || t.type === 'wallet_recharge')
                      ? <ArrowUpRight className="w-3.5 h-3.5 text-green-600" />
                      : <ArrowDownLeft className="w-3.5 h-3.5 text-red-500" />}
                  </div>
                  <div>
                    <div className="text-xs font-medium flex items-center gap-1">
                      {t.type === 'wallet_recharge' && <span className="text-[9px] bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-full font-bold">شحن محفظة</span>}
                      {t.description}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{t.createdAt ? format(new Date(t.createdAt), 'dd/MM/yy HH:mm', { locale: ar }) : ''}</div>
                  </div>
                </div>
                <div className={`font-bold text-xs ${(t.type === 'earning' || t.type === 'wallet_recharge') ? 'text-green-600' : 'text-red-500'}`}>
                  {(t.type === 'earning' || t.type === 'wallet_recharge') ? '+' : '-'}{(t.amountEGP || 0).toFixed(4)} ج.م
                </div>
              </div>
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center mt-3">
              <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore} data-testid={`btn-load-more-${testIdPrefix}-tx`}>
                {loadingMore ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : null}
                تحميل المزيد
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}

// ── ناشر ──────────────────────────────────────────────────────────────
function PublisherTab() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ['/api/publisher/report'],
    queryFn: () => fetch('/api/publisher/report', { credentials: 'include' }).then(r => r.json()),
  });
  const { data: payments = [] } = useQuery<any[]>({
    queryKey: ['/api/payments'],
    queryFn: () => fetch('/api/payments', { credentials: 'include' }).then(r => r.json()),
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!data?.channel) return (
    <div className="text-center py-16">
      <Tv className="w-12 h-12 mx-auto mb-3 opacity-30" />
      <p className="text-muted-foreground">ليس لديك قناة بعد لكسب الإيرادات منها</p>
      <p className="text-xs text-muted-foreground mt-1">أنشئ قناتك من صفحة القنوات</p>
    </div>
  );

  const { channel, channelStats, totalEarnedEGP, withdrawnEGP, balanceEGP, minWithdrawalEGP = 100 } = data;
  const realImpr = Number(channelStats?.real_impressions || 0);
  const realClicks = Number(channelStats?.real_clicks || 0);
  const fraudImpr = Number(channelStats?.fraud_impressions || 0);
  const fraudClicks = Number(channelStats?.fraud_clicks || 0);
  const campaignsServed = Number(channelStats?.campaigns_served || 0);

  return (
    <div className="space-y-6">
      {/* رأس القناة */}
      <Card className="rounded-2xl border-green-200 dark:border-green-900 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/20">
        <CardContent className="p-5 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center text-2xl">📺</div>
            <div>
              <div className="font-bold text-lg">{channel.name}</div>
              <div className="text-sm text-muted-foreground">{channel.subscriberCount} متابع · {campaignsServed} حملة إعلانية</div>
              <Badge className="mt-1 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 border-0 text-xs">ناشر معتمد ✓</Badge>
            </div>
          </div>
          {balanceEGP >= minWithdrawalEGP && <WithdrawDialog balanceEGP={balanceEGP} label="أرباحي" minWithdrawalEGP={minWithdrawalEGP} />}
        </CardContent>
      </Card>

      {/* إحصائيات */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "الرصيد المتاح", value: balanceEGP.toFixed(2), unit: "ج.م", icon: Wallet, color: "text-primary", bg: "from-primary/10 to-primary/5 border-primary/20" },
          { label: "إجمالي الأرباح", value: totalEarnedEGP.toFixed(2), unit: "ج.م", icon: TrendingUp, color: "text-green-600", bg: "from-green-500/10 to-green-500/5 border-green-500/20" },
          { label: "المسحوب", value: withdrawnEGP.toFixed(2), unit: "ج.م", icon: Banknote, color: "text-blue-500", bg: "from-blue-500/10 to-blue-500/5 border-blue-500/20" },
          { label: "حملات نُشرت فيها", value: campaignsServed.toString(), unit: "", icon: Megaphone, color: "text-purple-500", bg: "from-purple-500/10 to-purple-500/5 border-purple-500/20" },
        ].map(s => (
          <Card key={s.label} className={`rounded-2xl bg-gradient-to-br border ${s.bg}`}>
            <CardContent className="p-4">
              <s.icon className={`w-7 h-7 mb-2 ${s.color}`} />
              <div className="text-xl font-bold">{s.value} <span className="text-sm font-normal text-muted-foreground">{s.unit}</span></div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* مشاهدات ونقرات */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "مشاهدات حقيقية", value: realImpr.toLocaleString(), icon: Eye, color: "text-teal-500" },
          { label: "نقرات حقيقية", value: realClicks.toLocaleString(), icon: MousePointer, color: "text-indigo-500" },
          { label: "مشاهدات مرفوضة (احتيال)", value: fraudImpr.toLocaleString(), icon: ShieldX, color: "text-red-400" },
          { label: "نقرات مرفوضة (احتيال)", value: fraudClicks.toLocaleString(), icon: ShieldX, color: "text-red-400" },
        ].map(s => (
          <Card key={s.label} className="rounded-2xl">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`w-6 h-6 ${s.color}`} />
              <div>
                <div className="font-bold text-base">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* طلبات السحب */}
      {payments.filter((p: any) => p.type === 'withdrawal').length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">طلبات السحب</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {payments.filter((p: any) => p.type === 'withdrawal').map((p: any) => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-muted rounded-xl" data-testid={`withdraw-${p.id}`}>
                <div className="flex items-center gap-3">
                  <PhoneCall className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">{PAYMENT_METHODS.find(m => m.value === p.method)?.label || p.method}</div>
                    <div className="text-xs text-muted-foreground">{p.orderNumber} · {p.phoneNumber || p.adminNote}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold">{p.amountEGP} ج.م</div>
                  <Badge variant={p.status === 'approved' ? 'default' : p.status === 'rejected' ? 'destructive' : 'secondary'} className="text-xs">
                    {p.status === 'pending' ? 'قيد المراجعة' : p.status === 'approved' ? 'مقبول ✓' : 'مرفوض'}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* سجل الأرباح */}
      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Receipt className="w-4 h-4" /> كشف حساب الأرباح</CardTitle></CardHeader>
        <CardContent>
          <TransactionList
            defaultType="earning"
            emptyText="لا توجد أرباح بعد — الإيرادات ستظهر هنا عند عرض الإعلانات"
            testIdPrefix="pub"
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ── معلن ──────────────────────────────────────────────────────────────
function AdvertiserTab() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ['/api/advertiser/report'],
    queryFn: () => fetch('/api/advertiser/report', { credentials: 'include' }).then(r => r.json()),
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!data?.campaigns?.length) return (
    <div className="text-center py-16">
      <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-30" />
      <p className="text-muted-foreground">ليس لديك حملات إعلانية بعد</p>
      <p className="text-xs text-muted-foreground mt-1">أنشئ حملتك الأولى من صفحة الحملات</p>
    </div>
  );

  const { campaigns, totalSpentEGP, balanceEGP } = data;

  return (
    <div className="space-y-6">
      {/* ملخص الإنفاق */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: "إجمالي الإنفاق", value: totalSpentEGP.toFixed(2), unit: "ج.م", icon: CreditCard, color: "text-red-500", bg: "from-red-500/10 to-red-500/5 border-red-500/20" },
          { label: "عدد الحملات", value: campaigns.length.toString(), unit: "", icon: Megaphone, color: "text-blue-500", bg: "from-blue-500/10 to-blue-500/5 border-blue-500/20" },
          { label: "رصيدك الحالي", value: balanceEGP.toFixed(2), unit: "ج.م", icon: Wallet, color: "text-primary", bg: "from-primary/10 to-primary/5 border-primary/20" },
        ].map(s => (
          <Card key={s.label} className={`rounded-2xl bg-gradient-to-br border ${s.bg}`}>
            <CardContent className="p-4">
              <s.icon className={`w-7 h-7 mb-2 ${s.color}`} />
              <div className="text-xl font-bold">{s.value} <span className="text-sm font-normal text-muted-foreground">{s.unit}</span></div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* تفاصيل كل حملة */}
      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart2 className="w-4 h-4" /> تقرير الحملات التفصيلي</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {campaigns.map((c: any) => (
            <div key={c.id} className="border rounded-xl p-4 space-y-3" data-testid={`camp-report-${c.id}`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="font-bold">{c.name}</div>
                  <div className="text-xs text-muted-foreground">حملة #{c.id}</div>
                </div>
                <Badge variant={c.status === 'active' ? 'default' : c.status === 'paused' ? 'secondary' : 'destructive'} className="text-xs">
                  {c.status === 'active' ? '✅ نشطة' : c.status === 'paused' ? '⏸️ متوقفة' : '❌ مرفوضة'}
                </Badge>
              </div>

              {/* شريط الميزانية */}
              {c.budgetEGP > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>الميزانية المستهلكة</span>
                    <span className={`font-bold ${c.budgetPct >= 90 ? 'text-red-500' : c.budgetPct >= 70 ? 'text-yellow-500' : 'text-green-600'}`}>
                      {c.budgetPct}%
                    </span>
                  </div>
                  <Progress value={c.budgetPct} className={`h-2 ${c.budgetPct >= 90 ? '[&>div]:bg-red-500' : c.budgetPct >= 70 ? '[&>div]:bg-yellow-500' : ''}`} />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>صُرف: {(c.spentEGP || 0).toFixed(3)} ج.م</span>
                    <span>الميزانية: {c.budgetEGP} ج.م</span>
                  </div>
                </div>
              )}

              {/* إحصائيات الحملة */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {[
                  { label: "مشاهدات حقيقية", value: c.realImpressions.toLocaleString(), icon: Eye, cls: "text-teal-600" },
                  { label: "نقرات حقيقية", value: c.realClicks.toLocaleString(), icon: MousePointer, cls: "text-indigo-600" },
                  { label: "نسبة النقر CTR", value: `${c.ctr}%`, icon: BarChart2, cls: "text-blue-600" },
                  { label: "سعر 1000 مشاهدة", value: `${c.cpmRate} ج.م`, icon: Banknote, cls: "text-purple-600" },
                  { label: "سعر النقرة", value: `${c.cpcRate.toFixed(3)} ج.م`, icon: CreditCard, cls: "text-orange-600" },
                  { label: "محاولات احتيال", value: (c.fraudImpressions + c.fraudClicks).toString(), icon: ShieldX, cls: "text-red-400" },
                ].map(s => (
                  <div key={s.label} className="bg-muted/40 rounded-lg p-2 text-center">
                    <s.icon className={`w-3.5 h-3.5 mx-auto mb-1 ${s.cls}`} />
                    <div className="font-bold text-xs">{s.value}</div>
                    <div className="text-[9px] text-muted-foreground leading-tight">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* تحذير الميزانية */}
              {c.budgetPct >= 80 && c.status === 'active' && (
                <div className={`flex items-center gap-2 rounded-lg p-2.5 text-xs ${c.budgetPct >= 100 ? 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400' : 'bg-yellow-50 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-400'}`}>
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {c.budgetPct >= 100
                    ? '⛔ انتهت الميزانية — الحملة متوقفة. اشحن رصيدك لاستئناف النشر.'
                    : `⚠️ استهلكت ${c.budgetPct}% من الميزانية — اشحن رصيدك قبل توقف الحملة!`}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* طرق شحن الرصيد الإعلاني */}
      <Card className="rounded-2xl overflow-hidden">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><CreditCard className="w-4 h-4" /> طرق شحن رصيدك الإعلاني</CardTitle></CardHeader>
        <CardContent className="p-0">
          {/* الدفع الفوري */}
          <div className="px-5 pb-4">
            <p className="text-xs text-muted-foreground mb-3">تواصل معنا بعد الدفع لتفعيل رصيدك فوراً</p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-3 py-1.5 rounded-full font-bold">📱 Vodafone Cash: 01098553911</span>
              <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-3 py-1.5 rounded-full font-bold">📱 Etisalat: 01126665741</span>
              <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-full font-bold">💳 InstaPay: 01285558567</span>

            </div>
          </div>

          {/* جميع بطاقات فيزا / مستركارد */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/10 px-5 py-4 border-t">
            <p className="text-sm font-bold mb-1 flex items-center gap-2">
              <span>💳</span> جميع بطاقات فيزا ومستركارد وكارت الدفع مقبولة
            </p>
            <p className="text-xs text-muted-foreground mb-2">من أي بنك مصري أو دولي — ائتمانية أو دفع فوري (Debit)</p>
            <div className="flex flex-wrap gap-2 text-xs">
              {["🟦 Visa", "🔴 Mastercard", "💙 Meeza", "🏦 أي بنك مصري", "🌍 بطاقات دولية"].map(b => (
                <span key={b} className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2.5 py-1 rounded-full font-bold">{b}</span>
              ))}
            </div>
          </div>

          {/* التقسيط */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/10 px-5 py-4 border-t">
            <p className="text-sm font-bold mb-1 flex items-center gap-2">
              <span>📅</span> تقسيط قيمة الإعلانات من 6 إلى 18 شهر
            </p>
            <p className="text-xs text-muted-foreground mb-2">متاح عبر بطاقات الفيزا والماستركارد الائتمانية من أي بنك</p>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {[6, 9, 12, 18].map(m => (
                <span key={m} className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-2.5 py-1 rounded-full font-bold">{m} شهر</span>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">* الأقساط تُحسب حسب سياسة البنك المُصدِر للبطاقة</p>
          </div>

          {/* البنك الأهلي 55 يوم */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/10 px-5 py-4 border-t">
            <p className="text-sm font-bold mb-1 flex items-center gap-2">
              <span>🏦</span> فيزا مشتريات البنك الأهلي المصري — 55 يوم سماح
            </p>
            <p className="text-xs text-muted-foreground mb-2">
              سدّد قيمة إعلاناتك خلال
              <span className="font-bold text-emerald-700 dark:text-emerald-400"> 55 يوم </span>
              بدون فوائد أو مصاريف عبر حساب العرض المتاح من فيزا مشتريات البنك الأهلي
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2.5 py-1.5 rounded-full font-bold">✅ بدون فوائد</span>
              <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2.5 py-1.5 rounded-full font-bold">✅ بدون مصاريف</span>
              <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2.5 py-1.5 rounded-full font-bold">🕐 55 يوم سماح</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* كشف حساب الإنفاق */}
      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Receipt className="w-4 h-4" /> كشف حساب الإنفاق</CardTitle></CardHeader>
        <CardContent>
          <TransactionList
            defaultType="spending"
            emptyText="لا توجد معاملات بعد"
            testIdPrefix="adv"
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ── الصفحة الرئيسية ───────────────────────────────────────────────────
export default function Revenue() {
  const { data: pubData } = useQuery<any>({
    queryKey: ['/api/publisher/report'],
    queryFn: () => fetch('/api/publisher/report', { credentials: 'include' }).then(r => r.json()),
  });
  const { data: advData } = useQuery<any>({
    queryKey: ['/api/advertiser/report'],
    queryFn: () => fetch('/api/advertiser/report', { credentials: 'include' }).then(r => r.json()),
  });

  const isPublisher = !!pubData?.channel;
  const isAdvertiser = !!(advData?.campaigns?.length);
  const defaultTab = isPublisher ? 'publisher' : 'advertiser';

  return (
    <div className="container px-4 py-10 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold flex items-center gap-2">💰 الإيرادات والتقارير</h1>
        <p className="text-muted-foreground mt-1">جميع المبالغ بالجنيه المصري — بياناتك الخاصة فقط</p>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="mb-6 w-full">
          <TabsTrigger value="publisher" className="flex-1 gap-2" disabled={!isPublisher && pubData !== undefined}>
            <Tv className="w-4 h-4" /> ناشر (صاحب قناة)
          </TabsTrigger>
          <TabsTrigger value="advertiser" className="flex-1 gap-2" disabled={!isAdvertiser && advData !== undefined}>
            <Megaphone className="w-4 h-4" /> معلن
          </TabsTrigger>
        </TabsList>
        <TabsContent value="publisher"><PublisherTab /></TabsContent>
        <TabsContent value="advertiser"><AdvertiserTab /></TabsContent>
      </Tabs>
    </div>
  );
}
