import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertAdSchema } from "@shared/schema";
import { useCreateAd, useGenerateAdCopy, useGenerateImage } from "@/hooks/use-ads";
import { useLanguage } from "@/components/LanguageProvider";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Loader2, Image as ImageIcon, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Extend schema for client form
const formSchema = insertAdSchema.extend({
  productName: z.string().optional(), // Helper field for AI
  targetAudience: z.string().optional(), // Helper field for AI
});

type FormValues = z.infer<typeof formSchema>;

export default function CreateAd() {
  const { t, language } = useLanguage();
  const { mutateAsync: createAd, isPending: isCreating } = useCreateAd();
  const { mutateAsync: generateCopy, isPending: isGeneratingCopy } = useGenerateAdCopy();
  const { mutateAsync: generateImage, isPending: isGeneratingImage } = useGenerateImage();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [aiMode, setAiMode] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      mediaUrl: "",
      mediaType: "image",
      language: language,
      status: "active",
      productName: "",
      targetAudience: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await createAd({
        title: values.title,
        description: values.description,
        mediaUrl: values.mediaUrl,
        mediaType: values.mediaType,
        language: values.language,
        status: "active",
        userId: "temp", // Backend handles this from session
      });
      
      toast({
        title: t('create.success'),
        className: "bg-green-500 text-white border-none",
      });
      
      setLocation("/ads");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: error.message,
      });
    }
  };

  const handleGenerateCopy = async () => {
    const { productName, targetAudience, language } = form.getValues();
    if (!productName || !targetAudience) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please fill in Product Name and Target Audience for AI generation.",
      });
      return;
    }

    try {
      const result = await generateCopy({
        productName,
        targetAudience,
        language: language as 'ar' | 'en',
      });
      
      form.setValue("title", result.title);
      form.setValue("description", result.description);
      toast({ title: "Content Generated!", description: "Review and edit as needed." });
    } catch (error) {
      toast({ variant: "destructive", title: "AI Generation Failed" });
    }
  };

  const handleGenerateImage = async () => {
    const { description, productName } = form.getValues();
    const prompt = description || `Advertisement for ${productName}`;
    
    if (!prompt) return;

    try {
      const url = await generateImage(prompt);
      form.setValue("mediaUrl", url);
      setGeneratedImageUrl(url);
      toast({ title: "Image Generated!" });
    } catch (error) {
      toast({ variant: "destructive", title: "Image Generation Failed" });
    }
  };

  return (
    <div className="container max-w-3xl px-4 py-12">
      <div className="mb-12">
        <h1 className="text-5xl font-extrabold mb-4 tracking-tight">{t('create.title')}</h1>
        <p className="text-muted-foreground text-xl">Craft your message with the power of artificial intelligence.</p>
      </div>

      <div className="bg-card border-none rounded-[2.5rem] p-8 md:p-12 shadow-2xl shadow-primary/5 ring-1 ring-border/50">
        <div className="flex flex-col md:flex-row items-center gap-6 mb-12 bg-primary/5 p-8 rounded-[2rem] border border-primary/10">
          <div className="flex-1 text-center md:text-left rtl:md:text-right">
            <h3 className="text-xl font-bold flex items-center justify-center md:justify-start gap-3 mb-2">
              <Sparkles className="w-6 h-6 text-primary animate-pulse" />
              AI Creative Suite
            </h3>
            <p className="text-muted-foreground">Unlock professional copy and visuals with a single click.</p>
          </div>
          <Button 
            variant={aiMode ? "default" : "outline"} 
            onClick={() => setAiMode(!aiMode)}
            className="rounded-full px-8 h-12 text-base font-semibold transition-all hover:scale-105 active:scale-95"
          >
            {aiMode ? "Suite Active" : "Activate AI"}
          </Button>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {/* AI Helper Fields */}
            <AnimatePresence>
              {aiMode && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-6 overflow-hidden border-b pb-6 mb-6"
                >
                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="productName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Product/Service Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Smart Coffee Maker" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="targetAudience"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Target Audience</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Coffee lovers, Office workers" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button 
                    type="button" 
                    onClick={handleGenerateCopy} 
                    disabled={isGeneratingCopy}
                    className="w-full bg-primary text-white border-none h-14 rounded-2xl text-lg font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all hover:-translate-y-1"
                  >
                    {isGeneratingCopy ? (
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    ) : (
                      <Sparkles className="w-5 h-5 mr-2" />
                    )}
                    Generate Professional Copy
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Standard Fields */}
            <div className="space-y-8">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-lg font-semibold">{t('create.title')}</FormLabel>
                    <FormControl>
                      <Input className="text-xl font-medium h-16 rounded-2xl px-6 border-none bg-muted/30 focus-visible:bg-muted/50 transition-colors" placeholder="e.g. Premium Coffee Beans" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-lg font-semibold">Description</FormLabel>
                    <FormControl>
                      <Textarea className="min-h-[160px] resize-none rounded-2xl p-6 border-none bg-muted/30 focus-visible:bg-muted/50 transition-colors text-lg" placeholder="Describe the value of your product..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="language"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Language</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ar">العربية (Arabic)</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="mediaType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Media Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="image">Image</SelectItem>
                        <SelectItem value="video">Video</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Media URL / Generation */}
            <div className="space-y-6 pt-10 border-t border-border/50">
              <div className="flex items-center justify-between">
                <FormLabel className="text-xl font-bold">Visual Assets</FormLabel>
                {aiMode && (
                  <Button 
                    type="button" 
                    variant="secondary" 
                    size="sm"
                    onClick={handleGenerateImage}
                    disabled={isGeneratingImage || !form.getValues().description}
                    className="rounded-full bg-secondary/10 text-secondary hover:bg-secondary/20 border-none px-4"
                  >
                    {isGeneratingImage ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ImageIcon className="w-4 h-4 mr-2" />}
                    Generate Custom Visual
                  </Button>
                )}
              </div>
              
              <FormField
                control={form.control}
                name="mediaUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input className="h-14 rounded-2xl px-6 bg-muted/30 border-none" placeholder="Paste image/video URL or use AI..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Preview */}
              <AnimatePresence>
                {(form.watch("mediaUrl") || generatedImageUrl) && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-[2rem] overflow-hidden border bg-muted/10 aspect-video relative group ring-1 ring-border/50"
                  >
                    <img 
                      src={form.watch("mediaUrl")} 
                      alt="Preview" 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      onError={(e) => e.currentTarget.style.display = 'none'} 
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Button 
              type="submit" 
              size="lg" 
              className="w-full text-xl h-16 mt-12 rounded-2xl shadow-xl shadow-primary/10 hover:shadow-primary/20 transition-all hover:-translate-y-1 active:scale-[0.98]"
              disabled={isCreating}
              data-testid="button-submit"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  {t('common.loading')}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  {t('create.submit')}
                </>
              )}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
