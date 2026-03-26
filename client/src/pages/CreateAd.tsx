import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertAdSchema } from "@shared/schema";
import { useCreateAd, useGenerateAdCopy } from "@/hooks/use-ads";
import { useLanguage } from "@/components/LanguageProvider";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader2, Video, Film } from "lucide-react";
import { UploadZone } from "@/components/UploadZone";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";

const formSchema = insertAdSchema.extend({
  productName: z.string().optional(),
  targetAudience: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function CreateAd() {
  const { t, language } = useLanguage();
  const { mutateAsync: createAd, isPending: isCreating } = useCreateAd();
  const { mutateAsync: generateCopy, isPending: isGeneratingCopy } = useGenerateAdCopy();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [aiMode, setAiMode] = useState(false);
  const [videoScript, setVideoScript] = useState<any>(null);
  const [generatingScript, setGeneratingScript] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", description: "", mediaUrl: "", mediaType: "image", language, status: "active", productName: "", targetAudience: "" },
  });

  const generateImageMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const res = await fetch("/api/generate-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, size: "1024x1024" }), credentials: "include" });
      if (!res.ok) throw new Error("فشل توليد الصورة");
      const data = await res.json();
      return data.url as string;
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await createAd({ title: values.title, description: values.description, mediaUrl: values.mediaUrl, mediaType: values.mediaType, language: values.language, status: "active", userId: "temp" });
      toast({ title: t('create.success'), className: "bg-green-500 text-white border-none" });
      setLocation("/ads");
    } catch (error: any) {
      toast({ variant: "destructive", title: t('common.error'), description: error.message });
    }
  };

  const handleGenerateCopy = async () => {
    const { productName, targetAudience, language } = form.getValues();
    if (!productName || !targetAudience) { toast({ variant: "destructive", title: "أدخل اسم المنتج والجمهور المستهدف" }); return; }
    try {
      const result = await generateCopy({ productName, targetAudience, language: language as 'ar' | 'en' });
      form.setValue("title", result.title);
      form.setValue("description", result.description);
      toast({ title: "تم توليد المحتوى! ✨" });
    } catch { toast({ variant: "destructive", title: "فشل التوليد" }); }
  };

  const handleGenerateImage = async () => {
    const { description, productName } = form.getValues();
    const prompt = description || `Advertisement for ${productName}`;
    if (!prompt) return;
    try {
      const url = await generateImageMutation.mutateAsync(prompt);
      form.setValue("mediaUrl", url);
      toast({ title: "تم توليد الصورة! 🎨" });
    } catch { toast({ variant: "destructive", title: "فشل توليد الصورة" }); }
  };

  const handleGenerateVideoScript = async () => {
    const { productName } = form.getValues();
    if (!productName) { toast({ variant: "destructive", title: "أدخل اسم المنتج أولاً" }); return; }
    setGeneratingScript(true);
    try {
      const res = await fetch("/api/ai/generate-video-script", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productName, duration: 30, language: form.getValues("language") }), credentials: "include" });
      const data = await res.json();
      setVideoScript(data);
      toast({ title: "تم توليد سكريبت الفيديو! 🎬" });
    } catch { toast({ variant: "destructive", title: "فشل التوليد" }); }
    finally { setGeneratingScript(false); }
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
        <Button onClick={() => setAiMode(false)} variant={!aiMode ? "default" : "outline"} size="sm">✏️ يدوي</Button>
        <Button onClick={() => setAiMode(true)} variant={aiMode ? "default" : "outline"} size="sm" className="gap-2">
          <Sparkles className="w-4 h-4" /> AI مساعد
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {aiMode && (
            <AnimatePresence>
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="rounded-2xl border-primary/20 bg-primary/5">
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> توليد بالذكاء الاصطناعي</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="productName" render={({ field }) => (
                        <FormItem><FormLabel>اسم المنتج</FormLabel><FormControl><Input placeholder="مثال: هاتف سامسونج" {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="targetAudience" render={({ field }) => (
                        <FormItem><FormLabel>الجمهور المستهدف</FormLabel><FormControl><Input placeholder="مثال: شباب 18-35" {...field} /></FormControl></FormItem>
                      )} />
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button type="button" onClick={handleGenerateCopy} disabled={isGeneratingCopy} size="sm" className="gap-2">
                        {isGeneratingCopy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        توليد نص
                      </Button>
                      <Button type="button" onClick={handleGenerateImage} disabled={generateImageMutation.isPending} size="sm" variant="outline" className="gap-2">
                        {generateImageMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "🎨"}
                        توليد صورة AI
                      </Button>
                      <Button type="button" onClick={handleGenerateVideoScript} disabled={generatingScript} size="sm" variant="outline" className="gap-2">
                        {generatingScript ? <Loader2 className="w-4 h-4 animate-spin" /> : <Film className="w-4 h-4" />}
                        سكريبت فيديو
                      </Button>
                    </div>
                    {videoScript && (
                      <div className="bg-background rounded-xl p-4 text-sm space-y-2">
                        <h4 className="font-bold">{videoScript.title}</h4>
                        <p className="text-muted-foreground">{videoScript.script}</p>
                        {videoScript.scenes && (
                          <div className="space-y-2 mt-3">
                            {videoScript.scenes.map((sc: any, i: number) => (
                              <div key={i} className="border rounded-lg p-2">
                                <span className="text-xs text-primary font-bold">{sc.time}s</span>
                                <p className="text-xs mt-1"><strong>مشهد:</strong> {sc.visual}</p>
                                <p className="text-xs text-muted-foreground"><strong>صوت:</strong> {sc.narration}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </AnimatePresence>
          )}

          <FormField control={form.control} name="title" render={({ field }) => (
            <FormItem><FormLabel>عنوان الإعلان</FormLabel><FormControl><Input placeholder="أدخل عنواناً جذاباً..." {...field} /></FormControl><FormMessage /></FormItem>
          )} />

          <FormField control={form.control} name="description" render={({ field }) => (
            <FormItem><FormLabel>وصف الإعلان</FormLabel><FormControl><Textarea placeholder="اكتب وصفاً مقنعاً..." rows={4} {...field} /></FormControl><FormMessage /></FormItem>
          )} />

          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="mediaType" render={({ field }) => (
              <FormItem><FormLabel>نوع الوسيط</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="image">📷 صورة</SelectItem>
                    <SelectItem value="video">🎬 فيديو</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name="language" render={({ field }) => (
              <FormItem><FormLabel>اللغة</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="ar">🇸🇦 العربية</SelectItem>
                    <SelectItem value="en">🇺🇸 English</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
          </div>

          <FormField control={form.control} name="mediaUrl" render={({ field }) => (
            <FormItem>
              <FormLabel>الصورة / الفيديو</FormLabel>
              <UploadZone value={field.value} onChange={field.onChange} label="ارفع صورة أو فيديو مباشرة" />
              {!field.value && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">أو أدخل رابطاً</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}
              {!field.value && <FormControl><Input placeholder="https://..." className="mt-2" onChange={e => field.onChange(e.target.value)} /></FormControl>}
              <FormMessage />
            </FormItem>
          )} />

          <Button type="submit" disabled={isCreating} size="lg" className="w-full h-14 text-lg gap-2 shadow-xl shadow-primary/25">
            {isCreating ? <><Loader2 className="w-5 h-5 animate-spin" /> جاري النشر...</> : <>{t('create.submit')} 🚀</>}
          </Button>
        </form>
      </Form>
    </div>
  );
}
