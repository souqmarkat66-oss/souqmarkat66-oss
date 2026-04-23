import { useLanguage } from "@/components/LanguageProvider";
import { AdCard } from "@/components/AdCard";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { PlusCircle, LayoutGrid, Video, Search, Megaphone, ExternalLink, Star, Globe, SlidersHorizontal, ChevronDown, ArrowUpDown, X } from "lucide-react";
import { TrendingAdsStrip } from "@/components/TrendingStrip";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CATEGORIES = ["الكل", "عقارات", "سيارات", "إلكترونيات", "ملابس", "طعام", "صحة", "تعليم", "ترفيه"];

const EGYPT_GOVS = [
  "القاهرة", "الجيزة", "الإسكندرية", "الدقهلية", "الشرقية", "المنوفية",
  "البحيرة", "كفر الشيخ", "الغربية", "دمياط", "مطروح", "السويس",
  "الإسماعيلية", "بورسعيد", "المنيا", "أسيوط", "سوهاج", "قنا",
  "الأقصر", "أسوان", "الفيوم", "بني سويف", "شمال سيناء", "جنوب سيناء",
  "البحر الأحمر", "الوادي الجديد",
];

// كل صفحة من صفحات المنصة مع كلماتها المفتاحية
const PLATFORM_PAGES = [
  {
    href: "https://ads-as.com/ads",
    icon: "🗂️",
    title: "الإعلانات المبوبة",
    titleEn: "Classified Ads",
    desc: "تصفح جميع الإعلانات المنشورة على المنصة",
    descEn: "Browse all ads published on the platform",
    path: "ads-as.com/ads",
    keywords: ["ads", "ad", "إعلان", "إعلانات", "مبوبة", "classified", "نشر", "بيع", "شراء", "سوق", "souq", "asouq", "شبكة", "منصة", "مصر", "egypt", "ads-as", "adsas"],
  },
  {
    href: "https://ads-as.com/reels",
    icon: "🎬",
    title: "الريلز الإعلانية",
    titleEn: "Ad Reels",
    desc: "فيديوهات قصيرة للإعلانات — شاهد وتفاعل",
    descEn: "Short ad videos — watch and interact",
    path: "ads-as.com/reels",
    keywords: ["ريلز", "reels", "reel", "فيديو", "video", "قصير", "short", "تيك", "tik"],
  },
  {
    href: "https://ads-as.com/channels",
    icon: "📺",
    title: "القنوات الرقمية",
    titleEn: "Digital Channels",
    desc: "اشترك في قنوات المعلنين وتابع محتواهم",
    descEn: "Subscribe to advertiser channels and follow their content",
    path: "ads-as.com/channels",
    keywords: ["قناة", "قنوات", "channel", "channels", "اشتراك", "subscribe", "محتوى", "ناشر"],
  },
  {
    href: "https://ads-as.com/livestream",
    icon: "🔴",
    title: "البث المباشر",
    titleEn: "Live Stream",
    desc: "شاهد أو ابدأ بثاً مباشراً الآن",
    descEn: "Watch or start a live broadcast now",
    path: "ads-as.com/livestream",
    keywords: ["بث", "مباشر", "live", "livestream", "stream", "streaming"],
  },
  {
    href: "https://ads-as.com/campaigns",
    icon: "📣",
    title: "الحملات الإعلانية",
    titleEn: "Ad Campaigns",
    desc: "أطلق حملتك الإعلانية واستهدف جمهورك",
    descEn: "Launch your ad campaign and target your audience",
    path: "ads-as.com/campaigns",
    keywords: ["حملة", "حملات", "campaign", "campaigns", "ممول", "sponsored", "تسويق", "marketing", "ترويج"],
  },
  {
    href: "https://ads-as.com/coupons",
    icon: "🎟️",
    title: "الكوبونات والخصومات",
    titleEn: "Coupons & Discounts",
    desc: "احصل على أفضل كوبونات الخصم المصرية",
    descEn: "Get the best Egyptian discount coupons",
    path: "ads-as.com/coupons",
    keywords: ["كوبون", "كوبونات", "coupon", "coupons", "خصم", "discount", "offer", "عرض", "تخفيض"],
  },
  {
    href: "https://ads-as.com/store",
    icon: "🛒",
    title: "المتجر الرقمي",
    titleEn: "Digital Store",
    desc: "اشترِ وبِع المنتجات عبر المنصة",
    descEn: "Buy and sell products through the platform",
    path: "ads-as.com/store",
    keywords: ["متجر", "store", "shop", "تسوق", "shopping", "منتج", "product"],
  },
  {
    href: "https://ads-as.com/create",
    icon: "✏️",
    title: "أنشئ إعلانك",
    titleEn: "Create Your Ad",
    desc: "انشر إعلانك على المنصة مجاناً الآن",
    descEn: "Post your ad on the platform for free now",
    path: "ads-as.com/create",
    keywords: ["إنشاء", "create", "new", "جديد", "نشر", "publish", "اضافة", "add"],
  },
];

const ALL_PLATFORM_KEYWORDS = Array.from(new Set(PLATFORM_PAGES.flatMap(p => p.keywords)));

function getMatchedPages(query: string) {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];
  return PLATFORM_PAGES.filter(p =>
    p.keywords.some(kw => q.includes(kw.toLowerCase()) || kw.toLowerCase().includes(q))
  );
}

function PlatformCard({ query }: { query: string }) {
  const matched = getMatchedPages(query);
  const primary = matched[0];
  const others = PLATFORM_PAGES.filter(p => p !== primary).slice(0, 6);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 rounded-2xl overflow-hidden border border-primary/30 bg-gradient-to-br from-primary/8 via-violet-50/60 to-purple-50/40 dark:from-primary/15 dark:via-violet-950/20 dark:to-purple-950/10"
      data-testid="platform-search-card"
    >
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0 shadow shadow-primary/30">
          <Globe className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm text-foreground">شبكة سوق للإعلانات</span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground font-medium">Souq Ads Network</span>
          </div>
          <p className="text-xs text-primary/70">ads-as.com</p>
        </div>
        <Badge className="bg-primary/15 text-primary border-primary/25 text-xs flex-shrink-0">🏆 Official</Badge>
      </div>
      {primary && (
        <a href={primary.href} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 mx-3 mb-2 p-3 rounded-xl bg-white/70 dark:bg-white/5 border border-primary/20 hover:border-primary/50 hover:bg-white dark:hover:bg-white/10 transition-all group">
          <span className="text-2xl flex-shrink-0">{primary.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-foreground">{primary.title}</p>
            <p className="text-xs text-muted-foreground">{primary.desc}</p>
            <div className="mt-1 pt-1 border-t border-border/50">
              <p className="font-semibold text-xs text-foreground/80" dir="ltr">{primary.titleEn}</p>
              <p className="text-xs text-muted-foreground/80" dir="ltr">{primary.descEn}</p>
            </div>
            <p className="text-xs text-primary/60 mt-1" dir="ltr">{primary.path}</p>
          </div>
          <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
        </a>
      )}
      <div className="flex flex-wrap gap-2 px-3 pb-3 pt-1">
        {(primary ? others : PLATFORM_PAGES.slice(0, 7)).map(page => (
          <a key={page.href} href={page.href} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/60 dark:bg-white/5 border border-border hover:border-primary/40 hover:bg-white dark:hover:bg-white/10 transition-all text-xs font-medium text-foreground">
            <span>{page.icon}</span>
            <span>{page.title}</span>
            <span className="text-muted-foreground mx-0.5">·</span>
            <span className="text-muted-foreground" dir="ltr">{page.titleEn}</span>
          </a>
        ))}
      </div>
    </motion.div>
  );
}

const SORT_OPTIONS = [
  { value: "boost",      label: "المميز أولاً" },
  { value: "newest",     label: "الأحدث" },
  { value: "oldest",     label: "الأقدم" },
  { value: "price_asc",  label: "السعر: الأقل" },
  { value: "price_desc", label: "السعر: الأعلى" },
  { value: "views",      label: "الأكثر مشاهدة" },
];

export default function Ads() {
  const { t } = useLanguage();
  const initialQ = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("q") ?? "" : "";

  const [search, setSearch]       = useState(initialQ);
  const [selectedCat, setSelectedCat] = useState("الكل");
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy]       = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("sort") || "boost";
  });
  const [region, setRegion]       = useState("");
  const [priceMin, setPriceMin]   = useState("");
  const [priceMax, setPriceMax]   = useState("");
  const [mediaType, setMediaType] = useState("");

  // ── Build query string ──
  const buildQS = useCallback((page = 1) => {
    const p = new URLSearchParams({ page: String(page), limit: "20", sortBy });
    if (region)    p.set("region", region);
    if (priceMin)  p.set("priceMin", priceMin);
    if (priceMax)  p.set("priceMax", priceMax);
    if (mediaType) p.set("mediaType", mediaType);
    return p.toString();
  }, [sortBy, region, priceMin, priceMax, mediaType]);

  // ── Paginated fetch ──
  const {
    data: pages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: adsLoading,
  } = useInfiniteQuery({
    queryKey: ["/api/ads/paginated", sortBy, region, priceMin, priceMax, mediaType],
    queryFn: ({ pageParam = 1 }) =>
      fetch(`/api/ads?${buildQS(pageParam as number)}`).then(r => r.json()),
    getNextPageParam: (last: any) => last.hasMore ? last.page + 1 : undefined,
    initialPageParam: 1,
  });

  const allAds: any[] = pages?.pages.flatMap((p: any) => p.ads || []) ?? [];
  const total: number = pages?.pages[0]?.total ?? 0;

  // ── Search ──
  const { data: searchResults = [], isFetching: searchFetching } = useQuery<any[]>({
    queryKey: ["/api/ads/search", search],
    queryFn: () => fetch(`/api/ads/search?q=${encodeURIComponent(search)}`).then(r => r.json()),
    enabled: search.trim().length >= 2,
  });

  const isSearching = search.trim().length >= 2;
  const rawAds = isSearching ? searchResults : allAds;

  const filtered = rawAds.filter(ad => {
    if (selectedCat !== "الكل" && ad.category && !ad.category.includes(selectedCat)) return false;
    return true;
  });

  const showPlatformCard = isSearching &&
    ALL_PLATFORM_KEYWORDS.some(kw =>
      search.toLowerCase().includes(kw.toLowerCase()) || kw.toLowerCase().includes(search.toLowerCase())
    );

  const { data: sponsoredAd } = useQuery<any>({
    queryKey: ["/api/campaigns/random"],
    queryFn: () => fetch("/api/campaigns/random").then(r => r.ok ? r.json() : null),
    retry: false,
  });

  const hasActiveFilters = region || priceMin || priceMax || mediaType || sortBy !== "boost";

  const clearFilters = () => {
    setRegion(""); setPriceMin(""); setPriceMax(""); setMediaType(""); setSortBy("boost");
  };

  return (
    <div className="container px-4 py-10" dir="rtl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight mb-2">🗂️ لوحة الإعلانات</h1>
            <p className="text-muted-foreground text-base">
              {isSearching
                ? `${filtered.length} نتيجة للبحث`
                : `${total.toLocaleString()} إعلان على المنصة`}
            </p>
          </div>
          <Link href="/create">
            <Button className="gap-2 h-11 px-6 shadow-lg shadow-primary/20" data-testid="btn-create-ad">
              <PlusCircle className="w-4 h-4" />
              أنشئ إعلاناً
            </Button>
          </Link>
        </div>

        {/* Search + Filter toggle */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ابحث عن إعلان... (اكتب 2 حروف فأكثر)"
              className="pr-9 h-10 rounded-xl"
              data-testid="input-search-ads"
            />
            {searchFetching && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground animate-pulse">جاري البحث...</span>
            )}
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(f => !f)}
            className={`gap-2 h-10 px-4 rounded-xl flex-shrink-0 ${hasActiveFilters ? "border-primary text-primary" : ""}`}
            data-testid="btn-toggle-filters"
          >
            <SlidersHorizontal className="w-4 h-4" />
            فلاتر
            {hasActiveFilters && <Badge className="bg-primary text-white text-xs h-4 w-4 p-0 flex items-center justify-center rounded-full">!</Badge>}
          </Button>
        </div>

        {/* Advanced Filters Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-muted/50 rounded-2xl p-4 mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Sort */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">الترتيب</label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="h-9 rounded-lg text-sm" data-testid="select-sort">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Region */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">المحافظة</label>
                  <Select value={region || "__all__"} onValueChange={v => setRegion(v === "__all__" ? "" : v)}>
                    <SelectTrigger className="h-9 rounded-lg text-sm" data-testid="select-region">
                      <SelectValue placeholder="كل المحافظات" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">كل المحافظات</SelectItem>
                      {EGYPT_GOVS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Media type */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">نوع المحتوى</label>
                  <Select value={mediaType || "__all__"} onValueChange={v => setMediaType(v === "__all__" ? "" : v)}>
                    <SelectTrigger className="h-9 rounded-lg text-sm" data-testid="select-media-type">
                      <SelectValue placeholder="الكل" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">الكل</SelectItem>
                      <SelectItem value="image">صور فقط 🖼️</SelectItem>
                      <SelectItem value="video">فيديو فقط 🎬</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Price range */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">نطاق السعر (جنيه)</label>
                  <div className="flex gap-1">
                    <Input
                      type="number"
                      placeholder="من"
                      value={priceMin}
                      onChange={e => setPriceMin(e.target.value)}
                      className="h-9 rounded-lg text-sm"
                      data-testid="input-price-min"
                    />
                    <Input
                      type="number"
                      placeholder="إلى"
                      value={priceMax}
                      onChange={e => setPriceMax(e.target.value)}
                      className="h-9 rounded-lg text-sm"
                      data-testid="input-price-max"
                    />
                  </div>
                </div>

                {/* Clear filters */}
                {hasActiveFilters && (
                  <div className="col-span-2 md:col-span-4 flex justify-end">
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-xs h-7">
                      <X className="w-3 h-3" /> مسح الفلاتر
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Category pills */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCat(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                selectedCat === cat
                  ? "bg-primary text-white border-primary"
                  : "bg-muted border-border hover:border-primary/50"
              }`}
              data-testid={`filter-cat-${cat}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Trending Ads Strip */}
      {!isSearching && (
        <div className="mb-8 p-4 bg-muted/30 rounded-2xl border border-border/30">
          <TrendingAdsStrip />
        </div>
      )}

      {/* Sponsored Ad */}
      {sponsoredAd && !isSearching && (
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-10" data-testid="sponsored-ad-banner">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1.5 bg-gradient-to-r from-yellow-500 to-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md shadow-yellow-300/40">
              <Star className="w-3 h-3 fill-white" />
              إعلان ممول مميز
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-yellow-300/60 to-transparent dark:from-yellow-700/40" />
            <span className="text-xs text-muted-foreground">Sponsored</span>
          </div>
          <div
            onClick={async () => { await fetch(`/api/campaigns/${sponsoredAd.id}/click`, { method: "POST" }); if (sponsoredAd.targetUrl) window.open(sponsoredAd.targetUrl, "_blank"); }}
            className="relative rounded-3xl overflow-hidden cursor-pointer group"
            style={{ boxShadow: "0 0 0 2px #f59e0b44, 0 8px 40px 0 #f59e0b22" }}
            data-testid="sponsored-ad-card"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-yellow-950/40 dark:via-amber-950/30 dark:to-orange-950/20" />
            <div className="relative flex flex-col md:flex-row">
              {sponsoredAd.mediaUrl && (
                <div className="md:w-80 flex-shrink-0 overflow-hidden">
                  {sponsoredAd.mediaType === "video"
                    ? <video src={sponsoredAd.mediaUrl} className="w-full h-52 md:h-full object-cover group-hover:scale-105 transition-transform duration-700" muted autoPlay loop playsInline />
                    : <img src={sponsoredAd.mediaUrl} alt={sponsoredAd.name} className="w-full h-52 md:h-full object-cover group-hover:scale-105 transition-transform duration-700" />}
                </div>
              )}
              <div className="flex-1 p-7 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="inline-flex items-center gap-1.5 bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 text-xs font-bold px-3 py-1 rounded-full border border-yellow-400/40">
                      <Megaphone className="w-3 h-3" /> ممـوّل
                    </span>
                  </div>
                  <h3 className="text-2xl font-extrabold mb-2 leading-snug">{sponsoredAd.name}</h3>
                  {sponsoredAd.description && <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2 mb-5">{sponsoredAd.description}</p>}
                </div>
                {sponsoredAd.targetUrl && (
                  <Button size="default" className="gap-2 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white border-0 w-fit">
                    <ExternalLink className="w-4 h-4" /> زيارة الآن
                  </Button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Content header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LayoutGrid className="w-4 h-4" />
            <span>الإعلانات</span>
            <Badge variant="secondary">{isSearching ? filtered.length : total}</Badge>
          </div>
          <Link href="/reels">
            <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
              <Video className="w-4 h-4" />
              <span>الريلز</span>
            </div>
          </Link>
        </div>
        {/* Quick sort */}
        {!isSearching && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ArrowUpDown className="w-3 h-3" />
            <span>{SORT_OPTIONS.find(o => o.value === sortBy)?.label}</span>
          </div>
        )}
      </div>

      {/* Platform result card */}
      {showPlatformCard && <PlatformCard query={search} />}

      {/* Ads Grid */}
      {adsLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((ad, i) => (
              <AdCard key={ad.id} ad={ad} index={i} />
            ))}
          </div>

          {/* Load More */}
          {!isSearching && hasNextPage && (
            <div className="flex justify-center mt-10">
              <Button
                variant="outline"
                size="lg"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="gap-2 rounded-xl px-8"
                data-testid="btn-load-more"
              >
                {isFetchingNextPage ? (
                  <span className="animate-pulse">جاري التحميل...</span>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    تحميل المزيد
                  </>
                )}
              </Button>
            </div>
          )}

          {/* End of results */}
          {!isSearching && !hasNextPage && total > 20 && (
            <p className="text-center text-sm text-muted-foreground mt-8">
              تم عرض جميع الإعلانات ({total.toLocaleString()})
            </p>
          )}
        </>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-28 text-center"
        >
          <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6 text-4xl">📭</div>
          <h2 className="text-2xl font-bold mb-2">
            {isSearching ? "لا توجد نتائج" : "لا توجد إعلانات بعد"}
          </h2>
          <p className="text-muted-foreground mb-6">
            {isSearching
              ? `لا يوجد إعلان يحتوي على "${search}"`
              : hasActiveFilters
                ? "لا توجد إعلانات بهذه الفلاتر — جرّب تغيير الفلاتر"
                : "كن أول من ينشر إعلاناً على المنصة!"}
          </p>
          {hasActiveFilters && (
            <Button variant="outline" onClick={clearFilters} className="gap-2 mb-3">
              <X className="w-4 h-4" /> مسح الفلاتر
            </Button>
          )}
          {!isSearching && !hasActiveFilters && (
            <Link href="/create">
              <Button className="gap-2">
                <PlusCircle className="w-4 h-4" />
                أنشئ إعلانك الآن
              </Button>
            </Link>
          )}
        </motion.div>
      )}
    </div>
  );
}
