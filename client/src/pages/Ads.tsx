import { useAds } from "@/hooks/use-ads";
import { useLanguage } from "@/components/LanguageProvider";
import { AdCard } from "@/components/AdCard";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { PlusCircle, LayoutGrid, Video, Search, Megaphone, ExternalLink, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";

const CATEGORIES = ["الكل", "عقارات", "سيارات", "إلكترونيات", "ملابس", "طعام", "صحة", "تعليم", "ترفيه"];

export default function Ads() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState("الكل");

  const { data: ads = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/ads"],
    queryFn: () => fetch("/api/ads").then(r => r.json()),
  });

  const { data: sponsoredAd } = useQuery<any>({
    queryKey: ["/api/campaigns/random"],
    queryFn: () => fetch("/api/campaigns/random").then(r => r.ok ? r.json() : null),
    retry: false,
  });

  const handleSponsoredClick = async () => {
    if (!sponsoredAd) return;
    await fetch(`/api/campaigns/${sponsoredAd.id}/click`, { method: "POST" });
    if (sponsoredAd.targetUrl) window.open(sponsoredAd.targetUrl, "_blank");
  };

  const filtered = ads.filter(ad => {
    const matchSearch = !search || 
      ad.title?.toLowerCase().includes(search.toLowerCase()) ||
      ad.description?.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  return (
    <div className="container px-4 py-10" dir="rtl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight mb-2">🗂️ لوحة الإعلانات</h1>
            <p className="text-muted-foreground text-base">
              تصفح جميع الإعلانات المنشورة على المنصة • {ads.length} إعلان
            </p>
          </div>
          <Link href="/create">
            <Button className="gap-2 h-11 px-6 shadow-lg shadow-primary/20" data-testid="btn-create-ad">
              <PlusCircle className="w-4 h-4" />
              أنشئ إعلاناً
            </Button>
          </Link>
        </div>

        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ابحث عن إعلان..."
              className="pr-9 h-10 rounded-xl"
              data-testid="input-search-ads"
            />
          </div>
        </div>

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

      {/* Sponsored Ad */}
      {sponsoredAd && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
          data-testid="sponsored-ad-banner"
        >
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            <span className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">إعلان ممول مميز</span>
            <div className="flex-1 h-px bg-yellow-200 dark:bg-yellow-800" />
          </div>
          <div
            onClick={handleSponsoredClick}
            className="relative rounded-2xl overflow-hidden border-2 border-yellow-400/60 bg-gradient-to-l from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 cursor-pointer hover:border-yellow-500 transition-all hover:shadow-lg hover:shadow-yellow-200/50 dark:hover:shadow-yellow-900/30 group"
            data-testid="sponsored-ad-card"
          >
            <div className="absolute top-3 right-3 z-10">
              <Badge className="bg-yellow-500 text-white border-0 text-xs font-bold px-3 gap-1 shadow-md">
                <Megaphone className="w-3 h-3" /> ممول
              </Badge>
            </div>
            <div className="flex flex-col md:flex-row gap-0">
              {sponsoredAd.mediaUrl && (
                <div className="md:w-72 flex-shrink-0">
                  {sponsoredAd.mediaType === "video" ? (
                    <video src={sponsoredAd.mediaUrl} className="w-full h-48 md:h-full object-cover" muted autoPlay loop playsInline />
                  ) : (
                    <img src={sponsoredAd.mediaUrl} alt={sponsoredAd.name} className="w-full h-48 md:h-full object-cover" />
                  )}
                </div>
              )}
              <div className="flex-1 p-6 flex flex-col justify-center">
                <h3 className="text-xl font-bold mb-2 group-hover:text-yellow-700 dark:group-hover:text-yellow-300 transition-colors">
                  {sponsoredAd.name}
                </h3>
                {sponsoredAd.description && (
                  <p className="text-muted-foreground text-sm mb-4 line-clamp-2">{sponsoredAd.description}</p>
                )}
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <span className="flex items-center gap-1">👁️ {(sponsoredAd.impressions || 0).toLocaleString()} مشاهدة</span>
                  {sponsoredAd.targetRegions?.length > 0 && (
                    <span className="flex items-center gap-1">📍 {sponsoredAd.targetRegions.slice(0, 2).join("، ")}</span>
                  )}
                </div>
                {sponsoredAd.targetUrl && (
                  <Button size="sm" className="w-fit gap-2 bg-yellow-500 hover:bg-yellow-600 text-white border-0">
                    <ExternalLink className="w-3 h-3" /> زيارة الرابط
                  </Button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Content tabs */}
      <div className="flex gap-3 mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LayoutGrid className="w-4 h-4" />
          <span>الإعلانات</span>
          <Badge variant="secondary">{filtered.length}</Badge>
        </div>
        <Link href="/reels">
          <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
            <Video className="w-4 h-4" />
            <span>الريلز</span>
          </div>
        </Link>
      </div>

      {isLoading ? (
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
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map((ad, i) => (
            <AdCard key={ad.id} ad={ad} index={i} />
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-28 text-center"
        >
          <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6 text-4xl">
            📭
          </div>
          <h2 className="text-2xl font-bold mb-2">
            {search ? "لا توجد نتائج" : "لا توجد إعلانات بعد"}
          </h2>
          <p className="text-muted-foreground mb-6">
            {search ? `لا يوجد إعلان يحتوي على "${search}"` : "كن أول من ينشر إعلاناً على المنصة!"}
          </p>
          {!search && (
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
