import { useEffect, useState, useCallback, useRef } from "react";
import { X, ExternalLink, Volume2, VolumeX } from "lucide-react";
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
  const [show, setShow] = useState(false);       // controls fade-in
  const [leaving, setLeaving] = useState(false); // controls fade-out
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const [videoProgress, setVideoProgress] = useState(0);
  const [canSkip, setCanSkip] = useState(false);
  const [skipCountdown, setSkipCountdown] = useState(5);
  const videoRef = useRef<HTMLVideoElement>(null);
  const skipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isVideo = ad?.mediaType === "video" && !!ad.mediaUrl;

  // ── جلب إعلان جديد ─────────────────────────────────────────────
  const fetchAd = useCallback(async () => {
    try {
      const res = await fetch("/api/campaigns/random");
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      if (!data?.id) { setLoading(false); return; }

      // خروج ناعم للإعلان القديم إن وجد
      if (ad) {
        setLeaving(true);
        await new Promise(r => setTimeout(r, 350));
        setLeaving(false);
        setShow(false);
      }

      setAd(data);
      setVideoProgress(0);
      setCanSkip(false);
      setSkipCountdown(5);
      setLoading(false);

      // دخول ناعم للإعلان الجديد
      requestAnimationFrame(() => {
        setTimeout(() => setShow(true), 50);
      });

      // تسجيل المشاهدة
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
    return () => clearInterval(t);
  }, [fetchAd, refreshInterval]);

  // ── عداد تخطي الفيديو ──────────────────────────────────────────
  useEffect(() => {
    if (!isVideo || !show) return;
    setCanSkip(false);
    setSkipCountdown(5);
    if (skipTimerRef.current) clearTimeout(skipTimerRef.current);
    if (skipIntervalRef.current) clearInterval(skipIntervalRef.current);

    skipIntervalRef.current = setInterval(() => {
      setSkipCountdown(c => {
        if (c <= 1) {
          clearInterval(skipIntervalRef.current!);
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    skipTimerRef.current = setTimeout(() => {
      setCanSkip(true);
    }, 5000);

    return () => {
      clearTimeout(skipTimerRef.current!);
      clearInterval(skipIntervalRef.current!);
    };
  }, [isVideo, show, ad?.id]);

  // ── تقدم الفيديو ───────────────────────────────────────────────
  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    setVideoProgress((v.currentTime / v.duration) * 100);
  };

  // ── إغلاق ناعم ─────────────────────────────────────────────────
  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLeaving(true);
    setTimeout(() => {
      setShow(false);
      setLeaving(false);
      setAd(null);
    }, 350);
  };

  const handleClick = () => {
    if (!ad) return;
    fetch(`/api/campaigns/${ad.id}/click`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId, userId }),
    }).catch(() => {});
    if (ad.targetUrl) window.open(ad.targetUrl, "_blank", "noopener");
  };

  if (loading || !ad || (!show && !leaving)) return null;

  // ── styles مشتركة ──────────────────────────────────────────────
  const transitionCls = `transition-all duration-300 ease-out ${
    leaving ? "opacity-0 translate-y-2 scale-95" : show ? "opacity-100 translate-y-0 scale-100" : "opacity-0"
  }`;

  const adLabel = (
    <span className="text-[10px] text-muted-foreground font-semibold tracking-wide">
      إعلان ممول · شبكة سوق
    </span>
  );

  const skipBtn = isVideo && (
    <button
      onClick={e => { e.stopPropagation(); handleDismiss(e); }}
      className={`absolute bottom-10 left-3 z-20 flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border transition-all duration-300
        ${canSkip
          ? "bg-white/90 text-black border-white/80 hover:bg-white cursor-pointer"
          : "bg-black/40 text-white/70 border-white/20 cursor-not-allowed"}`}
    >
      {canSkip ? "تخطي الإعلان ›" : `تخطي بعد ${skipCountdown} ث`}
    </button>
  );

  const muteBtn = isVideo && (
    <button
      onClick={e => { e.stopPropagation(); setMuted(m => !m); }}
      className="absolute top-2 right-2 z-20 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
    >
      {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
    </button>
  );

  const progressBar = isVideo && (
    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-20">
      <div
        className="h-full bg-primary transition-all duration-200"
        style={{ width: `${videoProgress}%` }}
      />
    </div>
  );

  /* ══ Overlay ══════════════════════════════════════════════════ */
  if (variant === "overlay") {
    return (
      <div
        className={`fixed bottom-20 left-3 z-40 w-56 rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black/80 backdrop-blur ${transitionCls} ${className}`}
        data-testid="ad-widget-overlay"
      >
        {dismissible && (
          <button
            onClick={handleDismiss}
            className="absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-500 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        {muteBtn}
        <button onClick={handleClick} className="relative block w-full text-right">
          {ad.mediaUrl && (
            isVideo
              ? <video ref={videoRef} src={ad.mediaUrl} autoPlay muted={muted} loop playsInline
                  onTimeUpdate={handleTimeUpdate}
                  className="w-full h-32 object-cover" />
              : <img src={ad.mediaUrl} alt={ad.name} className="w-full h-32 object-cover" />
          )}
          {progressBar}
          <div className="px-3 py-2 bg-black/70">
            <p className="text-white text-xs font-bold truncate">{ad.name}</p>
            {adLabel}
          </div>
        </button>
      </div>
    );
  }

  /* ══ Sidebar ═══════════════════════════════════════════════════ */
  if (variant === "sidebar") {
    return (
      <div
        className={`rounded-2xl overflow-hidden border border-border/50 bg-card shadow-sm ${transitionCls} ${className}`}
        data-testid="ad-widget-sidebar"
      >
        <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b border-border/30">
          {adLabel}
          {dismissible && (
            <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <button onClick={handleClick} className="relative block w-full text-right group">
          {ad.mediaUrl && (
            isVideo
              ? <video ref={videoRef} src={ad.mediaUrl} autoPlay muted={muted} loop playsInline
                  onTimeUpdate={handleTimeUpdate}
                  className="w-full h-36 object-cover" />
              : <img src={ad.mediaUrl} alt={ad.name} className="w-full h-36 object-cover group-hover:opacity-90 transition-opacity duration-200" />
          )}
          {muteBtn}
          {progressBar}
          {skipBtn}
          <div className="px-3 py-2.5">
            <p className="font-bold text-sm truncate">{ad.name}</p>
            {ad.description && <p className="text-muted-foreground text-xs line-clamp-2 mt-0.5">{ad.description}</p>}
            <span className="flex items-center gap-1 mt-1.5 text-primary text-xs font-bold">
              <ExternalLink className="w-3 h-3" /> اعرف أكثر
            </span>
          </div>
        </button>
      </div>
    );
  }

  /* ══ Inline ════════════════════════════════════════════════════ */
  if (variant === "inline") {
    return (
      <div
        className={`relative rounded-xl overflow-hidden border border-border/40 bg-card shadow-sm ${transitionCls} ${className}`}
        data-testid="ad-widget-inline"
      >
        {dismissible && (
          <button
            onClick={handleDismiss}
            className="absolute top-2 left-2 z-10 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-red-500 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        <button onClick={handleClick} className="flex items-center gap-3 w-full p-3 text-right group">
          {ad.mediaUrl && (
            isVideo
              ? <video ref={videoRef} src={ad.mediaUrl} autoPlay muted loop playsInline
                  className="w-16 h-16 rounded-xl object-cover shrink-0" />
              : <img src={ad.mediaUrl} alt={ad.name} className="w-16 h-16 rounded-xl object-cover shrink-0 group-hover:opacity-90 transition-opacity duration-200" />
          )}
          <div className="flex-1 min-w-0">
            {adLabel}
            <p className="font-bold text-sm truncate">{ad.name}</p>
            {ad.description && <p className="text-muted-foreground text-xs line-clamp-1 mt-0.5">{ad.description}</p>}
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-primary shrink-0" />
        </button>
      </div>
    );
  }

  /* ══ Banner (default) ══════════════════════════════════════════ */
  return (
    <div
      className={`relative rounded-2xl overflow-hidden border border-border/40 bg-card shadow-md ${transitionCls} ${className}`}
      data-testid="ad-widget-banner"
    >
      {dismissible && (
        <button
          onClick={handleDismiss}
          className="absolute top-2 left-2 z-10 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-red-500 transition-colors"
          aria-label="إغلاق الإعلان"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      {muteBtn}

      <button onClick={handleClick} className="relative block w-full text-right group">
        {ad.mediaUrl ? (
          isVideo ? (
            <video
              ref={videoRef}
              src={ad.mediaUrl}
              autoPlay
              muted={muted}
              loop
              playsInline
              onTimeUpdate={handleTimeUpdate}
              className="w-full max-h-48 object-cover"
            />
          ) : (
            <img
              src={ad.mediaUrl}
              alt={ad.name}
              className="w-full max-h-48 object-cover group-hover:opacity-95 transition-opacity duration-200"
            />
          )
        ) : (
          <div className="w-full h-24 bg-gradient-to-r from-primary/10 to-primary/5 flex items-center justify-center">
            <span className="text-primary font-bold text-lg">{ad.name}</span>
          </div>
        )}

        {progressBar}
        {skipBtn}

        <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm truncate">{ad.name}</p>
            {ad.description && <p className="text-muted-foreground text-xs truncate mt-0.5">{ad.description}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0 mr-3">
            <span className="flex items-center gap-1 text-primary text-xs font-bold bg-primary/10 px-2.5 py-1 rounded-full">
              <ExternalLink className="w-3 h-3" /> اعرف أكثر
            </span>
          </div>
        </div>

        <div className="px-4 pb-2">
          {adLabel}
        </div>
      </button>
    </div>
  );
}
