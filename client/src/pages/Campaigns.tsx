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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, BarChart2, Eye, MousePointer, Code, Pause, Play, TrendingUp, MapPin, Loader2, Copy, CheckCheck } from "lucide-react";
import { UploadZone } from "@/components/UploadZone";
import { EgyptTargetingMap } from "@/components/EgyptTargetingMap";
import type { AdCampaign } from "@shared/schema";

const EGYPT_REGIONS = [
  "القاهرة", "الجيزة", "الإسكندرية", "الدقهلية", "الشرقية", "المنوفية",
  "المنيا", "أسيوط", "سوهاج", "قنا", "الأقصر", "أسوان", "البحيرة",
  "كفر الشيخ", "الغربية", "الفيوم", "بني سويف", "الوادي الجديد",
  "مطروح", "شمال سيناء", "جنوب سيناء", "البحر الأحمر", "السويس",
  "الإسماعيلية", "بورسعيد", "دمياط"
];

const CATEGORIES = ["عقارات", "سيارات", "إلكترونيات", "ملابس", "طعام", "صحة", "تعليم", "ترفيه", "سياحة", "خدمات"];

const statusColor: Record<string, string> = {
  active: "bg-green-500",
  paused: "bg-yellow-500",
  pending: "bg-blue-500",
  completed: "bg-gray-500",
  rejected: "bg-red-500",
};

const statusLabel: Record<string, string> = {
  active: "نشط", paused: "متوقف", pending: "قيد المراجعة", completed: "مكتمل", rejected: "مرفوض"
};

const schema = z.object({
  name: z.string().min(2, "اسم الحملة مطلوب"),
  description: z.string().optional(),
  targetUrl: z.string().optional(),
  budgetEGP: z.coerce.number().min(1, "الميزانية يجب أن تكون أكبر من صفر"),
  cpmRateEGP: z.coerce.number().min(1).default(15),
  mediaType: z.enum(["image", "video", "reel"]).default("image"),
  mediaUrl: z.string().optional(),
  targetLanguages: z.array(z.string()).default(["ar"]),
  targetCategories: z.array(z.string()).default([]),
  targetRegions: z.array(z.string()).default([]),
});

type FormSchema = z.infer<typeof schema>;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1 text-xs">
      {copied ? <CheckCheck className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
      {copied ? "تم النسخ" : "نسخ"}
    </Button>
  );
}

export default function Campaigns() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [embedCampaign, setEmbedCampaign] = useState<AdCampaign | null>(null);
  const [analyticsCampaign, setAnalyticsCampaign] = useState<any | null>(null);
  const [mapRegions, setMapRegions] = useState<string[]>([]);
  const [mapInterests, setMapInterests] = useState<string[]>([]);
  const [mapAges, setMapAges] = useState<string[]>([]);

  const { data: campaigns = [], isLoading } = useQuery<AdCampaign[]>({
    queryKey: ["/api/campaigns"],
    queryFn: () => fetch("/api/campaigns", { credentials: "include" }).then(r => r.json()),
  });

  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
    queryFn: () => fetch("/api/settings").then(r => r.json()),
  });

  const defaultCpmEGP = parseFloat(settings?.cpm_rate_egp || "15");

  const form = useForm<FormSchema>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "", description: "", targetUrl: "",
      budgetEGP: 100, cpmRateEGP: defaultCpmEGP,
      mediaType: "image", mediaUrl: "",
      targetLanguages: ["ar"], targetCategories: [], targetRegions: [],
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormSchema) => {
      const res = await fetch("/api/campaigns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data), credentials: "include"
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/campaigns"] });
      setOpen(false); form.reset();
      toast({ title: "✅ تم إنشاء الحملة! ستتم المراجعة قريباً." });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "خطأ", description: e.message }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }), credentials: "include"
      });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/campaigns"] }),
  });

  const fetchAnalytics = async (campaign: AdCampaign) => {
    const res = await fetch(`/api/campaigns/${campaign.id}/analytics`, { credentials: 'include' });
    const data = await res.json();
    setAnalyticsCampaign(data);
  };

  const totalImpressions = campaigns.reduce((s, c) => s + (c.impressions || 0), 0);
  const totalSpentEGP = campaigns.reduce((s, c) => s + (c.spentEGP || 0), 0);
  const totalClicks = campaigns.reduce((s, c) => s + (c.clicks || 0), 0);
  const overallCTR = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0";

  return (
    <div className="container px-4 py-12 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold">🎯 الحملات الإعلانية</h1>
          <p className="text-muted-foreground mt-1">إدارة حملاتك كما في Meta Ads - جميع المبالغ بالجنيه المصري</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="btn-new-campaign"><Plus className="w-4 h-4" /> حملة جديدة</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>إنشاء حملة إعلانية جديدة</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(data => createMutation.mutate(data))} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>اسم الحملة</FormLabel>
                    <FormControl><Input placeholder="مثال: حملة رمضان 2025" {...field} data-testid="input-campaign-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel>وصف الحملة</FormLabel>
                    <FormControl><Textarea placeholder="صف هدف حملتك..." rows={2} {...field} /></FormControl>
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="budgetEGP" render={({ field }) => (
                    <FormItem><FormLabel>الميزانية (ج.م)</FormLabel>
                      <FormControl><Input type="number" placeholder="500" {...field} data-testid="input-budget" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="cpmRateEGP" render={({ field }) => (
                    <FormItem><FormLabel>سعر الألف مشاهدة (ج.م)</FormLabel>
                      <FormControl><Input type="number" placeholder={String(defaultCpmEGP)} {...field} /></FormControl>
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="targetUrl" render={({ field }) => (
                  <FormItem><FormLabel>رابط الوجهة</FormLabel>
                    <FormControl><Input placeholder="https://yoursite.com" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="mediaType" render={({ field }) => (
                  <FormItem><FormLabel>نوع المحتوى</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="image">📷 صورة</SelectItem>
                        <SelectItem value="video">🎬 فيديو</SelectItem>
                        <SelectItem value="reel">📱 ريل</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="mediaUrl" render={({ field }) => (
                  <FormItem><FormLabel>صورة / فيديو الإعلان</FormLabel>
                    <UploadZone value={field.value} onChange={field.onChange} />
                    {!field.value && <FormControl><Input placeholder="أو أدخل رابطاً..." className="mt-2" onChange={e => field.onChange(e.target.value)} /></FormControl>}
                  </FormItem>
                )} />

                {/* Egypt Targeting Map */}
                <div className="border rounded-2xl p-3 bg-background/50">
                  <EgyptTargetingMap
                    selectedRegions={mapRegions}
                    selectedInterests={mapInterests}
                    selectedAges={mapAges}
                    onRegionsChange={(r) => { setMapRegions(r); form.setValue("targetRegions", r); }}
                    onInterestsChange={(i) => { setMapInterests(i); form.setValue("targetCategories", i); }}
                    onAgesChange={setMapAges}
                  />
                </div>

                {/* Language Targeting */}
                <div>
                  <FormLabel>اللغة المستهدفة</FormLabel>
                  <div className="flex gap-3 mt-2">
                    {["ar", "en"].map(lang => (
                      <label key={lang} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(form.watch("targetLanguages") || []).includes(lang)}
                          onChange={(e) => {
                            const current = form.getValues("targetLanguages") || [];
                            if (e.target.checked) form.setValue("targetLanguages", [...current, lang]);
                            else form.setValue("targetLanguages", current.filter(l => l !== lang));
                          }}
                        />
                        {lang === 'ar' ? '🇸🇦 عربي' : '🇺🇸 إنجليزي'}
                      </label>
                    ))}
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="btn-submit-campaign">
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : null}
                  إنشاء الحملة
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "إجمالي المشاهدات", value: totalImpressions.toLocaleString(), icon: Eye, color: "text-blue-500" },
          { label: "إجمالي النقرات", value: totalClicks.toLocaleString(), icon: MousePointer, color: "text-purple-500" },
          { label: "نسبة النقر (CTR)", value: `${overallCTR}%`, icon: TrendingUp, color: "text-green-500" },
          { label: "الإنفاق الكلي (ج.م)", value: totalSpentEGP.toFixed(2), icon: BarChart2, color: "text-orange-500" },
        ].map(s => (
          <Card key={s.label} className="rounded-2xl">
            <CardContent className="p-4">
              <s.icon className={`w-6 h-6 mb-2 ${s.color}`} />
              <div className="text-xl font-bold">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Campaigns List */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-16">
          <BarChart2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
          <h3 className="text-lg font-bold mb-2">لا توجد حملات بعد</h3>
          <p className="text-muted-foreground text-sm">أنشئ حملتك الأولى للوصول لعملائك</p>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => {
            const ctr = campaign.impressions > 0 ? ((campaign.clicks / campaign.impressions) * 100).toFixed(2) : "0";
            const spentEGP = campaign.spentEGP || 0;
            const budgetEGP = campaign.budgetEGP || 0;
            const budgetPct = budgetEGP > 0 ? Math.min(100, (spentEGP / budgetEGP) * 100) : 0;
            return (
              <Card key={campaign.id} className="rounded-2xl hover:shadow-md transition-shadow" data-testid={`campaign-${campaign.id}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {campaign.mediaUrl && (
                        <img src={campaign.mediaUrl} alt="" className="w-14 h-14 rounded-xl object-cover bg-muted flex-shrink-0" />
                      )}
                      <div>
                        <h3 className="font-bold text-lg">{campaign.name}</h3>
                        {campaign.description && <p className="text-sm text-muted-foreground">{campaign.description}</p>}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge className={`${statusColor[campaign.status || 'pending']} text-white text-xs`}>
                            {statusLabel[campaign.status || 'pending']}
                          </Badge>
                          {(campaign.targetRegions as string[] | null)?.length > 0 && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <MapPin className="w-2.5 h-2.5" />
                              {(campaign.targetRegions as string[]).slice(0, 2).join('، ')}
                              {(campaign.targetRegions as string[]).length > 2 && ` +${(campaign.targetRegions as string[]).length - 2}`}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {campaign.status === 'active' && (
                        <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => toggleMutation.mutate({ id: campaign.id, status: 'paused' })}>
                          <Pause className="w-3 h-3" /> إيقاف
                        </Button>
                      )}
                      {campaign.status === 'paused' && (
                        <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => toggleMutation.mutate({ id: campaign.id, status: 'active' })}>
                          <Play className="w-3 h-3" /> تفعيل
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={() => fetchAnalytics(campaign)}>
                        <BarChart2 className="w-3 h-3" /> تقرير
                      </Button>
                      {campaign.embedCode && (
                        <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={() => setEmbedCampaign(campaign)}>
                          <Code className="w-3 h-3" /> كود
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Analytics Grid */}
                  <div className="grid grid-cols-4 gap-3 mb-3">
                    {[
                      { label: "مشاهدات", value: (campaign.impressions || 0).toLocaleString(), icon: Eye },
                      { label: "نقرات", value: (campaign.clicks || 0).toLocaleString(), icon: MousePointer },
                      { label: "CTR", value: `${ctr}%`, icon: TrendingUp },
                      { label: "إنفاق (ج.م)", value: spentEGP.toFixed(2), icon: BarChart2 },
                    ].map(m => (
                      <div key={m.label} className="bg-muted/40 rounded-xl p-3 text-center">
                        <m.icon className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                        <div className="text-sm font-bold">{m.value}</div>
                        <div className="text-xs text-muted-foreground">{m.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Budget Progress */}
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>الميزانية المستهلكة</span>
                      <span>{spentEGP.toFixed(2)} / {budgetEGP.toFixed(2)} ج.م</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${budgetPct > 80 ? 'bg-red-500' : 'bg-primary'}`}
                        style={{ width: `${budgetPct}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Embed Code Dialog */}
      <Dialog open={!!embedCampaign} onOpenChange={() => setEmbedCampaign(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>كود تضمين الإعلان (AdSense-Style)</DialogTitle></DialogHeader>
          {embedCampaign && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold">كود التضمين</label>
                  <CopyButton text={embedCampaign.embedCode || ""} />
                </div>
                <pre className="bg-muted rounded-xl p-3 text-xs overflow-x-auto whitespace-pre-wrap">{embedCampaign.embedCode}</pre>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold">كود تتبع النقرات (Google AdSense-Style)</label>
                  <CopyButton text={embedCampaign.clickTrackingCode || ""} />
                </div>
                <pre className="bg-muted rounded-xl p-3 text-xs overflow-x-auto whitespace-pre-wrap">{embedCampaign.clickTrackingCode}</pre>
              </div>
              <p className="text-xs text-muted-foreground">
                أضف هذا الكود في موقعك لعرض الإعلان وتتبع المشاهدات والنقرات تلقائياً.
                حصتك من الإيرادات: {((embedCampaign.publisherRevShare || 0.6) * 100).toFixed(0)}%
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Analytics Dialog */}
      <Dialog open={!!analyticsCampaign} onOpenChange={() => setAnalyticsCampaign(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>تقرير الحملة: {analyticsCampaign?.name}</DialogTitle></DialogHeader>
          {analyticsCampaign && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "إجمالي المشاهدات", value: (analyticsCampaign.impressions || 0).toLocaleString() },
                  { label: "إجمالي النقرات", value: (analyticsCampaign.clicks || 0).toLocaleString() },
                  { label: "نسبة النقر (CTR)", value: `${analyticsCampaign.ctr || 0}%` },
                  { label: "سعر الألف مشاهدة", value: `${analyticsCampaign.cpmEGP || 15} ج.م` },
                  { label: "تكلفة النقرة (CPC)", value: `${analyticsCampaign.cpcEGP || 0} ج.م` },
                  { label: "إجمالي الإنفاق", value: `${(analyticsCampaign.spentEGP || 0).toFixed(2)} ج.م` },
                  { label: "الميزانية الكلية", value: `${(analyticsCampaign.budgetEGP || 0).toFixed(2)} ج.م` },
                  { label: "الميزانية المتبقية", value: `${Math.max(0, (analyticsCampaign.budgetEGP || 0) - (analyticsCampaign.spentEGP || 0)).toFixed(2)} ج.م` },
                ].map(m => (
                  <div key={m.label} className="bg-muted rounded-xl p-3">
                    <div className="text-xs text-muted-foreground">{m.label}</div>
                    <div className="text-base font-bold mt-0.5">{m.value}</div>
                  </div>
                ))}
              </div>
              {(analyticsCampaign.targetRegions as string[] | null)?.length > 0 && (
                <div>
                  <p className="text-xs font-bold mb-2">المناطق المستهدفة:</p>
                  <div className="flex flex-wrap gap-1">
                    {(analyticsCampaign.targetRegions as string[]).map((r: string) => (
                      <Badge key={r} variant="secondary" className="text-xs">{r}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
