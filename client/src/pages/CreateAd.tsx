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
import { EgyptTargetingMap } from "@/components/EgyptTargetingMap";

const formSchema = insertAdSchema.extend({
  productName: z.string().optional(),
  targetAudience: z.string().optional(),
  userId: z.string().optional(), // set server-side from auth
  mediaUrl: z.string().optional().default(""),
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
  const [cinemaScene, setCinemaScene] = useState(0);
  const [cinemaPlaying, setCinemaPlaying] = useState(false);
  const [cinemaFullscreen, setCinemaFullscreen] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  // Targeting map states
  const [targetRegions, setTargetRegions] = useState<string[]>([]);
  const [targetInterests, setTargetInterests] = useState<string[]>([]);
  const [targetAges, setTargetAges] = useState<string[]>([]);

  // Auto-advance cinema slideshow
  useEffect(() => {
    if (!cinemaPlaying || !videoScript?.scenes?.length) return;
    const scenes = videoScript.scenes;
    const text = scenes[cinemaScene]?.narration || scenes[cinemaScene]?.visual || '';
    // Speak
    setAudioPlaying(true);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = 'ar-EG';
      utt.rate = 0.85;
      utt.pitch = 1.1;
      const voices = window.speechSynthesis.getVoices();
      const arVoice = voices.find(v => v.lang.startsWith('ar')) || voices[0];
      if (arVoice) utt.voice = arVoice;
      utt.onend = () => setAudioPlaying(false);
      window.speechSynthesis.speak(utt);
    }
    const timer = setTimeout(() => {
      const next = cinemaScene + 1;
      if (next >= scenes.length) {
        setCinemaPlaying(false);
        setCinemaScene(0);
      } else {
        setCinemaScene(next);
      }
    }, 6000);
    return () => { clearTimeout(timer); };
  }, [cinemaPlaying, cinemaScene, videoScript]);

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
      userId: "", productName: "", targetAudience: "", targetRegion: ""
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const { productName, targetAudience, ...adData } = values;
      const newAd = await createAd({
        ...adData,
        userId: "temp",
        targetRegion: targetRegions.join(",") || adData.targetRegion || "",
        // extra targeting sent as description extension (stored as JSON comment for now)
      });
      toast({ title: "🎉 تم نشر الإعلان بنجاح!", className: "bg-green-500 text-white border-none" });
      if (newAd?.id) {
        setLocation(`/ads/${newAd.id}`);
      } else {
        setLocation("/ads");
      }
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
    {/* ===== FULLSCREEN CINEMA OVERLAY ===== */}
    {cinemaPlaying && videoScript?.scenes && (
      <div className="fixed inset-0 z-[9999] bg-black flex flex-col" dir="rtl">
        {/* Top bar */}
        <div className="flex items-center justify-between p-4 bg-black/80 backdrop-blur border-b border-white/10">
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-primary" />
            <span className="text-white font-bold text-sm">{videoScript.title}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-white/60 text-xs">
              مشهد {cinemaScene + 1} / {videoScript.scenes.length}
            </span>
            <button
              onClick={() => { setCinemaPlaying(false); window.speechSynthesis?.cancel?.(); }}
              className="text-white/70 hover:text-white text-sm border border-white/20 rounded-full px-3 py-1 hover:bg-white/10 transition-all"
            >
              ⏹ إيقاف
            </button>
          </div>
        </div>

        {/* Main scene */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          {/* Time badge */}
          <div className="mb-6">
            <span className="bg-primary/20 text-primary border border-primary/40 rounded-full px-4 py-1 text-sm font-medium">
              ⏱ {videoScript.scenes[cinemaScene]?.time}
            </span>
          </div>

          {/* Narration — BIG TEXT */}
          <p className="text-white text-2xl md:text-4xl font-extrabold leading-relaxed mb-6 max-w-3xl">
            {videoScript.scenes[cinemaScene]?.narration}
          </p>

          {/* Visual description */}
          <p className="text-white/50 text-base md:text-lg max-w-2xl leading-relaxed">
            🎥 {videoScript.scenes[cinemaScene]?.visual}
          </p>

          {/* Mood */}
          {videoScript.scenes[cinemaScene]?.mood && (
            <span className="mt-4 text-white/40 text-sm italic">
              {videoScript.scenes[cinemaScene].mood}
            </span>
          )}
        </div>

        {/* Audio wave indicator */}
        <div className="flex items-center justify-center gap-1.5 py-4">
          {[1,2,3,4,5,6,7].map(i => (
            <div
              key={i}
              className="w-1 bg-primary rounded-full"
              style={{
                height: audioPlaying ? `${12 + Math.sin(Date.now()/200 + i) * 10}px` : '4px',
                animation: audioPlaying ? `audioWave 0.6s ease-in-out ${i * 0.1}s infinite alternate` : 'none',
                transition: 'height 0.2s'
              }}
            />
          ))}
          <span className="text-white/50 text-xs mr-2 ml-1">
            {audioPlaying ? '🔊 يتحدث...' : '🔇 في الانتظار'}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-white/10">
          <div
            className="h-full bg-primary transition-all"
            style={{
              width: `${((cinemaScene + 1) / videoScript.scenes.length) * 100}%`,
              transitionDuration: '6000ms'
            }}
          />
        </div>

        {/* Scene dots */}
        <div className="flex items-center justify-center gap-2 py-3 bg-black/50">
          {videoScript.scenes.map((_: any, i: number) => (
            <button
              key={i}
              onClick={() => { window.speechSynthesis?.cancel?.(); setCinemaScene(i); }}
              className={`rounded-full transition-all ${i === cinemaScene ? 'w-6 h-2 bg-primary' : 'w-2 h-2 bg-white/30 hover:bg-white/60'}`}
            />
          ))}
        </div>
      </div>
    )}

    <style>{`
      @keyframes audioWave {
        from { height: 4px; }
        to { height: 24px; }
      }
    `}</style>
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
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-sm">🎬 {videoScript.title}</h4>
                            <Button
                              size="sm" variant="secondary" className="h-7 gap-1 text-xs bg-white/20 text-white hover:bg-white/30 border-0"
                              onClick={() => { setCinemaScene(0); setCinemaPlaying(true); }}
                            >
                              <Film className="w-3 h-3" /> {cinemaPlaying ? 'يعرض...' : 'عرض سينمائي ▶'}
                            </Button>
                          </div>
                          {videoScript.music && <p className="text-xs opacity-80 mt-1">🎵 موسيقى: {typeof videoScript.music === 'string' ? videoScript.music : videoScript.music?.description || ''}</p>}
                        </div>

                        {/* Inline cinema preview placeholder */}
                        {cinemaPlaying && <div className="bg-muted/30 rounded-xl p-3 text-xs text-center text-muted-foreground animate-pulse">🎬 جاري العرض السينمائي في الشاشة...</div>}

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
                                <div key={i} className={`border rounded-lg p-3 bg-muted/30 transition-all ${cinemaPlaying && cinemaScene === i ? 'ring-2 ring-primary' : ''}`}>
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
                              <p className="text-sm font-bold text-primary">
                                📢 {typeof videoScript.callToAction === 'string' ? videoScript.callToAction : videoScript.callToAction?.text || videoScript.callToAction?.description || ''}
                              </p>
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

          {/* Pricing & Payment */}
          <div className="border rounded-2xl p-4 bg-green-50/30 dark:bg-green-950/10 space-y-3">
            <h3 className="font-bold text-sm flex items-center gap-2">💰 السعر وطرق التواصل</h3>
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="priceEGP" render={({ field }) => (
                <FormItem>
                  <FormLabel>السعر (ج.م)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="مثال: 500" {...field} data-testid="input-price" />
                  </FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="whatsappNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>رقم الواتساب</FormLabel>
                  <FormControl>
                    <Input placeholder="01xxxxxxxxx" {...field} dir="ltr" data-testid="input-whatsapp" />
                  </FormControl>
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="paymentLink" render={({ field }) => (
              <FormItem>
                <FormLabel>رابط الدفع المباشر (اختياري)</FormLabel>
                <FormControl>
                  <Input placeholder="https://payment.example.com/pay" {...field} dir="ltr" />
                </FormControl>
              </FormItem>
            )} />
          </div>

          {/* Targeting Map */}
          <div className="border rounded-2xl p-4 bg-background space-y-2">
            <EgyptTargetingMap
              selectedRegions={targetRegions}
              selectedInterests={targetInterests}
              selectedAges={targetAges}
              onRegionsChange={setTargetRegions}
              onInterestsChange={setTargetInterests}
              onAgesChange={setTargetAges}
            />
          </div>

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

          {/* Show any validation errors */}
          {Object.keys(form.formState.errors).length > 0 && (
            <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/20 p-4 space-y-1" data-testid="form-errors">
              <p className="text-sm font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> يرجى تصحيح الأخطاء التالية:
              </p>
              {form.formState.errors.title && <p className="text-sm text-red-500">• العنوان: {String(form.formState.errors.title.message)}</p>}
              {form.formState.errors.description && <p className="text-sm text-red-500">• الوصف: {String(form.formState.errors.description.message)}</p>}
              {Object.entries(form.formState.errors)
                .filter(([k]) => !['title','description','mediaUrl','userId','productName','targetAudience'].includes(k))
                .map(([k, v]: any) => <p key={k} className="text-sm text-red-500">• {k}: {String(v?.message)}</p>)
              }
            </div>
          )}

          <Button
            type="submit"
            disabled={isCreating}
            size="lg"
            className="w-full h-14 text-lg gap-2 shadow-xl shadow-primary/25"
            data-testid="btn-submit"
            onClick={() => {
              // Debug: log errors if form is invalid
              const errs = form.formState.errors;
              if (Object.keys(errs).length > 0) console.log("Form errors:", errs);
            }}
          >
            {isCreating ? <><Loader2 className="w-5 h-5 animate-spin" /> جاري النشر...</> : <>{t('create.submit')} 🚀</>}
          </Button>
        </form>
      </Form>
    </div>
  );
}
