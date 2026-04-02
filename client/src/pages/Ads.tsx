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
  const initialQ = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("q") ?? "" : "";
  const [search, setSearch] = useState(initialQ);
  const [selectedCat, setSelectedCat] = useState("الكل");

  const { data: allAds = [], isLoading: adsLoading } = useQuery<any[]>({
    queryKey: ["/api/ads"],
    queryFn: () => fetch("/api/ads").then(r => r.json()),
  });

  const { data: searchResults = [], isFetching: searchFetching } = useQuery<any[]>({
    queryKey: ["/api/ads/search", search],
    queryFn: () => fetch(`/api/ads/search?q=${encodeURIComponent(search)}`).then(r => r.json()),
    enabled: search.trim().length >= 2,
  });

  const isLoading = adsLoading;
  const ads = search.trim().length >= 2 ? searchResults : allAds;

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
    if (selectedCat !== "الكل" && ad.category && !ad.category.includes(selectedCat)) return false;
    return true;
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
              placeholder="ابحث عن إعلان... (اكتب 2 حروف فأكثر)"
              className="pr-9 h-10 rounded-xl"
              data-testid="input-search-ads"
            />
            {searchFetching && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground animate-pulse">جاري البحث...</span>
            )}
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
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
          data-testid="sponsored-ad-banner"
        >
          {/* Label */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1.5 bg-gradient-to-r from-yellow-500 to-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md shadow-yellow-300/40">
              <Star className="w-3 h-3 fill-white" />
              إعلان ممول مميز
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-yellow-300/60 to-transparent dark:from-yellow-700/40" />
            <span className="text-xs text-muted-foreground">Sponsored</span>
          </div>

          {/* Card */}
          <div
            onClick={handleSponsoredClick}
            className="relative rounded-3xl overflow-hidden cursor-pointer group"
            style={{ boxShadow: "0 0 0 2px #f59e0b44, 0 8px 40px 0 #f59e0b22" }}
            data-testid="sponsored-ad-card"
          >
            {/* Gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-yellow-950/40 dark:via-amber-950/30 dark:to-orange-950/20" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#fbbf2422,transparent_60%)]" />

            {/* Shine effect on hover */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[linear-gradient(105deg,transparent_40%,#ffffff18_50%,transparent_60%)]" />

            <div className="relative flex flex-col md:flex-row">
              {/* Media */}
              {sponsoredAd.mediaUrl && (
                <div className="md:w-80 flex-shrink-0 overflow-hidden">
                  {sponsoredAd.mediaType === "video" ? (
                    <video
                      src={sponsoredAd.mediaUrl}
                      className="w-full h-52 md:h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      muted autoPlay loop playsInline
                    />
                  ) : (
                    <img
                      src={sponsoredAd.mediaUrl}
                      alt={sponsoredAd.name}
                      className="w-full h-52 md:h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                  )}
                  {/* Gold overlay strip */}
                  <div className="absolute top-0 right-0 bottom-0 w-1 bg-gradient-to-b from-yellow-400 via-amber-500 to-orange-400 md:block hidden" />
                </div>
              )}

              {/* Content */}
              <div className="flex-1 p-7 flex flex-col justify-between">
                <div>
                  {/* Top badges */}
                  <div className="flex items-center gap-2 mb-4">
                    <span className="inline-flex items-center gap-1.5 bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 text-xs font-bold px-3 py-1 rounded-full border border-yellow-400/40">
                      <Megaphone className="w-3 h-3" /> ممـوّل
                    </span>
                    {sponsoredAd.targetRegions?.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                        📍 {sponsoredAd.targetRegions.slice(0, 2).join("، ")}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="text-2xl font-extrabold mb-2 leading-snug group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors duration-300">
                    {sponsoredAd.name}
                  </h3>

                  {/* Description */}
                  {sponsoredAd.description && (
                    <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2 mb-5">
                      {sponsoredAd.description}
                    </p>
                  )}

                  {/* Stats row */}
                  <div className="flex items-center gap-5 text-sm mb-6">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="w-7 h-7 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-base">👁️</span>
                      <span><strong className="text-foreground">{(sponsoredAd.impressions || 0).toLocaleString()}</strong> مشاهدة</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-base">🎯</span>
                      <span><strong className="text-foreground">{(sponsoredAd.clicks || 0).toLocaleString()}</strong> نقرة</span>
                    </div>
                  </div>
                </div>

                {/* CTA Button */}
                <div className="flex items-center gap-3">
                  {sponsoredAd.targetUrl && (
                    <Button
                      size="default"
                      className="gap-2 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white border-0 shadow-lg shadow-yellow-400/30 hover:shadow-yellow-400/50 transition-all hover:-translate-y-0.5 font-bold"
                    >
                      <ExternalLink className="w-4 h-4" /> زيارة الآن
                    </Button>
                  )}
                  <span className="text-xs text-muted-foreground/60">إعلان مدفوع • سوق للإعلانات</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Regular Ads Separator */}
      {sponsoredAd && (
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs font-semibold text-muted-foreground px-3 py-1 rounded-full bg-muted border border-border">
            📋 الإعلانات العادية
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>
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
