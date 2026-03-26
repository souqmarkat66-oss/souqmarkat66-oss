import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Users, BarChart2, Flag, Megaphone, Radio, CheckCircle, XCircle,
  AlertTriangle, TrendingUp, Eye, Banknote, Settings, Loader2,
  ShieldAlert, Tv, Film, ShieldX, VideoOff
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

const ADMIN_ID = "54219806";

export default function AdminPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  // Check if user is admin
  const isAdmin = user?.id === ADMIN_ID;

  const { data: stats } = useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: () => fetch("/api/admin/stats", { credentials: "include" }).then(r => r.json()),
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  const { data: reports = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/reports"],
    queryFn: () => fetch("/api/admin/reports", { credentials: "include" }).then(r => r.json()),
    enabled: isAdmin,
  });

  const { data: campaigns = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/campaigns"],
    queryFn: () => fetch("/api/admin/campaigns", { credentials: "include" }).then(r => r.json()),
    enabled: isAdmin,
  });

  const { data: channels = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/channels"],
    queryFn: () => fetch("/api/admin/channels", { credentials: "include" }).then(r => r.json()),
    enabled: isAdmin,
  });

  const { data: payments = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/payments"],
    queryFn: () => fetch("/api/admin/payments", { credentials: "include" }).then(r => r.json()),
    enabled: isAdmin,
  });

  const { data: settings, refetch: refetchSettings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
    queryFn: () => fetch("/api/settings").then(r => r.json()),
    enabled: isAdmin,
  });

  const { data: fraudStats } = useQuery<any>({
    queryKey: ["/api/admin/fraud-stats"],
    queryFn: () => fetch("/api/admin/fraud-stats", { credentials: "include" }).then(r => r.json()),
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  const { data: fraudAlerts = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/fraud-alerts"],
    queryFn: () => fetch("/api/admin/fraud-alerts", { credentials: "include" }).then(r => r.json()),
    enabled: isAdmin,
  });

  const { data: streamModeration = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/stream-moderation"],
    queryFn: () => fetch("/api/admin/stream-moderation", { credentials: "include" }).then(r => r.json()),
    enabled: isAdmin,
  });

  const [settingsForm, setSettingsForm] = useState<Record<string, string>>({});

  const reportMutation = useMutation({
    mutationFn: ({ id, status, adminNote }: any) =>
      fetch(`/api/admin/reports/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, adminNote }), credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/reports"] }); toast({ title: "✅ تم تحديث البلاغ" }); },
  });

  const campaignMutation = useMutation({
    mutationFn: ({ id, status }: any) =>
      fetch(`/api/admin/campaigns/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }), credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/campaigns"] }); toast({ title: "✅ تم تحديث الحملة" }); },
  });

  const channelMutation = useMutation({
    mutationFn: ({ id, data }: any) =>
      fetch(`/api/admin/channels/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/channels"] }); toast({ title: "✅ تم تحديث القناة" }); },
  });

  const paymentMutation = useMutation({
    mutationFn: ({ id, status, adminNote }: any) =>
      fetch(`/api/admin/payments/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, adminNote }), credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/payments"] }); toast({ title: "✅ تم تحديث طلب السحب" }); },
  });

  const settingsMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const res = await fetch('/api/settings/bulk', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data), credentials: 'include'
      });
      return res.json();
    },
    onSuccess: () => { refetchSettings(); toast({ title: "✅ تم حفظ الإعدادات" }); },
  });

  const getSettingValue = (key: string, fallback: string) =>
    settingsForm[key] !== undefined ? settingsForm[key] : (settings?.[key] ?? fallback);

  if (!isAdmin) {
    return (
      <div className="container py-20 text-center">
        <ShieldAlert className="w-16 h-16 mx-auto mb-4 text-red-500" />
        <h2 className="text-2xl font-bold mb-2">غير مصرح لك بالدخول</h2>
        <p className="text-muted-foreground">هذه الصفحة مخصصة لمالك المشروع فقط.</p>
      </div>
    );
  }

  return (
    <div className="container px-4 py-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
          <BarChart2 className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold">لوحة تحكم الإدارة الشاملة</h1>
          <p className="text-muted-foreground">Admin Panel — Souq Ads Network (صاحب المشروع فقط)</p>
        </div>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
          {[
            { label: "الإعلانات", value: stats.totalAds, icon: Megaphone, color: "text-blue-500" },
            { label: "القنوات", value: stats.totalChannels, icon: Tv, color: "text-purple-500" },
            { label: "بث مباشر", value: stats.liveStreams, icon: Radio, color: "text-red-500" },
            { label: "الريلز", value: stats.totalReels, icon: Film, color: "text-pink-500" },
            { label: "حملات نشطة", value: stats.activeCampaigns, icon: BarChart2, color: "text-green-500" },
            { label: "البلاغات المعلقة", value: stats.pendingReports, icon: Flag, color: "text-yellow-500" },
            { label: "المشاهدات الكلية", value: Number(stats.totalImpressions || 0).toLocaleString(), icon: Eye, color: "text-teal-500" },
            { label: "الإيرادات (ج.م)", value: `${(stats.totalRevenueEGP || 0).toFixed(0)} ج.م`, icon: Banknote, color: "text-emerald-500" },
            { label: "طلبات السحب", value: stats.pendingPayments, icon: Banknote, color: "text-orange-500" },
            { label: "مستخدمون", value: stats.totalUsers || '-', icon: Users, color: "text-indigo-500" },
          ].map(s => (
            <Card key={s.label} className="rounded-2xl hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <s.icon className={`w-6 h-6 mb-2 ${s.color}`} />
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Tabs defaultValue="settings">
        <TabsList className="mb-6 flex-wrap gap-1 h-auto">
          <TabsTrigger value="settings" className="gap-1.5"><Settings className="w-4 h-4" /> الإعدادات</TabsTrigger>
          <TabsTrigger value="payments" className="gap-1.5"><Banknote className="w-4 h-4" /> طلبات السحب</TabsTrigger>
          <TabsTrigger value="reports" className="gap-1.5"><Flag className="w-4 h-4" /> البلاغات</TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-1.5"><BarChart2 className="w-4 h-4" /> الحملات</TabsTrigger>
          <TabsTrigger value="channels" className="gap-1.5"><Tv className="w-4 h-4" /> القنوات</TabsTrigger>
          <TabsTrigger value="fraud" className="gap-1.5 text-red-500"><ShieldX className="w-4 h-4" /> كشف الاحتيال</TabsTrigger>
          <TabsTrigger value="streams" className="gap-1.5 text-orange-500"><VideoOff className="w-4 h-4" /> مراقبة البث</TabsTrigger>
        </TabsList>

        {/* PLATFORM SETTINGS */}
        <TabsContent value="settings">
          <Card className="rounded-2xl">
            <CardHeader><CardTitle>إعدادات المنصة (تحكم الأسعار)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: "ai_free_credits", label: "رصيد AI المجاني للمستخدم الجديد", default: "3", suffix: "رصيد" },
                  { key: "ai_price_per_credit_egp", label: "سعر رصيد AI الإضافي", default: "5", suffix: "ج.م / رصيد" },
                  { key: "cpm_rate_egp", label: "سعر الألف مشاهدة (CPM)", default: "15", suffix: "ج.م" },
                  { key: "publisher_rev_share", label: "نسبة الناشر من الإعلانات", default: "0.60", suffix: "مثال: 0.60 = 60%" },
                  { key: "min_withdrawal_egp", label: "الحد الأدنى للسحب", default: "50", suffix: "ج.م" },
                ].map(setting => (
                  <div key={setting.key}>
                    <label className="text-sm font-medium">{setting.label}</label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        type="number" step="0.01"
                        value={getSettingValue(setting.key, setting.default)}
                        onChange={e => setSettingsForm(prev => ({ ...prev, [setting.key]: e.target.value }))}
                        placeholder={setting.default}
                        data-testid={`setting-${setting.key}`}
                      />
                      <span className="text-xs text-muted-foreground self-center whitespace-nowrap">{setting.suffix}</span>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                onClick={() => settingsMutation.mutate(settingsForm)}
                disabled={settingsMutation.isPending || Object.keys(settingsForm).length === 0}
                data-testid="btn-save-settings"
              >
                {settingsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : null}
                💾 حفظ الإعدادات
              </Button>
              <p className="text-xs text-muted-foreground">
                ملاحظة: تغيير سعر الألف مشاهدة يؤثر على الحملات الجديدة فقط. الحملات القائمة تستمر بالسعر المحدد عند إنشائها.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PAYMENT REQUESTS */}
        <TabsContent value="payments">
          <div className="space-y-3">
            {payments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Banknote className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>لا توجد طلبات سحب معلقة</p>
              </div>
            ) : payments.map((p: any) => (
              <Card key={p.id} className="rounded-xl" data-testid={`payment-${p.id}`}>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={p.status === 'approved' ? 'default' : p.status === 'rejected' ? 'destructive' : 'secondary'}>
                        {p.status === 'pending' ? 'معلق' : p.status === 'approved' ? 'مقبول' : 'مرفوض'}
                      </Badge>
                      <span className="font-bold text-lg">{p.amountEGP} ج.م</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {p.method} — {p.phoneNumber} — {p.createdAt ? format(new Date(p.createdAt), 'dd MMM yyyy', { locale: ar }) : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">المستخدم: {p.userId}</p>
                  </div>
                  {p.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button size="sm" className="gap-1 bg-green-500 hover:bg-green-600 text-white" onClick={() => paymentMutation.mutate({ id: p.id, status: 'approved' })}>
                        <CheckCircle className="w-3 h-3" /> موافقة
                      </Button>
                      <Button size="sm" variant="destructive" className="gap-1" onClick={() => paymentMutation.mutate({ id: p.id, status: 'rejected', adminNote: 'مرفوض' })}>
                        <XCircle className="w-3 h-3" /> رفض
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* REPORTS */}
        <TabsContent value="reports">
          <div className="space-y-3">
            {reports.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Flag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>لا توجد بلاغات معلقة</p>
              </div>
            ) : reports.map((report: any) => (
              <Card key={report.id} className="rounded-xl" data-testid={`report-${report.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={report.status === 'pending' ? 'secondary' : report.status === 'resolved' ? 'default' : 'outline'}>
                          {report.status === 'pending' ? 'معلق' : report.status === 'resolved' ? 'محلول' : 'مرفوض'}
                        </Badge>
                        <span className="text-sm font-medium">{report.targetType} #{report.targetId}</span>
                      </div>
                      <p className="text-sm">{report.reason}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {report.createdAt ? format(new Date(report.createdAt), 'dd MMM yyyy HH:mm', { locale: ar }) : ''}
                      </p>
                    </div>
                    {report.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button size="sm" className="gap-1 bg-green-500 hover:bg-green-600 text-white" onClick={() => reportMutation.mutate({ id: report.id, status: 'resolved' })}>
                          <CheckCircle className="w-3 h-3" /> حل
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => reportMutation.mutate({ id: report.id, status: 'dismissed' })}>
                          <XCircle className="w-3 h-3" /> رفض
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* CAMPAIGNS */}
        <TabsContent value="campaigns">
          <div className="space-y-3">
            {campaigns.map((campaign: any) => (
              <Card key={campaign.id} className="rounded-xl" data-testid={`admin-campaign-${campaign.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      {campaign.mediaUrl && (
                        <img src={campaign.mediaUrl} alt="" className="w-14 h-14 rounded-xl object-cover bg-muted flex-shrink-0" />
                      )}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold">{campaign.name}</h3>
                          <Badge className={`${
                            campaign.status === 'active' ? 'bg-green-500' : campaign.status === 'pending' ? 'bg-blue-500' : 'bg-gray-500'
                          } text-white text-xs`}>
                            {campaign.status === 'active' ? 'نشط' : campaign.status === 'pending' ? 'مراجعة' : campaign.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">المعلن: {campaign.advertiserId}</p>
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                          <span>مشاهدات: {campaign.impressions}</span>
                          <span>نقرات: {campaign.clicks}</span>
                          <span>إنفاق: {(campaign.spentEGP || 0).toFixed(2)} ج.م</span>
                          <span>ميزانية: {(campaign.budgetEGP || 0).toFixed(2)} ج.م</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {campaign.status === 'pending' && (
                        <>
                          <Button size="sm" className="gap-1 bg-green-500 hover:bg-green-600 text-white" onClick={() => campaignMutation.mutate({ id: campaign.id, status: 'active' })}>
                            <CheckCircle className="w-3 h-3" /> موافقة
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => campaignMutation.mutate({ id: campaign.id, status: 'rejected' })}>
                            <XCircle className="w-3 h-3" /> رفض
                          </Button>
                        </>
                      )}
                      {campaign.status === 'active' && (
                        <Button size="sm" variant="outline" onClick={() => campaignMutation.mutate({ id: campaign.id, status: 'paused' })}>
                          إيقاف
                        </Button>
                      )}
                      {campaign.status === 'paused' && (
                        <Button size="sm" variant="outline" onClick={() => campaignMutation.mutate({ id: campaign.id, status: 'active' })}>
                          تفعيل
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* CHANNELS */}
        <TabsContent value="channels">
          <div className="space-y-3">
            {channels.map((channel: any) => (
              <Card key={channel.id} className="rounded-xl" data-testid={`admin-channel-${channel.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold">{channel.name}</h3>
                        {channel.isVerified && <Badge className="bg-blue-500 text-white text-xs">موثق</Badge>}
                        {channel.isMonetized && <Badge className="bg-green-500 text-white text-xs">ممول</Badge>}
                        <Badge variant={channel.status === 'active' ? 'default' : 'destructive'} className="text-xs">
                          {channel.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {channel.subscriberCount} متابع — {(channel.earningsEGP || 0).toFixed(2)} ج.م أرباح
                      </p>
                      <p className="text-xs text-muted-foreground">المالك: {channel.userId}</p>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-end">
                      <Button
                        size="sm" variant="outline" className="text-xs gap-1"
                        onClick={() => channelMutation.mutate({ id: channel.id, data: { isVerified: !channel.isVerified } })}
                      >
                        {channel.isVerified ? '❌ إلغاء التوثيق' : '✅ توثيق'}
                      </Button>
                      <Button
                        size="sm" variant="outline" className="text-xs gap-1"
                        onClick={() => channelMutation.mutate({ id: channel.id, data: { isMonetized: !channel.isMonetized } })}
                      >
                        {channel.isMonetized ? '❌ إلغاء التمويل' : '💰 تمويل'}
                      </Button>
                      <Button
                        size="sm" variant={channel.status === 'active' ? 'destructive' : 'default'} className="text-xs"
                        onClick={() => channelMutation.mutate({ id: channel.id, data: { status: channel.status === 'active' ? 'suspended' : 'active' } })}
                      >
                        {channel.status === 'active' ? '🚫 تعليق' : '✅ تفعيل'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* FRAUD DETECTION */}
        <TabsContent value="fraud">
          <div className="space-y-6">
            {/* Stats */}
            {fraudStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "نقرات وهمية", value: fraudStats.fraud_clicks || 0, color: "text-red-500" },
                  { label: "مشاهدات وهمية", value: fraudStats.fraud_impressions || 0, color: "text-orange-500" },
                  { label: "إجمالي الاحتيال", value: fraudStats.total_fraud || 0, color: "text-red-700" },
                  { label: "حقيقية (نظيفة)", value: fraudStats.total_legit || 0, color: "text-green-600" },
                ].map(s => (
                  <Card key={s.label} className="rounded-2xl">
                    <CardContent className="p-4">
                      <div className={`text-2xl font-bold ${s.color}`}>{Number(s.value).toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">{s.label}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            {/* Fraud Alerts Table */}
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldX className="w-5 h-5 text-red-500" /> سجل التنبيهات الوهمية (آخر 200)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {fraudAlerts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">لا توجد تنبيهات احتيال حتى الآن ✅</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="text-muted-foreground border-b">
                        <th className="pb-2 text-right">الحملة</th>
                        <th className="pb-2 text-right">IP</th>
                        <th className="pb-2 text-right">النوع</th>
                        <th className="pb-2 text-right">التفاصيل</th>
                        <th className="pb-2 text-right">الوقت</th>
                      </tr></thead>
                      <tbody>
                        {fraudAlerts.map((alert: any) => (
                          <tr key={alert.id} className="border-b last:border-0 hover:bg-muted/50">
                            <td className="py-2 font-medium">{alert.campaign_name || `#${alert.campaign_id}`}</td>
                            <td className="py-2 font-mono text-xs">{alert.ip_address}</td>
                            <td className="py-2">
                              <Badge variant={alert.alert_type === 'click' ? 'destructive' : 'secondary'} className="text-xs">
                                {alert.alert_type === 'click' ? '🖱️ نقر' : '👁️ مشاهدة'}
                              </Badge>
                            </td>
                            <td className="py-2 text-xs text-muted-foreground">{alert.details}</td>
                            <td className="py-2 text-xs text-muted-foreground">
                              {alert.created_at ? format(new Date(alert.created_at), 'dd/MM HH:mm', { locale: ar }) : '-'}
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
        </TabsContent>

        {/* STREAM MODERATION */}
        <TabsContent value="streams">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <VideoOff className="w-5 h-5 text-orange-500" /> مراقبة البث المباشر بالذكاء الاصطناعي
              </CardTitle>
            </CardHeader>
            <CardContent>
              {streamModeration.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">لا توجد بثوث مراجَعة بعد</div>
              ) : (
                <div className="space-y-3">
                  {streamModeration.map((sm: any) => (
                    <div key={sm.id} className="flex items-start justify-between p-4 rounded-xl border" data-testid={`stream-mod-${sm.id}`}>
                      <div>
                        <div className="font-medium">{sm.stream_title || `بث #${sm.stream_id}`}</div>
                        <div className="text-xs text-muted-foreground mt-1">{sm.ai_reason || 'لا توجد ملاحظات'}</div>
                        <div className="text-xs text-muted-foreground">
                          حالة البث: <span className={sm.stream_status === 'live' ? 'text-green-500' : 'text-red-500'}>{sm.stream_status}</span>
                          {' · '}{sm.reviewed_at ? format(new Date(sm.reviewed_at), 'dd/MM HH:mm', { locale: ar }) : ''}
                        </div>
                      </div>
                      <Badge
                        variant={sm.ai_verdict === 'safe' ? 'default' : 'destructive'}
                        className="text-xs shrink-0"
                      >
                        {sm.ai_verdict === 'safe' ? '✅ آمن' : '🚫 محظور'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
