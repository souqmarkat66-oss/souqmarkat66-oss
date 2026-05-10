import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Megaphone, X } from "lucide-react";

type ActiveTicker = { id: number; text: string; advertiserId?: string };

let sharedSocket: Socket | null = null;
function getTickerSocket(): Socket {
  if (!sharedSocket) {
    sharedSocket = io({ path: "/socket.io", transports: ["websocket", "polling"] });
  }
  return sharedSocket;
}

export default function GlobalTicker() {
  const [tickers, setTickers] = useState<ActiveTicker[]>([]);
  const [hidden, setHidden] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ticker-ads/active")
      .then((r) => r.json())
      .then((rows: ActiveTicker[]) => { if (!cancelled && Array.isArray(rows)) setTickers(rows); })
      .catch(() => {});

    const s = getTickerSocket();
    const onShow = (ad: ActiveTicker) => {
      setTickers((prev) => (prev.find((t) => t.id === ad.id) ? prev : [...prev, ad]));
    };
    const onRemove = (data: { id: number }) => {
      setTickers((prev) => prev.filter((t) => t.id !== data.id));
    };
    s.on("ticker:show", onShow);
    s.on("ticker:remove", onRemove);
    return () => {
      cancelled = true;
      s.off("ticker:show", onShow);
      s.off("ticker:remove", onRemove);
    };
  }, []);

  const visible = tickers.filter((t) => !hidden.has(t.id));
  if (visible.length === 0) return null;

  return (
    <div
      className="absolute top-0 left-0 right-0 z-30 w-full bg-gradient-to-r from-red-600/95 via-rose-600/95 to-red-600/95 backdrop-blur-sm text-white shadow-lg border-b border-red-800"
      data-testid="global-ticker"
      dir="rtl"
    >
      {visible.map((t) => (
        <div key={t.id} className="flex items-center gap-2 px-3 py-1.5 overflow-hidden">
          <span className="flex items-center gap-1 bg-white/20 backdrop-blur rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0">
            <Megaphone className="w-3 h-3" />
            عاجل
          </span>
          <div className="flex-1 overflow-hidden whitespace-nowrap">
            <div className="inline-block animate-marquee text-sm font-semibold" data-testid={`ticker-text-${t.id}`}>
              {t.text}
            </div>
          </div>
          <button
            onClick={() => setHidden((p) => new Set(p).add(t.id))}
            className="shrink-0 hover:bg-white/20 rounded-full p-1 transition"
            aria-label="إخفاء"
            data-testid={`btn-hide-ticker-${t.id}`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <style>{`
        @keyframes marquee { from { transform: translateX(100%); } to { transform: translateX(-100%); } }
        .animate-marquee { animation: marquee 22s linear infinite; }
      `}</style>
    </div>
  );
}
