import { useAds } from "@/hooks/use-ads";
import { useLanguage } from "@/components/LanguageProvider";
import { AdCard } from "@/components/AdCard";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { PlusCircle, LayoutGrid, Video, Image, Search } from "lucide-react";
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
