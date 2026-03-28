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
import { Sparkles, Loader2, Film, Volume2, ImageIcon, AlertCircle, CreditCard, Plus, X, Music } from "lucide-react";
import { UploadZone } from "@/components/UploadZone";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery } from "@tanstack/react-query";
import { EgyptTargetingMap } from "@/components/EgyptTargetingMap";
import LocationPickerMap from "@/components/LocationPickerMap";
import { useTTS } from "@/hooks/use-tts";
import { useRef } from "react";

const formSchema = insertAdSchema.extend({
  title: z.string().min(2, "العنوان مطلوب (2 أحرف على الأقل)"),
  description: z.string().min(5, "الوصف مطلوب (5 أحرف على الأقل)"),
  productName: z.string().optional(),
  targetAudience: z.string().optional(),
  userId: z.string().optional(),
  mediaUrl: z.string().optional().default(""),
  appStoreUrl: z.string().optional(),
  googlePlayUrl: z.string().optional(),
  appGalleryUrl: z.string().optional(),
  installmentMonths: z.number().optional(),
  installmentMonthlyEGP: z.number().optional(),
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

const SOUQ_PLAY = "https://play.google.com/store/apps/details?id=com.apmo.souqmarket";
const SOUQ_APPLE = "https://apps.apple.com/eg/app/as-souqmarket/id6740153334";

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
  const [paymentMode, setPaymentMode] = useState<"cash" | "installment">("cash");
  // Targeting map states
  const [targetRegions, setTargetRegions] = useState<string[]>([]);
  const [targetInterests, setTargetInterests] = useState<string[]>([]);
  const [targetAges, setTargetAges] = useState<string[]>([]);
  const [locationTarget, setLocationTarget] = useState<{ lat: number; lng: number; radiusKm: number } | null>(null);
  // Multi-image to video
  const [adImageUrls, setAdImageUrls] = useState<string[]>([]);
  const [uploadingAdImages, setUploadingAdImages] = useState(false);
  const [convertingAdToVideo, setConvertingAdToVideo] = useState(false);
  const fileAdImagesRef = useRef<HTMLInputElement>(null);
  const tts = useTTS();

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
      userId: "", productName: "", targetAudience: "", targetRegion: "",
      appStoreUrl: "", googlePlayUrl: "", appGalleryUrl: "",
      paymentLink: "", whatsappNumber: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const { productName, targetAudience, ...adData } = values;
      const newAd = await createAd({
        ...adData,
        userId: "temp",
        targetRegion: targetRegions.join(",") || adData.targetRegion || "",
        ...(locationTarget ? {
          targetLat: locationTarget.lat,
          targetLng: locationTarget.lng,
          targetRadiusKm: locationTarget.radiusKm,
        } : {}),
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
                    <SelectItem value="ar">🇪🇬 العربية</SelectItem>
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
            {/* Payment Mode Toggle */}
            <div className="bg-gradient-to-br from-green-50/60 to-blue-50/60 dark:from-green-950/20 dark:to-blue-950/20 border border-green-200 dark:border-green-800 rounded-xl p-3 space-y-3">
              <h4 className="font-bold text-sm flex items-center gap-2">💳 طريقة دفع قيمة الإعلان</h4>
              {/* Toggle buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMode("cash")}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${paymentMode === "cash" ? "bg-green-600 text-white border-green-600" : "bg-white dark:bg-background border-border text-muted-foreground hover:border-green-400"}`}
                  data-testid="btn-pay-cash"
                >
                  💵 دفع كاش
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode("installment")}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${paymentMode === "installment" ? "bg-blue-600 text-white border-blue-600" : "bg-white dark:bg-background border-border text-muted-foreground hover:border-blue-400"}`}
                  data-testid="btn-pay-installment"
                >
                  📅 تقسيط
                </button>
              </div>

              {/* Souq Market unified download card — shown in both modes */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
                <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-xl">🛒</span>
                  <div>
                    <p className="text-xs font-bold">{paymentMode === "cash" ? "ادفع كاش عبر تطبيق سوق ماركات" : "قسّط عبر تطبيق سوق ماركات"}</p>
                    <p className="text-[10px] text-muted-foreground">حمّل التطبيق لإتمام {paymentMode === "cash" ? "الدفع" : "التقسيط"} بسهولة</p>
                  </div>
                </div>
                <div className="flex flex-col divide-y divide-gray-200 dark:divide-gray-700">
                  <a
                    href={SOUQ_PLAY}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    data-testid="btn-souq-play"
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3.18 23.45a2 2 0 0 1-.93-.87V1.42a2 2 0 0 1 .93-.87l11.47 11.45L3.18 23.45zm13.12-6.92L4.43 23.35l9.1-9.09 2.77 2.27zm2.43-5.14c.4.28.65.72.65 1.21s-.25.93-.65 1.21l-2 1.3-3.06-3.05 3.06-3.06 2 1.39zM4.43.65l11.87 6.82-2.77 2.27L4.43.65z" fill="#01875f"/>
                    </svg>
                    <div>
                      <div className="text-[10px] text-muted-foreground">تحميل على</div>
                      <div className="text-xs font-bold">Google Play</div>
                    </div>
                  </a>
                  <a
                    href={SOUQ_APPLE}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    data-testid="btn-souq-apple"
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current flex-shrink-0" xmlns="http://www.w3.org/2000/svg">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                    <div>
                      <div className="text-[10px] text-muted-foreground">تحميل على</div>
                      <div className="text-xs font-bold">App Store</div>
                    </div>
                  </a>
                  <a
                    href={SOUQ_PLAY}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    data-testid="btn-souq-gallery"
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="10" fill="#CF0A2C"/>
                      <path d="M8 9.5h8M8 12h5M8 14.5h6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    <div>
                      <div className="text-[10px] text-muted-foreground">تحميل على</div>
                      <div className="text-xs font-bold">AppGallery</div>
                    </div>
                  </a>
                </div>
              </div>

              {/* Advertiser's own app links — 3 fields stacked */}
              <div className="space-y-1.5">
                <p className="text-xs font-bold flex items-center gap-1">📱 روابط تطبيقك الخاص (اختياري)</p>
                <p className="text-[10px] text-muted-foreground mb-1">أضف رابط تطبيقك على أي متجر — تظهر في صفحة إعلانك</p>
                <FormField control={form.control} name="appStoreUrl" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs flex items-center gap-2">
                      <span className="w-4 h-4 rounded bg-black text-white flex items-center justify-center text-[9px] font-bold flex-shrink-0"></span>
                      App Store (iOS)
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="https://apps.apple.com/app/..." {...field} dir="ltr" className="text-xs h-8" data-testid="input-appstore-url" />
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="googlePlayUrl" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs flex items-center gap-2">
                      <span className="w-4 h-4 rounded bg-green-600 text-white flex items-center justify-center text-[9px] font-bold flex-shrink-0">G</span>
                      Google Play (Android)
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="https://play.google.com/store/apps/..." {...field} dir="ltr" className="text-xs h-8" data-testid="input-googleplay-url" />
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="appGalleryUrl" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs flex items-center gap-2">
                      <span className="w-4 h-4 rounded bg-red-600 text-white flex items-center justify-center text-[9px] font-bold flex-shrink-0">H</span>
                      AppGallery (Huawei)
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="https://appgallery.huawei.com/..." {...field} dir="ltr" className="text-xs h-8" data-testid="input-appgallery-url" />
                    </FormControl>
                  </FormItem>
                )} />
              </div>

              {/* Installment: months + monthly amount */}
              {paymentMode === "installment" && (
                <div className="grid grid-cols-2 gap-2">
                  <FormField control={form.control} name="installmentMonths" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">عدد الأقساط (شهر)</FormLabel>
                      <FormControl>
                        <Input type="number" min="2" max="24" placeholder="مثال: 3" {...field} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)} data-testid="input-installment-months" />
                      </FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="installmentMonthlyEGP" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">القسط الشهري (ج.م)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" placeholder="مثال: 100" {...field} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)} data-testid="input-installment-monthly" />
                      </FormControl>
                    </FormItem>
                  )} />
                </div>
              )}
            </div>

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

          {/* Location Picker Map */}
          <div className="border rounded-2xl p-4 bg-background">
            <LocationPickerMap value={locationTarget} onChange={setLocationTarget} />
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

              {/* ─── Multi-image → Video ─── */}
              <div className="mt-3 rounded-xl border border-dashed border-orange-300 bg-orange-50/50 dark:bg-orange-900/10 p-3 space-y-3">
                <p className="text-xs font-bold text-orange-700 dark:text-orange-300 flex items-center gap-1.5">
                  🎬 أو ارفع عدة صور وحوّلها لفيديو احترافي
                </p>
                <input
                  ref={fileAdImagesRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    if (!files.length) return;
                    e.target.value = "";
                    const remaining = 15 - adImageUrls.length;
                    const toUpload = files.slice(0, remaining);
                    if (!toUpload.length) { toast({ title: "⚠ وصلت للحد الأقصى (15 صورة)" }); return; }
                    setUploadingAdImages(true);
                    try {
                      const uploaded = await Promise.all(toUpload.map(async (file) => {
                        const fd = new FormData();
                        fd.append('file', file);
                        const r = await fetch('/api/upload', { method: 'POST', body: fd });
                        const d = await r.json();
                        return d.url as string;
                      }));
                      setAdImageUrls(prev => [...prev, ...uploaded.filter(Boolean)].slice(0, 15));
                      toast({ title: `✅ تم رفع ${uploaded.length} صورة دفعة واحدة!` });
                    } catch { toast({ variant: "destructive", title: "فشل رفع الصور" }); }
                    finally { setUploadingAdImages(false); }
                  }}
                />

                {adImageUrls.length > 0 && (
                  <div className="grid grid-cols-4 gap-1.5">
                    {adImageUrls.map((url, i) => (
                      <div key={i} className="relative aspect-square rounded-lg overflow-hidden group">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button
                          onClick={() => setAdImageUrls(prev => prev.filter((_, j) => j !== i))}
                          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs opacity-0 group-hover:opacity-100 flex items-center justify-center"
                        ><X className="w-3 h-3" /></button>
                      </div>
                    ))}
                    {adImageUrls.length < 15 && (
                      <button
                        onClick={() => fileAdImagesRef.current?.click()}
                        disabled={uploadingAdImages}
                        className="aspect-square rounded-lg border-2 border-dashed border-orange-300 flex items-center justify-center hover:bg-orange-50 transition-all"
                      >
                        {uploadingAdImages ? <Loader2 className="w-4 h-4 animate-spin text-orange-500" /> : <Plus className="w-4 h-4 text-orange-500" />}
                      </button>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  {adImageUrls.length === 0 && (
                    <button
                      type="button"
                      onClick={() => fileAdImagesRef.current?.click()}
                      disabled={uploadingAdImages}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-orange-300 text-orange-700 text-sm hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all"
                      data-testid="btn-upload-ad-images"
                    >
                      {uploadingAdImages ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ImageIcon className="w-4 h-4" /> ارفع صور متعددة</>}
                    </button>
                  )}
                  {adImageUrls.length >= 1 && (
                    <button
                      type="button"
                      disabled={convertingAdToVideo}
                      onClick={async () => {
                        setConvertingAdToVideo(true);
                        try {
                          const r = await fetch('/api/ai/images-to-video', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ imageUrls: adImageUrls, duration: 3 }),
                          });
                          const d = await r.json();
                          if (!r.ok) throw new Error(d.message);
                          field.onChange(d.url);
                          form.setValue("mediaType", "video");
                          setAdImageUrls([]);
                          toast({ title: "🎬 تم تحويل الصور لفيديو!" });
                        } catch (e: any) {
                          toast({ variant: "destructive", title: "فشل التحويل", description: e.message });
                        } finally { setConvertingAdToVideo(false); }
                      }}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 disabled:opacity-50 transition-all"
                      data-testid="btn-convert-ad-to-video"
                    >
                      {convertingAdToVideo
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري التحويل...</>
                        : <>🎬 حوّل {adImageUrls.length} صور لفيديو MP4</>
                      }
                    </button>
                  )}
                </div>
              </div>

              {/* ─── TTS for Ad ─── */}
              {(form.watch("title")?.length >= 2) && (
                <div className="mt-3 rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200/50 p-3 space-y-2">
                  <p className="text-xs font-bold text-purple-700 dark:text-purple-300">🎙 تحويل النص لصوت (للريلز والإعلانات)</p>
                  {tts.audioUrl ? (
                    <div className="flex items-center gap-2">
                      <audio src={tts.audioUrl} controls className="flex-1 h-8" />
                      <button onClick={() => tts.reset()} className="w-6 h-6 rounded-full bg-red-100 text-red-500 text-xs flex items-center justify-center">✕</button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={tts.loading}
                      onClick={async () => {
                        const text = [form.getValues("title"), form.getValues("description")].filter(Boolean).join(". ");
                        try { await tts.generate(text, "nova", true); }
                        catch { toast({ variant: "destructive", title: "فشل توليد الصوت" }); }
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 disabled:opacity-50"
                      data-testid="btn-ad-tts"
                    >
                      {tts.loading ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري التوليد...</> : <>🎤 حوّل النص لصوت عربي مصري</>}
                    </button>
                  )}
                </div>
              )}
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
