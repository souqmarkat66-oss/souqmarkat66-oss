import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Users, BarChart2, Flag, Megaphone, Radio, CheckCircle, XCircle, AlertTriangle, TrendingUp, Eye, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export default function AdminPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: () => fetch("/api/admin/stats", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30000,
  });

  const { data: reports } = useQuery<any[]>({
    queryKey: ["/api/admin/reports"],
    queryFn: () => fetch("/api/admin/reports", { credentials: "include" }).then(r => r.json()),
  });

  const { data: campaigns } = useQuery<any[]>({
    queryKey: ["/api/admin/campaigns"],
    queryFn: () => fetch("/api/admin/campaigns", { credentials: "include" }).then(r => r.json()),
  });

  const { data: channels } = useQuery<any[]>({
    queryKey: ["/api/admin/channels"],
    queryFn: () => fetch("/api/admin/channels", { credentials: "include" }).then(r => r.json()),
  });

  const reportMutation = useMutation({
    mutationFn: ({ id, status, adminNote }: any) =>
      fetch(`/api/admin/reports/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, adminNote }), credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/reports"] }); toast({ title: "تم تحديث البلاغ" }); },
  });

  const campaignMutation = useMutation({
    mutationFn: ({ id, status }: any) =>
      fetch(`/api/admin/campaigns/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }), credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/campaigns"] }); toast({ title: "تم تحديث الحملة" }); },
  });

  const channelMutation = useMutation({
    mutationFn: ({ id, data }: any) =>
      fetch(`/api/admin/channels/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/channels"] }); toast({ title: "تم تحديث القناة" }); },
  });

  return (
    <div className="container px-4 py-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
          <BarChart2 className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold">لوحة تحكم الإدارة</h1>
          <p className="text-muted-foreground">Admin Panel — Souq Ads Network</p>
        </div>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
          {[
            { label: "الإعلانات", value: stats.totalAds, icon: Megaphone, color: "text-blue-500" },
            { label: "القنوات", value: stats.totalChannels, icon: Radio, color: "text-purple-500" },
            { label: "بث مباشر", value: stats.liveStreams, icon: Radio, color: "text-red-500" },
            { label: "حملات نشطة", value: stats.activeCampaigns, icon: BarChart2, color: "text-green-500" },
            { label: "البلاغات", value: stats.pendingReports, icon: Flag, color: "text-yellow-500" },
            { label: "المشاهدات", value: Number(stats.totalImpressions).toLocaleString(), icon: Eye, color: "text-teal-500" },
            { label: "الإيرادات ($)", value: `$${stats.totalRevenue}`, icon: DollarSign, color: "text-emerald-500" },
          ].map(s => (
            <Card key={s.label} className="rounded-2xl hover:shadow-md transition-shadow">
              <CardContent className="p-4 text-center">
                <s.icon className={`w-6 h-6 mx-auto mb-1 ${s.color}`} />
                <div className="text-xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Tabs defaultValue="reports">
        <TabsList className="mb-6">
          <TabsTrigger value="reports" className="gap-2"><Flag className="w-4 h-4" /> البلاغات {reports?.filter(r => r.status === 'pending').length ? <Badge variant="destructive" className="ms-1 text-xs">{reports.filter(r => r.status === 'pending').length}</Badge> : null}</TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-2"><Megaphone className="w-4 h-4" /> الحملات</TabsTrigger>
          <TabsTrigger value="channels" className="gap-2"><Radio className="w-4 h-4" /> القنوات</TabsTrigger>
        </TabsList>

        {/* Reports Tab */}
        <TabsContent value="reports">
          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="flex items-center gap-2"><Flag className="w-5 h-5 text-yellow-500" /> إدارة البلاغات</CardTitle></CardHeader>
            <CardContent>
              {!reports?.length ? <p className="text-center py-8 text-muted-foreground">لا توجد بلاغات</p> : (
                <div className="space-y-3">
                  {reports.map(r => (
                    <div key={r.id} className="flex items-center justify-between p-4 rounded-xl border">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={r.status === 'pending' ? 'destructive' : r.status === 'resolved' ? 'default' : 'outline'}>
                            {r.status === 'pending' ? 'معلق' : r.status === 'resolved' ? 'تم الحل' : 'مرفوض'}
                          </Badge>
                          <span className="text-sm font-medium">{r.targetType}: #{r.targetId}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{r.reason}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(r.createdAt), 'PPP', { locale: ar })}</p>
                      </div>
                      {r.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => reportMutation.mutate({ id: r.id, status: "resolved", adminNote: "تم المراجعة" })} className="gap-1 bg-green-500 hover:bg-green-600 text-white text-xs">
                            <CheckCircle className="w-3 h-3" /> حل
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => reportMutation.mutate({ id: r.id, status: "dismissed" })} className="gap-1 text-xs">
                            <XCircle className="w-3 h-3" /> رفض
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns">
          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="flex items-center gap-2"><Megaphone className="w-5 h-5 text-blue-500" /> إدارة الحملات الإعلانية</CardTitle></CardHeader>
            <CardContent>
              {!campaigns?.length ? <p className="text-center py-8 text-muted-foreground">لا توجد حملات</p> : (
                <div className="space-y-3">
                  {campaigns.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between p-4 rounded-xl border gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        {c.mediaUrl && <img src={c.mediaUrl} className="w-16 h-10 object-cover rounded-lg" alt="" />}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{c.name}</span>
                            <Badge className={`${c.status === 'active' ? 'bg-green-500' : c.status === 'pending' ? 'bg-blue-500' : c.status === 'rejected' ? 'bg-red-500' : 'bg-gray-500'} text-white text-xs`}>
                              {c.status === 'active' ? 'نشطة' : c.status === 'pending' ? 'قيد المراجعة' : c.status === 'rejected' ? 'مرفوضة' : c.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">ميزانية: ${c.budget} | مشاهدات: {c.impressions} | نقرات: {c.clicks}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {c.status === 'pending' && <>
                          <Button size="sm" onClick={() => campaignMutation.mutate({ id: c.id, status: "active" })} className="text-xs bg-green-500 hover:bg-green-600 text-white">موافقة</Button>
                          <Button size="sm" variant="outline" onClick={() => campaignMutation.mutate({ id: c.id, status: "rejected" })} className="text-xs text-red-500 hover:text-red-600">رفض</Button>
                        </>}
                        {c.status === 'active' && <Button size="sm" variant="outline" onClick={() => campaignMutation.mutate({ id: c.id, status: "paused" })} className="text-xs">إيقاف</Button>}
                        {c.status === 'paused' && <Button size="sm" onClick={() => campaignMutation.mutate({ id: c.id, status: "active" })} className="text-xs">تفعيل</Button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Channels Tab */}
        <TabsContent value="channels">
          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="flex items-center gap-2"><Radio className="w-5 h-5 text-purple-500" /> إدارة القنوات</CardTitle></CardHeader>
            <CardContent>
              {!channels?.length ? <p className="text-center py-8 text-muted-foreground">لا توجد قنوات</p> : (
                <div className="space-y-3">
                  {channels.map((ch: any) => (
                    <div key={ch.id} className="flex items-center justify-between p-4 rounded-xl border gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold">
                          {ch.name[0]}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{ch.name}</span>
                            <Badge variant={ch.status === 'active' ? 'default' : ch.status === 'suspended' ? 'destructive' : 'outline'} className="text-xs">
                              {ch.status === 'active' ? 'نشطة' : ch.status === 'suspended' ? 'موقوفة' : 'معلقة'}
                            </Badge>
                            {ch.isVerified && <CheckCircle className="w-3 h-3 text-primary" />}
                          </div>
                          <p className="text-xs text-muted-foreground">{ch.subscriberCount} مشترك | أرباح: ${(ch.earnings || 0).toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => channelMutation.mutate({ id: ch.id, data: { isVerified: !ch.isVerified } })} className="text-xs gap-1">
                          <CheckCircle className="w-3 h-3" /> {ch.isVerified ? 'إزالة التوثيق' : 'توثيق'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => channelMutation.mutate({ id: ch.id, data: { isMonetized: !ch.isMonetized } })} className="text-xs gap-1">
                          <DollarSign className="w-3 h-3" /> {ch.isMonetized ? 'إلغاء التربيح' : 'تربيح'}
                        </Button>
                        <Button size="sm" variant={ch.status === 'suspended' ? 'default' : 'destructive'} onClick={() => channelMutation.mutate({ id: ch.id, data: { status: ch.status === 'suspended' ? 'active' : 'suspended' } })} className="text-xs">
                          {ch.status === 'suspended' ? 'تفعيل' : 'إيقاف'}
                        </Button>
                      </div>
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
