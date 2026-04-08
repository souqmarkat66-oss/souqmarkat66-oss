import { useState, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  ChefHat, Sparkles, Download, Megaphone, Film,
  Loader2, ArrowRight, Star, Utensils
} from "lucide-react";

const CATEGORIES = [
  { key: "grills",   label: "مشويات",          emoji: "🥩" },
  { key: "seafood",  label: "أسماك وبحريات",   emoji: "🐟" },
  { key: "oriental", label: "أكلات شرقية",      emoji: "🍲" },
  { key: "pizza",    label: "بيتزا وباستا",     emoji: "🍕" },
  { key: "fastfood", label: "وجبات سريعة",      emoji: "🍔" },
  { key: "sweets",   label: "حلويات",           emoji: "🍰" },
  { key: "drinks",   label: "مشروبات",          emoji: "🥤" },
  { key: "salads",   label: "سلطات",            emoji: "🥗" },
];

const STYLES = [
  { key: "photo",   label: "فوتوغرافي",  desc: "صورة احترافية واقعية",   emoji: "📸" },
  { key: "elegant", label: "فاخر",       desc: "تصوير مطاعم راقية",       emoji: "✨" },
  { key: "street",  label: "شعبي",       desc: "ألوان دافئة وشهية",       emoji: "🔥" },
  { key: "cartoon", label: "كارتون",     desc: "رسوم ملونة ومرحة",        emoji: "🎨" },
];

export default function MenuGenerator() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const cardRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    restaurantName: "",
    dishName: "",
    price: "",
    description: "",
    category: "grills",
    style: "photo",
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ imageUrl: string; caption: string } | null>(null);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  if (!user) {
    window.location.href = "/login";
    return null;
  }

  async function generate() {
    if (!form.dishName.trim()) {
      toast({ variant: "destructive", title: "أدخل اسم الأكلة أولاً" });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/ai/menu-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "فشل التوليد");
      setResult(data);
    } catch (e: any) {
      toast({ variant: "destructive", title: "خطأ", description: e.message });
    } finally {
      setLoading(false);
    }
  }

  function downloadCard() {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.imageUrl;
    a.download = `menu-${form.dishName}.png`;
    a.click();
  }

  function shareAsAd() {
    setLocation(`/create?imageUrl=${encodeURIComponent(result!.imageUrl)}&title=${encodeURIComponent(form.dishName)}&desc=${encodeURIComponent(result!.caption)}`);
  }

  const catLabel = CATEGORIES.find(c => c.key === form.category)?.label || "";
  const catEmoji = CATEGORIES.find(c => c.key === form.category)?.emoji || "🍽️";

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container mx-auto px-4 py-6 max-w-2xl">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-bold mb-4">
            <Sparkles className="w-4 h-4" />
            ذكاء اصطناعي
          </div>
          <h1 className="text-2xl font-extrabold flex items-center justify-center gap-2 mb-2">
            <ChefHat className="w-7 h-7 text-orange-500" />
            منشئ المنيو الذكي
          </h1>
          <p className="text-muted-foreground text-sm">
            أدخل بيانات الأكلة والـ AI يولّد كارد منيو احترافي في ثوانٍ
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm mb-5">

          {/* Restaurant & Dish */}
          <div className="space-y-3 mb-5">
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1.5 block">اسم المطعم (اختياري)</label>
              <input
                type="text"
                value={form.restaurantName}
                onChange={e => set("restaurantName", e.target.value)}
                placeholder="مثال: مطعم أبو حسن"
                className="w-full border border-border/60 bg-background rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                data-testid="input-restaurant-name"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1.5 block">
                اسم الأكلة <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.dishName}
                onChange={e => set("dishName", e.target.value)}
                placeholder="مثال: كبدة إسكندراني"
                className="w-full border border-border/60 bg-background rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                data-testid="input-dish-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1.5 block">السعر (جنيه)</label>
                <input
                  type="number"
                  value={form.price}
                  onChange={e => set("price", e.target.value)}
                  placeholder="مثال: 85"
                  className="w-full border border-border/60 bg-background rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  data-testid="input-dish-price"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1.5 block">وصف مختصر</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => set("description", e.target.value)}
                  placeholder="مثال: مع خبز وسلطة"
                  className="w-full border border-border/60 bg-background rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  data-testid="input-dish-desc"
                />
              </div>
            </div>
          </div>

          {/* Category */}
          <div className="mb-5">
            <label className="text-xs font-bold text-muted-foreground mb-2 block">نوع الأكلة</label>
            <div className="grid grid-cols-4 gap-1.5">
              {CATEGORIES.map(c => (
                <button
                  key={c.key}
                  onClick={() => set("category", c.key)}
                  data-testid={`btn-cat-${c.key}`}
                  className={`flex flex-col items-center gap-0.5 rounded-xl py-2.5 px-1 border-2 transition-all ${
                    form.category === c.key
                      ? "border-primary bg-primary/10"
                      : "border-border/40 bg-muted/30 hover:border-border"
                  }`}
                >
                  <span className="text-xl">{c.emoji}</span>
                  <span className="text-[10px] font-semibold text-center leading-tight">{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Style */}
          <div className="mb-6">
            <label className="text-xs font-bold text-muted-foreground mb-2 block">أسلوب التصميم</label>
            <div className="grid grid-cols-2 gap-2">
              {STYLES.map(s => (
                <button
                  key={s.key}
                  onClick={() => set("style", s.key)}
                  data-testid={`btn-style-${s.key}`}
                  className={`flex items-center gap-2.5 rounded-xl py-2.5 px-3 border-2 transition-all text-right ${
                    form.style === s.key
                      ? "border-primary bg-primary/10"
                      : "border-border/40 bg-muted/30 hover:border-border"
                  }`}
                >
                  <span className="text-2xl">{s.emoji}</span>
                  <div>
                    <div className="text-xs font-bold">{s.label}</div>
                    <div className="text-[10px] text-muted-foreground">{s.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <Button
            onClick={generate}
            disabled={loading || !form.dishName.trim()}
            className="w-full h-12 text-base gap-2 rounded-xl"
            data-testid="btn-generate-menu"
          >
            {loading
              ? <><Loader2 className="w-5 h-5 animate-spin" /> جاري التوليد...</>
              : <><Sparkles className="w-5 h-5" /> ولّد كارد المنيو</>
            }
          </Button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12 bg-card border border-border/60 rounded-2xl">
            <div className="text-5xl mb-4 animate-bounce">{catEmoji}</div>
            <p className="text-foreground font-bold text-sm mb-1">الـ AI بيجهّز صورة {catLabel} احترافية...</p>
            <p className="text-muted-foreground text-xs">قد تستغرق 15-30 ثانية</p>
            <div className="flex justify-center gap-1 mt-4">
              {[0,1,2].map(i => (
                <div key={i} className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}

        {/* Result */}
        {result && !loading && (
          <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-lg" ref={cardRef}>

            {/* Menu Card Visual */}
            <div className="relative">
              <img
                src={result.imageUrl}
                alt={form.dishName}
                className="w-full object-cover"
                style={{ maxHeight: 380 }}
              />
              {/* Overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-5">
                <div className="flex items-end justify-between">
                  <div>
                    {form.restaurantName && (
                      <div className="flex items-center gap-1 mb-1">
                        <ChefHat className="w-3 h-3 text-yellow-400" />
                        <span className="text-yellow-400 text-[11px] font-bold">{form.restaurantName}</span>
                      </div>
                    )}
                    <h2 className="text-white font-extrabold text-xl leading-tight">{form.dishName}</h2>
                    {form.description && (
                      <p className="text-white/70 text-xs mt-0.5">{form.description}</p>
                    )}
                  </div>
                  {form.price && (
                    <div className="bg-primary rounded-2xl px-4 py-2 text-center flex-shrink-0">
                      <div className="text-white font-extrabold text-lg leading-none">{form.price}</div>
                      <div className="text-white/80 text-[10px]">جنيه</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Category Badge */}
              <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1 flex items-center gap-1.5">
                <span className="text-base">{catEmoji}</span>
                <span className="text-white text-[11px] font-bold">{catLabel}</span>
              </div>
            </div>

            {/* Caption */}
            {result.caption && (
              <div className="p-4 border-b border-border/50">
                <div className="flex items-start gap-2">
                  <Star className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground leading-relaxed">{result.caption}</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="p-4 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={downloadCard} variant="outline" className="gap-2 rounded-xl" data-testid="btn-download-menu">
                  <Download className="w-4 h-4" /> تحميل الصورة
                </Button>
                <Button onClick={shareAsAd} className="gap-2 rounded-xl bg-primary" data-testid="btn-share-as-ad">
                  <Megaphone className="w-4 h-4" /> نشر كإعلان
                </Button>
              </div>
              <Button
                variant="outline"
                className="w-full gap-2 rounded-xl border-orange-400/40 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20"
                onClick={() => generate()}
                data-testid="btn-regenerate"
              >
                <Sparkles className="w-4 h-4" /> توليد نسخة جديدة
              </Button>
            </div>
          </div>
        )}

        {/* Tips */}
        {!result && !loading && (
          <div className="bg-muted/30 border border-border/40 rounded-2xl p-4">
            <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
              <Utensils className="w-4 h-4 text-orange-500" />
              نصائح للحصول على أفضل نتيجة
            </h3>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-center gap-2"><span className="text-green-500">✓</span> أدخل اسم الأكلة بالعربي بوضوح</li>
              <li className="flex items-center gap-2"><span className="text-green-500">✓</span> اختر الفئة الصحيحة لتحسين جودة الصورة</li>
              <li className="flex items-center gap-2"><span className="text-green-500">✓</span> أضف وصفاً مختصراً لمكونات الطبق</li>
              <li className="flex items-center gap-2"><span className="text-green-500">✓</span> أسلوب "فوتوغرافي" مثالي للمطاعم العادية</li>
              <li className="flex items-center gap-2"><span className="text-green-500">✓</span> بعد التوليد يمكنك نشره مباشرة كإعلان</li>
            </ul>
          </div>
        )}

      </div>
    </div>
  );
}
