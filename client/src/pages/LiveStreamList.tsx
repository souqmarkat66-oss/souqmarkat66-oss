import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useState, useMemo } from "react";
import {
  Radio, Eye, Play, Plus, Users, Clock,
  Share2, Heart, Flame, ChevronDown,
  Gamepad2, ShoppingBag, BookOpen, Utensils,
  Music, Activity, Sparkles, Newspaper, Globe, MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "الآن";
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
  return `منذ ${Math.floor(diff / 86400)} يوم`;
}

const CATEGORIES = [
  { key: "all",       label: "الكل",         icon: Globe },
  { key: "general",   label: "عام",          icon: MessageSquare },
  { key: "shopping",  label: "تسوق",         icon: ShoppingBag },
  { key: "gaming",    label: "ألعاب",        icon: Gamepad2 },
  { key: "education", label: "تعليم",        icon: BookOpen },
  { key: "cooking",   label: "طبخ",          icon: Utensils },
  { key: "music",     label: "موسيقى",       icon: Music },
  { key: "sports",    label: "رياضة",        icon: Activity },
  { key: "beauty",    label: "جمال",         icon: Sparkles },
  { key: "news",      label: "أخبار",        icon: Newspaper },
  { key: "lifestyle", label: "أسلوب حياة",  icon: Heart },
];

const SORT_OPTIONS = [
  { key: "viewers",       label: "الأكثر مشاهدين" },
  { key: "newest",        label: "الأحدث"         },
  { key: "least_viewers", label: "الأقل مشاهدين"  },
];

function categoryLabel(cat: string) {
  return CATEGORIES.find(c => c.key === cat)?.label || cat;
}

function StreamCard({ stream }: { stream: any }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isLive = stream.status === "live";

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/streams/${stream.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: stream.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: "تم نسخ الرابط", description: url });
      }
    } catch { }
  };

  return (
    <div
      className="group relative rounded-2xl overflow-hidden bg-zinc-900 border border-white/5 cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
      onClick={() => setLocation(`/streams/${stream.id}`)}
      data-testid={`card-stream-${stream.id}`}
    >
      <div className="relative aspect-[9/16] bg-gradient-to-br from-zinc-800 to-zinc-900 overflow-hidden">
        {stream.thumbnailUrl ? (
          <img src={stream.thumbnailUrl} alt={stream.title} className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${isLive ? "bg-red-500/20" : "bg-zinc-700/50"}`}>
              {isLive
                ? <Radio className="w-8 h-8 text-red-400 animate-pulse" />
                : <Play className="w-8 h-8 text-zinc-400" />}
            </div>
            <span className="text-zinc-500 text-xs">{categoryLabel(stream.category || "general")}</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

        {isLive && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-red-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-lg">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            مباشر
          </div>
        )}

        {isLive && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur text-white text-[11px] px-2 py-0.5 rounded-full">
            <Eye className="w-3 h-3" />
            {(stream.viewerCount || 0).toLocaleString()}
          </div>
        )}

        <div className="absolute bottom-0 inset-x-0 p-2.5">
          <p className="text-white font-bold text-sm leading-tight line-clamp-2 mb-1">{stream.title}</p>
          {stream.channelName && (
            <p className="text-white/60 text-[11px] truncate">{stream.channelName}</p>
          )}
        </div>

        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl ${isLive ? "bg-red-500" : "bg-white/20 backdrop-blur"}`}>
            {isLive ? <Radio className="w-7 h-7 text-white" /> : <Play className="w-7 h-7 text-white" />}
          </div>
        </div>
      </div>

      <div className="p-2.5 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {stream.category && stream.category !== "general" && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                {categoryLabel(stream.category)}
              </Badge>
            )}
            {!isLive && stream.startedAt && (
              <span className="text-muted-foreground text-[10px] flex items-center gap-0.5">
                <Clock className="w-2.5 h-2.5" />
                {timeAgo(stream.startedAt)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 text-muted-foreground">
            {stream.likesCount > 0 && (
              <span className="flex items-center gap-0.5 text-[10px]">
                <Heart className="w-3 h-3 text-red-400 fill-red-400" />
                {stream.likesCount}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleShare}
          className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors flex-shrink-0"
          data-testid={`btn-share-stream-${stream.id}`}
        >
          <Share2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function LiveStreamList() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [activeCategory, setActiveCategory] = useState("all");
  const [sortBy, setSortBy] = useState("viewers");

  const { data: liveStreams = [], isLoading: loadingLive } = useQuery<any[]>({
    queryKey: ["/api/streams", "live"],
    queryFn: () => fetch("/api/streams?status=live", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 15000,
  });

  const { data: endedStreams = [], isLoading: loadingEnded } = useQuery<any[]>({
    queryKey: ["/api/streams", "ended"],
    queryFn: () => fetch("/api/streams?status=ended", { credentials: "include" }).then(r => r.json()),
  });

  const safeStreams = Array.isArray(liveStreams) ? liveStreams : [];
  const safeEnded  = Array.isArray(endedStreams) ? endedStreams : [];

  const sortStreams = (arr: any[]) => {
    const copy = [...arr];
    if (sortBy === "viewers")       return copy.sort((a, b) => (b.viewerCount || 0) - (a.viewerCount || 0));
    if (sortBy === "newest")        return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (sortBy === "least_viewers") return copy.sort((a, b) => (a.viewerCount || 0) - (b.viewerCount || 0));
    return copy;
  };

  const filteredLive = useMemo(() => {
    const filtered = activeCategory === "all" ? safeStreams : safeStreams.filter((s: any) => s.category === activeCategory);
    return sortStreams(filtered);
  }, [safeStreams, activeCategory, sortBy]);

  const filteredEnded = useMemo(() => {
    const filtered = activeCategory === "all" ? safeEnded : safeEnded.filter((s: any) => s.category === activeCategory);
    return sortStreams(filtered);
  }, [safeEnded, activeCategory, sortBy]);

  const totalViewers = safeStreams.reduce((s: number, st: any) => s + (st.viewerCount || 0), 0);
  const currentSortLabel = SORT_OPTIONS.find(o => o.key === sortBy)?.label || "الترتيب";

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Hero header */}
      <div className="bg-gradient-to-br from-red-600 via-red-500 to-orange-500 text-white px-4 py-8">
        <div className="container max-w-5xl mx-auto">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Radio className="w-5 h-5 animate-pulse flex-shrink-0" />
                <h1 className="text-xl font-bold">البث المباشر</h1>
              </div>
              <p className="text-red-100 text-sm">شاهد البثوث المباشرة وتفاعل مع المذيعين</p>
            </div>
            {user && (
              <Button
                onClick={() => setLocation("/stream/start")}
                className="bg-white text-red-600 hover:bg-red-50 font-bold gap-2 shadow-lg flex-shrink-0"
                data-testid="btn-start-stream"
              >
                <Plus className="w-4 h-4" />
                ابدأ بثاً
              </Button>
            )}
          </div>

          <div className="flex items-center gap-4 mt-5 flex-wrap">
            <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur rounded-full px-3 py-1.5">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="text-sm font-bold">{safeStreams.length} بث مباشر الآن</span>
            </div>
            {totalViewers > 0 && (
              <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur rounded-full px-3 py-1.5">
                <Users className="w-3.5 h-3.5" />
                <span className="text-sm font-bold">{totalViewers.toLocaleString()} مشاهد</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Filter bar ────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/40 shadow-sm">
        <div className="container max-w-5xl mx-auto px-4">
          <div className="flex items-center gap-2 py-2">
            {/* Category pills — scrollable */}
            <div className="flex items-center gap-1.5 overflow-x-auto flex-1 pb-1 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
              {CATEGORIES.map(cat => {
                const Icon = cat.icon;
                const isActive = activeCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    onClick={() => setActiveCategory(cat.key)}
                    data-testid={`filter-cat-${cat.key}`}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                      isActive
                        ? "bg-red-500 text-white shadow"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* Sort dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 flex-shrink-0 h-8 text-xs" data-testid="btn-sort-streams">
                  {currentSortLabel}
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[130px]">
                {SORT_OPTIONS.map(opt => (
                  <DropdownMenuItem
                    key={opt.key}
                    onClick={() => setSortBy(opt.key)}
                    className={sortBy === opt.key ? "font-semibold text-primary" : ""}
                    data-testid={`sort-${opt.key}`}
                  >
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="container max-w-5xl mx-auto px-4 py-6">

        {/* LIVE NOW */}
        {(loadingLive || filteredLive.length > 0) && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
              <h2 className="font-bold text-base">على الهواء الآن</h2>
              {!loadingLive && (
                <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900 text-xs">
                  {filteredLive.length}
                </Badge>
              )}
            </div>

            {loadingLive ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="rounded-2xl bg-zinc-100 dark:bg-zinc-800 aspect-[9/16] animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filteredLive.map((s: any) => <StreamCard key={s.id} stream={s} />)}
              </div>
            )}
          </section>
        )}

        {/* No live streams */}
        {!loadingLive && filteredLive.length === 0 && (
          <div className="text-center py-16 flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
              <Radio className="w-10 h-10 text-red-300 dark:text-red-700" />
            </div>
            <div>
              {activeCategory !== "all" ? (
                <>
                  <p className="font-bold text-lg text-foreground">لا يوجد بث في هذه الفئة الآن</p>
                  <p className="text-muted-foreground text-sm mt-1">جرب فئة أخرى أو شاهد الكل</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setActiveCategory("all")}>
                    عرض كل البثوث
                  </Button>
                </>
              ) : (
                <>
                  <p className="font-bold text-lg text-foreground">لا يوجد بث مباشر الآن</p>
                  <p className="text-muted-foreground text-sm mt-1">كن أول من يبث مباشراً على المنصة</p>
                  {user ? (
                    <Button
                      onClick={() => setLocation("/stream/start")}
                      className="bg-red-500 hover:bg-red-600 text-white gap-2 mt-3"
                      data-testid="btn-be-first-stream"
                    >
                      <Flame className="w-4 h-4" />
                      ابدأ البث الآن
                    </Button>
                  ) : (
                    <Button onClick={() => setLocation("/login")} variant="outline" className="mt-3" data-testid="btn-login-to-stream">
                      سجّل دخولك للبث
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* RECENT STREAMS */}
        {filteredEnded.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-bold text-base">بثوث سابقة</h2>
              <Badge variant="secondary" className="text-xs">{filteredEnded.length}</Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredEnded.slice(0, 8).map((s: any) => <StreamCard key={s.id} stream={s} />)}
            </div>
          </section>
        )}

        {/* CTA for non-users */}
        {!user && (
          <div className="mt-10 rounded-2xl bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 border border-red-200 dark:border-red-900/30 p-6 text-center">
            <Radio className="w-10 h-10 mx-auto mb-3 text-red-400" />
            <p className="font-bold text-base mb-1">سجّل دخولك وابدأ البث</p>
            <p className="text-muted-foreground text-sm mb-4">شارك محتواك مع آلاف المشاهدين وكسب من بثوثك</p>
            <Button onClick={() => setLocation("/login")} className="bg-red-500 hover:bg-red-600 text-white" data-testid="btn-cta-login">
              سجّل الدخول
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
