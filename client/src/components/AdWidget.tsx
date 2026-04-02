import { useEffect, useState, useCallback, useRef } from "react";
import { X, ExternalLink, Volume2, VolumeX, ChevronLeft, Play, Pause } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface Campaign {
  id: number;
  name: string;
  description?: string;
  mediaUrl?: string;
  mediaType?: string;
  targetUrl?: string;
}

interface AdWidgetProps {
  variant?: "banner" | "sidebar" | "inline" | "overlay";
  channelId?: number;
  className?: string;
  dismissible?: boolean;
  refreshInterval?: number;
}

// ─── Widget Image with fallback placeholder ────────────────────────────
function WidgetImage({ src, alt, className, onLoad }: { src: string; alt: string; className: string; onLoad?: () => void }) {
  const [err, setErr] = useState(false);
  useEffect(() => { setErr(false); }, [src]);
  if (err) {
    return (
      <div className={`${className} flex items-center justify-center bg-zinc-800 text-white/20`}>
        <span className="text-2xl">📷</span>
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} onLoad={onLoad} onError={() => setErr(true)} />;
}

// ─── Minimal Spinner ───────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="flex items-center justify-center w-full h-full min-h-[120px]">
      <div className="w-7 h-7 rounded-full border-2 border-white/20 border-t-white animate-spin" />
    </div>
  );
}

// ─── Ad Badge ─────────────────────────────────────────────────────────
function AdBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-widest uppercase bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 backdrop-blur-sm ${className}`}>
      AD
    </span>
  );
}

// ─── Main Component ────────────────────────────────────────────────────
export function AdWidget({
  variant = "banner",
  channelId,
  className = "",
  dismissible = true,
  refreshInterval = 30000,
}: AdWidgetProps) {
  const { user } = useAuth();
  const userId = (user as any)?.id || (user as any)?.claims?.sub || undefined;

  const [ad, setAd] = useState<Campaign | null>(null);
  const [phase, setPhase] = useState<"hidden" | "enter" | "visible" | "exit">("hidden");
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [skipSec, setSkipSec] = useState(5);
  const [canSkip, setCanSkip] = useState(false);
  const [loading, setLoading] = useState(true);
  const [imgLoaded, setImgLoaded] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const skipRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isVideo = ad?.mediaType === "video" && !!ad.mediaUrl;

  // ── fetch ─────────────────────────────────────────────────────────
  const fetchAd = useCallback(async () => {
    try {
      const res = await fetch("/api/campaigns/random");
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      if (!data?.id) { setLoading(false); return; }

      // exit old ad
      if (ad) {
        setPhase("exit");
        await new Promise(r => setTimeout(r, 400));
      }

      setAd(data);
      setVideoProgress(0);
      setCanSkip(false);
      setSkipSec(5);
      setImgLoaded(false);
      setLoading(false);

      // enter new ad
      setPhase("hidden");
      requestAnimationFrame(() => {
        phaseTimerRef.current = setTimeout(() => {
          setPhase("enter");
          setTimeout(() => setPhase("visible"), 20);
        }, 80);
      });

      fetch(`/api/campaigns/${data.id}/impression`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, userId }),
      }).catch(() => {});
    } catch {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, userId]);

  useEffect(() => {
    fetchAd();
    const t = setInterval(fetchAd, refreshInterval);
    return () => { clearInterval(t); clearTimeout(phaseTimerRef.current!); };
  }, [fetchAd, refreshInterval]);

  // ── skip countdown for video ───────────────────────────────────────
  useEffect(() => {
    if (!isVideo || phase !== "visible") return;
    setSkipSec(5); setCanSkip(false);
    if (skipRef.current) clearInterval(skipRef.current);
    skipRef.current = setInterval(() => {
      setSkipSec(s => {
        if (s <= 1) { clearInterval(skipRef.current!); setCanSkip(true); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(skipRef.current!);
  }, [isVideo, phase, ad?.id]);

  // ── video handlers ─────────────────────────────────────────────────
  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    setVideoProgress((v.currentTime / v.duration) * 100);
  };

  const togglePause = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPaused(false); } else { v.pause(); setPaused(true); }
  };

  // ── dismiss ────────────────────────────────────────────────────────
  const dismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhase("exit");
    setTimeout(() => { setPhase("hidden"); setAd(null); }, 400);
  };

  // ── click ──────────────────────────────────────────────────────────
  const handleClick = () => {
    if (!ad) return;
    fetch(`/api/campaigns/${ad.id}/click`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId, userId }),
    }).catch(() => {});
    if (ad.targetUrl) window.open(ad.targetUrl, "_blank", "noopener");
  };

  // ── transition helpers ─────────────────────────────────────────────
  const show = phase === "visible";
  const entering = phase === "enter";
  const exiting = phase === "exit";

  if (loading || !ad || phase === "hidden") return null;

  // ────────────────────────────────────────────────────────────────────
  // ══  BANNER  ════════════════════════════════════════════════════════
  // ────────────────────────────────────────────────────────────────────
  if (variant === "banner") {
    return (
      <div
        className={`
          relative w-full rounded-2xl overflow-hidden shadow-2xl select-none
          transition-all duration-500
          ${entering ? "opacity-0 scale-95 translate-y-4" : ""}
          ${show ? "opacity-100 scale-100 translate-y-0" : ""}
          ${exiting ? "opacity-0 scale-95 -translate-y-4" : ""}
          ${className}
        `}
        data-testid="ad-widget-banner"
      >
        {/* ── media ── */}
        <div className="relative w-full overflow-hidden bg-zinc-950" style={{ aspectRatio: "16/5", minHeight: 140 }}>
          {isVideo ? (
            <>
              {loading && <Spinner />}
              <video
                ref={videoRef}
                src={ad.mediaUrl}
                autoPlay
                muted={muted}
                loop
                playsInline
                onTimeUpdate={handleTimeUpdate}
                onLoadedData={() => setLoading(false)}
                className="w-full h-full object-cover"
              />
              {/* video progress bar */}
              <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/10 z-20">
                <div
                  className="h-full bg-gradient-to-r from-primary to-purple-400 transition-all duration-200"
                  style={{ width: `${videoProgress}%` }}
                />
              </div>
              {/* pause overlay */}
              {paused && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10">
                  <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Play className="w-7 h-7 text-white ml-1" />
                  </div>
                </div>
              )}
              {/* video controls */}
              <div className="absolute top-2.5 left-3 flex items-center gap-2 z-30">
                <button onClick={e => { e.stopPropagation(); setMuted(m => !m); }}
                  className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center hover:bg-black/70 transition-colors border border-white/10">
                  {muted ? <VolumeX className="w-3.5 h-3.5 text-white" /> : <Volume2 className="w-3.5 h-3.5 text-white" />}
                </button>
                <button onClick={togglePause}
                  className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center hover:bg-black/70 transition-colors border border-white/10">
                  {paused ? <Play className="w-3.5 h-3.5 text-white ml-0.5" /> : <Pause className="w-3.5 h-3.5 text-white" />}
                </button>
              </div>
              {/* skip button */}
              {dismissible && (
                <button
                  onClick={canSkip ? dismiss : undefined}
                  className={`absolute bottom-4 left-4 z-30 flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold border backdrop-blur-md transition-all duration-500
                    ${canSkip
                      ? "bg-white text-black border-white/80 hover:bg-white/90 cursor-pointer shadow-lg shadow-black/30"
                      : "bg-black/40 text-white/60 border-white/15 cursor-default"}`}
                >
                  {canSkip ? (
                    <><ChevronLeft className="w-3.5 h-3.5" /> تخطي الإعلان</>
                  ) : (
                    <>تخطي بعد {skipSec} ث</>
                  )}
                </button>
              )}
            </>
          ) : (
            <>
              {!imgLoaded && <div className="absolute inset-0 bg-zinc-900 animate-pulse" />}
              <WidgetImage
                src={ad.mediaUrl || ""}
                alt={ad.name}
                onLoad={() => setImgLoaded(true)}
                className={`w-full h-full object-cover transition-opacity duration-500 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
              />
              {/* close on image */}
              {dismissible && (
                <button onClick={dismiss}
                  className="absolute top-2.5 left-2.5 z-30 w-8 h-8 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center hover:bg-red-500/80 transition-colors border border-white/10">
                  <X className="w-3.5 h-3.5 text-white" />
                </button>
              )}
            </>
          )}

          {/* gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none z-10" />

          {/* ad badge */}
          <div className="absolute top-2.5 right-3 z-20">
            <AdBadge />
          </div>

          {/* text content overlay */}
          <button
            onClick={handleClick}
            className="absolute bottom-0 left-0 right-0 z-20 text-right p-4 group"
          >
            <p className="text-white font-extrabold text-base leading-tight drop-shadow-lg line-clamp-1 group-hover:text-primary transition-colors">
              {ad.name}
            </p>
            {ad.description && (
              <p className="text-white/70 text-xs mt-0.5 line-clamp-1">{ad.description}</p>
            )}
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="flex items-center gap-1 text-primary text-xs font-bold">
                <ExternalLink className="w-3 h-3" /> اعرف أكثر
              </span>
              <span className="text-white/30 text-[10px]">· شبكة سوق للإعلانات</span>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────
  // ══  OVERLAY (floating corner — TikTok style)  ══════════════════════
  // ────────────────────────────────────────────────────────────────────
  if (variant === "overlay") {
    return (
      <div
        className={`
          fixed bottom-20 left-3 z-50 w-56 rounded-2xl overflow-hidden shadow-2xl
          border border-white/10 bg-zinc-900/90 backdrop-blur-xl
          transition-all duration-500
          ${entering ? "opacity-0 scale-90 translate-x-4" : ""}
          ${show ? "opacity-100 scale-100 translate-x-0" : ""}
          ${exiting ? "opacity-0 scale-90 translate-x-4" : ""}
          ${className}
        `}
        data-testid="ad-widget-overlay"
      >
        {dismissible && (
          <button onClick={dismiss}
            className="absolute top-2 right-2 z-30 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center hover:bg-red-500 transition-colors border border-white/10">
            <X className="w-3 h-3 text-white" />
          </button>
        )}
        <AdBadge className="absolute top-2 left-2 z-30" />
        <button onClick={handleClick} className="relative block w-full text-right group">
          {ad.mediaUrl && (
            isVideo
              ? <video ref={videoRef} src={ad.mediaUrl} autoPlay muted loop playsInline
                  onTimeUpdate={handleTimeUpdate} className="w-full h-32 object-cover" />
              : <WidgetImage src={ad.mediaUrl} alt={ad.name} className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-500" />
          )}
          {/* progress */}
          {isVideo && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
              <div className="h-full bg-primary transition-all duration-200" style={{ width: `${videoProgress}%` }} />
            </div>
          )}
          <div className="px-3 py-2.5">
            <p className="text-white text-xs font-bold truncate">{ad.name}</p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-white/40 text-[10px]">ممول</span>
              <span className="flex items-center gap-0.5 text-primary text-[10px] font-bold">
                اعرف أكثر <ChevronLeft className="w-3 h-3" />
              </span>
            </div>
          </div>
        </button>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────
  // ══  SIDEBAR  ═══════════════════════════════════════════════════════
  // ────────────────────────────────────────────────────────────────────
  if (variant === "sidebar") {
    return (
      <div
        className={`
          relative rounded-2xl overflow-hidden border border-border/40 bg-card shadow-lg
          transition-all duration-400 ease-out
          ${entering ? "opacity-0 translate-x-4" : ""}
          ${show ? "opacity-100 translate-x-0" : ""}
          ${exiting ? "opacity-0 translate-x-4" : ""}
          ${className}
        `}
        data-testid="ad-widget-sidebar"
      >
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30 bg-muted/30">
          <AdBadge className="!bg-muted/60 !text-muted-foreground !border-border/40" />
          {dismissible && (
            <button onClick={dismiss} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button onClick={handleClick} className="relative block w-full text-right group">
          {ad.mediaUrl && (
            <div className="relative">
              {isVideo
                ? <video ref={videoRef} src={ad.mediaUrl} autoPlay muted={muted} loop playsInline
                    onTimeUpdate={handleTimeUpdate} className="w-full h-40 object-cover" />
                : <WidgetImage src={ad.mediaUrl} alt={ad.name} className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-500" />}
              {isVideo && (
                <>
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
                    <div className="h-full bg-primary transition-all duration-200" style={{ width: `${videoProgress}%` }} />
                  </div>
                  <button onClick={e => { e.stopPropagation(); setMuted(m => !m); }}
                    className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/10">
                    {muted ? <VolumeX className="w-3 h-3 text-white" /> : <Volume2 className="w-3 h-3 text-white" />}
                  </button>
                </>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            </div>
          )}
          <div className="px-3 py-3">
            <p className="font-bold text-sm truncate">{ad.name}</p>
            {ad.description && <p className="text-muted-foreground text-xs line-clamp-2 mt-0.5">{ad.description}</p>}
            <div className="flex items-center gap-1 mt-2 text-primary text-xs font-bold">
              <ExternalLink className="w-3 h-3" /> اعرف أكثر
            </div>
          </div>
        </button>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────
  // ══  INLINE  ════════════════════════════════════════════════════════
  // ────────────────────────────────────────────────────────────────────
  return (
    <div
      className={`
        relative rounded-xl overflow-hidden border border-border/30 bg-card/80 backdrop-blur-sm shadow-sm
        transition-all duration-400 ease-out
        ${entering ? "opacity-0 translate-y-2" : ""}
        ${show ? "opacity-100 translate-y-0" : ""}
        ${exiting ? "opacity-0 translate-y-2" : ""}
        ${className}
      `}
      data-testid="ad-widget-inline"
    >
      {dismissible && (
        <button onClick={dismiss}
          className="absolute top-2 left-2 z-10 w-5 h-5 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-red-500/80 transition-colors border border-white/10">
          <X className="w-3 h-3 text-white" />
        </button>
      )}
      <button onClick={handleClick} className="flex items-center gap-3 w-full p-3 text-right group">
        {ad.mediaUrl && (
          <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-zinc-900">
            {isVideo
              ? <video ref={videoRef} src={ad.mediaUrl} autoPlay muted loop playsInline className="w-full h-full object-cover" />
              : <WidgetImage src={ad.mediaUrl} alt={ad.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <AdBadge className="mb-1" />
          <p className="font-bold text-sm truncate">{ad.name}</p>
          {ad.description && <p className="text-muted-foreground text-xs line-clamp-1 mt-0.5">{ad.description}</p>}
        </div>
        <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
          <ChevronLeft className="w-4 h-4 text-primary" />
        </div>
      </button>
    </div>
  );
}
