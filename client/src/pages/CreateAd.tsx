import { useState, useEffect, useRef } from "react";
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
import { Sparkles, Loader2, Film, Volume2, ImageIcon, AlertCircle, CreditCard, Plus, X, Music, FolderOpen, Upload, Languages, Download, Eye, Camera, FileText, Wand2, RefreshCw, Tag, Copy, CheckCircle2, ToggleLeft, ToggleRight } from "lucide-react";
import MediaPickerModal from "@/components/MediaPickerModal";
import { UploadZone } from "@/components/UploadZone";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EgyptTargetingMap } from "@/components/EgyptTargetingMap";
import LocationPickerMap from "@/components/LocationPickerMap";
import { useTTS } from "@/hooks/use-tts";

const formSchema = insertAdSchema.extend({
  title: z.string().min(2, "العنوان مطلوب (2 أحرف على الأقل)"),
  description: z.string().min(5, "الوصف مطلوب (5 أحرف على الأقل)"),
  productName: z.string().optional(),
  targetAudience: z.string().optional(),
  adTitle: z.string().optional(),
  customPrompt: z.string().optional(),
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
  const qc = useQueryClient();
  const [aiMode, setAiMode] = useState(false);
  const [videoScript, setVideoScript] = useState<any>(null);
  const [generatingScript, setGeneratingScript] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatingCopy, setGeneratingCopy] = useState(false);
  const [aiImageUrl, setAiImageUrl] = useState("");
  const [talkingPhotoText, setTalkingPhotoText] = useState("");
  const [talkingPhotoVoice, setTalkingPhotoVoice] = useState("ar-EG-SalmaNeural");
  const [generatingTalkingPhoto, setGeneratingTalkingPhoto] = useState(false);
  const [talkingPhotoVideoUrl, setTalkingPhotoVideoUrl] = useState("");
  const [showTTS, setShowTTS] = useState(false);
  const [ttsText, setTtsText] = useState("");
  const [ttsVoice, setTtsVoice] = useState("nova");
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const [generatingTTS, setGeneratingTTS] = useState(false);
  const [ttsAudioUrl, setTtsAudioUrl] = useState("");
  const [speakingScene, setSpeakingScene] = useState<number | null>(null);
  const [cinemaScene, setCinemaScene] = useState(0);
  const [cinemaPlaying, setCinemaPlaying] = useState(false);
  const [cinemaFullscreen, setCinemaFullscreen] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [paymentMode, setPaymentMode] = useState<"cash" | "installment">("cash");
  const [adDuration, setAdDuration] = useState<number>(30); // days, 0 = no expiry
  const [addCoupon, setAddCoupon] = useState(false);
  const [couponDiscountType, setCouponDiscountType] = useState("percentage");
  const [couponDiscountValue, setCouponDiscountValue] = useState("");
  const [generatedCouponCode, setGeneratedCouponCode] = useState("");
  const [couponGenerating, setCouponGenerating] = useState(false);
  // Targeting map states
  const [targetRegions, setTargetRegions] = useState<string[]>([]);
  const [targetInterests, setTargetInterests] = useState<string[]>([]);
  const [targetAges, setTargetAges] = useState<string[]>([]);
  const [locationTarget, setLocationTarget] = useState<{ lat: number; lng: number; radiusKm: number } | null>(null);
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);
  // Multi-image to video
  const [adImageUrls, setAdImageUrls] = useState<string[]>([]);
  const [uploadingAdImages, setUploadingAdImages] = useState(false);
  const [convertingAdToVideo, setConvertingAdToVideo] = useState(false);
  const [convertProgress, setConvertProgress] = useState("");
  const [videoQuality, setVideoQuality] = useState<"standard" | "hd" | "cinema">("hd");
  const [videoFormat, setVideoFormat] = useState<"vertical" | "landscape">("vertical");
  const [imageDuration, setImageDuration] = useState(4);
  const [useAiVoiceVideo, setUseAiVoiceVideo] = useState(false);
  const [scriptTtsAudioUrl, setScriptTtsAudioUrl] = useState<string>("");
  const [generatingScriptAudio, setGeneratingScriptAudio] = useState(false);
  const fileAdImagesRef = useRef<HTMLInputElement>(null);
  const tts = useTTS();
  // AI ref images
  const [refImages, setRefImages] = useState<string[]>([]);
  const [uploadingRefImg, setUploadingRefImg] = useState(false);
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [editImagePrompt, setEditImagePrompt] = useState("");
  const [editingImage, setEditingImage] = useState(false);
  const refImgInputRef = useRef<HTMLInputElement>(null);
  const [cinemaKey, setCinemaKey] = useState(0);
  const cinemaAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  // Ken Burns animation variants cycling per scene
  const kenBurnsVariants = [
    'kenBurns0', 'kenBurns1', 'kenBurns2', 'kenBurns3'
  ];

  // Start full-audio (OpenAI TTS) through Web Audio API with +12dB boost
  const playBoostedAudio = (url: string) => {
    try {
      if (cinemaAudioRef.current) {
        cinemaAudioRef.current.pause();
        cinemaAudioRef.current = null;
      }
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;
      const gain = ctx.createGain();
      gain.gain.value = 3.5;
      gainNodeRef.current = gain;
      const audio = new Audio(url);
      audio.crossOrigin = 'anonymous';
      cinemaAudioRef.current = audio;
      const src = ctx.createMediaElementSource(audio);
      src.connect(gain);
      gain.connect(ctx.destination);
      audio.play().catch(() => {});
      setAudioPlaying(true);
      audio.onended = () => setAudioPlaying(false);
    } catch (e) {
      // fallback: plain audio
      const audio = new Audio(url);
      cinemaAudioRef.current = audio;
      audio.volume = 1;
      audio.play().catch(() => {});
      setAudioPlaying(true);
      audio.onended = () => setAudioPlaying(false);
    }
  };

  const stopCinema = () => {
    setCinemaPlaying(false);
    window.speechSynthesis?.cancel?.();
    if (cinemaAudioRef.current) { cinemaAudioRef.current.pause(); cinemaAudioRef.current = null; }
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
  };

  // Auto-advance cinema slideshow
  useEffect(() => {
    if (!cinemaPlaying || !videoScript?.scenes?.length) return;
    const scenes = videoScript.scenes;
    setCinemaKey(k => k + 1);

    // If we're at scene 0 and have boosted TTS audio, start it
    if (cinemaScene === 0 && scriptTtsAudioUrl) {
      playBoostedAudio(scriptTtsAudioUrl);
    }

    // Per-scene speech if no full TTS audio
    if (!scriptTtsAudioUrl && 'speechSynthesis' in window) {
      const text = scenes[cinemaScene]?.narration || scenes[cinemaScene]?.visual || '';
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = 'ar-EG';
      utt.rate = 0.75;
      utt.pitch = 1.05;
      utt.volume = 1;
      const voices = window.speechSynthesis.getVoices();
      const arVoice = voices.find(v => v.lang.startsWith('ar')) || voices[0];
      if (arVoice) utt.voice = arVoice;
      utt.onstart = () => setAudioPlaying(true);
      utt.onend = () => setAudioPlaying(false);
      window.speechSynthesis.speak(utt);
    }

    const sceneDuration = scriptTtsAudioUrl
      ? Math.max(5000, ((cinemaAudioRef.current?.duration || 20) / scenes.length) * 1000)
      : 6500;

    const timer = setTimeout(() => {
      const next = cinemaScene + 1;
      if (next >= scenes.length) {
        stopCinema();
        setCinemaScene(0);
      } else {
        setCinemaScene(next);
      }
    }, sceneDuration);
    return () => { clearTimeout(timer); };
  }, [cinemaPlaying, cinemaScene, videoScript]);

  // AI usage info
  const { data: aiUsage } = useQuery<any>({
    queryKey: ['/api/ai/usage'],
    enabled: aiMode,
  });

  const { data: platformSettings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
    queryFn: () => fetch("/api/settings").then(r => r.json()),
    staleTime: 60 * 1000,
  });
  const aiEnabled = platformSettings?.["feature_ai"] !== "0";

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "", description: "", mediaUrl: "", mediaType: "image",
      language: language as 'ar' | 'en', status: "active",
      userId: "", productName: "", targetAudience: "", adTitle: "", customPrompt: "", targetRegion: "",
      appStoreUrl: "", googlePlayUrl: "", appGalleryUrl: "",
      paymentLink: "", whatsappNumber: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const { productName, targetAudience, adTitle, customPrompt, ...adData } = values;
      const expiresAt = adDuration > 0
        ? new Date(Date.now() + adDuration * 24 * 60 * 60 * 1000)
        : null;
      const newAd = await createAd({
        ...adData,
        userId: "temp",
        targetRegion: targetRegions.join(",") || adData.targetRegion || "",
        targetInterests: targetInterests.join(",") || "",
        targetAges: targetAges.join(",") || "",
        expiresAt,
        ...(locationTarget ? {
          targetLat: locationTarget.lat,
          targetLng: locationTarget.lng,
          targetRadiusKm: locationTarget.radiusKm,
        } : {}),
      });
      toast({ title: "🎉 تم نشر الإعلان بنجاح!", className: "bg-green-500 text-white border-none" });
      qc.invalidateQueries({ queryKey: ["/api/ads"] });
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
    const { productName, targetAudience, adTitle, customPrompt, language: lang } = form.getValues();
    if (!productName) { toast({ variant: "destructive", title: "أدخل اسم المنتج أولاً" }); return; }
    setGeneratingCopy(true);
    try {
      const res = await fetch("/api/ai/generate-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName, targetAudience, adTitle, customPrompt, language: lang }),
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
    const { description, productName, adTitle, title, customPrompt } = form.getValues();
    const basePrompt = `Professional Arabic advertisement image for ${adTitle || productName || title || description}. High quality, vibrant colors, suitable for Egyptian market.`;
    const prompt = customPrompt ? `${basePrompt} Additional context: ${customPrompt}` : basePrompt;
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
    const { productName, adTitle, customPrompt } = form.getValues();
    if (!productName) { toast({ variant: "destructive", title: "أدخل اسم المنتج أولاً" }); return; }
    setGeneratingScript(true);
    try {
      const res = await fetch("/api/ai/generate-video-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName, adTitle, customPrompt, duration: 30, language: form.getValues("language") }),
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

  const handleTextToSpeech = async () => {
    const textToSpeak = ttsText || form.getValues("description") || form.getValues("title");
    if (!textToSpeak.trim()) { toast({ variant: "destructive", title: "اكتب النص أولاً أو ولّد محتوى الإعلان" }); return; }
    setTtsText(textToSpeak);
    setGeneratingTTS(true);
    try {
      const res = await fetch("/api/ai/text-to-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToSpeak, voice: ttsVoice, speed: ttsSpeed }),
        credentials: "include"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setTtsAudioUrl(data.audioUrl);
      toast({ title: "🎙️ تم توليد الصوت الطبيعي!" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "فشل توليد الصوت", description: e.message });
    } finally { setGeneratingTTS(false); }
  };

  const handleTalkingPhoto = async () => {
    const imageUrl = aiImageUrl || form.getValues("mediaUrl");
    if (!imageUrl) { toast({ variant: "destructive", title: "ارفع صورة أو ولّد صورة أولاً" }); return; }
    if (!talkingPhotoText.trim()) { toast({ variant: "destructive", title: "اكتب النص الذي سيقوله الشخص" }); return; }
    setGeneratingTalkingPhoto(true);
    try {
      const res = await fetch("/api/ai/talking-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, text: talkingPhotoText, voiceId: talkingPhotoVoice }),
        credentials: "include"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setTalkingPhotoVideoUrl(data.videoUrl);
      form.setValue("mediaUrl", data.videoUrl);
      form.setValue("mediaType", "video");
      toast({ title: "🎭 تم توليد الصورة الناطقة!" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "فشل التوليد", description: e.message });
    } finally { setGeneratingTalkingPhoto(false); }
  };

  const speakScene = (scene: any, idx: number) => {
    setSpeakingScene(idx);
    const text = `${scene.narration || scene.visual}`;
    speakEgyptian(text);
    setTimeout(() => setSpeakingScene(null), 3000);
  };

  // Upload reference images for AI analysis
  const handleUploadRefImages = async (files: FileList) => {
    setUploadingRefImg(true);
    const urls: string[] = [];
    for (let i = 0; i < Math.min(files.length, 5); i++) {
      const fd = new FormData();
      fd.append("file", files[i]);
      const r = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
      const d = await r.json();
      if (d.url) urls.push(d.url);
    }
    setRefImages(prev => [...prev, ...urls].slice(0, 5));
    setUploadingRefImg(false);
    toast({ title: `✅ تم رفع ${urls.length} صورة` });
  };

  // Analyze ref images and generate ad copy
  const handleAnalyzeImages = async () => {
    if (!refImages.length) { toast({ variant: "destructive", title: "ارفع صورة أولاً" }); return; }
    setAnalyzingImage(true);
    try {
      const { productName, targetAudience, language: lang } = form.getValues();
      const res = await fetch("/api/ai/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrls: refImages, productName, targetAudience, language: lang }),
        credentials: "include"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "فشل التحليل");
      if (data.title) form.setValue("title", data.title);
      if (data.description) form.setValue("description", data.description);
      toast({ title: "🔍 تم تحليل الصورة وإنشاء الإعلان!" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "فشل التحليل", description: e.message });
    } finally { setAnalyzingImage(false); }
  };

  // Translate generated text
  const handleTranslate = async () => {
    const title = form.getValues("title");
    const description = form.getValues("description");
    if (!title && !description) { toast({ variant: "destructive", title: "لا يوجد نص للترجمة" }); return; }
    setTranslating(true);
    try {
      const lang = form.getValues("language");
      const targetLang = lang === "ar" ? "en" : "ar";
      const res = await fetch("/api/ai/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, targetLanguage: targetLang }),
        credentials: "include"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "فشل الترجمة");
      if (data.title) form.setValue("title", data.title);
      if (data.description) form.setValue("description", data.description);
      form.setValue("language", targetLang as any);
      toast({ title: `🌐 تم الترجمة إلى ${targetLang === "ar" ? "العربية" : "الإنجليزية"}!` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "فشل الترجمة", description: e.message });
    } finally { setTranslating(false); }
  };

  // Edit image with AI
  const handleEditImage = async () => {
    if (!refImages.length && !aiImageUrl) { toast({ variant: "destructive", title: "لا توجد صورة للتعديل" }); return; }
    if (!editImagePrompt.trim()) { toast({ variant: "destructive", title: "اكتب وصف التعديل أولاً" }); return; }
    setEditingImage(true);
    try {
      const baseImage = aiImageUrl || refImages[0];
      const { productName, adTitle } = form.getValues();
      const prompt = `Edit this advertisement image: ${editImagePrompt}. Context: ${adTitle || productName || "Arabic ad"}. Keep it professional and high quality.`;
      const res = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, size: "1024x1024", referenceUrl: baseImage }),
        credentials: "include"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "فشل التعديل");
      setAiImageUrl(data.url);
      form.setValue("mediaUrl", data.url);
      form.setValue("mediaType", "image");
      setEditImagePrompt("");
      toast({ title: "✏️ تم تعديل الصورة!" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "فشل التعديل", description: e.message });
    } finally { setEditingImage(false); }
  };

  // Download generated text as file
  const handleDownloadText = () => {
    const title = form.getValues("title");
    const description = form.getValues("description");
    if (!title && !description) { toast({ variant: "destructive", title: "لا يوجد نص للتحميل" }); return; }
    const content = `العنوان:\n${title}\n\nالوصف:\n${description}${videoScript ? `\n\nالسكريبت:\n${videoScript.scenes?.map((s: any, i: number) => `مشهد ${i+1}: ${s.narration}`).join('\n')}` : ''}`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `إعلان-${title?.substring(0,20) || 'جديد'}.txt`;
    a.click(); URL.revokeObjectURL(url);
    toast({ title: "📄 تم تحميل الملف!" });
  };

  return (
    <div className="container max-w-3xl px-4 py-12">
    {/* ===== FULLSCREEN CINEMATIC OVERLAY ===== */}
    <AnimatePresence>
    {cinemaPlaying && videoScript?.scenes && (() => {
      const scene = videoScript.scenes[cinemaScene];
      const bgImg = aiImageUrl || adImageUrls[0] || '';
      const kbClass = kenBurnsVariants[cinemaScene % kenBurnsVariants.length];
      return (
        <motion.div
          key="cinema-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[9999] bg-black flex flex-col overflow-hidden"
          dir="rtl"
        >
          {/* ── Background image with Ken Burns ── */}
          {bgImg && (
            <div className="absolute inset-0 overflow-hidden">
              <img
                key={`kb-${cinemaScene}`}
                src={bgImg}
                alt=""
                className={`absolute inset-0 w-full h-full object-cover cinema-kb ${kbClass}`}
              />
              {/* Cinematic gradient overlays */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/20" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent" />
            </div>
          )}
          {!bgImg && (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-black to-gray-900" />
          )}

          {/* ── Letterbox bars ── */}
          <div className="absolute top-0 left-0 right-0 h-[7vh] bg-black z-10" />
          <div className="absolute bottom-0 left-0 right-0 h-[7vh] bg-black z-10" />

          {/* ── Floating particles ── */}
          <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full bg-white/20 cinema-particle"
                style={{
                  width: `${2 + (i % 3)}px`,
                  height: `${2 + (i % 3)}px`,
                  left: `${(i * 8.3) % 100}%`,
                  animationDelay: `${i * 0.4}s`,
                  animationDuration: `${4 + (i % 4)}s`,
                }}
              />
            ))}
          </div>

          {/* ── Top HUD bar ── */}
          <div className="relative z-20 flex items-center justify-between px-5 py-3 mt-[7vh] bg-gradient-to-b from-black/80 to-transparent">
            <div className="flex items-center gap-2">
              <Film className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-white font-bold text-sm tracking-wide line-clamp-1 max-w-[180px]">{videoScript.title}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-white/50 text-xs bg-white/10 rounded-full px-3 py-0.5">
                {cinemaScene + 1} / {videoScript.scenes.length}
              </span>
              <button
                onClick={stopCinema}
                className="text-white/70 hover:text-white text-xs border border-white/20 rounded-full px-3 py-1 hover:bg-red-500/30 hover:border-red-400/50 transition-all"
              >
                ⏹ إيقاف
              </button>
            </div>
          </div>

          {/* ── Main scene content ── */}
          <div className="relative z-20 flex-1 flex flex-col items-center justify-end pb-8 px-6 text-center">
            {/* Time/mood badge */}
            <motion.div
              key={`badge-${cinemaScene}`}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="mb-4"
            >
              <span className="bg-primary/30 text-primary border border-primary/50 backdrop-blur-sm rounded-full px-4 py-1 text-xs font-semibold tracking-widest uppercase">
                ⏱ {scene?.time}{scene?.mood ? ` · ${scene.mood}` : ''}
              </span>
            </motion.div>

            {/* Narration — animated per scene */}
            <motion.p
              key={`narration-${cinemaScene}-${cinemaKey}`}
              initial={{ opacity: 0, y: 40, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -20, filter: 'blur(4px)' }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="text-white text-2xl md:text-4xl font-extrabold leading-relaxed mb-4 max-w-3xl drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]"
              style={{ textShadow: '0 2px 20px rgba(0,0,0,0.8), 0 0 40px rgba(0,0,0,0.5)' }}
            >
              {scene?.narration}
            </motion.p>

            {/* Visual description */}
            <motion.p
              key={`visual-${cinemaScene}-${cinemaKey}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="text-white/55 text-sm md:text-base max-w-2xl leading-relaxed mb-5 drop-shadow-lg"
            >
              🎥 {scene?.visual}
            </motion.p>

            {/* Audio visualizer */}
            <div className="flex items-end justify-center gap-[3px] h-7 mb-2">
              {[...Array(16)].map((_, i) => (
                <div
                  key={i}
                  className="w-[3px] bg-primary rounded-full cinema-bar"
                  style={{
                    animationDelay: `${i * 0.07}s`,
                    animationPlayState: audioPlaying ? 'running' : 'paused',
                    height: audioPlaying ? undefined : '3px',
                    opacity: audioPlaying ? 1 : 0.3,
                  }}
                />
              ))}
              <span className="text-white/40 text-[10px] mr-2 self-center">
                {audioPlaying ? '🔊' : '🔇'}
              </span>
            </div>
          </div>

          {/* ── Progress bar ── */}
          <div className="relative z-20 h-[3px] bg-white/10 mb-[7vh]">
            <motion.div
              key={`progress-${cinemaScene}`}
              className="h-full bg-primary"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 6.5, ease: 'linear' }}
            />
          </div>

          {/* ── Scene dots ── */}
          <div className="absolute bottom-[7vh] left-0 right-0 z-20 flex items-center justify-center gap-2 py-2">
            {videoScript.scenes.map((_: any, i: number) => (
              <button
                key={i}
                onClick={() => { window.speechSynthesis?.cancel?.(); setCinemaScene(i); }}
                className={`rounded-full transition-all duration-300 ${i === cinemaScene ? 'w-6 h-2 bg-primary shadow-[0_0_8px_theme(colors.primary)]' : 'w-2 h-2 bg-white/25 hover:bg-white/50'}`}
              />
            ))}
          </div>
        </motion.div>
      );
    })()}
    </AnimatePresence>

    <style>{`
      /* Ken Burns variants */
      @keyframes kb0 { from { transform: scale(1.0) translate(0,0); } to { transform: scale(1.18) translate(-2%, -1%); } }
      @keyframes kb1 { from { transform: scale(1.1) translate(2%, 1%); } to { transform: scale(1.22) translate(-3%, -2%); } }
      @keyframes kb2 { from { transform: scale(1.05) translate(-3%, 2%); } to { transform: scale(1.2) translate(2%, -1%); } }
      @keyframes kb3 { from { transform: scale(1.18) translate(1%, -2%); } to { transform: scale(1.0) translate(-1%, 2%); } }
      .cinema-kb { animation-timing-function: ease-in-out; animation-fill-mode: both; animation-duration: 7s; }
      .kenBurns0 { animation-name: kb0; }
      .kenBurns1 { animation-name: kb1; }
      .kenBurns2 { animation-name: kb2; }
      .kenBurns3 { animation-name: kb3; }

      /* Floating particles */
      @keyframes floatUp { 0% { transform: translateY(100vh) scale(0); opacity: 0; } 10% { opacity: 0.6; } 90% { opacity: 0.2; } 100% { transform: translateY(-10vh) scale(1.5); opacity: 0; } }
      .cinema-particle { animation: floatUp linear infinite; }

      /* Audio bars */
      @keyframes audioBar { 0%, 100% { height: 3px; } 50% { height: 22px; } }
      .cinema-bar { animation: audioBar 0.5s ease-in-out infinite; }
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
                    <FormField control={form.control} name="adTitle" render={({ field }) => (
                      <FormItem>
                        <FormLabel>عنوان الإعلان <span className="text-xs text-muted-foreground">(اختياري — يساعد الذكاء الاصطناعي)</span></FormLabel>
                        <FormControl><Input placeholder="مثال: الهاتف الأقوى لعام 2025" {...field} data-testid="input-ad-title-ai" /></FormControl>
                      </FormItem>
                    )} />
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
                    <FormField control={form.control} name="customPrompt" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                          برومبت مخصص <span className="text-xs text-muted-foreground font-normal">(اختياري — تفاصيل إضافية للذكاء الاصطناعي)</span>
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="مثال: المنتج مصري الصنع 100٪، السعر 299 جنيه فقط، متوفر بجميع المحافظات، نقدم ضمان سنة كاملة. أسلوب الإعلان يكون حماسي وموجّه للشباب المصري."
                            className="resize-none min-h-[80px] text-sm"
                            {...field}
                            data-testid="input-custom-prompt"
                          />
                        </FormControl>
                        <p className="text-[10px] text-muted-foreground">
                          أضف هنا أي تفاصيل عن منتجك أو خدمتك أو الأسلوب الذي تريده — الذكاء الاصطناعي سيأخذها بعين الاعتبار عند توليد الإعلان.
                        </p>
                      </FormItem>
                    )} />
                    {/* Reference images upload */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Camera className="w-3 h-3" /> صور مرجعية للذكاء الاصطناعي (حتى 5 صور)
                      </p>
                      <div className="flex flex-wrap gap-2 items-center">
                        {refImages.map((url, i) => (
                          <div key={i} className="relative group">
                            <img src={url} alt="" className="w-16 h-16 rounded-lg object-cover border border-border" />
                            <button
                              type="button"
                              onClick={() => setRefImages(prev => prev.filter((_, j) => j !== i))}
                              className="absolute -top-1 -right-1 bg-destructive text-white rounded-full w-4 h-4 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                            >×</button>
                          </div>
                        ))}
                        {refImages.length < 5 && (
                          <button
                            type="button"
                            onClick={() => refImgInputRef.current?.click()}
                            disabled={uploadingRefImg}
                            className="w-16 h-16 rounded-lg border-2 border-dashed border-primary/40 flex flex-col items-center justify-center gap-1 text-primary/60 hover:text-primary hover:border-primary transition-colors text-xs"
                          >
                            {uploadingRefImg ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Upload className="w-4 h-4" /><span>رفع</span></>}
                          </button>
                        )}
                        <input
                          ref={refImgInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={e => e.target.files && handleUploadRefImages(e.target.files)}
                        />
                        {refImages.length > 0 && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleAnalyzeImages}
                            disabled={analyzingImage}
                            className="gap-1 h-8 text-xs bg-violet-600 hover:bg-violet-700 text-white"
                            data-testid="btn-analyze-image"
                          >
                            {analyzingImage ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                            تحليل وإنشاء إعلان
                          </Button>
                        )}
                      </div>
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
                      <Button type="button" onClick={() => setTalkingPhotoText(t => t || form.getValues("description") || "")} size="sm" variant="outline" className="gap-2 border-purple-400 text-purple-600 hover:bg-purple-50" data-testid="btn-talking-photo-open">
                        <Camera className="w-4 h-4" />
                        صورة ناطقة 🎭
                      </Button>
                      <Button type="button" onClick={() => { setShowTTS(true); setTtsText(form.getValues("description") || form.getValues("title") || ""); }} size="sm" variant="outline" className="gap-2 border-green-400 text-green-700 hover:bg-green-50" data-testid="btn-tts-open">
                        <Volume2 className="w-4 h-4" />
                        صوت طبيعي 🎙️
                      </Button>
                      <Button type="button" onClick={handleTranslate} disabled={translating} size="sm" variant="outline" className="gap-2" data-testid="btn-translate">
                        {translating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
                        ترجمة النص
                      </Button>
                      <Button type="button" onClick={handleDownloadText} size="sm" variant="outline" className="gap-2" data-testid="btn-download-text">
                        <Download className="w-4 h-4" />
                        تحميل كملف
                      </Button>
                    </div>

                    {/* TTS - Natural Voice Section */}
                    {showTTS && (
                      <div className="border-2 border-green-300 rounded-xl p-4 bg-green-50 dark:bg-green-950/20 space-y-3">
                        <div className="flex items-center gap-2">
                          <Volume2 className="w-4 h-4 text-green-600" />
                          <p className="text-sm font-bold text-green-700">🎙️ توليد صوت طبيعي</p>
                          <Button type="button" size="sm" variant="ghost" className="mr-auto h-6 w-6 p-0" onClick={() => { setShowTTS(false); setTtsAudioUrl(""); }}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs font-medium text-green-700">النص الذي سيُقرأ بصوت طبيعي:</p>
                          <Textarea
                            value={ttsText}
                            onChange={e => setTtsText(e.target.value)}
                            placeholder="اكتب نص الإعلان هنا أو اضغط الزر وسيأخذ وصف الإعلان تلقائياً..."
                            className="text-sm min-h-[80px] border-green-300 focus:border-green-500"
                            data-testid="textarea-tts-text"
                          />
                          <p className="text-xs text-muted-foreground">{ttsText.length} / 4096 حرف</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-green-700">الصوت:</p>
                            <Select value={ttsVoice} onValueChange={setTtsVoice}>
                              <SelectTrigger className="h-8 text-xs border-green-300" data-testid="select-tts-voice">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="nova">🎙️ Nova — نسائي ناعم</SelectItem>
                                <SelectItem value="alloy">🎙️ Alloy — محايد</SelectItem>
                                <SelectItem value="echo">🎙️ Echo — رجالي</SelectItem>
                                <SelectItem value="fable">🎙️ Fable — دافئ</SelectItem>
                                <SelectItem value="onyx">🎙️ Onyx — رجالي عميق</SelectItem>
                                <SelectItem value="shimmer">🎙️ Shimmer — نسائي حيوي</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-green-700">السرعة: {ttsSpeed}x</p>
                            <input
                              type="range" min="0.5" max="2.0" step="0.1"
                              value={ttsSpeed}
                              onChange={e => setTtsSpeed(parseFloat(e.target.value))}
                              className="w-full h-2 accent-green-600"
                              data-testid="range-tts-speed"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>بطيء</span><span>عادي</span><span>سريع</span>
                            </div>
                          </div>
                        </div>

                        <Button
                          type="button"
                          onClick={handleTextToSpeech}
                          disabled={generatingTTS || !ttsText.trim()}
                          className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
                          data-testid="btn-gen-tts"
                        >
                          {generatingTTS ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> جاري توليد الصوت...</>
                          ) : (
                            <><Volume2 className="w-4 h-4" /> ولّد الصوت الطبيعي</>
                          )}
                        </Button>

                        {ttsAudioUrl && (
                          <div className="space-y-2 p-3 bg-white dark:bg-black/20 rounded-lg border border-green-200">
                            <p className="text-xs font-bold text-green-600">✅ تم توليد الصوت!</p>
                            <audio controls src={ttsAudioUrl} className="w-full" data-testid="audio-tts-result" />
                            <a
                              href={ttsAudioUrl}
                              download
                              className="flex items-center justify-center gap-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded-lg py-2 border border-green-300"
                            >
                              <Download className="w-3 h-3" /> تحميل ملف الصوت MP3
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Talking Photo Section */}
                    {(talkingPhotoText !== "" || talkingPhotoVideoUrl) && (
                      <div className="border-2 border-purple-300 rounded-xl p-4 bg-purple-50 dark:bg-purple-950/20 space-y-3">
                        <div className="flex items-center gap-2">
                          <Camera className="w-4 h-4 text-purple-600" />
                          <p className="text-sm font-bold text-purple-700">🎭 صورة ناطقة — الشخص يتكلم</p>
                          <Button type="button" size="sm" variant="ghost" className="mr-auto h-6 w-6 p-0" onClick={() => { setTalkingPhotoText(""); setTalkingPhotoVideoUrl(""); }}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>

                        {!(aiImageUrl || form.getValues("mediaUrl")) && (
                          <p className="text-xs text-orange-600 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> ولّد صورة أو ارفع صورة شخص أولاً ثم استخدم هذه الأداة
                          </p>
                        )}

                        {(aiImageUrl || form.getValues("mediaUrl")) && (
                          <div className="flex items-center gap-2 p-2 bg-white dark:bg-black/20 rounded-lg border border-purple-200">
                            <img
                              src={aiImageUrl || form.getValues("mediaUrl")}
                              alt="صورة الشخص"
                              className="w-12 h-12 rounded-lg object-cover"
                            />
                            <p className="text-xs text-muted-foreground">هذه الصورة ستتكلم ✅</p>
                          </div>
                        )}

                        <div className="space-y-2">
                          <p className="text-xs font-medium text-purple-700">النص الذي سيقوله الشخص:</p>
                          <Textarea
                            value={talkingPhotoText}
                            onChange={e => setTalkingPhotoText(e.target.value)}
                            placeholder="اكتب هنا ما تريد الشخص أن يقوله... مثال: أهلاً بكم في متجرنا! نقدم أفضل المنتجات بأسعار لا تُقاوم"
                            className="text-sm min-h-[80px] border-purple-300 focus:border-purple-500"
                            data-testid="textarea-talking-photo-text"
                          />
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs font-medium text-purple-700">الصوت:</p>
                          <Select value={talkingPhotoVoice} onValueChange={setTalkingPhotoVoice}>
                            <SelectTrigger className="h-8 text-xs border-purple-300" data-testid="select-talking-voice">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ar-EG-SalmaNeural">🎙️ سلمى — صوت نسائي مصري</SelectItem>
                              <SelectItem value="ar-EG-ShakirNeural">🎙️ شاكر — صوت رجالي مصري</SelectItem>
                              <SelectItem value="ar-SA-ZariyahNeural">🎙️ زارية — صوت نسائي خليجي</SelectItem>
                              <SelectItem value="ar-SA-HamedNeural">🎙️ حامد — صوت رجالي خليجي</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <Button
                          type="button"
                          onClick={handleTalkingPhoto}
                          disabled={generatingTalkingPhoto || !talkingPhotoText.trim()}
                          className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white"
                          data-testid="btn-gen-talking-photo"
                        >
                          {generatingTalkingPhoto ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> جاري توليد الفيديو... (30-60 ثانية)</>
                          ) : (
                            <><Camera className="w-4 h-4" /> ولّد الصورة الناطقة</>
                          )}
                        </Button>

                        {talkingPhotoVideoUrl && (
                          <div className="space-y-2">
                            <p className="text-xs font-bold text-green-600">✅ تم توليد الفيديو!</p>
                            <video
                              src={talkingPhotoVideoUrl}
                              controls
                              className="w-full rounded-xl border-2 border-purple-300 max-h-64"
                              data-testid="video-talking-photo-result"
                            />
                            <div className="flex gap-2">
                              <a
                                href={talkingPhotoVideoUrl}
                                download
                                className="flex-1 flex items-center justify-center gap-1 text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg py-2 border border-purple-300"
                              >
                                <Download className="w-3 h-3" /> تحميل الفيديو
                              </a>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="flex-1 text-xs border-purple-300 text-purple-600"
                                onClick={() => { form.setValue("mediaUrl", talkingPhotoVideoUrl); form.setValue("mediaType", "video"); toast({ title: "✅ تم تعيين الفيديو للإعلان" }); }}
                                data-testid="btn-use-talking-video"
                              >
                                استخدام في الإعلان
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* AI Image Edit section */}
                    {(aiImageUrl || refImages.length > 0) && (
                      <div className="border rounded-xl p-3 bg-background/60 space-y-2">
                        <p className="text-xs font-medium flex items-center gap-1">
                          <Wand2 className="w-3 h-3 text-primary" /> تعديل الصورة بالذكاء الاصطناعي
                        </p>
                        <div className="flex gap-2">
                          <Input
                            placeholder="مثال: غير الخلفية إلى اللون الأزرق واجعل النص أكبر..."
                            value={editImagePrompt}
                            onChange={e => setEditImagePrompt(e.target.value)}
                            className="text-sm h-8"
                            data-testid="input-edit-image-prompt"
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleEditImage}
                            disabled={editingImage}
                            className="h-8 gap-1 text-xs whitespace-nowrap"
                            data-testid="btn-edit-image"
                          >
                            {editingImage ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                            عدّل
                          </Button>
                        </div>
                        {aiImageUrl && (
                          <div className="flex items-center gap-2">
                            <img src={aiImageUrl} alt="AI" className="w-20 h-20 rounded-lg object-cover border" />
                            <div className="text-xs text-muted-foreground space-y-1">
                              <p>الصورة الحالية</p>
                              <a href={aiImageUrl} download className="flex items-center gap-1 text-primary hover:underline">
                                <Download className="w-3 h-3" /> تحميل الصورة
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

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

                          {/* ── زرار تحويل نص السكريبت → صوت AI → فيديو ── */}
                          <div className="border-t pt-3 space-y-2">
                            <p className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                              <span className="text-purple-500">✨</span> تحويل نص السكريبت لصوت احترافي
                            </p>

                            {/* Voice gender selector */}
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setTtsVoice("nova")}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${ttsVoice === "nova" ? "bg-pink-500 text-white border-pink-500" : "bg-white dark:bg-gray-800 border-gray-200 text-gray-600"}`}
                              >👩 صوت أنثى</button>
                              <button
                                type="button"
                                onClick={() => setTtsVoice("onyx")}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${ttsVoice === "onyx" ? "bg-blue-600 text-white border-blue-600" : "bg-white dark:bg-gray-800 border-gray-200 text-gray-600"}`}
                              >👨 صوت ذكر</button>
                            </div>

                            {/* Generate script audio button */}
                            <button
                              type="button"
                              disabled={generatingScriptAudio}
                              onClick={async () => {
                                // جمع كل نصوص المشاهد والتعليق الصوتي
                                const parts: string[] = [];
                                if (videoScript.voiceover) parts.push(videoScript.voiceover);
                                if (videoScript.scenes) {
                                  videoScript.scenes.forEach((sc: any) => {
                                    if (sc.narration) parts.push(sc.narration);
                                  });
                                }
                                if (videoScript.callToAction) {
                                  const cta = typeof videoScript.callToAction === 'string'
                                    ? videoScript.callToAction
                                    : videoScript.callToAction?.text || videoScript.callToAction?.description || '';
                                  if (cta) parts.push(cta);
                                }
                                const fullText = parts.join(". ");
                                if (!fullText.trim()) {
                                  toast({ variant: "destructive", title: "لا يوجد نص في السكريبت" });
                                  return;
                                }
                                setGeneratingScriptAudio(true);
                                try {
                                  const res = await fetch("/api/ai/tts", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    credentials: "include",
                                    body: JSON.stringify({ text: fullText, voice: ttsVoice }),
                                  });
                                  if (!res.ok) throw new Error((await res.json()).message);
                                  const data = await res.json();
                                  setScriptTtsAudioUrl(data.url);
                                  toast({ title: "🎙 تم توليد الصوت من نص السكريبت!" });
                                } catch (e: any) {
                                  toast({ variant: "destructive", title: "فشل توليد الصوت", description: e.message });
                                } finally { setGeneratingScriptAudio(false); }
                              }}
                              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 text-white text-xs font-bold hover:from-purple-600 hover:to-violet-700 disabled:opacity-60 transition-all"
                              data-testid="btn-script-to-audio"
                            >
                              {generatingScriptAudio
                                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> جارٍ توليد الصوت من النص...</>
                                : <><Volume2 className="w-3.5 h-3.5" /> حوّل نص السكريبت لصوت AI</>
                              }
                            </button>

                            {/* Audio preview + use in video */}
                            {scriptTtsAudioUrl && (
                              <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl p-3 space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-purple-600 text-xs font-bold flex-1">🎵 الصوت جاهز — استمع أو استخدمه في الفيديو</span>
                                  <button
                                    type="button"
                                    onClick={() => setScriptTtsAudioUrl("")}
                                    className="w-5 h-5 rounded-full bg-purple-200 dark:bg-purple-800 flex items-center justify-center hover:bg-red-200"
                                  ><X className="w-3 h-3 text-purple-600" /></button>
                                </div>
                                <audio controls src={scriptTtsAudioUrl} className="w-full h-8" style={{ height: 32 }} />
                                <button
                                  type="button"
                                  disabled={adImageUrls.length === 0 || convertingAdToVideo}
                                  onClick={async () => {
                                    if (adImageUrls.length === 0) {
                                      toast({ title: "⚠ ارفع صوراً أولاً من قسم الصور" });
                                      return;
                                    }
                                    setConvertingAdToVideo(true);
                                    try {
                                      setConvertProgress("🎬 جارٍ إنتاج الفيديو السينمائي بصوت السكريبت...");
                                      const r = await fetch('/api/ai/images-to-video', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        credentials: 'include',
                                        body: JSON.stringify({
                                          imageUrls: adImageUrls,
                                          audioUrl: scriptTtsAudioUrl,
                                          duration: imageDuration,
                                          quality: videoQuality,
                                          format: videoFormat,
                                        }),
                                      });
                                      const d = await r.json();
                                      if (!r.ok) throw new Error(d.message);
                                      form.setValue("mediaUrl", d.url);
                                      form.setValue("mediaType", "video");
                                      setAdImageUrls([]);
                                      setConvertProgress("");
                                      toast({ title: `🎬 تم إنتاج الفيديو بصوت السكريبت! (${d.resolution || ""})`, className: "bg-purple-500 text-white border-none" });
                                    } catch (e: any) {
                                      setConvertProgress("");
                                      toast({ variant: "destructive", title: "فشل إنتاج الفيديو", description: e.message });
                                    } finally { setConvertingAdToVideo(false); }
                                  }}
                                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-purple-500 text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-all"
                                  data-testid="btn-script-audio-to-video"
                                >
                                  {convertingAdToVideo
                                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {convertProgress || "جارٍ الإنتاج..."}</>
                                    : adImageUrls.length > 0
                                      ? <><Film className="w-3.5 h-3.5" /> أنتج الفيديو بهذا الصوت ({adImageUrls.length} صورة)</>
                                      : <><ImageIcon className="w-3.5 h-3.5" /> ارفع صوراً من الأسفل ثم اضغط هنا</>
                                  }
                                </button>
                              </div>
                            )}
                          </div>
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
                    <Input type="number" placeholder="مثال: 500" {...field} value={field.value ?? ""} data-testid="input-price" />
                  </FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="whatsappNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>رقم الواتساب</FormLabel>
                  <FormControl>
                    <Input placeholder="01xxxxxxxxx" {...field} value={field.value ?? ""} dir="ltr" data-testid="input-whatsapp" />
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
              <div className="flex items-center gap-2 mt-2">
                <Button type="button" variant="outline" size="sm" className="gap-1.5 h-9" onClick={() => setMediaLibraryOpen(true)} data-testid="btn-open-media-library">
                  <FolderOpen className="w-4 h-4 text-primary" /> اختر من المكتبة
                </Button>
                {field.value && <Button type="button" variant="ghost" size="sm" className="h-9 text-xs text-red-500 hover:text-red-600" onClick={() => field.onChange("")}>✕ إزالة</Button>}
              </div>
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

              {/* ─── صور → فيديو سينمائي HD ─── */}
              <div className="mt-3 rounded-2xl border border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/20 p-4 space-y-4">
                {/* Header */}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center">
                    <Film className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-orange-800 dark:text-orange-200">تحويل الصور لفيديو سينمائي</p>
                    <p className="text-[10px] text-orange-600 dark:text-orange-400">تأثير Ken Burns + تحسين جودة الصورة + صوت AI</p>
                  </div>
                </div>

                {/* Hidden file input */}
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
                      toast({ title: `✅ تم رفع ${uploaded.length} صورة` });
                    } catch { toast({ variant: "destructive", title: "فشل رفع الصور" }); }
                    finally { setUploadingAdImages(false); }
                  }}
                />

                {/* Image grid */}
                {adImageUrls.length > 0 && (
                  <div className="grid grid-cols-4 gap-1.5">
                    {adImageUrls.map((url, i) => (
                      <div key={i} className="relative aspect-square rounded-xl overflow-hidden group shadow-sm">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all" />
                        <div className="absolute top-1 left-1 w-4 h-4 rounded bg-black/60 text-white text-[9px] flex items-center justify-center font-bold">{i + 1}</div>
                        <button
                          onClick={() => setAdImageUrls(prev => prev.filter((_, j) => j !== i))}
                          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                        ><X className="w-3 h-3" /></button>
                      </div>
                    ))}
                    {adImageUrls.length < 15 && (
                      <button
                        onClick={() => fileAdImagesRef.current?.click()}
                        disabled={uploadingAdImages}
                        className="aspect-square rounded-xl border-2 border-dashed border-orange-300 flex items-center justify-center hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all"
                      >
                        {uploadingAdImages ? <Loader2 className="w-4 h-4 animate-spin text-orange-500" /> : <Plus className="w-4 h-4 text-orange-400" />}
                      </button>
                    )}
                  </div>
                )}

                {/* Upload button when empty */}
                {adImageUrls.length === 0 && (
                  <button
                    type="button"
                    onClick={() => fileAdImagesRef.current?.click()}
                    disabled={uploadingAdImages}
                    className="w-full flex flex-col items-center justify-center gap-1.5 py-6 rounded-xl border-2 border-dashed border-orange-300 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all"
                    data-testid="btn-upload-ad-images"
                  >
                    {uploadingAdImages
                      ? <Loader2 className="w-6 h-6 animate-spin" />
                      : <>
                          <ImageIcon className="w-6 h-6" />
                          <span className="text-sm font-bold">ارفع صور متعددة</span>
                          <span className="text-[10px] opacity-70">حتى 15 صورة — JPG, PNG, WEBP</span>
                        </>
                    }
                  </button>
                )}

                {/* Options (shown when at least 1 image) */}
                {adImageUrls.length >= 1 && (
                  <div className="space-y-3 pt-1">
                    {/* Quality + Format */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] font-bold text-orange-700 dark:text-orange-300 mb-1">🎯 جودة الفيديو</p>
                        <div className="flex flex-col gap-1">
                          {([
                            { v: "standard", label: "عادي 720p", icon: "📱" },
                            { v: "hd",       label: "HD 1080p ✨", icon: "🎬" },
                            { v: "cinema",   label: "سينما 4K", icon: "🏆" },
                          ] as const).map(({ v, label, icon }) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setVideoQuality(v)}
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                videoQuality === v
                                  ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700"
                              }`}
                            >
                              <span>{icon}</span> {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-orange-700 dark:text-orange-300 mb-1">📐 اتجاه الفيديو</p>
                        <div className="flex flex-col gap-1">
                          {([
                            { v: "vertical",  label: "عمودي 9:16",  icon: "📱" },
                            { v: "landscape", label: "أفقي 16:9",   icon: "🖥" },
                          ] as const).map(({ v, label, icon }) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setVideoFormat(v)}
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                videoFormat === v
                                  ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700"
                              }`}
                            >
                              <span>{icon}</span> {label}
                            </button>
                          ))}
                        </div>

                        {/* Duration per image */}
                        <div className="mt-2">
                          <p className="text-[10px] font-bold text-orange-700 dark:text-orange-300 mb-1">⏱ مدة كل صورة: {imageDuration}ث</p>
                          <input
                            type="range" min={2} max={8} step={1}
                            value={imageDuration}
                            onChange={e => setImageDuration(Number(e.target.value))}
                            className="w-full accent-orange-500 h-1.5"
                          />
                          <div className="flex justify-between text-[9px] text-orange-400">
                            <span>2ث</span><span>8ث</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Script audio ready banner */}
                    {scriptTtsAudioUrl && (
                      <div className="flex items-center gap-2 bg-purple-50 dark:bg-purple-950/30 border border-purple-300 dark:border-purple-700 rounded-xl px-3 py-2">
                        <span className="text-purple-600 text-lg">🎙</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-purple-700 dark:text-purple-300">صوت السكريبت جاهز!</p>
                          <p className="text-[10px] text-purple-500">سيُضاف تلقائياً للفيديو عند الإنتاج</p>
                        </div>
                        <audio controls src={scriptTtsAudioUrl} className="h-7 w-28 flex-shrink-0" />
                      </div>
                    )}

                    {/* AI Voice option (from ad text) — only show when no script audio */}
                    {!scriptTtsAudioUrl && (
                    <div
                      onClick={() => setUseAiVoiceVideo(!useAiVoiceVideo)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                        useAiVoiceVideo
                          ? "bg-purple-50 dark:bg-purple-950/30 border-purple-300 dark:border-purple-700"
                          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${useAiVoiceVideo ? "bg-purple-500" : "bg-gray-200 dark:bg-gray-700"}`}>
                        <Volume2 className={`w-4 h-4 ${useAiVoiceVideo ? "text-white" : "text-gray-500"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-700 dark:text-gray-200">إضافة صوت AI من نص الإعلان</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">يحوّل عنوان ووصف إعلانك لصوت عربي احترافي</p>
                      </div>
                      <div className={`w-8 h-4 rounded-full transition-all flex-shrink-0 ${useAiVoiceVideo ? "bg-purple-500" : "bg-gray-300"}`}>
                        <div className={`w-4 h-4 rounded-full bg-white shadow transition-all ${useAiVoiceVideo ? "translate-x-4" : "translate-x-0"}`} />
                      </div>
                    </div>
                    )}

                    {/* Summary + Convert button */}
                    <div className="bg-orange-100 dark:bg-orange-900/20 rounded-xl p-2.5 text-[10px] text-orange-700 dark:text-orange-300 flex flex-wrap gap-3">
                      <span>🎞 {adImageUrls.length} صورة</span>
                      <span>⏱ {adImageUrls.length * imageDuration}ث إجمالي</span>
                      <span>📊 {videoQuality === "cinema" ? "سينما" : videoQuality === "hd" ? "1080p HD" : "720p"}</span>
                      {scriptTtsAudioUrl
                        ? <span className="text-purple-600 font-bold">🎙 صوت السكريبت</span>
                        : useAiVoiceVideo
                          ? <span>🎙 صوت نص الإعلان</span>
                          : <span>🔇 بدون صوت</span>
                      }
                    </div>

                    {/* Progress during conversion */}
                    {convertingAdToVideo && convertProgress && (
                      <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
                        <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                        {convertProgress}
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={convertingAdToVideo || uploadingAdImages}
                      onClick={async () => {
                        setConvertingAdToVideo(true);
                        try {
                          let audioUrl: string | undefined;

                          // الأولوية: صوت السكريبت > صوت نص الإعلان > بدون صوت
                          if (scriptTtsAudioUrl) {
                            audioUrl = scriptTtsAudioUrl;
                            setConvertProgress("🎙 جارٍ دمج صوت السكريبت مع الفيديو...");
                          } else if (useAiVoiceVideo) {
                            const title = form.getValues("title");
                            const desc = form.getValues("description");
                            const narration = [title, desc].filter(Boolean).join(". ");
                            if (narration.trim()) {
                              setConvertProgress("🎙 جارٍ توليد الصوت بالذكاء الاصطناعي...");
                              const ttsRes = await fetch("/api/ai/tts", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                credentials: "include",
                                body: JSON.stringify({ text: narration, voice: ttsVoice }),
                              });
                              if (ttsRes.ok) {
                                const ttsData = await ttsRes.json();
                                audioUrl = ttsData.url;
                              }
                            }
                          }

                          // إنتاج الفيديو السينمائي
                          setConvertProgress(`🎬 جارٍ الإنتاج بجودة ${videoQuality === "cinema" ? "سينما" : videoQuality === "hd" ? "HD 1080p" : "720p"}...`);
                          const r = await fetch('/api/ai/images-to-video', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({
                              imageUrls: adImageUrls,
                              audioUrl,
                              duration: imageDuration,
                              quality: videoQuality,
                              format: videoFormat,
                            }),
                          });
                          const d = await r.json();
                          if (!r.ok) throw new Error(d.message);

                          setConvertProgress("✅ تم! جارٍ تحميل الفيديو...");
                          field.onChange(d.url);
                          form.setValue("mediaType", "video");
                          setAdImageUrls([]);
                          setConvertProgress("");
                          const withAudio = audioUrl ? " بصوت AI 🎙" : "";
                          toast({ title: `🎬 تم إنتاج الفيديو ${d.resolution || ""}${withAudio} بنجاح!`, className: "bg-orange-500 text-white border-none" });
                        } catch (e: any) {
                          setConvertProgress("");
                          toast({ variant: "destructive", title: "فشل التحويل", description: e.message });
                        } finally { setConvertingAdToVideo(false); }
                      }}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-bold hover:from-orange-600 hover:to-amber-600 disabled:opacity-60 transition-all shadow-md"
                      data-testid="btn-convert-ad-to-video"
                    >
                      {convertingAdToVideo
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ الإنتاج السينمائي...</>
                        : <><Film className="w-4 h-4" /> إنتاج فيديو احترافي ({adImageUrls.length} صورة)</>
                      }
                    </button>
                  </div>
                )}
              </div>

              {/* ─── TTS for Ad ─── */}
              {(form.watch("title")?.length >= 2) && (
                <div className="mt-3 rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200/50 p-3 space-y-2">
                  <p className="text-xs font-bold text-purple-700 dark:text-purple-300">🎙 تحويل النص لصوت (للريلز والإعلانات)</p>
                  {/* Voice gender selector */}
                  {!tts.audioUrl && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setTtsVoice("nova")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${ttsVoice === "nova" ? "bg-pink-500 text-white border-pink-500" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700"}`}
                        data-testid="btn-voice-female"
                      >
                        👩 صوت أنثى
                      </button>
                      <button
                        type="button"
                        onClick={() => setTtsVoice("onyx")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${ttsVoice === "onyx" ? "bg-blue-600 text-white border-blue-600" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700"}`}
                        data-testid="btn-voice-male"
                      >
                        👨 صوت ذكر
                      </button>
                    </div>
                  )}
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
                        try { await tts.generate(text, ttsVoice, true); }
                        catch { toast({ variant: "destructive", title: "فشل توليد الصوت" }); }
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 disabled:opacity-50"
                      data-testid="btn-ad-tts"
                    >
                      {tts.loading ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري التوليد...</> : <>{ttsVoice === "nova" ? "👩" : "👨"} حوّل النص لصوت عربي مصري</>}
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
                .filter(([k]) => !['title','description','mediaUrl','userId','productName','targetAudience','adTitle'].includes(k))
                .map(([k, v]: any) => <p key={k} className="text-sm text-red-500">• {k}: {String(v?.message)}</p>)
              }
            </div>
          )}

          {/* Ad Duration Selector */}
          <div className="border rounded-2xl p-4 bg-blue-50/40 dark:bg-blue-950/10 space-y-3">
            <h3 className="font-bold text-sm flex items-center gap-2">⏳ مدة الإعلان</h3>
            <p className="text-xs text-muted-foreground">حدد عدد الأيام اللي تريد إعلانك يظهر فيها — أي عدد تختاره</p>

            {/* اختصارات سريعة */}
            <div className="flex flex-wrap gap-1.5">
              {[7, 14, 30, 60, 90, 180, 365].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setAdDuration(d)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${
                    adDuration === d
                      ? "border-primary bg-primary text-white shadow shadow-primary/30"
                      : "border-border bg-white dark:bg-background hover:border-primary/50"
                  }`}
                  data-testid={`duration-${d}`}
                >
                  {d} يوم
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAdDuration(0)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${
                  adDuration === 0
                    ? "border-primary bg-primary text-white shadow shadow-primary/30"
                    : "border-border bg-white dark:bg-background hover:border-primary/50"
                }`}
                data-testid="duration-0"
              >
                ♾️ بلا حد
              </button>
            </div>

            {/* إدخال حر */}
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Input
                  type="number"
                  min={1}
                  max={3650}
                  placeholder="أو اكتب عدد الأيام يدوياً..."
                  value={adDuration > 0 ? adDuration : ""}
                  onChange={e => {
                    const v = parseInt(e.target.value);
                    if (!isNaN(v) && v > 0) setAdDuration(v);
                    else if (e.target.value === "") setAdDuration(0);
                  }}
                  className="h-10 text-sm ps-4"
                  data-testid="input-duration-custom"
                />
              </div>
              <span className="text-xs text-muted-foreground font-bold flex-shrink-0">يوم</span>
            </div>

            <div className="flex items-center gap-2 bg-blue-100/60 dark:bg-blue-900/20 rounded-xl px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
              <span>📅</span>
              {adDuration > 0
                ? `سينتهي إعلانك في: ${new Date(Date.now() + adDuration * 86400000).toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" })} (${adDuration} يوم)`
                : "إعلانك سيظل نشطاً إلى أجل غير مسمى ♾️"}
            </div>
          </div>

          {/* ── قسم الكوبون ── */}
          <div className="border rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => { setAddCoupon(v => !v); setGeneratedCouponCode(""); }}
              className="w-full flex items-center justify-between p-4 bg-orange-50/60 dark:bg-orange-950/10 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-colors"
              data-testid="btn-toggle-coupon"
            >
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-orange-500" />
                <span className="font-bold text-sm">أضف كوبون خصم لإعلانك</span>
                <Badge variant="secondary" className="text-[10px] bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">15 ج.م</Badge>
              </div>
              {addCoupon
                ? <ToggleRight className="w-6 h-6 text-orange-500" />
                : <ToggleLeft className="w-6 h-6 text-muted-foreground" />
              }
            </button>

            {addCoupon && (
              <div className="p-4 space-y-3 border-t bg-background">
                <p className="text-xs text-muted-foreground">سيظهر كود الخصم على بطاقة إعلانك ويتم خصم 15 ج.م من رصيدك</p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold block mb-1">نوع الخصم</label>
                    <Select value={couponDiscountType} onValueChange={setCouponDiscountType}>
                      <SelectTrigger className="h-9 text-xs" data-testid="select-discount-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">نسبة خصم %</SelectItem>
                        <SelectItem value="fixed">خصم بالجنيه ج.م</SelectItem>
                        <SelectItem value="free_shipping">شحن مجاني</SelectItem>
                        <SelectItem value="buy_x_get_y">اشتري X احصل على Y</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {couponDiscountType !== "free_shipping" && couponDiscountType !== "buy_x_get_y" && (
                    <div>
                      <label className="text-xs font-bold block mb-1">
                        {couponDiscountType === "percentage" ? "نسبة الخصم %" : "قيمة الخصم ج.م"}
                      </label>
                      <Input
                        type="number"
                        placeholder={couponDiscountType === "percentage" ? "20" : "50"}
                        value={couponDiscountValue}
                        onChange={e => setCouponDiscountValue(e.target.value)}
                        className="h-9 text-sm"
                        data-testid="input-discount-value"
                      />
                    </div>
                  )}
                </div>

                {generatedCouponCode ? (
                  <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-xl p-3">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-[10px] text-muted-foreground">كود الكوبون</p>
                      <p className="font-mono font-extrabold text-sm text-green-700 dark:text-green-400">{generatedCouponCode}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(generatedCouponCode); toast({ title: "✅ تم نسخ الكود" }); }}
                      className="p-1.5 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5 text-green-600" />
                    </button>
                  </div>
                ) : aiEnabled ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 border-orange-300 text-orange-600 hover:bg-orange-50"
                    disabled={couponGenerating || (!couponDiscountValue && couponDiscountType !== "free_shipping" && couponDiscountType !== "buy_x_get_y")}
                    onClick={async () => {
                      setCouponGenerating(true);
                      try {
                        const title = form.getValues("title") || "منتج";
                        const desc  = form.getValues("description") || "";
                        const res = await fetch("/api/coupons/generate", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify({
                            businessName: title,
                            productDescription: desc || title,
                            discountType: couponDiscountType,
                            discountValue: parseFloat(couponDiscountValue) || 0,
                          }),
                        });
                        if (!res.ok) {
                          const err = await res.json();
                          if (err.message === "insufficient_balance") {
                            toast({ variant: "destructive", title: "رصيد غير كافٍ", description: `تحتاج ${err.required} ج.م في رصيدك` });
                          } else {
                            toast({ variant: "destructive", title: "خطأ", description: err.message });
                          }
                          return;
                        }
                        const data = await res.json();
                        setGeneratedCouponCode(data.code);
                        form.setValue("couponCode" as any, data.code);
                        form.setValue("couponDiscountType" as any, couponDiscountType);
                        form.setValue("couponDiscountValue" as any, parseFloat(couponDiscountValue) || 0);
                        toast({ title: "✅ تم إنشاء الكوبون!", description: `كود: ${data.code}` });
                      } catch {
                        toast({ variant: "destructive", title: "خطأ في الاتصال" });
                      } finally {
                        setCouponGenerating(false);
                      }
                    }}
                    data-testid="btn-generate-coupon"
                  >
                    {couponGenerating ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الإنشاء...</> : <><Sparkles className="w-4 h-4" /> إنشاء كوبون بالذكاء (15 ج.م)</>}
                  </Button>
                ) : null}
              </div>
            )}
          </div>

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

      {/* Media Library Picker Modal */}
      <MediaPickerModal
        open={mediaLibraryOpen}
        onClose={() => setMediaLibraryOpen(false)}
        onSelect={(url, type) => {
          form.setValue("mediaUrl", url);
          form.setValue("mediaType", type);
          setMediaLibraryOpen(false);
        }}
      />
    </div>
  );
}
