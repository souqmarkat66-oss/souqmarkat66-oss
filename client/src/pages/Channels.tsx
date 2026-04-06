import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  Users, Radio, Plus, Search, CheckCircle,
  SlidersHorizontal, X, TrendingUp, Eye,
  Star, Wifi, ShieldCheck, DollarSign, ArrowUpDown,
} from "lucide-react";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Channel } from "@shared/schema";

const CATEGORIES = [
  { value: "all", label: "الكل" },
  { value: "general", label: "عام" },
  { value: "products", label: "منتجات" },
  { value: "tech", label: "تقنية" },
  { value: "fashion", label: "موضة" },
  { value: "food", label: "طعام" },
  { value: "cars", label: "سيارات" },
  { value: "real-estate", label: "عقارات" },
];

const SORT_OPTIONS = [
  { value: "subscribers", label: "الأكثر متابعة", icon: <Users className="w-3.5 h-3.5" /> },
  { value: "views",       label: "الأكثر مشاهدة", icon: <Eye className="w-3.5 h-3.5" /> },
  { value: "newest",      label: "الأحدث",         icon: <Star className="w-3.5 h-3.5" /> },
];

type Filter = { live: boolean; verified: boolean; monetized: boolean };

export default function Channels() {
  const { user } = useAuth();
  const [search,      setSearch]      = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [category,    setCategory]    = useState("all");
  const [sortBy,      setSortBy]      = useState("subscribers");
  const [filters,     setFilters]     = useState<Filter>({ live: false, verified: false, monetized: false });

  const { data: channels, isLoading } = useQuery<Channel[]>({ queryKey: ["/api/channels"] });
  const { data: myChannel }           = useQuery<Channel | null>({ queryKey: ["/api/channels/mine"], enabled: !!user });
  const { data: streams }             = useQuery<any[]>({ queryKey: ["/api/streams"] });

  const liveChannelIds = useMemo(() =>
    new Set((streams || []).map((s: any) => s.channelId)),
    [streams]
  );

  const activeFilterCount = [
    filters.live, filters.verified, filters.monetized, category !== "all"
  ].filter(Boolean).length;

  const filtered = useMemo(() => {
    let list = (channels || []).filter(ch => {
      const q = search.toLowerCase();
      if (q && !ch.name.toLowerCase().includes(q) && !(ch.description || "").toLowerCase().includes(q)) return false;
      if (filters.live     && !liveChannelIds.has(ch.id)) return false;
      if (filters.verified && !ch.isVerified)             return false;
      if (filters.monetized && !ch.isMonetized)           return false;
      if (category !== "all" && ch.category !== category) return false;
      return true;
    });
    if (sortBy === "subscribers") list = [...list].sort((a, b) => (b.subscriberCount || 0) - (a.subscriberCount || 0));
    if (sortBy === "views")       list = [...list].sort((a, b) => (b.viewsCount       || 0) - (a.viewsCount       || 0));
    if (sortBy === "newest")      list = [...list].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return list;
  }, [channels, search, filters, category, sortBy, liveChannelIds]);

  const toggleFilter = (key: keyof Filter) =>
    setFilters(f => ({ ...f, [key]: !f[key] }));

  const resetFilters = () => {
    setFilters({ live: false, verified: false, monetized: false });
    setCategory("all");
    setSortBy("subscribers");
    setSearch("");
  };

  return (
    <div className="container px-4 py-10" dir="rtl">

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-5 mb-8"
      >
        <div>
          <h1 className="text-3xl font-extrabold mb-1 flex items-center gap-2">
            <span className="text-3xl">📺</span> القنوات
          </h1>
          <p className="text-muted-foreground">اكتشف القنوات المباشرة والمنتجين</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {user && !myChannel && (
            <Link href="/channels/create">
              <Button size="sm" className="gap-1.5 bg-primary text-white">
                <Plus className="w-3.5 h-3.5" /> إنشاء قناة
              </Button>
            </Link>
          )}
          {user && myChannel && (
            <Link href={`/channels/${myChannel.id}`}>
              <Button size="sm" variant="outline" className="gap-1.5">
                <Radio className="w-3.5 h-3.5 text-red-500" /> قناتي
              </Button>
            </Link>
          )}
          <Link href="/stream/start">
            <Button size="sm" className="gap-1.5 bg-red-500 hover:bg-red-600 text-white">
              <Radio className="w-3.5 h-3.5" /> بث مباشر
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* ── Search + Filter Toggle Row ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex gap-2 mb-3"
      >
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="ابحث عن قناة بالاسم أو الوصف..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="ps-10 h-10 rounded-xl border-border/60"
            data-testid="input-channel-search"
          />
          <AnimatePresence>
            {search && (
              <motion.button
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                onClick={() => setSearch("")}
                className="absolute end-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-muted flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
        <button
          onClick={() => setShowFilters(f => !f)}
          className={`relative flex items-center gap-1.5 px-4 h-10 rounded-xl border text-sm font-medium transition-all duration-200
            ${showFilters ? "bg-primary text-white border-primary shadow-md" : "bg-background border-border/60 hover:border-primary/50"}`}
          data-testid="btn-toggle-filters"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="hidden sm:inline">فلاتر</span>
          <AnimatePresence>
            {activeFilterCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-1.5 -end-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center"
              >
                {activeFilterCount}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </motion.div>

      {/* ── Filter Panel ── */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            key="filter-panel"
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="bg-muted/40 border border-border/50 rounded-2xl p-4 space-y-4">

              {/* Quick toggles */}
              <div>
                <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide">تصفية سريعة</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "live"      as keyof Filter, label: "مباشر الآن",  icon: <Wifi       className="w-3.5 h-3.5" />, color: "bg-red-500/10 border-red-500/40 text-red-600 dark:text-red-400" },
                    { key: "verified"  as keyof Filter, label: "موثّق",        icon: <ShieldCheck className="w-3.5 h-3.5" />, color: "bg-blue-500/10 border-blue-500/40 text-blue-600 dark:text-blue-400" },
                    { key: "monetized" as keyof Filter, label: "ممنتج",        icon: <DollarSign  className="w-3.5 h-3.5" />, color: "bg-green-500/10 border-green-500/40 text-green-600 dark:text-green-400" },
                  ].map(({ key, label, icon, color }) => (
                    <motion.button
                      key={key}
                      whileTap={{ scale: 0.94 }}
                      onClick={() => toggleFilter(key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all duration-200
                        ${filters[key] ? color + " shadow-sm" : "bg-background border-border/60 text-muted-foreground hover:border-primary/40"}`}
                      data-testid={`btn-filter-${key}`}
                    >
                      {icon} {label}
                      {filters[key] && (
                        <motion.span
                          initial={{ scale: 0, rotate: -90 }}
                          animate={{ scale: 1, rotate: 0 }}
                          className="w-3.5 h-3.5 rounded-full bg-current/20 flex items-center justify-center text-[9px] opacity-70"
                        >✓</motion.span>
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Category chips */}
              <div>
                <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide">الفئة</p>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map(cat => (
                    <motion.button
                      key={cat.value}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => setCategory(cat.value)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-all duration-200
                        ${category === cat.value
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-background border-border/60 text-muted-foreground hover:border-primary/40"}`}
                      data-testid={`btn-category-${cat.value}`}
                    >
                      {cat.label}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Sort */}
              <div>
                <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide">ترتيب حسب</p>
                <div className="flex flex-wrap gap-1.5">
                  {SORT_OPTIONS.map(opt => (
                    <motion.button
                      key={opt.value}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => setSortBy(opt.value)}
                      className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-all duration-200
                        ${sortBy === opt.value
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-background border-border/60 text-muted-foreground hover:border-primary/40"}`}
                      data-testid={`btn-sort-${opt.value}`}
                    >
                      {opt.icon} {opt.label}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Reset */}
              {activeFilterCount > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <button
                    onClick={resetFilters}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
                    data-testid="btn-reset-filters"
                  >
                    <X className="w-3.5 h-3.5" /> إعادة تعيين الفلاتر
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Active filter chips row ── */}
      <AnimatePresence>
        {(activeFilterCount > 0 || search) && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex flex-wrap items-center gap-2 mb-4"
          >
            <span className="text-xs text-muted-foreground">نتائج:</span>
            <motion.span
              key={filtered.length}
              initial={{ scale: 1.3 }}
              animate={{ scale: 1 }}
              className="text-xs font-bold text-primary"
            >
              {filtered.length} قناة
            </motion.span>
            {search && (
              <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">
                "{search}" <button onClick={() => setSearch("")}><X className="w-3 h-3" /></button>
              </span>
            )}
            {filters.live      && <span className="flex items-center gap-1 text-xs bg-red-500/10 text-red-600 rounded-full px-2 py-0.5">مباشر <button onClick={() => toggleFilter("live")}><X className="w-3 h-3" /></button></span>}
            {filters.verified  && <span className="flex items-center gap-1 text-xs bg-blue-500/10 text-blue-600 rounded-full px-2 py-0.5">موثق <button onClick={() => toggleFilter("verified")}><X className="w-3 h-3" /></button></span>}
            {filters.monetized && <span className="flex items-center gap-1 text-xs bg-green-500/10 text-green-600 rounded-full px-2 py-0.5">ممنتج <button onClick={() => toggleFilter("monetized")}><X className="w-3 h-3" /></button></span>}
            {category !== "all" && (
              <span className="flex items-center gap-1 text-xs bg-muted rounded-full px-2 py-0.5">
                {CATEGORIES.find(c => c.value === category)?.label}
                <button onClick={() => setCategory("all")}><X className="w-3 h-3" /></button>
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Grid ── */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-52 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-24"
        >
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-xl font-bold mb-2">لا توجد نتائج</h2>
          <p className="text-muted-foreground text-sm mb-4">جرّب تغيير الفلاتر أو كلمة البحث</p>
          {activeFilterCount > 0 && (
            <Button variant="outline" size="sm" onClick={resetFilters} className="gap-1.5">
              <X className="w-3.5 h-3.5" /> إعادة تعيين
            </Button>
          )}
        </motion.div>
      ) : (
        <motion.div
          layout
          className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
        >
          <AnimatePresence mode="popLayout">
            {filtered.map((ch, i) => {
              const isLive = liveChannelIds.has(ch.id);
              return (
                <motion.div
                  key={ch.id}
                  layout
                  initial={{ opacity: 0, scale: 0.92, y: 18 }}
                  animate={{ opacity: 1, scale: 1,    y: 0  }}
                  exit={{ opacity: 0, scale: 0.88, y: -10 }}
                  transition={{ delay: i * 0.04, duration: 0.25, ease: "easeOut" }}
                  whileHover={{ y: -4 }}
                >
                  <Link href={`/channels/${ch.id}`}>
                    <Card className={`cursor-pointer overflow-hidden rounded-2xl border transition-all duration-300 h-full
                      ${isLive ? "ring-2 ring-red-500/60 shadow-red-500/10 shadow-lg" : "hover:shadow-xl hover:border-primary/40"}`}>

                      {/* Banner */}
                      <div className="h-28 bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/20 relative overflow-hidden">
                        {ch.bannerUrl && (
                          <img src={ch.bannerUrl} className="w-full h-full object-cover" alt="" />
                        )}
                        {/* Shimmer overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />

                        {/* Live badge */}
                        {isLive && (
                          <motion.div
                            initial={{ scale: 0, rotate: -10 }}
                            animate={{ scale: 1, rotate: 0 }}
                            className="absolute top-2 end-2"
                          >
                            <Badge className="bg-red-500 text-white gap-1 text-[10px] px-2 py-0.5 shadow-md">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping inline-block" />
                              مباشر
                            </Badge>
                          </motion.div>
                        )}

                        {/* Monetized badge */}
                        {ch.isMonetized && (
                          <div className="absolute top-2 start-2">
                            <Badge className="bg-green-500 text-white text-[9px] px-1.5 py-0.5">💰 ممنتج</Badge>
                          </div>
                        )}
                      </div>

                      <CardContent className="p-4 -mt-6">
                        {/* Avatar + name */}
                        <div className="flex items-end gap-3 mb-3">
                          <div className="w-14 h-14 rounded-full border-4 border-background bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xl font-bold shadow-lg shrink-0 overflow-hidden">
                            {ch.avatarUrl
                              ? <img src={ch.avatarUrl} className="w-full h-full object-cover" alt="" />
                              : <span>{ch.name[0]?.toUpperCase()}</span>}
                          </div>
                          <div className="min-w-0 flex-1 pb-1">
                            <div className="flex items-center gap-1 flex-wrap">
                              <h3 className="font-bold text-sm leading-tight truncate">{ch.name}</h3>
                              {ch.isVerified && (
                                <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0" />
                              )}
                            </div>
                            {ch.description && (
                              <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{ch.description}</p>
                            )}
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-1.5 mt-1 pt-3 border-t border-border/40">
                          <div className="flex flex-col items-center gap-0.5 bg-primary/5 rounded-xl py-2">
                            <span className="text-sm font-extrabold text-primary leading-none">
                              {(ch.subscriberCount || 0).toLocaleString("ar-EG")}
                            </span>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Users className="w-2.5 h-2.5" /> مشترك
                            </span>
                          </div>
                          <div className="flex flex-col items-center gap-0.5 bg-muted/50 rounded-xl py-2">
                            <span className="text-sm font-extrabold leading-none">
                              {(ch.viewsCount || 0).toLocaleString("ar-EG")}
                            </span>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Eye className="w-2.5 h-2.5" /> مشاهدة
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
