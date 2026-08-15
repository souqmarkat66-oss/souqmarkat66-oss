import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useState, useMemo } from "react";
import {
  Radio, Eye, Play, Users, Clock, Share2, Heart,
  Search, Satellite, User, Armchair, Swords, LayoutGrid, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "الآن";
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
  return `منذ ${Math.floor(diff / 86400)} يوم`;
}

/* نوع البث — الكل / فردي / صالون 8 / تحديات PK */
const TYPE_FILTERS = [
  { key: "all",   label: "الكل",           icon: LayoutGrid },
  { key: "solo",  label: "بث فردي",        icon: User },
  { key: "salon", label: "صالون 8 كراسي",  icon: Armchair },
  { key: "pk",    label: "تحديات PK",      icon: Swords },
];

function streamType(s: any): "solo" | "salon" | "pk" {
  if (s.battleActive || s.streamType === "pk" || s.mode === "pk") return "pk";
  if (s.streamType === "salon" || s.mode === "salon" || (s.coHostCount || 0) >= 3) return "salon";
  return "solo";
}

function StreamCard({ stream, index }: { stream: any; index: number }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isLive = stream.status === "live";
  const type = streamType(stream);

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
      className="group relative rounded-2xl overflow-hidden bg-zinc-900/80 border border-white/5 cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98] lobby-fade-up"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
      onClick={() => setLocation(`/streams/${stream.id}`)}
      data-testid={`card-stream-${stream.id}`}
    >
      <div className="relative aspect-[9/16] bg-gradient-to-br from-zinc-800 to-zinc-950 overflow-hidden">
        {stream.thumbnailUrl ? (
          <img src={stream.thumbnailUrl} alt={stream.title} className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${isLive ? "bg-orange-500/15 ring-1 ring-orange-500/40" : "bg-zinc-800/60"}`}>
              {isLive
                ? <Radio className="w-8 h-8 text-orange-400 animate-pulse" />
                : <Play className="w-8 h-8 text-zinc-500" />}
            </div>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/30" />

        {isLive && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-gradient-to-l from-red-600 to-orange-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-lg shadow-red-900/40">
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

        {/* Type badge */}
        {isLive && (
          <div className="absolute top-9 right-2 flex items-center gap-1 bg-black/60 backdrop-blur text-orange-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-orange-500/25">
            {type === "pk" ? <Swords className="w-3 h-3" /> : type === "salon" ? <Armchair className="w-3 h-3" /> : <User className="w-3 h-3" />}
            {type === "pk" ? "تحدي PK" : type === "salon" ? "صالون" : "فردي"}
          </div>
        )}

        <div className="absolute bottom-0 inset-x-0 p-2.5">
          <p className="text-white font-bold text-sm leading-tight line-clamp-2 mb-1">{stream.title}</p>
          {stream.channelName && (
            <p className="text-orange-200/60 text-[11px] truncate">{stream.channelName}</p>
          )}
        </div>
      </div>

      <div className="p-2.5 flex items-center gap-2">
        <div className="flex-1 min-w-0 flex items-center gap-2 text-zinc-500">
          {!isLive && stream.startedAt && (
            <span className="text-[10px] flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              {timeAgo(stream.startedAt)}
            </span>
          )}
          {stream.likesCount > 0 && (
            <span className="flex items-center gap-0.5 text-[10px]">
              <Heart className="w-3 h-3 text-red-400 fill-red-400" />
              {stream.likesCount}
            </span>
          )}
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
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");

  const { data: liveStreams = [], isLoading: loadingLive } = useQuery<any[]>({
    queryKey: ["/api/streams", "live"],
    queryFn: () => fetch("/api/streams?status=live", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 15000,
  });

  const { data: endedStreams = [] } = useQuery<any[]>({
    queryKey: ["/api/streams", "ended"],
    queryFn: () => fetch("/api/streams?status=ended", { credentials: "include" }).then(r => r.json()),
  });

  const safeStreams = Array.isArray(liveStreams) ? liveStreams : [];
  const safeEnded = Array.isArray(endedStreams) ? endedStreams : [];

  /* أسماء البحث السريع — مشتقة من المذيعين الفعليين */
  const quickNames = useMemo(() => {
    const names = new Set<string>();
    [...safeStreams, ...safeEnded].forEach((s: any) => {
      const n = (s.channelName || "").trim();
      if (n) names.add(n);
    });
    return Array.from(names).slice(0, 8);
  }, [safeStreams, safeEnded]);

  const matchesSearch = (s: any) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (s.title || "").toLowerCase().includes(q) || (s.channelName || "").toLowerCase().includes(q);
  };

  const filteredLive = useMemo(() => {
    return safeStreams
      .filter(matchesSearch)
      .filter((s: any) => typeFilter === "all" || streamType(s) === typeFilter)
      .sort((a: any, b: any) => (b.viewerCount || 0) - (a.viewerCount || 0));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeStreams, typeFilter, search]);

  const filteredEnded = useMemo(() => {
    return safeEnded
      .filter(matchesSearch)
      .filter((s: any) => typeFilter === "all" || streamType(s) === typeFilter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeEnded, typeFilter, search]);

  const startStream = () => setLocation(user ? "/stream/start" : "/login");

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-white" dir="rtl"
      style={{ background: "radial-gradient(1200px 500px at 50% -100px, rgba(249,115,22,.10), transparent 60%), #09090b" }}>

      <div className="container max-w-5xl mx-auto px-4 py-5 flex flex-col gap-4">

        {/* ── Header card ── */}
        <div className="lobby-fade-up rounded-3xl bg-zinc-900/70 border border-white/5 px-4 py-4 flex items-center gap-3 flex-wrap backdrop-blur">
          <div className="w-11 h-11 rounded-2xl souq-glow-btn flex items-center justify-center flex-shrink-0">
            <Radio className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-[180px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-extrabold text-base">البث المباشر الحي (Live Streams)</h1>
              <span className="flex items-center gap-1 bg-gradient-to-l from-red-600 to-orange-500 text-[10px] font-bold px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                {safeStreams.length} بث متصل الآن
              </span>
            </div>
            <p className="text-white/40 text-xs mt-0.5">تصفح وابحث عن المذيعين والأصدقاء المتصلين مباشرة</p>
          </div>
          <button
            onClick={startStream}
            className="souq-glow-btn text-white font-bold text-sm px-5 py-2.5 rounded-full flex items-center gap-2 active:scale-95 transition-transform flex-shrink-0"
            data-testid="btn-start-stream"
          >
            <Radio className="w-4 h-4" />
            ابدأ بثك المباشر الآن
          </button>
        </div>

        {/* ── Search + filters card ── */}
        <div className="lobby-fade-up rounded-3xl bg-zinc-900/70 border border-white/5 px-4 py-4 flex flex-col gap-3 backdrop-blur" style={{ animationDelay: "80ms" }}>
          {/* Search input */}
          <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-full px-4 py-2.5 focus-within:border-orange-500/50 transition-colors">
            <Search className="w-4 h-4 text-white/40 flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ابحث بالاسم: أحمد، محمد، علي، محمود..."
              className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
              data-testid="input-search-streams"
            />
            {search && (
              <button onClick={() => setSearch("")} className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0" data-testid="btn-clear-search">
                <X className="w-3 h-3 text-white/60" />
              </button>
            )}
          </div>

          {/* Quick names */}
          {quickNames.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
              <span className="text-white/40 text-[11px] font-bold flex-shrink-0">بحث سريع:</span>
              {quickNames.map(name => (
                <button
                  key={name}
                  onClick={() => setSearch(name)}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap flex-shrink-0 border transition-all ${
                    search === name ? "bg-orange-500/20 border-orange-500/50 text-orange-300" : "bg-black/40 border-white/10 text-white/70 hover:border-orange-500/30"
                  }`}
                  data-testid={`btn-quick-name-${name}`}
                >
                  <Search className="w-2.5 h-2.5" />
                  {name}
                </button>
              ))}
            </div>
          )}

          {/* Type filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {TYPE_FILTERS.map(f => {
              const Icon = f.icon;
              const active = typeFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setTypeFilter(f.key)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0 border transition-all ${
                    active
                      ? "bg-gradient-to-l from-red-600 to-orange-500 border-orange-400/40 text-white shadow-lg shadow-orange-900/30"
                      : "bg-black/40 border-white/10 text-white/60 hover:text-white hover:border-white/25"
                  }`}
                  data-testid={`filter-type-${f.key}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Live grid ── */}
        {loadingLive ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-2xl bg-zinc-900 aspect-[9/16] animate-pulse" />
            ))}
          </div>
        ) : filteredLive.length > 0 ? (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
              <h2 className="font-bold text-sm">على الهواء الآن</h2>
              <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/30 text-xs">{filteredLive.length}</Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredLive.map((s: any, i: number) => <StreamCard key={s.id} stream={s} index={i} />)}
            </div>
          </section>
        ) : (
          /* ── Empty state ── */
          <div className="lobby-fade-up rounded-3xl bg-zinc-900/60 border border-white/5 py-14 px-6 flex flex-col items-center gap-4 text-center backdrop-blur" style={{ animationDelay: "140ms" }}>
            <div className="w-16 h-16 rounded-full bg-black/50 border border-orange-500/25 flex items-center justify-center seat-empty" style={{ borderWidth: 2, borderStyle: "solid" }}>
              <Satellite className="w-8 h-8 text-orange-400" />
            </div>
            <div>
              <p className="font-extrabold text-base">
                {search || typeFilter !== "all" ? "لا توجد نتائج مطابقة" : "لا يوجد بث مباشر مفتوح حالياً"}
              </p>
              <p className="text-white/40 text-xs mt-1.5 max-w-sm leading-relaxed">
                {search || typeFilter !== "all"
                  ? "جرّب اسماً آخر أو غيّر نوع التصفية"
                  : "لم يقم أي مستخدم بفتح بث مباشر بعد. اضغط على الزر أدناه لبدء بثك المباشر ليظهر لجميع المتابعين على المنصة"}
              </p>
            </div>
            {search || typeFilter !== "all" ? (
              <button
                onClick={() => { setSearch(""); setTypeFilter("all"); }}
                className="px-5 py-2 rounded-full bg-white/10 text-white/80 text-sm font-bold hover:bg-white/15 transition-colors"
                data-testid="btn-reset-filters"
              >
                عرض كل البثوث
              </button>
            ) : (
              <button
                onClick={startStream}
                className="souq-glow-btn text-white font-bold text-sm px-7 py-3 rounded-full flex items-center gap-2 active:scale-95 transition-transform"
                data-testid="btn-be-first-stream"
              >
                <Radio className="w-4 h-4" />
                ابدأ بثك المباشر الآن
              </button>
            )}
          </div>
        )}

        {/* ── Ended streams ── */}
        {filteredEnded.length > 0 && (
          <section className="mt-2">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-white/40" />
              <h2 className="font-bold text-sm text-white/80">بثوث سابقة</h2>
              <Badge className="bg-white/5 text-white/50 border-white/10 text-xs">{filteredEnded.length}</Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredEnded.slice(0, 8).map((s: any, i: number) => <StreamCard key={s.id} stream={s} index={i} />)}
            </div>
          </section>
        )}

        {/* CTA for guests */}
        {!user && (
          <div className="rounded-3xl bg-gradient-to-br from-orange-950/40 to-red-950/30 border border-orange-500/20 p-6 text-center">
            <Users className="w-9 h-9 mx-auto mb-3 text-orange-400" />
            <p className="font-bold text-sm mb-1">سجّل دخولك وابدأ البث</p>
            <p className="text-white/40 text-xs mb-4">شارك بثك، استقبل الهدايا، وتنافس في تحديات PK</p>
            <button
              onClick={() => setLocation("/login")}
              className="souq-glow-btn text-white text-sm font-bold px-6 py-2.5 rounded-full active:scale-95 transition-transform"
              data-testid="btn-cta-login"
            >
              سجّل الدخول
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
