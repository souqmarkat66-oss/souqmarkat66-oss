import { useState, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  ChefHat, Sparkles, Download, Megaphone, Film,
  Loader2, ArrowRight, Star, Utensils, Plus, Trash2,
  Eye, Share2, X, QrCode, Palette
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

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

const MENU_THEMES = [
  { key: "classic", label: "كلاسيكي", bg: "from-amber-900 to-amber-800", text: "text-amber-100", accent: "text-yellow-400" },
  { key: "modern", label: "عصري", bg: "from-gray-900 to-gray-800", text: "text-gray-100", accent: "text-blue-400" },
  { key: "elegant", label: "فاخر", bg: "from-black to-gray-900", text: "text-white", accent: "text-gold" },
  { key: "fresh", label: "طازج", bg: "from-green-800 to-emerald-900", text: "text-green-100", accent: "text-lime-400" },
  { key: "warm", label: "دافئ", bg: "from-orange-800 to-red-900", text: "text-orange-100", accent: "text-yellow-300" },
];

interface MenuItem {
  id: string;
  dishName: string;
  price: string;
  description: string;
  category: string;
  imageUrl?: string;
  caption?: string;
  generating?: boolean;
}

export default function MenuGenerator() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const menuRef = useRef<HTMLDivElement>(null);

  const [restaurantName, setRestaurantName] = useState("");
  const [restaurantSlogan, setRestaurantSlogan] = useState("");
  const [menuTheme, setMenuTheme] = useState("classic");
  const [style, setStyle] = useState("photo");

  const [items, setItems] = useState<MenuItem[]>([]);
  const [newItem, setNewItem] = useState({ dishName: "", price: "", description: "", category: "grills" });
  const [showPreview, setShowPreview] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);

  const addItem = () => {
    if (!newItem.dishName.trim()) {
      toast({ variant: "destructive", title: "أدخل اسم الأكلة" });
      return;
    }
    setItems(prev => [...prev, {
      id: Date.now().toString(),
      ...newItem,
    }]);
    setNewItem({ dishName: "", price: "", description: "", category: newItem.category });
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const generateSingleImage = async (item: MenuItem): Promise<{ imageUrl: string; caption: string } | null> => {
    try {
      const res = await fetch("/api/ai/menu-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          restaurantName,
          dishName: item.dishName,
          price: item.price,
          description: item.description,
          category: item.category,
          style,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "فشل التوليد");
      return data;
    } catch (e: any) {
      toast({ variant: "destructive", title: `خطأ في توليد ${item.dishName}`, description: e.message });
      return null;
    }
  };

  const generateAllImages = async () => {
    if (items.length === 0) {
      toast({ variant: "destructive", title: "أضف أطباق أولاً" });
      return;
    }
    setGeneratingAll(true);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.imageUrl) continue;
      setItems(prev => prev.map(it => it.id === item.id ? { ...it, generating: true } : it));
      const result = await generateSingleImage(item);
      if (result) {
        setItems(prev => prev.map(it => it.id === item.id ? { ...it, imageUrl: result.imageUrl, caption: result.caption, generating: false } : it));
      } else {
        setItems(prev => prev.map(it => it.id === item.id ? { ...it, generating: false } : it));
      }
    }

    setGeneratingAll(false);
    toast({ title: "✅ تم توليد صور المنيو!" });
  };

  const generateSingleItem = async (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    setItems(prev => prev.map(it => it.id === id ? { ...it, generating: true } : it));
    const result = await generateSingleImage(item);
    if (result) {
      setItems(prev => prev.map(it => it.id === id ? { ...it, imageUrl: result.imageUrl, caption: result.caption, generating: false } : it));
    } else {
      setItems(prev => prev.map(it => it.id === id ? { ...it, generating: false } : it));
    }
  };

  const theme = MENU_THEMES.find(t => t.key === menuTheme) || MENU_THEMES[0];
  const catEmoji = (key: string) => CATEGORIES.find(c => c.key === key)?.emoji || "🍽️";
  const catLabel = (key: string) => CATEGORIES.find(c => c.key === key)?.label || "";

  const groupedItems = items.reduce<Record<string, MenuItem[]>>((acc, item) => {
    const cat = item.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  if (!user) {
    window.location.href = "/login";
    return null;
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container mx-auto px-4 py-6 max-w-3xl">

        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-bold mb-3">
            <Sparkles className="w-4 h-4" />
            ذكاء اصطناعي
          </div>
          <h1 className="text-2xl font-extrabold flex items-center justify-center gap-2 mb-2">
            <ChefHat className="w-7 h-7 text-orange-500" />
            منشئ المنيو الذكي
          </h1>
          <p className="text-muted-foreground text-sm">
            أضف أطباقك والـ AI يولّد منيو رقمي احترافي كامل — وداعاً للطباعة الورقية! 🚀
          </p>
        </div>

        <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm mb-5">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
            <ChefHat className="w-4 h-4 text-orange-500" />
            بيانات المطعم
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">اسم المطعم</label>
              <input
                type="text"
                value={restaurantName}
                onChange={e => setRestaurantName(e.target.value)}
                placeholder="مثال: مطعم أبو حسن"
                className="w-full border border-border/60 bg-background rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                data-testid="input-restaurant-name"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">شعار أو وصف (اختياري)</label>
              <input
                type="text"
                value={restaurantSlogan}
                onChange={e => setRestaurantSlogan(e.target.value)}
                placeholder="مثال: أطيب أكل مصري"
                className="w-full border border-border/60 bg-background rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                data-testid="input-restaurant-slogan"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="text-xs font-bold text-muted-foreground mb-2 block flex items-center gap-1">
              <Palette className="w-3.5 h-3.5" /> ثيم المنيو
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {MENU_THEMES.map(t => (
                <button
                  key={t.key}
                  onClick={() => setMenuTheme(t.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border-2 transition-all ${
                    menuTheme === t.key ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground"
                  }`}
                  data-testid={`theme-${t.key}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="text-xs font-bold text-muted-foreground mb-2 block">أسلوب تصوير الأطباق</label>
            <div className="grid grid-cols-4 gap-1.5">
              {STYLES.map(s => (
                <button
                  key={s.key}
                  onClick={() => setStyle(s.key)}
                  data-testid={`btn-style-${s.key}`}
                  className={`flex flex-col items-center gap-0.5 rounded-xl py-2 px-1 border-2 transition-all ${
                    style === s.key
                      ? "border-primary bg-primary/10"
                      : "border-border/40 bg-muted/30 hover:border-border"
                  }`}
                >
                  <span className="text-lg">{s.emoji}</span>
                  <span className="text-[10px] font-semibold">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm mb-5">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4 text-green-600" />
            إضافة طبق جديد
          </h3>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                value={newItem.dishName}
                onChange={e => setNewItem(f => ({ ...f, dishName: e.target.value }))}
                placeholder="اسم الأكلة *"
                className="w-full border border-border/60 bg-background rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                data-testid="input-dish-name"
                onKeyDown={e => e.key === "Enter" && addItem()}
              />
              <input
                type="number"
                value={newItem.price}
                onChange={e => setNewItem(f => ({ ...f, price: e.target.value }))}
                placeholder="السعر (جنيه)"
                className="w-full border border-border/60 bg-background rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                data-testid="input-dish-price"
              />
              <input
                type="text"
                value={newItem.description}
                onChange={e => setNewItem(f => ({ ...f, description: e.target.value }))}
                placeholder="وصف مختصر"
                className="w-full border border-border/60 bg-background rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                data-testid="input-dish-desc"
              />
            </div>

            <div className="flex gap-2 items-center">
              <div className="flex gap-1 overflow-x-auto flex-1">
                {CATEGORIES.map(c => (
                  <button
                    key={c.key}
                    onClick={() => setNewItem(f => ({ ...f, category: c.key }))}
                    data-testid={`btn-cat-${c.key}`}
                    className={`flex items-center gap-1 rounded-lg py-1 px-2 text-[10px] font-bold whitespace-nowrap border transition-all ${
                      newItem.category === c.key
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/40 text-muted-foreground"
                    }`}
                  >
                    <span>{c.emoji}</span> {c.label}
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={addItem} className="w-full gap-2 rounded-xl" size="sm" data-testid="btn-add-item">
              <Plus className="w-4 h-4" /> أضف الطبق للمنيو
            </Button>
          </div>
        </div>

        {items.length > 0 && (
          <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm mb-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Utensils className="w-4 h-4 text-orange-500" />
                أطباق المنيو ({items.length} طبق)
              </h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowPreview(true)}
                  className="gap-1 text-xs rounded-lg"
                  data-testid="btn-preview-menu"
                  disabled={items.length === 0}
                >
                  <Eye className="w-3.5 h-3.5" /> معاينة
                </Button>
              </div>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {items.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-3 border rounded-xl p-3 bg-muted/20 hover:bg-muted/40 transition-all">
                  <span className="text-lg">{catEmoji(item.category)}</span>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.dishName} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  ) : item.generating ? (
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0 text-muted-foreground text-[10px]">
                      بدون صورة
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm truncate">{item.dishName}</span>
                      {item.price && <span className="text-xs text-primary font-bold">{item.price} ج.م</span>}
                    </div>
                    {item.description && <p className="text-[10px] text-muted-foreground truncate">{item.description}</p>}
                    <span className="text-[9px] text-muted-foreground">{catLabel(item.category)}</span>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {!item.imageUrl && !item.generating && (
                      <button
                        onClick={() => generateSingleItem(item.id)}
                        className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors"
                        title="ولّد صورة"
                        data-testid={`btn-gen-${item.id}`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => removeItem(item.id)}
                      className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                      data-testid={`btn-remove-${item.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-2">
              <Button
                onClick={generateAllImages}
                disabled={generatingAll || items.every(i => !!i.imageUrl)}
                className="w-full h-11 gap-2 rounded-xl"
                data-testid="btn-generate-all"
              >
                {generatingAll
                  ? <><Loader2 className="w-5 h-5 animate-spin" /> جاري توليد صور الأطباق...</>
                  : <><Sparkles className="w-5 h-5" /> ولّد صور كل الأطباق ({items.filter(i => !i.imageUrl).length} متبقي)</>
                }
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowPreview(true)}
                className="w-full gap-2 rounded-xl"
                data-testid="btn-preview-full"
              >
                <Eye className="w-4 h-4" /> معاينة المنيو الكامل
              </Button>
            </div>
          </div>
        )}

        {items.length === 0 && (
          <div className="bg-muted/30 border border-border/40 rounded-2xl p-5">
            <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
              <Utensils className="w-4 h-4 text-orange-500" />
              كيف تستخدم المنيو الذكي؟
            </h3>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-center gap-2"><span className="text-green-500 font-bold">1</span> أدخل اسم المطعم واختر الثيم والأسلوب</li>
              <li className="flex items-center gap-2"><span className="text-green-500 font-bold">2</span> أضف كل أطباقك واحد تلو الآخر (اسم + سعر + فئة)</li>
              <li className="flex items-center gap-2"><span className="text-green-500 font-bold">3</span> اضغط "ولّد صور كل الأطباق" — الـ AI يصمم صورة لكل طبق</li>
              <li className="flex items-center gap-2"><span className="text-green-500 font-bold">4</span> اضغط "معاينة" لتشوف المنيو الرقمي الكامل</li>
              <li className="flex items-center gap-2"><span className="text-green-500 font-bold">5</span> شارك رابط المنيو مع عملائك — وداعاً للطباعة! 🎉</li>
            </ul>
            <div className="mt-4 bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
              <p className="text-xs font-bold text-primary">💡 وفّر تكاليف الطباعة — منيو رقمي احترافي بالذكاء الاصطناعي!</p>
            </div>
          </div>
        )}

      </div>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-lg w-full p-0 rounded-2xl overflow-hidden border-0 max-h-[90vh] overflow-y-auto">
          <div ref={menuRef} className={`bg-gradient-to-b ${theme.bg} min-h-[60vh]`} dir="rtl">
            <div className="text-center py-8 px-6 border-b border-white/10">
              <div className="text-3xl mb-1">🍽️</div>
              <h1 className={`text-2xl font-black ${theme.text} mb-1`}>{restaurantName || "اسم المطعم"}</h1>
              {restaurantSlogan && <p className={`text-sm ${theme.accent} opacity-80`}>{restaurantSlogan}</p>}
              <div className={`mt-2 text-[10px] ${theme.text} opacity-50`}>— قائمة الطعام —</div>
            </div>

            <div className="px-4 py-4 space-y-6">
              {Object.keys(groupedItems).length === 0 && (
                <p className={`text-center py-8 text-sm ${theme.text} opacity-50`}>لا توجد أطباق بعد — أضف أطباق من الأعلى</p>
              )}

              {Object.entries(groupedItems).map(([cat, catItems]) => (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-3 border-b border-white/10 pb-2">
                    <span className="text-xl">{catEmoji(cat)}</span>
                    <h2 className={`text-lg font-extrabold ${theme.accent}`}>{catLabel(cat)}</h2>
                    <span className={`text-xs ${theme.text} opacity-40`}>({catItems.length})</span>
                  </div>

                  <div className="space-y-3">
                    {catItems.map(item => (
                      <div key={item.id} className="flex gap-3 items-start bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.dishName} className="w-20 h-20 rounded-xl object-cover flex-shrink-0 shadow-lg" />
                        ) : (
                          <div className="w-20 h-20 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 text-2xl">
                            {catEmoji(item.category)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className={`font-bold text-sm ${theme.text}`}>{item.dishName}</h3>
                            {item.price && (
                              <span className={`text-sm font-black ${theme.accent} whitespace-nowrap`}>{item.price} ج.م</span>
                            )}
                          </div>
                          {item.description && (
                            <p className={`text-[11px] ${theme.text} opacity-60 mt-0.5 leading-relaxed`}>{item.description}</p>
                          )}
                          {item.caption && (
                            <p className={`text-[10px] ${theme.text} opacity-40 mt-1 italic leading-relaxed line-clamp-2`}>{item.caption}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className={`text-center py-5 border-t border-white/10 ${theme.text} opacity-40`}>
              <p className="text-[10px]">تم الإنشاء بواسطة منشئ المنيو الذكي · ads-as.com</p>
              <p className="text-[9px] mt-0.5">شبكة سوق للإعلانات 🇪🇬</p>
            </div>
          </div>

          <div className="bg-background p-4 border-t flex gap-2">
            <Button variant="outline" className="flex-1 gap-1 rounded-xl text-xs" onClick={() => setShowPreview(false)} data-testid="btn-close-preview">
              <X className="w-3.5 h-3.5" /> إغلاق
            </Button>
            <Button
              className="flex-1 gap-1 rounded-xl text-xs"
              onClick={() => {
                setLocation(`/create?title=${encodeURIComponent(restaurantName + " - منيو")}&desc=${encodeURIComponent("منيو " + restaurantName + " الرقمي")}`);
              }}
              data-testid="btn-share-menu-ad"
            >
              <Megaphone className="w-3.5 h-3.5" /> نشر كإعلان
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
