import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Radio, Video, Plus } from "lucide-react";
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
  const [loading, setLoading] = useState(false);

  const { data: myChannel } = useQuery<Channel | null>({
    queryKey: ["/api/channels/mine"],
    queryFn: () => fetch("/api/channels/mine", { credentials: "include" }).then(r => r.json()),
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", description: "", category: "general", language: "ar" },
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

  /* زر "ابدأ البث" — onClick مباشر يفتح الكاميرا ثم ينشئ البث */
  const handleStart = async () => {
    const valid = await form.trigger();
    if (!valid) return;
    const data = form.getValues();
    setLoading(true);
    try {
      /* فتح الكاميرا في لحظة الضغط (user-gesture) ونحتفظ بالـ stream */
      const ms = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      /* نخزّن الـ stream في window عشان LiveStream يستخدمه مباشرة بدون ما يطلب الكاميرا تاني */
      (window as any).__pendingCameraStream = ms;
    } catch {
      toast({ variant: "destructive", title: "⚠️ الكاميرا محجوبة", description: "افتح إعدادات المتصفح وأعطِ الموقع إذن الكاميرا والميكروفون، ثم أعد المحاولة" });
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/streams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      const stream = await res.json();
      toast({ title: "تم إنشاء البث!", description: "سيبدأ البث المباشر الآن" });
      setLocation(`/streams/${stream.id}?mode=broadcast`);
    } catch (e: any) {
      toast({ variant: "destructive", title: "خطأ", description: e.message });
      setLoading(false);
    }
  };

  if (!myChannel) {
    return (
      <div className="container max-w-lg px-4 py-12 text-center" dir="rtl">
        <div className="relative mb-8">
          <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center mx-auto mb-5 shadow-2xl shadow-red-500/30">
            <Radio className="w-14 h-14 text-white" />
          </div>
        </div>
        <h2 className="text-3xl font-extrabold mb-2">ابدأ قناتك الآن!</h2>
        <p className="text-muted-foreground mb-8 text-base">أنشئ قناتك مجاناً وابدأ البث المباشر مع آلاف المشاهدين</p>
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
          onClick={() => {
            const rawName = user?.firstName;
            const safeName = (rawName && rawName !== "null" && rawName !== "undefined") ? rawName : "قناتي";
            createChannelMutation.mutate(safeName + " Channel");
          }}
          disabled={createChannelMutation.isPending}
          size="lg"
          className="w-full gap-2 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-extrabold text-base py-6 rounded-2xl shadow-xl shadow-red-500/25"
          data-testid="btn-create-channel"
        >
          {createChannelMutation.isPending ? <><span className="animate-spin">⏳</span> جارٍ الإنشاء...</> : <><Plus className="w-5 h-5" /> إنشاء قناتي الآن — مجاناً</>}
        </Button>
        <p className="text-xs text-muted-foreground mt-3">✨ لا تحتاج بطاقة بنكية — مجاني تماماً</p>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl px-4 py-12" dir="rtl">
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
            <div className="space-y-5">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>عنوان البث</FormLabel>
                  <FormControl><Input placeholder="أدخل عنواناً جذاباً للبث..." {...field} data-testid="input-stream-title" /></FormControl>
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

              <Button
                type="button"
                onClick={handleStart}
                disabled={loading}
                size="lg"
                className="w-full bg-red-500 hover:bg-red-600 text-white gap-2"
                data-testid="btn-start-stream"
              >
                <Video className="w-5 h-5" />
                {loading ? "جاري الإعداد..." : "ابدأ البث الآن 🔴"}
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
