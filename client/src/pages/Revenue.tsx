import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TrendingUp, Wallet, ArrowDownLeft, ArrowUpRight, Loader2, CreditCard, Banknote, PhoneCall, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

const PAYMENT_METHODS = [
  { value: "vodafone", label: "فودافون كاش", number: "01098553911", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  { value: "etisalat", label: "اتصالات e& كاش", number: "0112666571", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  { value: "instapay", label: "InstaPay", number: "01285558567", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  { value: "souq", label: "تطبيق سوق ماركات", number: "", color: "bg-primary/10 text-primary" },
];

function WithdrawDialog({ balanceEGP }: { balanceEGP: number }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [phone, setPhone] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () => apiRequest('/api/payments', 'POST', {
      type: 'withdrawal',
      amountEGP: parseFloat(amount),
      method,
      phoneNumber: phone,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/revenue'] });
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
          <Banknote className="w-4 h-4" /> طلب سحب رصيد
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
            <label className="text-sm font-medium">المبلغ (بالجنيه المصري)</label>
            <Input
              type="number" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="الحد الأدنى 50 ج.م" className="mt-1"
              data-testid="input-withdraw-amount"
            />
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
          {method && method !== 'souq' && (
            <div>
              <label className="text-sm font-medium">رقم المحفظة / الهاتف</label>
              <Input
                value={phone} onChange={e => setPhone(e.target.value)}
                placeholder={selectedMethod?.number || "01xxxxxxxxx"} className="mt-1 font-mono"
                data-testid="input-wallet-number"
              />
            </div>
          )}
          <div className="flex items-start gap-2 bg-yellow-50 dark:bg-yellow-950/20 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-yellow-700 dark:text-yellow-400">
              سيتم مراجعة طلبك وإرسال المبلغ خلال 24-48 ساعة عمل. الحد الأدنى للسحب 50 ج.م.
            </p>
          </div>
          <Button
            className="w-full" onClick={() => mutation.mutate()}
            disabled={!amount || !method || parseFloat(amount) < 50 || parseFloat(amount) > balanceEGP || mutation.isPending}
            data-testid="btn-confirm-withdraw"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : null}
            تأكيد طلب السحب
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Revenue() {
  const { data, isLoading } = useQuery<{ transactions: any[]; balanceEGP: number; channel: any }>({
    queryKey: ["/api/revenue"],
    queryFn: () => fetch("/api/revenue", { credentials: "include" }).then(r => r.json()),
  });

  const { data: aiUsage } = useQuery<any>({ queryKey: ['/api/ai/usage'] });
  const { data: payments = [] } = useQuery<any[]>({
    queryKey: ['/api/payments'],
    queryFn: () => fetch('/api/payments', { credentials: 'include' }).then(r => r.json()),
  });

  const { data: paymentNotifications = [] } = useQuery<any[]>({
    queryKey: ['/api/payment-notifications'],
    queryFn: () => fetch('/api/payment-notifications', { credentials: 'include' }).then(r => r.json()),
  });

  const balanceEGP = data?.balanceEGP || 0;
  const transactions = data?.transactions || [];
  const channel = data?.channel;
  const earningsEGP = transactions.filter(t => t.type === 'earning').reduce((s: number, t: any) => s + (t.amountEGP || 0), 0);
  const spendingEGP = transactions.filter(t => t.type === 'spending' || t.type === 'ai_charge').reduce((s: number, t: any) => s + (t.amountEGP || 0), 0);
  const withdrawnEGP = transactions.filter(t => t.type === 'withdrawal').reduce((s: number, t: any) => s + (t.amountEGP || 0), 0);

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="container px-4 py-12 max-w-4xl">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-4xl font-extrabold">💰 الإيرادات</h1>
        {balanceEGP > 0 && <WithdrawDialog balanceEGP={balanceEGP} />}
      </div>
      <p className="text-muted-foreground mb-8">تتبع أرباحك وإنفاقك - جميع المبالغ بالجنيه المصري</p>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-5">
            <Wallet className="w-8 h-8 text-primary mb-2" />
            <div className="text-2xl font-bold">{balanceEGP.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">الرصيد الحالي (ج.م)</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="p-5">
            <TrendingUp className="w-8 h-8 text-green-500 mb-2" />
            <div className="text-2xl font-bold">{earningsEGP.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">إجمالي الأرباح (ج.م)</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
          <CardContent className="p-5">
            <CreditCard className="w-8 h-8 text-red-500 mb-2" />
            <div className="text-2xl font-bold">{spendingEGP.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">إجمالي الإنفاق (ج.م)</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="p-5">
            <Banknote className="w-8 h-8 text-blue-500 mb-2" />
            <div className="text-2xl font-bold">{withdrawnEGP.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">المسحوب (ج.م)</div>
          </CardContent>
        </Card>
      </div>

      {/* AI Credits */}
      {aiUsage && (
        <Card className="rounded-2xl mb-6 border-primary/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                ✨
              </div>
              <div>
                <div className="font-bold text-sm">رصيد الذكاء الاصطناعي</div>
                <div className="text-xs text-muted-foreground">
                  استخدمت {aiUsage.usageCount} من {aiUsage.freeCredits} مجاني
                  {aiUsage.remaining === 0 && ` — سعر الإضافي: ${aiUsage.pricePerCredit} ج.م`}
                </div>
              </div>
            </div>
            <Badge variant={aiUsage.remaining > 0 ? "default" : "destructive"}>
              {aiUsage.remaining} متبقي
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* Channel earnings */}
      {channel && (
        <Card className="rounded-2xl mb-6 border-green-200 dark:border-green-900">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600">📺</div>
              <div>
                <div className="font-bold text-sm">{channel.name}</div>
                <div className="text-xs text-muted-foreground">أرباح القناة من الإعلانات</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-green-600">{(channel.earningsEGP || 0).toFixed(2)} ج.م</div>
              <div className="text-xs text-muted-foreground">{channel.subscriberCount} متابع</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Requests */}
      {payments.length > 0 && (
        <Card className="rounded-2xl mb-6">
          <CardHeader><CardTitle className="text-base">طلبات السحب</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {payments.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-muted rounded-xl">
                <div className="flex items-center gap-3">
                  <PhoneCall className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">{PAYMENT_METHODS.find(m => m.value === p.method)?.label || p.method}</div>
                    <div className="text-xs text-muted-foreground">{p.phoneNumber}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold">{p.amountEGP} ج.م</div>
                  <Badge variant={p.status === 'approved' ? 'default' : p.status === 'rejected' ? 'destructive' : 'secondary'} className="text-xs">
                    {p.status === 'pending' ? 'قيد المراجعة' : p.status === 'approved' ? 'مقبول' : 'مرفوض'}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Payment Notifications from Buyers */}
      {paymentNotifications.length > 0 && (
        <Card className="rounded-2xl mb-6 border-green-200 dark:border-green-900">
          <CardHeader><CardTitle className="text-base flex items-center gap-2">📩 إشعارات دفع من المشترين</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {paymentNotifications.map((pn: any) => (
              <div key={pn.id} className="flex items-center justify-between p-3 bg-muted rounded-xl" data-testid={`pn-${pn.id}`}>
                <div>
                  <div className="text-sm font-bold">{pn.payer_name} — {pn.payer_phone}</div>
                  <div className="text-xs text-muted-foreground">{pn.ad_title} · {pn.payment_method}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-green-600">{pn.paid_amount} ج.م</div>
                  <Badge variant={pn.status === 'confirmed' ? 'default' : 'secondary'} className="text-xs">
                    {pn.status === 'pending' ? 'قيد المراجعة' : 'مؤكد'}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Transactions */}
      <Card className="rounded-2xl">
        <CardHeader><CardTitle>سجل المعاملات</CardTitle></CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>لا توجد معاملات بعد</p>
              <p className="text-sm mt-1">ستظهر هنا أرباحك وإنفاقك</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-xl transition-colors" data-testid={`tx-${t.id}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      t.type === 'earning' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
                    }`}>
                      {t.type === 'earning' ? <ArrowUpRight className="w-4 h-4 text-green-600" /> : <ArrowDownLeft className="w-4 h-4 text-red-500" />}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{t.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.createdAt ? format(new Date(t.createdAt), 'dd MMM yyyy', { locale: ar }) : ''}
                      </div>
                    </div>
                  </div>
                  <div className={`font-bold ${t.type === 'earning' ? 'text-green-600' : 'text-red-500'}`}>
                    {t.type === 'earning' ? '+' : '-'}{(t.amountEGP || 0).toFixed(2)} ج.م
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
