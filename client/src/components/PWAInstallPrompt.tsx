import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, X, Smartphone, Star } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Already installed as PWA
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
      return;
    }
    // Dismissed before
    if (localStorage.getItem("pwa-dismissed") === "true") return;

    // iOS detection
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    if (ios) {
      setTimeout(() => setShowBanner(true), 3000);
      return;
    }

    // Android / Desktop - listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowBanner(true), 3000);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
      setInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem("pwa-dismissed", "true");
  };

  if (installed || !showBanner) return null;

  return (
    <>
      {/* Install Banner */}
      <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom duration-500">
        <div className="m-3 rounded-2xl border bg-background/95 backdrop-blur-xl shadow-2xl shadow-primary/20 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-secondary/5 pointer-events-none" />
          <div className="relative p-4">
            <button
              onClick={handleDismiss}
              className="absolute top-3 left-3 text-muted-foreground hover:text-foreground transition-colors"
              data-testid="btn-pwa-dismiss"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-4 pr-2">
              {/* App Icon */}
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg flex-shrink-0">
                <Smartphone className="w-7 h-7 text-white" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="font-bold text-base leading-tight">سوق للإعلانات</div>
                <div className="text-xs text-muted-foreground mt-0.5">ثبّت التطبيق مجاناً على هاتفك</div>
                <div className="flex items-center gap-1 mt-1">
                  {[1,2,3,4,5].map(i => (
                    <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  ))}
                  <span className="text-xs text-muted-foreground mr-1">بدون متجر تطبيقات</span>
                </div>
              </div>

              {/* CTA */}
              <Button
                onClick={handleInstall}
                size="sm"
                className="gap-2 bg-primary hover:bg-primary/90 text-white rounded-xl px-4 flex-shrink-0"
                data-testid="btn-pwa-install"
              >
                <Download className="w-4 h-4" />
                تثبيت
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* iOS Guide Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-end" onClick={() => setShowIOSGuide(false)}>
          <div
            className="w-full bg-background rounded-t-3xl p-6 pb-10 animate-in slide-in-from-bottom duration-300"
            dir="rtl"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-5" />
            <h3 className="text-lg font-bold text-center mb-2">تثبيت التطبيق على iPhone</h3>
            <p className="text-sm text-muted-foreground text-center mb-6">اتبع الخطوات التالية لتثبيت سوق للإعلانات</p>

            <div className="space-y-4">
              {[
                { step: "١", icon: "⬆️", title: "اضغط على زر المشاركة", desc: "في أسفل المتصفح (Safari)" },
                { step: "٢", icon: "➕", title: "اختر «إضافة إلى الشاشة الرئيسية»", desc: "من القائمة التي ستظهر" },
                { step: "٣", icon: "✅", title: "اضغط «إضافة»", desc: "وسيظهر التطبيق على شاشتك الرئيسية!" },
              ].map(item => (
                <div key={item.step} className="flex items-center gap-4 bg-muted/30 rounded-2xl p-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-xl flex-shrink-0">
                    {item.icon}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{item.title}</div>
                    <div className="text-xs text-muted-foreground">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <Button
              className="w-full mt-6 rounded-xl h-12 text-base"
              onClick={() => { setShowIOSGuide(false); setShowBanner(false); }}
            >
              فهمت، شكراً!
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
