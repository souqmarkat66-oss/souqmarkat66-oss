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
import { Radio, Video, AlertCircle, Plus } from "lucide-react";
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
      <div className="container max-w-lg px-4 py-16 text-center">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
        <h2 className="text-2xl font-bold mb-2">تحتاج إلى قناة أولاً</h2>
        <p className="text-muted-foreground mb-6">أنشئ قناتك لتتمكن من بدء البث المباشر</p>
        <Button onClick={() => createChannelMutation.mutate(user?.firstName + " Channel" || "قناتي")} disabled={createChannelMutation.isPending} className="gap-2">
          <Plus className="w-4 h-4" />
          إنشاء قناة تلقائياً
        </Button>
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
            <form onSubmit={form.handleSubmit(data => createStreamMutation.mutate(data))} className="space-y-5">
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
              <Button type="submit" disabled={createStreamMutation.isPending} size="lg" className="w-full bg-red-500 hover:bg-red-600 text-white gap-2">
                <Video className="w-5 h-5" />
                {createStreamMutation.isPending ? "جاري الإعداد..." : "ابدأ البث الآن 🔴"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
