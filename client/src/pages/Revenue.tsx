import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, ArrowUpRight, ArrowDownLeft, Wallet } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export default function Revenue() {
  const { data, isLoading } = useQuery<{ transactions: any[]; balance: number }>({
    queryKey: ["/api/revenue"],
    queryFn: () => fetch("/api/revenue", { credentials: "include" }).then(r => r.json()),
  });

  const balance = data?.balance || 0;
  const transactions = data?.transactions || [];
  const earnings = transactions.filter(t => t.type === 'earning').reduce((s: number, t: any) => s + t.amount, 0);
  const spending = transactions.filter(t => t.type === 'spending').reduce((s: number, t: any) => s + t.amount, 0);

  return (
    <div className="container px-4 py-12 max-w-4xl">
      <h1 className="text-4xl font-extrabold mb-2">💰 الإيرادات</h1>
      <p className="text-muted-foreground mb-8">تتبع أرباحك وإنفاقك على المنصة</p>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card className="rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-5">
            <Wallet className="w-8 h-8 text-primary mb-2" />
            <div className="text-3xl font-bold">${balance.toFixed(2)}</div>
            <div className="text-sm text-muted-foreground">الرصيد الحالي</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="p-5">
            <TrendingUp className="w-8 h-8 text-green-500 mb-2" />
            <div className="text-3xl font-bold">${earnings.toFixed(2)}</div>
            <div className="text-sm text-muted-foreground">إجمالي الأرباح</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
          <CardContent className="p-5">
            <DollarSign className="w-8 h-8 text-red-500 mb-2" />
            <div className="text-3xl font-bold">${spending.toFixed(2)}</div>
            <div className="text-sm text-muted-foreground">إجمالي الإنفاق</div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle>سجل المعاملات</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-center py-8 text-muted-foreground">جاري التحميل...</p> : !transactions.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>لا توجد معاملات بعد</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${tx.type === 'earning' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                      {tx.type === 'earning' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{tx.description || (tx.type === 'earning' ? 'أرباح' : 'إنفاق')}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(tx.createdAt), 'PPP', { locale: ar })}</p>
                    </div>
                  </div>
                  <span className={`font-bold ${tx.type === 'earning' ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.type === 'earning' ? '+' : '-'}${tx.amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
