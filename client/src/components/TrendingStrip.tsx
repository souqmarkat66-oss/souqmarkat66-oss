import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, CheckCircle, TrendingUp, Eye, Heart, Radio, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useRef, useState } from "react";

/* ────────────────────────────────────────────────────────────────
   Trending Ads Strip
──────────────────────────────────────────────────────────────── */
function TrendBadge({ rank }: { rank: number }) {
  const colors = ["bg-yellow-400 text-yellow-900", "bg-slate-400 text-slate-900", "bg-amber-600 text-white"];
  const c = rank <= 3 ? colors[rank - 1] : "bg-muted text-muted-foreground";
  return (
    <span className={`absolute top-1.5 start-1.5 w-5 h-5 rounded-full text-[9px] font-black flex items-center justify-center shadow-md z-10 ${c}`}>
      {rank}
    </span>
  );
}

function AdTrendCard({ ad, rank, index }: { ad: any; rank: number; index: number }) {
  const [imgErr, setImgErr] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06, duration: 0.28, ease: "easeOut" }}
      whileHover={{ y: -3, scale: 1.02 }}
      className="flex-shrink-0 w-36"
    >
      <Link href={`/ads/${ad.id}`}>
        <div className="relative rounded-2xl overflow-hidden bg-muted border border-border/40 cursor-pointer hover:border-primary/40 hover:shadow-lg transition-all duration-200 group">
          {/* Thumbnail */}
          <div className="h-28 bg-gradient-to-br from-primary/10 to-muted relative">
            {ad.media_url && !imgErr && ad.media_type !== "video" ? (
              <img
                src={ad.media_url}
                alt={ad.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={() => setImgErr(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl">📢</div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <TrendBadge rank={rank} />
            {ad.is_boosted && (
              <span className="absolute top-1.5 end-1.5 bg-yellow-400 text-yellow-900 text-[8px] font-black px-1 rounded-full">⭐ مُعزَّز</span>
            )}
          </div>
          {/* Info */}
          <div className="p-2">
            <p className="text-xs font-bold leading-tight line-clamp-2 mb-1.5">{ad.title}</p>
            {ad.price_egp && (
              <p className="text-xs font-extrabold text-primary">{Number(ad.price_egp).toLocaleString("ar-EG")} ج.م</p>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Eye className="w-2.5 h-2.5" /> {(ad.views_count || 0).toLocaleString()}
              </span>
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Heart className="w-2.5 h-2.5" /> {(ad.likes_count || 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function TrendingAdsStrip({ className = "" }: { className?: string }) {
  const { data: ads, isLoading } = useQuery<any[]>({
    queryKey: ["/api/trending/ads"],
    queryFn: () => fetch("/api/trending/ads?limit=12").then(r => r.json()),
    staleTime: 60_000,
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  if (isLoading) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <Flame className="w-5 h-5 text-orange-500" />
          <span className="font-bold text-base">الإعلانات الرائجة</span>
        </div>
        <div className="flex gap-3 overflow-x-hidden">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="w-36 h-44 rounded-2xl shrink-0" />)}
        </div>
      </div>
    );
  }

  if (!ads || ads.length === 0) return null;

  return (
    <div className={`${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
          <Flame className="w-5 h-5 text-orange-500" />
        </motion.div>
        <h2 className="font-extrabold text-base">الإعلانات الرائجة</h2>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">بناءً على التفاعل</span>
        <Link href="/ads">
          <span className="text-xs text-primary hover:underline ms-auto cursor-pointer">عرض الكل</span>
        </Link>
      </div>

      {/* Horizontal scroll */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide"
        style={{ scrollbarWidth: "none" }}
      >
        {ads.map((ad, i) => (
          <AdTrendCard key={ad.id} ad={ad} rank={i + 1} index={i} />
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Trending Channels Strip
──────────────────────────────────────────────────────────────── */
function ChannelTrendCard({ ch, rank, index, liveIds }: { ch: any; rank: number; index: number; liveIds: Set<number> }) {
  const isLive = liveIds.has(ch.id);
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06, duration: 0.28, ease: "easeOut" }}
      whileHover={{ y: -3, scale: 1.02 }}
      className="flex-shrink-0 w-32"
    >
      <Link href={`/channels/${ch.id}`}>
        <div className={`relative rounded-2xl overflow-hidden bg-muted border cursor-pointer transition-all duration-200 group
          ${isLive ? "border-red-500/60 ring-2 ring-red-500/30" : "border-border/40 hover:border-primary/40 hover:shadow-lg"}`}>
          {/* Banner */}
          <div className="h-20 bg-gradient-to-br from-primary/20 to-secondary/20 relative overflow-hidden">
            {ch.banner_url && (
              <img src={ch.banner_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            <TrendBadge rank={rank} />
            {isLive && (
              <motion.span
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="absolute top-1.5 end-1.5 bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
              >
                <span className="w-1 h-1 rounded-full bg-white inline-block" />
                LIVE
              </motion.span>
            )}
          </div>
          {/* Avatar + info */}
          <div className="px-2 pb-2 -mt-4">
            <div className="w-10 h-10 rounded-full border-2 border-background bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-sm font-bold shadow-md mx-auto mb-1 overflow-hidden">
              {ch.avatar_url
                ? <img src={ch.avatar_url} className="w-full h-full object-cover" alt="" />
                : <span>{ch.name?.[0]?.toUpperCase()}</span>}
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-0.5">
                <p className="text-[11px] font-bold line-clamp-1">{ch.name}</p>
                {ch.is_verified && <CheckCircle className="w-2.5 h-2.5 text-primary shrink-0" />}
              </div>
              <div className="flex items-center justify-center gap-1.5 mt-0.5">
                <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                  <Users className="w-2 h-2" /> {(ch.subscriber_count || 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function TrendingChannelsStrip({ className = "" }: { className?: string }) {
  const { data: channels, isLoading } = useQuery<any[]>({
    queryKey: ["/api/trending/channels"],
    queryFn: () => fetch("/api/trending/channels?limit=8").then(r => r.json()),
    staleTime: 60_000,
  });

  const { data: streams } = useQuery<any[]>({
    queryKey: ["/api/streams"],
    staleTime: 30_000,
  });

  const liveIds = new Set<number>((streams || []).map((s: any) => s.channelId));

  if (isLoading) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-5 h-5 text-primary" />
          <span className="font-bold text-base">القنوات الرائجة</span>
        </div>
        <div className="flex gap-3 overflow-x-hidden">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="w-32 h-36 rounded-2xl shrink-0" />)}
        </div>
      </div>
    );
  }

  if (!channels || channels.length === 0) return null;

  return (
    <div className={`${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <motion.div animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
          <TrendingUp className="w-5 h-5 text-primary" />
        </motion.div>
        <h2 className="font-extrabold text-base">القنوات الرائجة</h2>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">الأعلى تفاعلاً</span>
        <Link href="/channels">
          <span className="text-xs text-primary hover:underline ms-auto cursor-pointer">عرض الكل</span>
        </Link>
      </div>

      {/* Horizontal scroll */}
      <div
        className="flex gap-3 overflow-x-auto pb-2"
        style={{ scrollbarWidth: "none" }}
      >
        {channels.map((ch, i) => (
          <ChannelTrendCard key={ch.id} ch={ch} rank={i + 1} index={i} liveIds={liveIds} />
        ))}
      </div>
    </div>
  );
}
