import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  ShieldX, Tv, Megaphone, Receipt, Filter, X, Coins, CircleDollarSign,
  History
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  finiteReportNumber,
  formatReportDate,
  formatReportMoney,
  formatReportMoneyOrUnavailable,
  normalizeRevenueActivity,
  normalizeRevenueActivityList,
  normalizeRevenueTransaction,
  normalizeRevenueTransactions,
} from "@/lib/revenue-report";

const PAYMENT_METHODS = [
  { value: "mobile_wallet", label: "محفظة إلكترونية", hint: "010 / 011 / 012 / 015" },
  { value: "instapay", label: "InstaPay", hint: "رقم الموبايل أو عنوان IPA" },
  { value: "visa_bank", label: "بطاقة بنكية 16 رقماً", hint: "التحويل إلى البطاقة عبر InstaPay" },
  // Labels retained for existing requests created before the unified wallet option.
  { value: "vodafone", label: "فودافون كاش", hint: "" },
  { value: "etisalat", label: "اتصالات كاش", hint: "" },
];
const NEW_WITHDRAWAL_METHODS = new Set(["mobile_wallet", "instapay", "visa_bank"]);

async function fetchRevenueJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === "object" && "message" in body
      ? String((body as { message?: unknown }).message || `HTTP ${response.status}`)
      : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return body as T;
}

function WithdrawDialog({ balanceEGP, label, minWithdrawalEGP = 100 }: { balanceEGP: number; label: string; minWithdrawalEGP?: number }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [payoutName, setPayoutName] = useState("");
  const [payoutDestination, setPayoutDestination] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const safeBalance = finiteReportNumber(balanceEGP);
  const safeMinimum = Math.max(10, finiteReportNumber(minWithdrawalEGP, 100));
  const requestedAmount = finiteReportNumber(amount, -1);

  const mutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/payments', {
      type: 'withdrawal', amountEGP: parseFloat(amount),
      method, payoutName, payoutDestination,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/publisher/report'] });
      queryClient.invalidateQueries({ queryKey: ['/api/advertiser/report'] });
      queryClient.invalidateQueries({ queryKey: ['/api/revenue'] });
      queryClient.invalidateQueries({ queryKey: ['/api/payments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/payments/unified'] });
      setAmount("");
      setMethod("");
      setPayoutName("");
      setPayoutDestination("");
      setOpen(false);
      toast({ title: "✅ تم إرسال طلب السحب، سيتم المراجعة خلال 24 ساعة" });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "خطأ", description: err.message }),
  });

  const selectedMethod = PAYMENT_METHODS.find(m => m.value === method);
  const clearForm = () => {
    setAmount("");
    setMethod("");
    setPayoutName("");
    setPayoutDestination("");
  };
  const updateDestination = (value: string) => {
    if (method === "visa_bank") {
      const digits = value.replace(/\D/g, "").slice(0, 16);
      setPayoutDestination(digits.replace(/(\d{4})(?=\d)/g, "$1 "));
      return;
    }
    setPayoutDestination(value);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      setOpen(nextOpen);
      if (!nextOpen) clearForm();
    }}>
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
            <div className="text-2xl font-bold text-green-600">{formatReportMoney(safeBalance)} ج.م</div>
          </div>
          <div>
            <label className="text-sm font-medium">المبلغ (ج.م)</label>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)}
               placeholder={`الحد الأدنى ${safeMinimum} ج.م`} className="mt-1" data-testid="input-withdraw-amount" />
          </div>
          <div>
            <label className="text-sm font-medium">طريقة الاستلام</label>
            <Select value={method} onValueChange={(value) => { setMethod(value); setPayoutDestination(""); }}>
              <SelectTrigger className="mt-1" data-testid="select-payment-method"><SelectValue placeholder="اختر طريقة" /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.filter(m => NEW_WITHDRAWAL_METHODS.has(m.value)).map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {method && (
            <div>
              <label className="text-sm font-medium">
                {method === "visa_bank" ? "اسم صاحب البطاقة بالكامل" : "اسم صاحب وسيلة الاستلام بالكامل"}
              </label>
              <Input
                value={payoutName}
                onChange={e => setPayoutName(e.target.value)}
                placeholder="الاسم كما هو مسجل لدى جهة التحويل"
                className="mt-1"
                autoComplete="name"
                data-testid="input-payout-name"
              />
            </div>
          )}
          {method && (
            <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
              <label className="text-sm font-medium">
                {method === "visa_bank" ? "رقم البطاقة" : method === "instapay" ? "بيانات InstaPay" : "رقم المحفظة"}
              </label>
              <Input
                value={payoutDestination}
                onChange={e => updateDestination(e.target.value)}
                placeholder={selectedMethod?.hint}
                className="font-mono"
                inputMode={method === "instapay" ? "text" : "numeric"}
                autoComplete="off"
                maxLength={method === "visa_bank" ? 19 : 100}
                data-testid={method === "visa_bank" ? "input-card-number" : method === "instapay" ? "input-instapay-destination" : "input-wallet-number"}
              />
              <p className="text-[11px] text-muted-foreground">
                {method === "visa_bank"
                  ? "يُشفّر الرقم ولا يظهر كاملاً إلا للأدمن عند تنفيذ التحويل عبر InstaPay."
                  : method === "instapay"
                    ? "اكتب رقم الموبايل المسجل أو عنوان IPA."
                    : "اكتب رقم الموبايل المصري المرتبط بالمحفظة."}
              </p>
            </div>
          )}
          <div className="flex items-start gap-2 bg-yellow-50 dark:bg-yellow-950/20 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
            <p className="text-xs text-yellow-700 dark:text-yellow-400">
               مراجعة الطلبات خلال 24-48 ساعة عمل. الحد الأدنى {safeMinimum} ج.م.
            </p>
          </div>
          <Button className="w-full" onClick={() => mutation.mutate()}
             disabled={!amount || !method || payoutName.trim().length < 3 || !payoutDestination.trim() || requestedAmount < safeMinimum || requestedAmount > safeBalance || mutation.isPending}
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
        setPages([normalizeRevenueTransactions(json?.transactions)]);
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
      setPages(prev => [...prev, normalizeRevenueTransactions(json?.transactions)]);
      setHasMore(!!json.hasMore);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'تعذر تحميل المزيد', description: e.message });
    } finally {
      setLoadingMore(false);
    }
  };

  const all = pages.flat().map((transaction, index) => normalizeRevenueTransaction(transaction, index));
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
                    <div className="text-[10px] text-muted-foreground">{formatReportDate(t.createdAt)}</div>
                  </div>
                </div>
                <div className={`font-bold text-xs ${(t.type === 'earning' || t.type === 'wallet_recharge') ? 'text-green-600' : 'text-red-500'}`}>
                  {(t.type === 'earning' || t.type === 'wallet_recharge') ? '+' : '-'}{formatReportMoney(t.amountEGP, 4)} ج.م
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

const ACTIVITY_LABELS: Record<string, string> = {
  deposit: "إيداع",
  withdrawal: "سحب",
  coin_purchase: "شراء عملات",
  coin_recharge: "شحن عملات",
  gift_sent: "هدية مرسلة",
  gift_received: "هدية مستلمة",
  platform_share: "حصة المنصة",
  revenue: "أرباح",
  spending: "إنفاق",
  adjustment: "تسوية",
};

const ACTIVITY_STATUS_LABELS: Record<string, string> = {
  pending: "قيد المراجعة",
  failed: "فشل",
  rejected: "مرفوض",
  approved: "مقبول",
  paid: "تم الدفع",
  test: "اختبار فقط",
  completed: "مكتمل",
};

function hasSettledActivityMovement(activity: ReturnType<typeof normalizeRevenueActivity>): boolean {
  return activity.signedAmount !== 0
    && ["completed", "paid", "approved", "fulfilled"].includes(activity.status);
}

function activityAmountLabel(activity: ReturnType<typeof normalizeRevenueActivity>): string {
  const amount = formatReportMoney(activity.amount, activity.asset === "COIN" ? 0 : 2);
  if (activity.amount > 0 && activity.signedAmount === 0) {
    return `مطلوب ${amount} ${activity.asset === "COIN" ? "🪙" : "ج.م"}`;
  }
  return `${activity.signedAmount >= 0 ? "+" : "−"}${amount} ${activity.asset === "COIN" ? "🪙" : "ج.م"}`;
}

function reportNumberOrUnavailable(...values: unknown[]): number | null {
  const value = values.find(candidate => candidate !== null && candidate !== undefined && candidate !== "");
  return value === undefined ? null : finiteReportNumber(value);
}

function queryErrorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * The personal account section deliberately uses the authenticated unified
 * activity feed rather than inventing values from channel/campaign totals.
 * The ledger endpoint remains the fallback for deployments where the activity
 * feed is temporarily unavailable.
 */
function PersonalReport() {
  const reportQuery = useInfiniteQuery<any>({
    queryKey: ['/api/revenue', 'personal-report'],
    queryFn: ({ pageParam = 0 }) => fetchRevenueJson(`/api/revenue?limit=100&offset=${pageParam}`),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage?.hasMore
      ? Number(lastPage.offset || 0) + Number(lastPage.limit || 100)
      : undefined,
  });
  const activityQuery = useInfiniteQuery<any>({
    queryKey: ['/api/payments/unified', 'revenue-report'],
    queryFn: ({ pageParam = 0 }) => fetchRevenueJson(`/api/payments/unified?scope=self&limit=100&offset=${pageParam}&includeMeta=1`),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage?.hasMore
      ? Number(lastPage.offset || 0) + Number(lastPage.limit || 100)
      : undefined,
  });
  const { data: rawPayments, isError: paymentsError, error: paymentsQueryError } = useQuery<unknown>({
    queryKey: ['/api/payments', 'revenue-report'],
    queryFn: () => fetchRevenueJson('/api/payments?scope=self'),
  });
  const reportPages = reportQuery.data?.pages || [];
  const report = reportPages[0];
  const reportLoading = reportQuery.isLoading;
  const reportIsError = reportQuery.isError;
  const reportQueryError = reportQuery.error;
  const reportHasMore = Boolean(reportPages[reportPages.length - 1]?.hasMore);
  const activityLoading = activityQuery.isLoading;
  const activityError = activityQuery.isError;
  const activityQueryError = activityQuery.error;
  const activityPages = activityQuery.data?.pages || [];
  const rawActivity = activityPages.flatMap((page: any) => Array.isArray(page) ? page : page?.activities || []);
  const activityHasMore = Boolean(activityPages[activityPages.length - 1]?.hasMore);
  const reportError = reportIsError;

  if (reportLoading && activityLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const ledgerTransactions = reportPages.flatMap((page: any) => normalizeRevenueTransactions(page?.transactions));
  const activity = normalizeRevenueActivityList(rawActivity);
  const history = activity.length > 0
    ? activity
    : ledgerTransactions.map((transaction, index) => normalizeRevenueActivity({
      id: `revenue_transaction:${transaction.id}`,
      source: transaction.campaignId != null
        ? "ad_campaign"
        : /هدية|هدايا|gift/i.test(transaction.description)
          ? "live_gift"
          : "revenue_transaction",
      kind: transaction.type === "earning" ? "revenue" : transaction.type === "wallet_recharge" ? "deposit" : transaction.type === "withdrawal" ? "withdrawal" : "spending",
      asset: "EGP",
      amount: transaction.amountEGP,
      signedAmount: ["earning", "wallet_recharge"].includes(transaction.type) ? transaction.amountEGP : -transaction.amountEGP,
      moneyAmount: transaction.amountEGP,
      status: "completed",
      description: transaction.description,
      reference: transaction.campaignId ?? transaction.channelId ?? "",
      createdAt: transaction.createdAt,
    }, index));
  const totals = report?.totals || {};
  const totalEarned = reportNumberOrUnavailable(
    totals.earning ?? report?.totalEarnedEGP ?? report?.total_earned_egp,
  );
  const totalWithdrawn = reportNumberOrUnavailable(
    totals.withdrawal ?? report?.withdrawnEGP ?? report?.withdrawn_egp,
  );
  const totalDeposits = reportNumberOrUnavailable(
    totals.walletRecharge ?? totals.wallet_recharge ?? report?.walletRechargeEGP,
  );
  const ledgerSpending = reportNumberOrUnavailable(
    totals.spending ?? report?.totalSpentEGP ?? report?.total_spent_egp,
  );
  const aiCharges = reportNumberOrUnavailable(totals.aiCharge ?? totals.ai_charge);
  const totalSpent = ledgerSpending == null && aiCharges == null
    ? null
    : (ledgerSpending ?? 0) + (aiCharges ?? 0);
  const balance = reportNumberOrUnavailable(report?.balanceEGP, report?.balance_egp);
  const withdrawable = reportNumberOrUnavailable(
    report?.withdrawableBalanceEGP ?? report?.withdrawable_balance_egp,
  );
  const earningSources = history.filter(row => row.kind === "revenue");
  const withdrawals = history.filter(row => row.kind === "withdrawal");
  const deposits = history.filter(row => row.kind === "deposit");
  const coinPurchases = history.filter(row => row.kind === "coin_purchase");
  const coinActivity = history.filter(row => row.asset === "COIN" || ["coin_purchase", "coin_recharge", "gift_sent", "gift_received"].includes(row.kind));
  const payments = Array.isArray(rawPayments) ? rawPayments : [];
  const withdrawalRequests = payments.filter((payment: any) => payment?.type === "withdrawal");
  const coinPurchaseCount = activityError && activity.length === 0 ? null : coinPurchases.length;
  const hasAnyData = history.length > 0 || withdrawalRequests.length > 0
    || [totalEarned, totalDeposits, totalSpent].some(value => value != null && value > 0);
  const hasQueryError = Boolean(reportError || activityError || paymentsError);
  const historyUsesLedgerFallback = activity.length === 0 && ledgerTransactions.length > 0;
  const recordsHaveMore = activityHasMore || (historyUsesLedgerFallback && reportHasMore);

  return (
    <div className="space-y-4 mb-8" data-testid="personal-revenue-report">
      {reportError && (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">
          تعذر تحميل ملخص الرصيد والأرقام الإجمالية: {queryErrorText(reportQueryError, "الخدمة غير متاحة")}. لم يتم استبدال البيانات الفاشلة بأصفار.
        </div>
      )}
      {activityError && (
        <div role="alert" className="rounded-xl border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950/20 dark:text-yellow-300">
          تعذر تحميل سجل النشاط الكامل: {queryErrorText(activityQueryError, "الخدمة غير متاحة")}.
          {historyUsesLedgerFallback ? " المعروض حالياً هو كشف الحساب المتاح فقط، وليس سجلاً كاملاً." : " لا يمكن اعتبار القائمة الفارغة دليلاً على عدم وجود معاملات."}
        </div>
      )}
      {paymentsError && (
        <div role="alert" className="rounded-xl border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950/20 dark:text-yellow-300">
          تعذر تحميل طلبات السحب: {queryErrorText(paymentsQueryError, "الخدمة غير متاحة")}.
        </div>
      )}
      <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CircleDollarSign className="w-4 h-4 text-primary" /> التقرير المالي الشخصي
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            مصادر الأرباح وحركة محفظتك وسجل العملات — لحسابك الحالي فقط
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "الأرباح", value: totalEarned, icon: TrendingUp, color: "text-green-600" },
              { label: "السحوبات", value: totalWithdrawn, icon: ArrowDownLeft, color: "text-orange-600" },
              { label: "الإيداعات/الشحن", value: totalDeposits, icon: Wallet, color: "text-blue-600" },
              { label: recordsHaveMore ? "عمليات شراء العملات المحمّلة" : "عمليات شراء العملات", value: coinPurchaseCount, icon: Coins, color: "text-amber-600", isCount: true },
              { label: "الرصيد الحالي", value: balance, icon: Wallet, color: "text-primary" },
            ].map(summary => (
              <div key={summary.label} className="rounded-xl border bg-background/70 p-3">
                <summary.icon className={`w-5 h-5 mb-1 ${summary.color}`} />
                <div className="font-bold text-sm">
                  {summary.value == null
                    ? "غير متاح"
                    : summary.isCount
                      ? summary.value.toLocaleString("ar-EG")
                      : formatReportMoneyOrUnavailable(summary.value)}
                  {!summary.isCount && summary.value != null && <span className="text-[10px] font-normal text-muted-foreground ms-1">ج.م</span>}
                </div>
                <div className="text-[10px] text-muted-foreground">{summary.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>القابل للسحب: <strong className="text-foreground">{formatReportMoneyOrUnavailable(withdrawable)}{withdrawable != null && " ج.م"}</strong></span>
            <span>الإنفاق: <strong className="text-foreground">{formatReportMoneyOrUnavailable(totalSpent)}{totalSpent != null && " ج.م"}</strong></span>
            {!hasQueryError && activity.length === 0 && report?.transactions == null && <span>لا تتوفر معاملات مالية بعد</span>}
          </div>
        </CardContent>
      </Card>

      {earningSources.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-600" /> مصادر الأرباح</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
              {earningSources.map(row => (
              <div key={String(row.id)} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-muted/50" data-testid={`earning-source-${row.id}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-1 truncate text-xs font-medium">
                    <span className="truncate">{row.description}</span>
                    <span className="shrink-0 rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] text-green-700 dark:bg-green-900/30 dark:text-green-300">
                      {row.source === "ad_campaign" ? "دخل إعلانات" : row.source === "live_gift" ? "هدايا البث المباشر" : "دخل آخر"}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">{formatReportDate(row.createdAt)}</div>
                </div>
                <span className="shrink-0 text-xs font-bold text-green-600">{activityAmountLabel(row)}</span>
              </div>
            ))}
            {recordsHaveMore && <div className="pt-1 text-center text-[10px] text-muted-foreground">تم تحميل أحدث جزء من المصادر — استخدم زر تحميل النشاط الأقدم لاستكمالها</div>}
          </CardContent>
        </Card>
      )}

      {withdrawalRequests.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Banknote className="w-4 h-4 text-orange-600" /> طلبات السحب</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {withdrawalRequests.slice(0, 20).map((payment: any) => (
              <div key={String(payment.id)} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2" data-testid={`personal-withdrawal-${payment.id}`}>
                <div className="min-w-0">
                  <div className="text-xs font-medium">{PAYMENT_METHODS.find(method => method.value === payment.method)?.label || payment.method || "وسيلة سحب"}</div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {payment.payoutName || "طلب سحب"}{payment.payoutDestinationMasked ? ` · ${payment.payoutDestinationMasked}` : ""}
                  </div>
                </div>
                <div className="shrink-0 text-end">
                  <div className="text-xs font-bold">{formatReportMoney(payment.amountEGP)} ج.م</div>
                  <Badge variant={payment.status === "approved" ? "default" : payment.status === "rejected" ? "destructive" : "secondary"} className="text-[10px]">
                    {payment.status === "approved" ? "مقبول" : payment.status === "rejected" ? "مرفوض" : "قيد المراجعة"}
                  </Badge>
                </div>
              </div>
            ))}
            {withdrawalRequests.length > 20 && <div className="pt-1 text-center text-[10px] text-muted-foreground">تظهر أحدث 20 طلب سحب فقط؛ راجع صفحة المدفوعات للقائمة الكاملة</div>}
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><History className="w-4 h-4" /> سجل المعاملات والنشاط</CardTitle>
        </CardHeader>
        <CardContent>
          {!hasAnyData ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {hasQueryError ? "تعذر التحقق من وجود معاملات؛ أعد المحاولة بعد عودة الخدمة." : "لا توجد معاملات مالية أو مشتريات عملات بعد"}
            </div>
          ) : (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {history.map(row => (
                <div key={String(row.id)} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-muted/50" data-testid={`personal-activity-${row.id}`}>
                  <div className="flex min-w-0 items-center gap-2">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${!hasSettledActivityMovement(row) ? "bg-muted text-muted-foreground" : row.signedAmount >= 0 ? "bg-green-100 text-green-600 dark:bg-green-900/30" : "bg-red-100 text-red-600 dark:bg-red-900/30"}`}>
                      {row.asset === "COIN" ? <Coins className="w-3.5 h-3.5" /> : !hasSettledActivityMovement(row) ? <Receipt className="w-3.5 h-3.5" /> : row.signedAmount >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownLeft className="w-3.5 h-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 truncate text-xs font-medium">
                        <span className="truncate">{row.description}</span>
                        <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px]">{ACTIVITY_LABELS[row.kind] || "نشاط"}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {formatReportDate(row.createdAt)}
                        {row.status !== "completed" ? ` · ${ACTIVITY_STATUS_LABELS[row.status] || row.status}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className={`shrink-0 text-xs font-bold ${!hasSettledActivityMovement(row) ? "text-muted-foreground" : row.signedAmount >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {activityAmountLabel(row)}
                    {row.asset === "COIN" && row.moneyAmount != null && <span className="block text-[9px] font-normal text-muted-foreground">{formatReportMoney(row.moneyAmount)} ج.م</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {coinActivity.length > 0 && (
            <div className="mt-4 border-t pt-3">
              <div className="mb-2 text-xs font-bold text-amber-700 dark:text-amber-300">حركة العملات: هدايا وشحن ومشتريات</div>
              <div className="space-y-1">
                {coinActivity.map(row => (
                  <div key={`coin-${String(row.id)}`} className="flex items-center justify-between gap-3 rounded-lg bg-amber-50/60 px-2 py-1.5 text-[11px] dark:bg-amber-950/10">
                    <span className="truncate">
                      {row.kind === "gift_sent" ? "هدية مرسلة" : row.kind === "gift_received" ? "هدية مستلمة" : row.kind === "coin_recharge" ? "شحن بكود عملات" : row.source === "afs_card" ? "شراء عملات بالبطاقة" : row.source === "coin_purchase_order" ? "شراء عملات يدوي" : "شراء عملات من المحفظة"}
                      {" · "}{row.description}
                    </span>
                    <span className="shrink-0 font-bold">{activityAmountLabel(row)}</span>
                  </div>
                ))}
              </div>
              {recordsHaveMore && <div className="pt-1 text-center text-[10px] text-muted-foreground">تم تحميل أحدث جزء من حركة العملات — حمّل النشاط الأقدم لاستكمال السجل</div>}
            </div>
          )}
          {activityHasMore && (
            <div className="flex justify-center pt-3">
              <Button variant="outline" size="sm" onClick={() => activityQuery.fetchNextPage()} disabled={activityQuery.isFetchingNextPage}>
                {activityQuery.isFetchingNextPage && <Loader2 className="w-4 h-4 animate-spin me-2" />}
                تحميل النشاط الأقدم
              </Button>
            </div>
          )}
          {reportHasMore && historyUsesLedgerFallback && (
            <div className="flex justify-center pt-3">
              <Button variant="outline" size="sm" onClick={() => reportQuery.fetchNextPage()} disabled={reportQuery.isFetchingNextPage}>
                {reportQuery.isFetchingNextPage && <Loader2 className="w-4 h-4 animate-spin me-2" />}
                تحميل كشف الحساب الأقدم
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {(withdrawals.length > 0 || deposits.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {deposits.length > 0 && <Card className="rounded-2xl"><CardContent className="p-4"><div className="text-xs font-bold mb-1 text-blue-600">آخر الإيداعات والشحن</div><div className="text-sm">{deposits.slice(0, 3).map(row => <div key={String(row.id)} className="flex justify-between gap-2 py-1"><span className="truncate">{row.description}</span><span className="shrink-0">{activityAmountLabel(row)}</span></div>)}</div></CardContent></Card>}
          {withdrawals.length > 0 && <Card className="rounded-2xl"><CardContent className="p-4"><div className="text-xs font-bold mb-1 text-orange-600">آخر السحوبات</div><div className="text-sm">{withdrawals.slice(0, 3).map(row => <div key={String(row.id)} className="flex justify-between gap-2 py-1"><span className="truncate">{row.description}</span><span className="shrink-0">{activityAmountLabel(row)}</span></div>)}</div></CardContent></Card>}
        </div>
      )}
    </div>
  );
}

// ── ناشر ──────────────────────────────────────────────────────────────
function PublisherTab() {
  const { data, isLoading, isError, error } = useQuery<any>({
    queryKey: ['/api/publisher/report'],
    queryFn: () => fetchRevenueJson('/api/publisher/report'),
  });
  const { data: payments = [] } = useQuery<any[]>({
    queryKey: ['/api/payments'],
    queryFn: async () => {
      const value = await fetchRevenueJson<unknown>('/api/payments?scope=self');
      return Array.isArray(value) ? value : [];
    },
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (isError) return (
    <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-6 text-center text-sm text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">
      تعذر تحميل تقرير الناشر: {queryErrorText(error, "الخدمة غير متاحة")}. لم يتم اعتبار التقرير فارغاً.
    </div>
  );
  if (!data?.channel) return (
    <div className="text-center py-16">
      <Tv className="w-12 h-12 mx-auto mb-3 opacity-30" />
      <p className="text-muted-foreground">ليس لديك قناة بعد لكسب الإيرادات منها</p>
      <p className="text-xs text-muted-foreground mt-1">أنشئ قناتك من صفحة القنوات</p>
    </div>
  );

  const { channel, channelStats } = data;
  const totalEarned = finiteReportNumber(data.totalEarnedEGP ?? data.total_earned_egp);
  const withdrawn = finiteReportNumber(data.withdrawnEGP ?? data.withdrawn_egp);
  const balance = finiteReportNumber(data.balanceEGP ?? data.balance_egp);
  const minWithdrawal = Math.max(
    10,
    finiteReportNumber(data.minWithdrawalEGP ?? data.min_withdrawal_egp, 100),
  );
  const realImpr = finiteReportNumber(channelStats?.realImpressions ?? channelStats?.real_impressions);
  const realClicks = finiteReportNumber(channelStats?.realClicks ?? channelStats?.real_clicks);
  const fraudImpr = finiteReportNumber(channelStats?.fraudImpressions ?? channelStats?.fraud_impressions);
  const fraudClicks = finiteReportNumber(channelStats?.fraudClicks ?? channelStats?.fraud_clicks);
  const campaignsServed = finiteReportNumber(channelStats?.campaignsServed ?? channelStats?.campaigns_served);

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
          {balance >= minWithdrawal && <WithdrawDialog balanceEGP={balance} label="أرباحي" minWithdrawalEGP={minWithdrawal} />}
        </CardContent>
      </Card>

      {/* إحصائيات */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "الرصيد المتاح", value: formatReportMoney(balance), unit: "ج.م", icon: Wallet, color: "text-primary", bg: "from-primary/10 to-primary/5 border-primary/20" },
          { label: "إجمالي الأرباح", value: formatReportMoney(totalEarned), unit: "ج.م", icon: TrendingUp, color: "text-green-600", bg: "from-green-500/10 to-green-500/5 border-green-500/20" },
          { label: "المسحوب", value: formatReportMoney(withdrawn), unit: "ج.م", icon: Banknote, color: "text-blue-500", bg: "from-blue-500/10 to-blue-500/5 border-blue-500/20" },
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
                    <div className="text-xs text-muted-foreground">{p.payoutName || "طلب قديم"} · {p.payoutDestinationMasked || p.phoneNumber || p.adminNote}</div>
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
  const { data, isLoading, isError, error } = useQuery<any>({
    queryKey: ['/api/advertiser/report'],
    queryFn: () => fetchRevenueJson('/api/advertiser/report'),
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (isError) return (
    <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-6 text-center text-sm text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">
      تعذر تحميل تقرير المعلن: {queryErrorText(error, "الخدمة غير متاحة")}. لم يتم اعتبار التقرير فارغاً.
    </div>
  );
  if (!data?.campaigns?.length) return (
    <div className="text-center py-16">
      <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-30" />
      <p className="text-muted-foreground">ليس لديك حملات إعلانية بعد</p>
      <p className="text-xs text-muted-foreground mt-1">أنشئ حملتك الأولى من صفحة الحملات</p>
    </div>
  );

  const campaigns = Array.isArray(data.campaigns) ? data.campaigns : [];
  const totalSpent = finiteReportNumber(data.totalSpentEGP ?? data.total_spent_egp);
  const balance = finiteReportNumber(data.balanceEGP ?? data.balance_egp);

  return (
    <div className="space-y-6">
      {/* ملخص الإنفاق */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: "إجمالي الإنفاق", value: formatReportMoney(totalSpent), unit: "ج.م", icon: CreditCard, color: "text-red-500", bg: "from-red-500/10 to-red-500/5 border-red-500/20" },
          { label: "عدد الحملات", value: campaigns.length.toString(), unit: "", icon: Megaphone, color: "text-blue-500", bg: "from-blue-500/10 to-blue-500/5 border-blue-500/20" },
          { label: "رصيدك الحالي", value: formatReportMoney(balance), unit: "ج.م", icon: Wallet, color: "text-primary", bg: "from-primary/10 to-primary/5 border-primary/20" },
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
              {finiteReportNumber(c.budgetEGP) > 0 && (
                <div>
                  {(() => {
                    const budgetEGP = finiteReportNumber(c.budgetEGP);
                    const spentEGP = finiteReportNumber(c.spentEGP);
                    const budgetPct = Math.max(0, finiteReportNumber(c.budgetPct));
                    return (
                      <>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>الميزانية المستهلكة</span>
                    <span className={`font-bold ${budgetPct >= 90 ? 'text-red-500' : budgetPct >= 70 ? 'text-yellow-500' : 'text-green-600'}`}>
                      {budgetPct}%
                    </span>
                  </div>
                  <Progress value={Math.min(100, budgetPct)} className={`h-2 ${budgetPct >= 90 ? '[&>div]:bg-red-500' : budgetPct >= 70 ? '[&>div]:bg-yellow-500' : ''}`} />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>صُرف: {formatReportMoney(spentEGP, 3)} ج.م</span>
                    <span>الميزانية: {formatReportMoney(budgetEGP)} ج.م</span>
                  </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* إحصائيات الحملة */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {[
                    { label: "مشاهدات حقيقية", value: finiteReportNumber(c.realImpressions).toLocaleString(), icon: Eye, cls: "text-teal-600" },
                    { label: "نقرات حقيقية", value: finiteReportNumber(c.realClicks).toLocaleString(), icon: MousePointer, cls: "text-indigo-600" },
                    { label: "نسبة النقر CTR", value: `${finiteReportNumber(c.ctr)}%`, icon: BarChart2, cls: "text-blue-600" },
                    { label: "سعر 1000 مشاهدة", value: `${formatReportMoney(c.cpmRate)} ج.م`, icon: Banknote, cls: "text-purple-600" },
                    { label: "سعر النقرة", value: `${formatReportMoney(c.cpcRate, 3)} ج.م`, icon: CreditCard, cls: "text-orange-600" },
                    { label: "محاولات احتيال", value: (finiteReportNumber(c.fraudImpressions) + finiteReportNumber(c.fraudClicks)).toString(), icon: ShieldX, cls: "text-red-400" },
                ].map(s => (
                  <div key={s.label} className="bg-muted/40 rounded-lg p-2 text-center">
                    <s.icon className={`w-3.5 h-3.5 mx-auto mb-1 ${s.cls}`} />
                    <div className="font-bold text-xs">{s.value}</div>
                    <div className="text-[9px] text-muted-foreground leading-tight">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* تحذير الميزانية */}
              {finiteReportNumber(c.budgetPct) >= 80 && c.status === 'active' && (
                <div className={`flex items-center gap-2 rounded-lg p-2.5 text-xs ${finiteReportNumber(c.budgetPct) >= 100 ? 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400' : 'bg-yellow-50 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-400'}`}>
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {finiteReportNumber(c.budgetPct) >= 100
                    ? '⛔ انتهت الميزانية — الحملة متوقفة. اشحن رصيدك لاستئناف النشر.'
                    : `⚠️ استهلكت ${finiteReportNumber(c.budgetPct)}% من الميزانية — اشحن رصيدك قبل توقف الحملة!`}
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
    queryFn: () => fetchRevenueJson('/api/publisher/report'),
  });
  const { data: advData } = useQuery<any>({
    queryKey: ['/api/advertiser/report'],
    queryFn: () => fetchRevenueJson('/api/advertiser/report'),
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

      <PersonalReport />

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
