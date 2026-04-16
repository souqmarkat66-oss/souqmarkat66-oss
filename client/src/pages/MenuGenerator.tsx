import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  ChefHat, Sparkles, Download, Megaphone, Film,
  Loader2, ArrowRight, Star, Utensils, Plus, Trash2,
  Eye, Share2, X, QrCode, Palette, Save, Copy, Check,
  ExternalLink, List
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";

const CATEGORIES = [
  { key: "grills",   label: "مشويات",          emoji: "🥩", color: "from-red-500 to-orange-500" },
  { key: "seafood",  label: "أسماك وبحريات",   emoji: "🐟", color: "from-blue-500 to-cyan-500" },
  { key: "oriental", label: "أكلات شرقية",      emoji: "🍲", color: "from-amber-500 to-yellow-500" },
  { key: "pizza",    label: "بيتزا وباستا",     emoji: "🍕", color: "from-red-400 to-rose-500" },
  { key: "fastfood", label: "وجبات سريعة",      emoji: "🍔", color: "from-yellow-500 to-amber-500" },
  { key: "sweets",   label: "حلويات",           emoji: "🍰", color: "from-pink-400 to-rose-400" },
  { key: "drinks",   label: "مشروبات",          emoji: "🥤", color: "from-green-400 to-emerald-500" },
  { key: "salads",   label: "سلطات",            emoji: "🥗", color: "from-lime-400 to-green-500" },
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
  { key: "elegant", label: "فاخر", bg: "from-black to-gray-900", text: "text-white", accent: "text-yellow-300" },
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

interface SavedMenu {
  id: number;
  slug: string;
  restaurant_name: string;
  restaurant_slogan: string;
  theme: string;
  style: string;
  items: MenuItem[];
  views_count: number;
  created_at: string;
  updated_at: string;
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

  const [savedMenuId, setSavedMenuId] = useState<number | null>(null);
  const [savedSlug, setSavedSlug] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);
  const [myMenus, setMyMenus] = useState<SavedMenu[]>([]);
  const [showMyMenus, setShowMyMenus] = useState(false);
  const [loadingMenus, setLoadingMenus] = useState(false);

  const menuUrl = savedSlug ? `${window.location.origin}/m/${savedSlug}` : null;

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

  const saveMenu = async () => {
    if (items.length === 0) {
      toast({ variant: "destructive", title: "أضف أطباق أولاً" });
      return;
    }
    setSaving(true);
    try {
      const url = savedMenuId ? `/api/menus/${savedMenuId}` : "/api/menus";
      const method = savedMenuId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          restaurantName,
          restaurantSlogan,
          theme: menuTheme,
          style,
          items: items.map(({ generating, ...rest }) => rest),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.message === "insufficient_credits") {
          toast({
            variant: "destructive",
            title: "رصيد غير كافٍ",
            description: `حفظ المنيو يتطلب ${data.cost || 2} كريدت (${data.totalCostEGP || 10} ج.م). رصيدك: ${data.balance || 0} ج.م. اشحن المحفظة أولاً.`
          });
          return;
        }
        throw new Error(data.message || "فشل الحفظ");
      }
      setSavedMenuId(data.id);
      setSavedSlug(data.slug);
      toast({ title: "✅ تم حفظ المنيو بنجاح!" });
      setShowQR(true);
    } catch (e: any) {
      toast({ variant: "destructive", title: "خطأ", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const copyLink = () => {
    if (!menuUrl) return;
    navigator.clipboard.writeText(menuUrl).then(() => {
      setCopied(true);
      toast({ title: "✅ تم نسخ الرابط!" });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const loadMyMenus = async () => {
    setLoadingMenus(true);
    try {
      const res = await fetch("/api/menus/mine", { credentials: "include" });
      if (!res.ok) throw new Error("فشل تحميل المنيوهات");
      const data = await res.json();
      if (Array.isArray(data)) setMyMenus(data);
    } catch (e: any) {
      toast({ variant: "destructive", title: "خطأ", description: e.message });
    }
    setLoadingMenus(false);
    setShowMyMenus(true);
  };

  const loadMenu = (menu: SavedMenu) => {
    let menuItems: MenuItem[] = [];
    try { menuItems = typeof menu.items === "string" ? JSON.parse(menu.items as any) : (menu.items || []); } catch { menuItems = []; }
    setRestaurantName(menu.restaurant_name || "");
    setRestaurantSlogan(menu.restaurant_slogan || "");
    setMenuTheme(menu.theme || "classic");
    setStyle(menu.style || "photo");
    setItems(menuItems || []);
    setSavedMenuId(menu.id);
    setSavedSlug(menu.slug);
    setShowMyMenus(false);
    toast({ title: "✅ تم تحميل المنيو" });
  };

  const deleteMenu = async (id: number) => {
    try {
      const res = await fetch(`/api/menus/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "فشل الحذف");
      }
      setMyMenus(prev => prev.filter(m => m.id !== id));
      if (savedMenuId === id) {
        setSavedMenuId(null);
        setSavedSlug(null);
      }
      toast({ title: "تم حذف المنيو" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "خطأ في الحذف", description: e.message });
    }
  };

  const theme = MENU_THEMES.find(t => t.key === menuTheme) || MENU_THEMES[0];
  const catEmoji = (key: string) => CATEGORIES.find(c => c.key === key)?.emoji || "🍽️";
  const catLabel = (key: string) => CATEGORIES.find(c => c.key === key)?.label || "";
  const catColor = (key: string) => CATEGORIES.find(c => c.key === key)?.color || "from-gray-400 to-gray-500";

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
            أضف أطباقك والـ AI يولّد منيو رقمي احترافي كامل مع QR Code — وداعاً للطباعة الورقية!
          </p>
        </div>

        <div className="flex gap-2 mb-5">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMyMenus}
            className="gap-1 rounded-xl text-xs flex-1"
            data-testid="btn-my-menus"
          >
            <List className="w-3.5 h-3.5" /> منيوهاتي المحفوظة
          </Button>
          {savedSlug && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowQR(true)}
              className="gap-1 rounded-xl text-xs"
              data-testid="btn-show-qr"
            >
              <QrCode className="w-3.5 h-3.5" /> QR Code
            </Button>
          )}
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
              {items.map((item) => (
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
                onClick={saveMenu}
                disabled={saving}
                variant="default"
                className="w-full h-11 gap-2 rounded-xl bg-green-600 hover:bg-green-700 text-white"
                data-testid="btn-save-menu"
              >
                {saving
                  ? <><Loader2 className="w-5 h-5 animate-spin" /> جاري الحفظ...</>
                  : <><Save className="w-5 h-5" /> {savedMenuId ? "تحديث المنيو" : "احفظ المنيو + QR Code (2 كريدت)"}</>
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
              <li className="flex items-center gap-2"><span className="text-green-500 font-bold">4</span> اضغط "احفظ المنيو" — يتم توليد رابط + QR Code</li>
              <li className="flex items-center gap-2"><span className="text-green-500 font-bold">5</span> اطبع الـ QR Code وحطّه على الطاولات — الزبون يمسح ويشوف المنيو!</li>
            </ul>
            <div className="mt-4 bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
              <p className="text-xs font-bold text-primary">وفّر تكاليف الطباعة — منيو رقمي مع QR بالذكاء الاصطناعي!</p>
            </div>
          </div>
        )}

      </div>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-lg w-full p-0 rounded-2xl overflow-hidden border-0 max-h-[90vh] overflow-y-auto">
          <div ref={menuRef} className="bg-gradient-to-br from-orange-50/50 via-white to-amber-50/50 min-h-[60vh]" dir="rtl">
            <div className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500"></div>
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-3 right-6 text-5xl opacity-30">🍽️</div>
                <div className="absolute bottom-3 left-6 text-3xl opacity-20">✨</div>
              </div>
              <div className="relative px-5 py-8 text-center">
                <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-3 border-2 border-white/30">
                  <span className="text-3xl">🍽️</span>
                </div>
                <h1 className="text-2xl font-black text-white mb-1 drop-shadow-lg">{restaurantName || "اسم المطعم"}</h1>
                {restaurantSlogan && <p className="text-xs text-white/80 font-medium">{restaurantSlogan}</p>}
                <div className="flex items-center justify-center gap-3 mt-3 text-white/50 text-[10px]">
                  <span>{items.length} صنف</span>
                </div>
              </div>
              <div className="h-4 bg-gradient-to-br from-orange-50/50 via-white to-amber-50/50 rounded-t-[1.5rem]"></div>
            </div>

            <div className="px-3 pb-4 -mt-1 space-y-4">
              {Object.keys(groupedItems).length === 0 && (
                <p className="text-center py-8 text-sm text-gray-400">لا توجد أطباق بعد — أضف أطباق من الأعلى</p>
              )}

              {Object.entries(groupedItems).map(([cat, catItems]) => (
                <div key={cat} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className={`bg-gradient-to-l ${catColor(cat)} px-4 py-2.5 flex items-center gap-2`}>
                    <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center text-lg">
                      {catEmoji(cat)}
                    </div>
                    <div>
                      <h2 className="text-base font-extrabold text-white">{catLabel(cat)}</h2>
                      <span className="text-[9px] text-white/70">{catItems.length} صنف</span>
                    </div>
                  </div>

                  <div className="divide-y divide-gray-50">
                    {catItems.map((item, idx) => (
                      <div key={item.id} className="p-3">
                        <div className="flex gap-3 items-start">
                          {item.imageUrl ? (
                            <div className="relative flex-shrink-0">
                              <img src={item.imageUrl} alt={item.dishName} className="w-20 h-20 rounded-xl object-cover shadow-md" />
                              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white text-[8px] font-bold shadow-sm">
                                {idx + 1}
                              </div>
                            </div>
                          ) : (
                            <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center flex-shrink-0 border border-gray-100 relative">
                              <span className="text-3xl">{catEmoji(item.category)}</span>
                              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white text-[8px] font-bold shadow-sm">
                                {idx + 1}
                              </div>
                            </div>
                          )}
                          <div className="flex-1 min-w-0 py-0.5">
                            <h3 className="font-bold text-sm text-gray-900 mb-0.5">{item.dishName}</h3>
                            {item.description && (
                              <p className="text-[10px] text-gray-500 leading-relaxed mb-2">{item.description}</p>
                            )}
                            {item.price && (
                              <div className="inline-flex items-center gap-1 bg-gradient-to-l from-orange-500 to-amber-500 text-white rounded-full px-3 py-1 shadow-sm">
                                <span className="text-xs font-black">{item.price}</span>
                                <span className="text-[9px] opacity-80">ج.م</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center py-4 border-t border-gray-100">
              <p className="text-[10px] text-gray-400">تم الإنشاء بواسطة منشئ المنيو الذكي · ads-as.com</p>
            </div>
          </div>

          <div className="bg-background p-4 border-t flex gap-2">
            <Button variant="outline" className="flex-1 gap-1 rounded-xl text-xs" onClick={() => setShowPreview(false)} data-testid="btn-close-preview">
              <X className="w-3.5 h-3.5" /> إغلاق
            </Button>
            {menuUrl && (
              <Button
                variant="outline"
                className="flex-1 gap-1 rounded-xl text-xs"
                onClick={() => window.open(menuUrl, "_blank")}
                data-testid="btn-open-public"
              >
                <ExternalLink className="w-3.5 h-3.5" /> فتح الرابط العام
              </Button>
            )}
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

      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="max-w-sm w-full rounded-2xl p-0 overflow-hidden border-0">
          <div className="bg-white p-6 text-center" dir="rtl">
            <div className="mb-4">
              <QrCode className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <h2 className="text-lg font-black text-gray-900">QR Code للمنيو</h2>
              <p className="text-xs text-gray-500 mt-1">اطبع الكود وحطّه على الطاولات أو عند الباب</p>
            </div>

            {menuUrl && (
              <div className="flex flex-col items-center gap-4">
                <div className="bg-white p-4 rounded-2xl border-2 border-gray-100 shadow-lg inline-block">
                  <QRCodeSVG
                    value={menuUrl}
                    size={200}
                    level="H"
                    includeMargin
                    bgColor="#ffffff"
                    fgColor="#1a1a1a"
                  />
                </div>

                <div className="text-center">
                  <p className="text-sm font-bold text-gray-800 mb-1">{restaurantName || "المنيو الرقمي"}</p>
                  {restaurantSlogan && <p className="text-[10px] text-gray-400">{restaurantSlogan}</p>}
                </div>

                <div className="w-full bg-gray-50 rounded-xl p-3 flex items-center gap-2">
                  <input
                    type="text"
                    value={menuUrl}
                    readOnly
                    className="flex-1 bg-transparent text-xs text-gray-600 outline-none text-left"
                    dir="ltr"
                    data-testid="input-menu-url"
                  />
                  <button
                    onClick={copyLink}
                    className="flex items-center gap-1 bg-primary text-white rounded-lg px-3 py-1.5 text-xs font-bold hover:bg-primary/90 transition-colors"
                    data-testid="btn-copy-link"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "تم!" : "نسخ"}
                  </button>
                </div>

                <div className="w-full space-y-2">
                  <Button
                    variant="outline"
                    className="w-full gap-2 rounded-xl text-xs"
                    onClick={() => window.open(menuUrl, "_blank")}
                    data-testid="btn-open-menu-link"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> فتح المنيو في تاب جديد
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full gap-2 rounded-xl text-xs"
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({ title: restaurantName + " - منيو", url: menuUrl });
                      } else {
                        copyLink();
                      }
                    }}
                    data-testid="btn-share-menu"
                  >
                    <Share2 className="w-3.5 h-3.5" /> مشاركة الرابط
                  </Button>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-xl p-3 w-full">
                  <p className="text-[11px] text-green-700 font-bold text-center">
                    اطبع الـ QR Code وحطّه على طاولات المطعم — الزبون يمسح بموبايله ويشوف المنيو فوراً!
                  </p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showMyMenus} onOpenChange={setShowMyMenus}>
        <DialogContent className="max-w-md w-full rounded-2xl p-0 overflow-hidden border-0 max-h-[80vh] overflow-y-auto">
          <div className="p-5" dir="rtl">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <List className="w-5 h-5 text-primary" />
              منيوهاتي المحفوظة
            </h2>

            {loadingMenus ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : myMenus.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <ChefHat className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">لا يوجد منيوهات محفوظة بعد</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myMenus.map(menu => {
                  let menuItems: MenuItem[] = [];
                  try { menuItems = typeof menu.items === "string" ? JSON.parse(menu.items as any) : (menu.items || []); } catch { menuItems = []; }
                  return (
                    <div key={menu.id} className="border rounded-xl p-3 bg-muted/20 hover:bg-muted/40 transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="font-bold text-sm">{menu.restaurant_name || "بدون اسم"}</h3>
                          <p className="text-[10px] text-muted-foreground">
                            {menuItems?.length || 0} طبق · {menu.views_count || 0} مشاهدة
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => loadMenu(menu)}
                            className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20"
                            data-testid={`btn-load-menu-${menu.id}`}
                          >
                            <ArrowRight className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => window.open(`/m/${menu.slug}`, "_blank")}
                            className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center hover:bg-green-200"
                            data-testid={`btn-view-menu-${menu.id}`}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteMenu(menu.id)}
                            className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center hover:bg-red-200"
                            data-testid={`btn-delete-menu-${menu.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
