import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertAdSchema } from "@shared/schema";
import { useCreateAd } from "@/hooks/use-ads";
import { useLanguage } from "@/components/LanguageProvider";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Film, Volume2, ImageIcon, AlertCircle, CreditCard } from "lucide-react";
import { UploadZone } from "@/components/UploadZone";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery } from "@tanstack/react-query";

const formSchema = insertAdSchema.extend({
  productName: z.string().optional(),
  targetAudience: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const EGYPT_REGIONS = [
  "القاهرة", "الجيزة", "الإسكندرية", "الدقهلية", "الشرقية", "المنوفية",
  "المنيا", "أسيوط", "سوهاج", "قنا", "الأقصر", "أسوان", "البحيرة",
  "كفر الشيخ", "الغربية", "الفيوم", "بني سويف", "الوادي الجديد",
  "مطروح", "شمال سيناء", "جنوب سيناء", "البحر الأحمر", "السويس",
  "الإسماعيلية", "بورسعيد", "دمياط"
];

// Egyptian Arabic TTS
function speakEgyptian(text: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ar-EG';
  utterance.rate = 0.9;
  utterance.pitch = 1.0;
  const voices = window.speechSynthesis.getVoices();
  const arVoice = voices.find(v => v.lang.startsWith('ar')) || voices[0];
  if (arVoice) utterance.voice = arVoice;
  window.speechSynthesis.speak(utterance);
}

export default function CreateAd() {
  const { t, language } = useLanguage();
  const { mutateAsync: createAd, isPending: isCreating } = useCreateAd();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [aiMode, setAiMode] = useState(false);
  const [videoScript, setVideoScript] = useState<any>(null);
  const [generatingScript, setGeneratingScript] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatingCopy, setGeneratingCopy] = useState(false);
  const [aiImageUrl, setAiImageUrl] = useState("");
  const [speakingScene, setSpeakingScene] = useState<number | null>(null);

  // AI usage info
  const { data: aiUsage } = useQuery<any>({
    queryKey: ['/api/ai/usage'],
    enabled: aiMode,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "", description: "", mediaUrl: "", mediaType: "image",
      language: language as 'ar' | 'en', status: "active",
      productName: "", targetAudience: "", targetRegion: ""
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const { productName, targetAudience, ...adData } = values;
      await createAd({ ...adData, userId: "temp" });
      toast({ title: "🎉 تم نشر الإعلان بنجاح!", className: "bg-green-500 text-white border-none" });
      setLocation("/ads");
    } catch (error: any) {
      toast({ variant: "destructive", title: "خطأ", description: error.message });
    }
  };

  const handleGenerateCopy = async () => {
    const { productName, targetAudience, language: lang } = form.getValues();
    if (!productName) { toast({ variant: "destructive", title: "أدخل اسم المنتج أولاً" }); return; }
    setGeneratingCopy(true);
    try {
      const res = await fetch("/api/ai/generate-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName, targetAudience, language: lang }),
        credentials: "include"
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.message === 'insufficient_credits') {
          toast({ variant: "destructive", title: "انتهت الرصيد المجاني", description: `تكلفة الرصيد الإضافي: ${data.pricePerCredit} جنيه` });
          return;
        }
        throw new Error(data.message);
      }
      form.setValue("title", data.title || "");
      form.setValue("description", data.description || "");
      if (lang === 'ar' && data.title) speakEgyptian("تم توليد النص: " + data.title);
      toast({ title: "✨ تم توليد النص!" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "فشل التوليد", description: e.message });
    } finally { setGeneratingCopy(false); }
  };

  const handleGenerateImage = async () => {
    const { description, productName, title } = form.getValues();
    const prompt = `Professional Arabic advertisement image for ${productName || title || description}. High quality, vibrant colors, suitable for Egyptian market.`;
    setGeneratingImage(true);
    try {
      const res = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, size: "1024x1024" }),
        credentials: "include"
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.message === 'insufficient_credits') {
          toast({ variant: "destructive", title: "انتهت الرصيد المجاني", description: `اشحن رصيدك من صفحة الإيرادات` });
          return;
        }
        throw new Error(data.message);
      }
      const url = data.url;
      setAiImageUrl(url);
      form.setValue("mediaUrl", url);
      form.setValue("mediaType", "image");
      toast({ title: "🎨 تم توليد الصورة!" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "فشل توليد الصورة", description: e.message });
    } finally { setGeneratingImage(false); }
  };

  const handleGenerateVideoScript = async () => {
    const { productName } = form.getValues();
    if (!productName) { toast({ variant: "destructive", title: "أدخل اسم المنتج أولاً" }); return; }
    setGeneratingScript(true);
    try {
      const res = await fetch("/api/ai/generate-video-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName, duration: 30, language: form.getValues("language") }),
        credentials: "include"
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.message === 'insufficient_credits') {
          toast({ variant: "destructive", title: "انتهت الرصيد المجاني" });
          return;
        }
        throw new Error(data.message);
      }
      setVideoScript(data);
      if (data.title) form.setValue("title", data.title);
      if (data.script) form.setValue("description", data.script);
      toast({ title: "🎬 تم توليد سكريبت الفيديو السينمائي!" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "فشل التوليد", description: e.message });
    } finally { setGeneratingScript(false); }
  };

  const speakScene = (scene: any, idx: number) => {
    setSpeakingScene(idx);
    const text = `${scene.narration || scene.visual}`;
    speakEgyptian(text);
    setTimeout(() => setSpeakingScene(null), 3000);
  };

  return (
    <div className="container max-w-3xl px-4 py-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold">{t('create.title')}</h1>
          <p className="text-muted-foreground">أنشئ إعلاناً احترافياً بمساعدة الذكاء الاصطناعي</p>
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        <Button onClick={() => setAiMode(false)} variant={!aiMode ? "default" : "outline"} size="sm" data-testid="btn-manual-mode">✏️ يدوي</Button>
        <Button onClick={() => setAiMode(true)} variant={aiMode ? "default" : "outline"} size="sm" className="gap-2" data-testid="btn-ai-mode">
          <Sparkles className="w-4 h-4" /> مساعد AI
        </Button>
      </div>

      {/* AI Credits Badge */}
      {aiMode && aiUsage && (
        <div className="mb-4 flex items-center gap-3 bg-muted rounded-xl p-3">
          <CreditCard className="w-5 h-5 text-primary" />
          <div className="flex-1">
            <span className="text-sm font-medium">رصيد AI المجاني: </span>
            <Badge variant={aiUsage.remaining > 0 ? "default" : "destructive"} className="ml-2">
              {aiUsage.remaining} متبقي من {aiUsage.freeCredits}
            </Badge>
          </div>
          {aiUsage.remaining === 0 && (
            <span className="text-xs text-muted-foreground">{aiUsage.pricePerCredit} ج/طلب إضافي</span>
          )}
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {aiMode && (
            <AnimatePresence>
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="rounded-2xl border-primary/20 bg-primary/5">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" /> توليد بالذكاء الاصطناعي
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="productName" render={({ field }) => (
                        <FormItem>
                          <FormLabel>اسم المنتج / الخدمة</FormLabel>
                          <FormControl><Input placeholder="مثال: هاتف سامسونج" {...field} data-testid="input-product-name" /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="targetAudience" render={({ field }) => (
                        <FormItem>
                          <FormLabel>الجمهور المستهدف</FormLabel>
                          <FormControl><Input placeholder="مثال: شباب 18-35" {...field} data-testid="input-target-audience" /></FormControl>
                        </FormItem>
                      )} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" onClick={handleGenerateCopy} disabled={generatingCopy} size="sm" className="gap-2" data-testid="btn-gen-copy">
                        {generatingCopy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        توليد نص
                      </Button>
                      <Button type="button" onClick={handleGenerateImage} disabled={generatingImage} size="sm" variant="outline" className="gap-2" data-testid="btn-gen-image">
                        {generatingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                        توليد صورة AI
                      </Button>
                      <Button type="button" onClick={handleGenerateVideoScript} disabled={generatingScript} size="sm" variant="outline" className="gap-2" data-testid="btn-gen-script">
                        {generatingScript ? <Loader2 className="w-4 h-4 animate-spin" /> : <Film className="w-4 h-4" />}
                        سكريبت فيديو سينمائي
                      </Button>
                    </div>

                    {/* Video Script Display */}
                    {videoScript && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-background rounded-xl border overflow-hidden">
                        <div className="bg-gradient-to-r from-primary to-secondary p-3 text-white">
                          <h4 className="font-bold text-sm">🎬 {videoScript.title}</h4>
                          {videoScript.music && <p className="text-xs opacity-80 mt-1">🎵 موسيقى: {videoScript.music}</p>}
                        </div>
                        <div className="p-4 space-y-3">
                          {videoScript.voiceover && (
                            <div className="bg-muted rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-primary">التعليق الصوتي</span>
                                <Button size="sm" variant="ghost" className="h-6 gap-1 text-xs" onClick={() => speakEgyptian(videoScript.voiceover)}>
                                  <Volume2 className="w-3 h-3" /> استمع
                                </Button>
                              </div>
                              <p className="text-sm">{videoScript.voiceover}</p>
                            </div>
                          )}
                          {videoScript.scenes && (
                            <div className="space-y-2">
                              <p className="text-xs font-bold text-muted-foreground">المشاهد السينمائية:</p>
                              {videoScript.scenes.map((sc: any, i: number) => (
                                <div key={i} className="border rounded-lg p-3 bg-muted/30">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="secondary" className="text-xs px-2 py-0">{sc.time || `${i * 5}s`}</Badge>
                                      {sc.mood && <span className="text-xs text-muted-foreground">{sc.mood}</span>}
                                    </div>
                                    <Button
                                      size="sm" variant="ghost" className="h-6 gap-1 text-xs"
                                      onClick={() => speakScene(sc, i)}
                                      disabled={speakingScene === i}
                                    >
                                      {speakingScene === i ? <Loader2 className="w-3 h-3 animate-spin" /> : <Volume2 className="w-3 h-3" />}
                                      استمع
                                    </Button>
                                  </div>
                                  <p className="text-xs font-medium">🎥 {sc.visual}</p>
                                  <p className="text-xs text-muted-foreground mt-1">🎤 {sc.narration}</p>
                                  {sc.transition && <p className="text-xs text-primary mt-1">➡ {sc.transition}</p>}
                                </div>
                              ))}
                            </div>
                          )}
                          {videoScript.callToAction && (
                            <div className="bg-primary/10 rounded-lg p-3 text-center">
                              <p className="text-sm font-bold text-primary">📢 {videoScript.callToAction}</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </AnimatePresence>
          )}

          <FormField control={form.control} name="title" render={({ field }) => (
            <FormItem>
              <FormLabel>عنوان الإعلان</FormLabel>
              <FormControl><Input placeholder="أدخل عنواناً جذاباً..." {...field} data-testid="input-title" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="description" render={({ field }) => (
            <FormItem>
              <FormLabel>وصف الإعلان</FormLabel>
              <FormControl><Textarea placeholder="اكتب وصفاً مقنعاً..." rows={4} {...field} data-testid="input-description" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="mediaType" render={({ field }) => (
              <FormItem>
                <FormLabel>نوع الوسيط</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger data-testid="select-media-type"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="image">📷 صورة</SelectItem>
                    <SelectItem value="video">🎬 فيديو</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name="language" render={({ field }) => (
              <FormItem>
                <FormLabel>اللغة</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger data-testid="select-language"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="ar">🇸🇦 العربية</SelectItem>
                    <SelectItem value="en">🇺🇸 English</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
          </div>

          <FormField control={form.control} name="targetRegion" render={({ field }) => (
            <FormItem>
              <FormLabel>المنطقة الجغرافية (اختياري)</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                <FormControl><SelectTrigger data-testid="select-region"><SelectValue placeholder="كل مصر" /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="">🗺 كل مصر</SelectItem>
                  {EGYPT_REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormItem>
          )} />

          <FormField control={form.control} name="mediaUrl" render={({ field }) => (
            <FormItem>
              <FormLabel>الصورة / الفيديو</FormLabel>
              <UploadZone value={field.value} onChange={field.onChange} label="ارفع صورة أو فيديو مباشرة" />
              {!field.value && (
                <>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground">أو أدخل رابطاً</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <FormControl>
                    <Input placeholder="https://..." className="mt-2" onChange={e => field.onChange(e.target.value)} data-testid="input-media-url" />
                  </FormControl>
                </>
              )}
              <FormMessage />
            </FormItem>
          )} />

          <Button type="submit" disabled={isCreating} size="lg" className="w-full h-14 text-lg gap-2 shadow-xl shadow-primary/25" data-testid="btn-submit">
            {isCreating ? <><Loader2 className="w-5 h-5 animate-spin" /> جاري النشر...</> : <>{t('create.submit')} 🚀</>}
          </Button>
        </form>
      </Form>
    </div>
  );
}
