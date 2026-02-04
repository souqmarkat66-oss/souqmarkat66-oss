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
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{t('create.title')}</h1>
        <p className="text-muted-foreground">Fill in the details below to publish your advertisement.</p>
      </div>

      <div className="bg-card border rounded-3xl p-6 md:p-8 shadow-sm">
        <div className="flex items-center gap-4 mb-8 bg-muted/50 p-4 rounded-xl">
          <div className="flex-1">
            <h3 className="font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              AI Assistant
            </h3>
            <p className="text-sm text-muted-foreground">Use AI to generate content and images.</p>
          </div>
          <Button 
            variant={aiMode ? "default" : "outline"} 
            onClick={() => setAiMode(!aiMode)}
            className="rounded-full"
          >
            {aiMode ? "AI Mode On" : "Enable AI"}
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
                    className="w-full bg-gradient-to-r from-primary to-secondary text-white border-none"
                  >
                    {isGeneratingCopy ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    Generate Copy
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Standard Fields */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ad Title</FormLabel>
                  <FormControl>
                    <Input className="text-lg font-medium h-12" placeholder="Catchy headline..." {...field} />
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
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea className="min-h-[120px] resize-none" placeholder="Detailed description of your offering..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <FormLabel className="text-base">Media</FormLabel>
                {aiMode && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={handleGenerateImage}
                    disabled={isGeneratingImage || !form.getValues().description}
                  >
                    {isGeneratingImage ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <ImageIcon className="w-3 h-3 mr-2" />}
                    Generate Image
                  </Button>
                )}
              </div>
              
              <FormField
                control={form.control}
                name="mediaUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="Enter image or video URL..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Preview */}
              {(form.watch("mediaUrl") || generatedImageUrl) && (
                <div className="rounded-xl overflow-hidden border bg-muted/20 aspect-video relative">
                  <img 
                    src={form.watch("mediaUrl")} 
                    alt="Preview" 
                    className="w-full h-full object-contain"
                    onError={(e) => e.currentTarget.style.display = 'none'} 
                  />
                </div>
              )}
            </div>

            <Button 
              type="submit" 
              size="lg" 
              className="w-full text-lg h-14 mt-8"
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
