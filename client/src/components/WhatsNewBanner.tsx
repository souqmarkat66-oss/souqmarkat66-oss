import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { X, Sparkles, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "souq_seen_version";

export function WhatsNewBanner() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
    queryFn: () => fetch("/api/settings").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const version = settings?.app_version || "";
  const whatsnewRaw = settings?.app_whatsnew || "";
  const title = settings?.app_whatsnew_title || "تحديث جديد! 🎉";

  let items: string[] = [];
  if (whatsnewRaw) {
    try {
      const parsed = JSON.parse(whatsnewRaw);
      items = Array.isArray(parsed) ? parsed : [whatsnewRaw];
    } catch {
      items = whatsnewRaw.split("\n").filter(Boolean);
    }
  }

  useEffect(() => {
    if (!version || items.length === 0) return;
    const seenVersion = localStorage.getItem(STORAGE_KEY);
    if (seenVersion !== version) {
      const timer = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [version, items.length]);

  const dismiss = () => {
    if (version) {
      localStorage.setItem(STORAGE_KEY, version);
      fetch("/api/whatsnew/seen", { method: "POST", credentials: "include" }).catch(() => {});
    }
    setVisible(false);
  };

  if (!visible || items.length === 0) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm"
        onClick={dismiss}
      />

      {/* Sheet — slides up from bottom */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[9999] rounded-t-3xl bg-background border-t border-border/60 shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
        dir="rtl"
        style={{ maxHeight: "80vh", overflowY: "auto" }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="px-5 pb-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-4 mt-2">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-extrabold leading-tight">{title}</h2>
                {version && (
                  <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                    الإصدار {version}
                  </span>
                )}
              </div>
            </div>
            <button onClick={dismiss} className="text-muted-foreground hover:text-foreground mt-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Items list */}
          <div className="space-y-2.5 mb-5">
            {(expanded ? items : items.slice(0, 4)).map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-primary text-[10px] font-bold">{i + 1}</span>
                </div>
                <p className="text-sm leading-relaxed text-foreground/90">{item}</p>
              </div>
            ))}
          </div>

          {/* Show more */}
          {!expanded && items.length > 4 && (
            <button
              onClick={() => setExpanded(true)}
              className="flex items-center gap-1 text-xs text-primary mb-4 hover:underline"
            >
              <ChevronDown className="w-3 h-3" />
              عرض {items.length - 4} ميزة أخرى
            </button>
          )}

          {/* Action button */}
          <Button
            className="w-full rounded-2xl h-12 text-base font-bold"
            onClick={dismiss}
            data-testid="btn-whatsnew-dismiss"
          >
            ✨ رأيت الجديد — شكراً!
          </Button>
        </div>
      </div>
    </>
  );
}
