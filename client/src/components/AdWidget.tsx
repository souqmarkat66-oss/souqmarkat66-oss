import { useEffect, useState, useCallback } from "react";
import { X, ExternalLink } from "lucide-react";

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
  publisherCode?: string;
  className?: string;
  dismissible?: boolean;
  refreshInterval?: number;
}

export function AdWidget({
  variant = "banner",
  publisherCode,
  className = "",
  dismissible = true,
  refreshInterval = 30000,
}: AdWidgetProps) {
  const [ad, setAd] = useState<Campaign | null>(null);
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchAd = useCallback(async () => {
    try {
      const res = await fetch("/api/campaigns/random");
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      setAd(data);
      setVisible(true);
      if (data?.id) {
        fetch(`/api/campaigns/${data.id}/impression`, { method: "POST" }).catch(() => {});
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAd();
    const t = setInterval(fetchAd, refreshInterval);
    return () => clearInterval(t);
  }, [fetchAd, refreshInterval]);

  const handleClick = () => {
    if (!ad) return;
    fetch(`/api/campaigns/${ad.id}/click`, { method: "POST" }).catch(() => {});
    if (ad.targetUrl) window.open(ad.targetUrl, "_blank", "noopener");
  };

  if (!visible || loading || !ad) return null;

  /* ── Overlay (floating corner) ─────────────────────── */
  if (variant === "overlay") {
    return (
      <div className={`fixed bottom-20 left-3 z-40 w-52 rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black/80 backdrop-blur ${className}`}
        data-testid="ad-widget-overlay">
        {dismissible && (
          <button onClick={() => setVisible(false)}
            className="absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-500 transition-colors"
            aria-label="إغلاق">
            <X className="w-3 h-3" />
          </button>
        )}
        <button onClick={handleClick} className="block w-full text-right">
          {ad.mediaUrl && (
            ad.mediaType === "video"
              ? <video src={ad.mediaUrl} autoPlay muted loop playsInline className="w-full h-28 object-cover" />
              : <img src={ad.mediaUrl} alt={ad.name} className="w-full h-28 object-cover" />
          )}
          <div className="px-2.5 py-2 bg-black/70">
            <p className="text-white text-xs font-bold truncate">{ad.name}</p>
            <span className="text-white/40 text-[10px]">إعلان ممول · سوق</span>
          </div>
        </button>
      </div>
    );
  }

  /* ── Sidebar ────────────────────────────────────────── */
  if (variant === "sidebar") {
    return (
      <div className={`rounded-xl overflow-hidden border border-border/50 bg-card ${className}`}
        data-testid="ad-widget-sidebar">
        <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b border-border/30">
          <span className="text-[10px] text-muted-foreground font-bold">إعلان ممول</span>
          {dismissible && (
            <button onClick={() => setVisible(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <button onClick={handleClick} className="block w-full text-right group">
          {ad.mediaUrl && (
            ad.mediaType === "video"
              ? <video src={ad.mediaUrl} autoPlay muted loop playsInline className="w-full h-32 object-cover" />
              : <img src={ad.mediaUrl} alt={ad.name} className="w-full h-32 object-cover group-hover:opacity-90 transition-opacity" />
          )}
          <div className="px-3 py-2">
            <p className="font-bold text-xs truncate">{ad.name}</p>
            {ad.description && <p className="text-muted-foreground text-xs line-clamp-2 mt-0.5">{ad.description}</p>}
            <span className="flex items-center gap-1 mt-1.5 text-primary text-xs font-bold">
              <ExternalLink className="w-3 h-3" /> اعرف أكثر
            </span>
          </div>
        </button>
      </div>
    );
  }

  /* ── Inline (between content) ───────────────────────── */
  if (variant === "inline") {
    return (
      <div className={`relative rounded-xl overflow-hidden border border-border/40 bg-card shadow-sm ${className}`}
        data-testid="ad-widget-inline">
        {dismissible && (
          <button onClick={() => setVisible(false)}
            className="absolute top-2 left-2 z-10 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-red-500 transition-colors">
            <X className="w-3 h-3" />
          </button>
        )}
        <button onClick={handleClick} className="flex items-center gap-3 w-full p-2 text-right group">
          {ad.mediaUrl && (
            ad.mediaType === "video"
              ? <video src={ad.mediaUrl} autoPlay muted loop playsInline className="w-16 h-16 rounded-lg object-cover shrink-0" />
              : <img src={ad.mediaUrl} alt={ad.name} className="w-16 h-16 rounded-lg object-cover shrink-0 group-hover:opacity-90 transition-opacity" />
          )}
          <div className="flex-1 min-w-0">
            <span className="text-[10px] text-muted-foreground">إعلان ممول</span>
            <p className="font-bold text-sm truncate">{ad.name}</p>
            {ad.description && <p className="text-muted-foreground text-xs line-clamp-1">{ad.description}</p>}
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-primary shrink-0 ml-1" />
        </button>
      </div>
    );
  }

  /* ── Banner (default — horizontal) ─────────────────── */
  return (
    <div className={`relative rounded-xl overflow-hidden border border-border/40 bg-card shadow-sm ${className}`}
      data-testid="ad-widget-banner">
      {dismissible && (
        <button onClick={() => setVisible(false)}
          className="absolute top-2 left-2 z-10 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-red-500 transition-colors"
          aria-label="إغلاق الإعلان">
          <X className="w-3 h-3" />
        </button>
      )}
      <button onClick={handleClick} className="block w-full text-right group">
        {ad.mediaUrl && (
          ad.mediaType === "video"
            ? <video src={ad.mediaUrl} autoPlay muted loop playsInline className="w-full max-h-40 object-cover" />
            : <img src={ad.mediaUrl} alt={ad.name} className="w-full max-h-40 object-cover group-hover:opacity-90 transition-opacity" />
        )}
        <div className="flex items-center justify-between px-3 py-2 bg-muted/40">
          <div className="min-w-0">
            <p className="font-bold text-sm truncate">{ad.name}</p>
            {ad.description && <p className="text-muted-foreground text-xs truncate">{ad.description}</p>}
          </div>
          <span className="flex items-center gap-1 text-primary text-xs font-bold shrink-0 mr-2">
            <ExternalLink className="w-3 h-3" /> اعرف أكثر
          </span>
        </div>
        <div className="px-3 pb-1.5">
          <span className="text-[10px] text-muted-foreground">إعلان ممول · شبكة سوق للإعلانات</span>
        </div>
      </button>
    </div>
  );
}
