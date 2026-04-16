import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { Loader2, ChefHat, Eye } from "lucide-react";

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

const MENU_THEMES: Record<string, { bg: string; text: string; accent: string }> = {
  classic: { bg: "from-amber-900 to-amber-800", text: "text-amber-100", accent: "text-yellow-400" },
  modern: { bg: "from-gray-900 to-gray-800", text: "text-gray-100", accent: "text-blue-400" },
  elegant: { bg: "from-black to-gray-900", text: "text-white", accent: "text-yellow-300" },
  fresh: { bg: "from-green-800 to-emerald-900", text: "text-green-100", accent: "text-lime-400" },
  warm: { bg: "from-orange-800 to-red-900", text: "text-orange-100", accent: "text-yellow-300" },
};

interface MenuItem {
  id: string;
  dishName: string;
  price: string;
  description: string;
  category: string;
  imageUrl?: string;
  caption?: string;
}

export default function PublicMenu() {
  const [, params] = useRoute("/m/:slug");
  const slug = params?.slug;
  const [menu, setMenu] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/menus/public/${slug}`)
      .then(r => r.json())
      .then(data => {
        if (data.message) { setError(data.message); }
        else { setMenu(data); }
      })
      .catch(() => setError("حدث خطأ في تحميل المنيو"))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-950">
      <Loader2 className="w-10 h-10 animate-spin text-amber-400" />
    </div>
  );

  if (error || !menu) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-white">
      <ChefHat className="w-16 h-16 text-amber-400 mb-4" />
      <h1 className="text-2xl font-bold mb-2">المنيو غير موجود</h1>
      <p className="text-gray-400">{error || "تأكد من الرابط وحاول مرة أخرى"}</p>
      <a href="/" className="mt-4 text-amber-400 underline text-sm">العودة للرئيسية</a>
    </div>
  );

  let items: MenuItem[] = [];
  try {
    items = typeof menu.items === "string" ? JSON.parse(menu.items) : (menu.items || []);
  } catch { items = []; }
  const themeKey = menu.theme || "classic";
  const theme = MENU_THEMES[themeKey] || MENU_THEMES.classic;
  const catEmoji = (key: string) => CATEGORIES.find(c => c.key === key)?.emoji || "🍽️";
  const catLabel = (key: string) => CATEGORIES.find(c => c.key === key)?.label || "";

  const groupedItems = items.reduce<Record<string, MenuItem[]>>((acc, item) => {
    const cat = item.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div className={`min-h-screen bg-gradient-to-b ${theme.bg}`} dir="rtl">
      <div className="max-w-lg mx-auto">
        <div className="text-center py-10 px-6 border-b border-white/10">
          <div className="text-4xl mb-2">🍽️</div>
          <h1 className={`text-3xl font-black ${theme.text} mb-1`}>
            {menu.restaurant_name || menu.restaurantName || "قائمة الطعام"}
          </h1>
          {(menu.restaurant_slogan || menu.restaurantSlogan) && (
            <p className={`text-sm ${theme.accent} opacity-80`}>
              {menu.restaurant_slogan || menu.restaurantSlogan}
            </p>
          )}
          <div className={`mt-3 text-[10px] ${theme.text} opacity-40`}>— قائمة الطعام —</div>
          <div className={`flex items-center justify-center gap-1 mt-2 ${theme.text} opacity-30`}>
            <Eye className="w-3 h-3" />
            <span className="text-[10px]">{menu.views_count || menu.viewsCount || 0} مشاهدة</span>
          </div>
        </div>

        <div className="px-4 py-6 space-y-8">
          {Object.entries(groupedItems).map(([cat, catItems]) => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-2">
                <span className="text-2xl">{catEmoji(cat)}</span>
                <h2 className={`text-xl font-extrabold ${theme.accent}`}>{catLabel(cat)}</h2>
                <span className={`text-xs ${theme.text} opacity-40`}>({catItems.length})</span>
              </div>

              <div className="space-y-3">
                {catItems.map(item => (
                  <div key={item.id} className="flex gap-3 items-start bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.dishName} className="w-24 h-24 rounded-xl object-cover flex-shrink-0 shadow-lg" />
                    ) : (
                      <div className="w-24 h-24 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 text-3xl">
                        {catEmoji(item.category)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className={`font-bold text-base ${theme.text}`}>{item.dishName}</h3>
                        {item.price && (
                          <span className={`text-sm font-black ${theme.accent} whitespace-nowrap`}>{item.price} ج.م</span>
                        )}
                      </div>
                      {item.description && (
                        <p className={`text-xs ${theme.text} opacity-60 mt-1 leading-relaxed`}>{item.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className={`text-center py-6 border-t border-white/10 ${theme.text} opacity-40`}>
          <p className="text-xs">تم الإنشاء بواسطة منشئ المنيو الذكي</p>
          <a href="/" className="text-[10px] mt-1 block hover:opacity-70 transition-opacity">
            شبكة سوق للإعلانات · ads-as.com 🇪🇬
          </a>
        </div>
      </div>
    </div>
  );
}
