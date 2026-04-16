import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { Loader2, ChefHat, Eye, MapPin, Phone, Clock, Star } from "lucide-react";

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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50">
      <div className="relative">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow-xl shadow-orange-200 animate-pulse">
          <ChefHat className="w-10 h-10 text-white" />
        </div>
      </div>
      <p className="mt-4 text-sm text-gray-400 font-medium">جاري تحميل المنيو...</p>
    </div>
  );

  if (error || !menu) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50">
      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <ChefHat className="w-10 h-10 text-gray-300" />
      </div>
      <h1 className="text-xl font-bold text-gray-800 mb-2">المنيو غير موجود</h1>
      <p className="text-gray-400 text-sm">{error || "تأكد من الرابط وحاول مرة أخرى"}</p>
      <a href="/" className="mt-4 bg-orange-500 text-white px-6 py-2 rounded-full text-sm font-bold hover:bg-orange-600 transition-colors shadow-lg shadow-orange-200">
        العودة للرئيسية
      </a>
    </div>
  );

  let items: MenuItem[] = [];
  try {
    items = typeof menu.items === "string" ? JSON.parse(menu.items) : (menu.items || []);
  } catch { items = []; }

  const catEmoji = (key: string) => CATEGORIES.find(c => c.key === key)?.emoji || "🍽️";
  const catLabel = (key: string) => CATEGORIES.find(c => c.key === key)?.label || "";
  const catColor = (key: string) => CATEGORIES.find(c => c.key === key)?.color || "from-gray-400 to-gray-500";

  const groupedItems = items.reduce<Record<string, MenuItem[]>>((acc, item) => {
    const cat = item.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const restaurantName = menu.restaurant_name || menu.restaurantName || "قائمة الطعام";
  const restaurantSlogan = menu.restaurant_slogan || menu.restaurantSlogan || "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/50 via-white to-amber-50/50" dir="rtl">
      <div className="max-w-lg mx-auto">

        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500"></div>
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-4 right-8 text-6xl opacity-30">🍽️</div>
            <div className="absolute bottom-4 left-8 text-4xl opacity-20">✨</div>
            <div className="absolute top-12 left-16 text-3xl opacity-20">🌟</div>
          </div>
          <div className="relative px-6 py-10 text-center">
            <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 shadow-lg border-2 border-white/30">
              <span className="text-4xl">🍽️</span>
            </div>
            <h1 className="text-3xl font-black text-white mb-1 drop-shadow-lg">
              {restaurantName}
            </h1>
            {restaurantSlogan && (
              <p className="text-sm text-white/80 font-medium">{restaurantSlogan}</p>
            )}
            <div className="flex items-center justify-center gap-4 mt-4">
              <div className="flex items-center gap-1 text-white/60 text-[10px]">
                <Eye className="w-3 h-3" />
                <span>{menu.views_count || menu.viewsCount || 0} مشاهدة</span>
              </div>
              <div className="flex items-center gap-1 text-white/60 text-[10px]">
                <Star className="w-3 h-3" />
                <span>{items.length} صنف</span>
              </div>
            </div>
          </div>
          <div className="h-6 bg-gradient-to-br from-orange-50/50 via-white to-amber-50/50 rounded-t-[2rem]"></div>
        </div>

        <div className="px-4 pb-8 -mt-2 space-y-8">
          {Object.entries(groupedItems).map(([cat, catItems]) => (
            <div key={cat} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className={`bg-gradient-to-l ${catColor(cat)} px-5 py-3 flex items-center gap-3`}>
                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-xl shadow-sm">
                  {catEmoji(cat)}
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-white">{catLabel(cat)}</h2>
                  <span className="text-[10px] text-white/70 font-medium">{catItems.length} صنف</span>
                </div>
              </div>

              <div className="divide-y divide-gray-50">
                {catItems.map((item, idx) => (
                  <div key={item.id} className="p-4 hover:bg-orange-50/30 transition-colors">
                    <div className="flex gap-4 items-start">
                      {item.imageUrl ? (
                        <div className="relative flex-shrink-0">
                          <img
                            src={item.imageUrl}
                            alt={item.dishName}
                            className="w-28 h-28 rounded-2xl object-cover shadow-md"
                          />
                          <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white text-[9px] font-bold shadow-md">
                            {idx + 1}
                          </div>
                        </div>
                      ) : (
                        <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center flex-shrink-0 border border-gray-100 shadow-sm relative">
                          <span className="text-4xl">{catEmoji(item.category)}</span>
                          <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white text-[9px] font-bold shadow-md">
                            {idx + 1}
                          </div>
                        </div>
                      )}

                      <div className="flex-1 min-w-0 py-1">
                        <h3 className="font-bold text-base text-gray-900 mb-1">{item.dishName}</h3>
                        {item.description && (
                          <p className="text-xs text-gray-500 leading-relaxed mb-3">{item.description}</p>
                        )}
                        {item.price && (
                          <div className="inline-flex items-center gap-1 bg-gradient-to-l from-orange-500 to-amber-500 text-white rounded-full px-4 py-1.5 shadow-sm">
                            <span className="text-sm font-black">{item.price}</span>
                            <span className="text-[10px] font-medium opacity-80">ج.م</span>
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

        <div className="bg-white border-t border-gray-100 py-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center">
              <ChefHat className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-xs font-bold text-gray-600">منشئ المنيو الذكي</span>
          </div>
          <a href="/" className="text-[10px] text-gray-400 hover:text-orange-500 transition-colors block">
            شبكة سوق للإعلانات · ads-as.com
          </a>
          <a
            href="/menu-generator"
            className="inline-flex items-center gap-1 mt-3 bg-gradient-to-l from-orange-500 to-amber-500 text-white rounded-full px-5 py-2 text-[11px] font-bold shadow-lg shadow-orange-200 hover:shadow-xl hover:shadow-orange-300 transition-all"
          >
            <ChefHat className="w-3.5 h-3.5" />
            اصنع منيو لمطعمك مجاناً
          </a>
        </div>
      </div>
    </div>
  );
}
