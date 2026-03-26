import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, BarChart2, Eye, MousePointer, DollarSign, Code, Pause, Play, TrendingUp } from "lucide-react";
import { UploadZone } from "@/components/UploadZone";
import type { AdCampaign } from "@shared/schema";

const schema = z.object({
  name: z.string().min(2, "اسم الحملة مطلوب"),
  description: z.string().optional(),
  targetUrl: z.string().url("أدخل رابطاً صحيحاً").optional().or(z.literal("")),
  budget: z.coerce.number().min(1, "الميزانية يجب أن تكون أكبر من صفر"),
  cpmRate: z.coerce.number().min(0.1).default(5),
  mediaType: z.enum(["image", "video"]).default("image"),
  mediaUrl: z.string().optional(),
  targetCategories: z.string().optional(),
  targetLanguages: z.string().optional(),
});

const statusColor: Record<string, string> = {
  active: "bg-green-500",
  paused: "bg-yellow-500",
  pending: "bg-blue-500",
  completed: "bg-gray-500",
  rejected: "bg-red-500",
};

export default function Campaigns() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [embedCampaign, setEmbedCampaign] = useState<AdCampaign | null>(null);

  const { data: campaigns, isLoading } = useQuery<AdCampaign[]>({
    queryKey: ["/api/campaigns"],
    queryFn: () => fetch("/api/campaigns", { credentials: "include" }).then(r => r.json()),
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", description: "", targetUrl: "", budget: 100, cpmRate: 5, mediaType: "image", mediaUrl: "", targetCategories: "", targetLanguages: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        targetCategories: data.targetCategories ? data.targetCategories.split(",").map((s: string) => s.trim()) : [],
        targetLanguages: data.targetLanguages ? data.targetLanguages.split(",").map((s: string) => s.trim()) : ["ar", "en"],
      };
      const res = await fetch("/api/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), credentials: "include" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/campaigns"] }); setOpen(false); form.reset(); toast({ title: "تم إنشاء الحملة! ستتم المراجعة قريباً." }); },
    onError: (e: any) => toast({ variant: "destructive", title: "خطأ", description: e.message }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/campaigns/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }), credentials: "include" });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/campaigns"] }),
  });

  const totalImpressions = (campaigns || []).reduce((s, c) => s + (c.impressions || 0), 0);
  const totalSpent = (campaigns || []).reduce((s, c) => s + (c.spent || 0), 0);
  const totalClicks = (campaigns || []).reduce((s, c) => s + (c.clicks || 0), 0);

  return (
    <div className="container px-4 py-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-extrabold mb-1">📊 حملاتي الإعلانية</h1>
          <p className="text-muted-foreground">إدارة حملاتك الإعلانية واستهداف جمهورك</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> حملة جديدة</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>إنشاء حملة إعلانية</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(data => createMutation.mutate(data))} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>اسم الحملة</FormLabel><FormControl><Input placeholder="مثال: حملة رمضان 2026" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel>الوصف</FormLabel><FormControl><Textarea placeholder="وصف الحملة..." rows={2} {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="targetUrl" render={({ field }) => (
                  <FormItem><FormLabel>رابط الهبوط</FormLabel><FormControl><Input placeholder="https://example.com" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="budget" render={({ field }) => (
                    <FormItem><FormLabel>الميزانية ($)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="cpmRate" render={({ field }) => (
                    <FormItem><FormLabel>سعر الألف مشاهدة ($)</FormLabel><FormControl><Input type="number" step="0.1" {...field} /></FormControl></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="mediaUrl" render={({ field }) => (
                  <FormItem>
                    <FormLabel>الصورة / الفيديو</FormLabel>
                    <UploadZone value={field.value} onChange={field.onChange} accept="image/*,video/*" />
                  </FormItem>
                )} />
                <FormField control={form.control} name="targetCategories" render={({ field }) => (
                  <FormItem><FormLabel>التصنيفات المستهدفة (مفصولة بفاصلة)</FormLabel><FormControl><Input placeholder="gaming, education, sports" {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="targetLanguages" render={({ field }) => (
                  <FormItem><FormLabel>اللغات المستهدفة</FormLabel><FormControl><Input placeholder="ar, en" {...field} /></FormControl></FormItem>
                )} />
                <Button type="submit" disabled={createMutation.isPending} className="w-full">
                  {createMutation.isPending ? "جاري الإنشاء..." : "إنشاء الحملة"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "إجمالي المشاهدات", value: totalImpressions.toLocaleString(), icon: Eye, color: "text-blue-500" },
          { label: "النقرات", value: totalClicks.toLocaleString(), icon: MousePointer, color: "text-green-500" },
          { label: "الإنفاق ($)", value: totalSpent.toFixed(2), icon: DollarSign, color: "text-yellow-500" },
        ].map(s => (
          <Card key={s.label} className="rounded-2xl">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`w-8 h-8 ${s.color}`} />
              <div>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Campaigns List */}
      {isLoading ? <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div> : !campaigns?.length ? (
        <div className="text-center py-24">
          <BarChart2 className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <h2 className="text-xl font-bold mb-2">لا توجد حملات بعد</h2>
          <p className="text-muted-foreground">أنشئ أول حملة إعلانية الآن</p>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map(c => (
            <Card key={c.id} className="rounded-2xl hover:shadow-lg transition-all">
              <CardContent className="p-5">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  {c.mediaUrl && <img src={c.mediaUrl} className="w-24 h-16 object-cover rounded-xl shrink-0" alt="" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold truncate">{c.name}</h3>
                      <Badge className={`${statusColor[c.status]} text-white text-xs`}>{c.status === 'active' ? 'نشطة' : c.status === 'paused' ? 'موقوفة' : c.status === 'pending' ? 'قيد المراجعة' : c.status === 'rejected' ? 'مرفوضة' : 'منتهية'}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {(c.impressions || 0).toLocaleString()} مشاهدة</span>
                      <span className="flex items-center gap-1"><MousePointer className="w-3 h-3" /> {(c.clicks || 0).toLocaleString()} نقرة</span>
                      <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> ${(c.spent || 0).toFixed(2)} / ${c.budget}</span>
                      <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> CTR: {c.impressions ? ((c.clicks || 0) / c.impressions * 100).toFixed(1) : 0}%</span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => setEmbedCampaign(c)} className="gap-1 text-xs">
                      <Code className="w-3 h-3" /> كود الإعلان
                    </Button>
                    {c.status === 'active' ? (
                      <Button size="sm" variant="outline" onClick={() => toggleMutation.mutate({ id: c.id, status: "paused" })} className="gap-1 text-xs">
                        <Pause className="w-3 h-3" /> إيقاف
                      </Button>
                    ) : c.status === 'paused' ? (
                      <Button size="sm" onClick={() => toggleMutation.mutate({ id: c.id, status: "active" })} className="gap-1 text-xs">
                        <Play className="w-3 h-3" /> تشغيل
                      </Button>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Embed Code Dialog */}
      <Dialog open={!!embedCampaign} onOpenChange={() => setEmbedCampaign(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>كود تضمين الإعلان</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mb-3">ضع هذا الكود في موقعك أو تطبيقك لعرض الإعلان تلقائياً:</p>
          <div className="bg-muted rounded-xl p-4 font-mono text-sm break-all select-all">
            {embedCampaign?.embedCode}
          </div>
          <Button onClick={() => { navigator.clipboard.writeText(embedCampaign?.embedCode || ""); toast({ title: "تم نسخ الكود!" }); }} className="w-full">نسخ الكود</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
