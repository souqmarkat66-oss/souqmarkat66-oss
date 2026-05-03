import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Radio, Video, AlertCircle, Plus, Camera, Mic } from "lucide-react";
import type { Channel } from "@shared/schema";

const schema = z.object({
  title: z.string().min(3, "العنوان يجب أن يكون 3 أحرف على الأقل"),
  description: z.string().optional(),
  category: z.string().default("general"),
  language: z.enum(["ar", "en"]).default("ar"),
});

export default function StartStream() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [permStatus, setPermStatus] = useState<"idle"|"requesting"|"granted"|"denied">("idle");
  const [showPermDialog, setShowPermDialog] = useState(false);
  // pending form data waiting for permission
  const pendingFormData = useState<any>(null);

  const requestCameraPermission = async (formData?: any) => {
    setPermStatus("requesting");
    try {
      const ms = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      ms.getTracks().forEach(t => t.stop());
      setPermStatus("granted");
      setShowPermDialog(false);
      // Now create the stream with the pending data
      const data = formData || pendingFormData[0];
      if (data) createStreamMutation.mutate(data);
    } catch {
      setPermStatus("denied");
    }
  };

  // Called on form submit — check permission first
  const handleSubmit = async (data: any) => {
    // Store form data
    pendingFormData[1](data);
    // Try getUserMedia immediately (must be in user-gesture context)
    setPermStatus("requesting");
    try {
      const ms = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      ms.getTracks().forEach(t => t.stop());
      setPermStatus("granted");
      // Permission OK — create the stream
      createStreamMutation.mutate(data);
    } catch {
      // Permission denied/not yet given — show dialog
      setPermStatus("denied");
      setShowPermDialog(true);
    }
  };

  const { data: myChannel } = useQuery<Channel | null>({
    queryKey: ["/api/channels/mine"],
    queryFn: () => fetch("/api/channels/mine", { credentials: "include" }).then(r => r.json()),
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", description: "", category: "general", language: "ar" },
  });

  const createStreamMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/streams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: (stream) => {
      toast({ title: "تم إنشاء البث!", description: "سيبدأ البث المباشر الآن" });
      setLocation(`/streams/${stream.id}?mode=broadcast`);
    },
    onError: (e: any) => toast({ variant: "destructive", title: "خطأ", description: e.message }),
  });

  const createChannelMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, language: "ar", category: "general" }),
        credentials: "include",
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/channels/mine"] });
      toast({ title: "تم إنشاء القناة!" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "خطأ", description: e.message }),
  });

  if (!myChannel) {
    return (
      <div className="container max-w-lg px-4 py-12 text-center" dir="rtl">
        {/* Hero */}
        <div className="relative mb-8">
          <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center mx-auto mb-5 shadow-2xl shadow-red-500/30">
            <Radio className="w-14 h-14 text-white" />
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center text-base shadow-lg">
            📺
          </div>
        </div>

        <h2 className="text-3xl font-extrabold mb-2">ابدأ قناتك الآن!</h2>
        <p className="text-muted-foreground mb-8 text-base">
          أنشئ قناتك مجاناً وابدأ البث المباشر مع آلاف المشاهدين
        </p>

        {/* Benefits */}
        <div className="grid grid-cols-3 gap-3 mb-8 text-center">
          <div className="bg-red-50 dark:bg-red-950/20 rounded-2xl p-3 border border-red-100 dark:border-red-800/30">
            <div className="text-2xl mb-1">🎥</div>
            <p className="text-xs font-bold text-red-700 dark:text-red-400">بث مباشر</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-950/20 rounded-2xl p-3 border border-purple-100 dark:border-purple-800/30">
            <div className="text-2xl mb-1">👥</div>
            <p className="text-xs font-bold text-purple-700 dark:text-purple-400">مشاهدين</p>
          </div>
          <div className="bg-green-50 dark:bg-green-950/20 rounded-2xl p-3 border border-green-100 dark:border-green-800/30">
            <div className="text-2xl mb-1">🎁</div>
            <p className="text-xs font-bold text-green-700 dark:text-green-400">هدايا</p>
          </div>
        </div>

        <Button
          onClick={() => createChannelMutation.mutate((user?.firstName || "قناتي") + " Channel")}
          disabled={createChannelMutation.isPending}
          size="lg"
          className="w-full gap-2 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-extrabold text-base py-6 rounded-2xl shadow-xl shadow-red-500/25"
          data-testid="btn-create-channel"
        >
          {createChannelMutation.isPending ? (
            <><span className="animate-spin">⏳</span> جارٍ الإنشاء...</>
          ) : (
            <><Plus className="w-5 h-5" /> إنشاء قناتي الآن — مجاناً</>
          )}
        </Button>
        <p className="text-xs text-muted-foreground mt-3">✨ لا تحتاج بطاقة بنكية — مجاني تماماً</p>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl px-4 py-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-red-500 flex items-center justify-center">
          <Radio className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold">ابدأ البث المباشر</h1>
          <p className="text-muted-foreground">على قناة: {myChannel.name}</p>
        </div>
      </div>

      <Card className="rounded-3xl border-border/50">
        <CardHeader><CardTitle>تفاصيل البث</CardTitle></CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>عنوان البث</FormLabel>
                  <FormControl><Input placeholder="أدخل عنواناً جذاباً للبث..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>الوصف (اختياري)</FormLabel>
                  <FormControl><Textarea placeholder="وصف البث..." rows={3} {...field} /></FormControl>
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>التصنيف</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="general">عام</SelectItem>
                        <SelectItem value="gaming">ألعاب</SelectItem>
                        <SelectItem value="education">تعليم</SelectItem>
                        <SelectItem value="entertainment">ترفيه</SelectItem>
                        <SelectItem value="news">أخبار</SelectItem>
                        <SelectItem value="sports">رياضة</SelectItem>
                        <SelectItem value="tech">تقنية</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="language" render={({ field }) => (
                  <FormItem>
                    <FormLabel>اللغة</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="ar">العربية</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>
              <Button type="submit" disabled={createStreamMutation.isPending || permStatus === "requesting"} size="lg" className="w-full bg-red-500 hover:bg-red-600 text-white gap-2">
                <Video className="w-5 h-5" />
                {permStatus === "requesting" ? "جاري التحقق من الإذن..." : createStreamMutation.isPending ? "جاري الإعداد..." : "ابدأ البث الآن 🔴"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* ── Permission dialog — overlay on top of form, shown ONLY after user clicks submit ── */}
      {showPermDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50" dir="rtl">
          <div className="w-full max-w-sm bg-white rounded-t-3xl overflow-hidden shadow-2xl">
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-zinc-300" />
            </div>

            {/* Site header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-zinc-200">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center shadow-md flex-shrink-0">
                <span className="text-white text-base">📹</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-zinc-900 font-bold text-sm leading-tight">ads-as.com يريد</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Camera className="w-3.5 h-3.5 text-zinc-500" />
                  <Mic className="w-3.5 h-3.5 text-zinc-500" />
                  <p className="text-zinc-500 text-xs">الوصول للكاميرا والميكروفون</p>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="px-5 py-4">
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-3">
                <span className="text-xl mt-0.5 flex-shrink-0">🎥</span>
                <p className="text-zinc-700 text-xs leading-relaxed">
                  لبدء البث المباشر وإيصال صورتك وصوتك للمشاهدين، يحتاج الموقع إذنك للوصول للكاميرا والميكروفون.
                </p>
              </div>
              {permStatus === "denied" && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-2xl p-3">
                  <span className="text-base flex-shrink-0">⚠️</span>
                  <p className="text-red-700 text-xs leading-relaxed">
                    تم رفض الإذن — اذهب لإعدادات المتصفح ← الكاميرا والميكروفون ← "السماح"، ثم أعد المحاولة
                  </p>
                </div>
              )}
            </div>

            {/* Options */}
            <div className="border-t border-zinc-200 divide-y divide-zinc-100">
              <button
                onClick={() => requestCameraPermission(pendingFormData[0])}
                disabled={permStatus === "requesting"}
                className="w-full px-5 py-4 text-right text-blue-600 font-medium text-[15px] hover:bg-zinc-50 active:bg-zinc-100 transition-colors flex items-center gap-3 disabled:opacity-60"
                data-testid="btn-allow-always"
              >
                {permStatus === "requesting"
                  ? <span className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin flex-shrink-0" />
                  : <Camera className="w-4 h-4 flex-shrink-0 text-blue-500" />}
                {permStatus === "requesting" ? "جاري طلب الإذن..." : "السماح بالاستخدام أثناء زيارة الموقع"}
              </button>
              <button
                onClick={() => requestCameraPermission(pendingFormData[0])}
                disabled={permStatus === "requesting"}
                className="w-full px-5 py-4 text-right text-blue-600 font-medium text-[15px] hover:bg-zinc-50 active:bg-zinc-100 transition-colors flex items-center gap-3 disabled:opacity-60"
                data-testid="btn-allow-once"
              >
                <span className="text-blue-500 text-base flex-shrink-0">🔓</span>
                السماح بالاستخدام هذه المرة
              </button>
              <button
                onClick={() => { setShowPermDialog(false); setPermStatus("idle"); }}
                className="w-full px-5 py-4 text-right text-red-500 font-medium text-[15px] hover:bg-red-50 active:bg-red-100 transition-colors flex items-center gap-3"
                data-testid="btn-deny-camera"
              >
                <span className="text-red-400 text-base flex-shrink-0">🚫</span>
                عدم السماح مطلقاً
              </button>
            </div>
            <div className="h-6" />
          </div>
        </div>
      )}
    </div>
  );
}
