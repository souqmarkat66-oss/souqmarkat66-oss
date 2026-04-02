import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Smartphone, ShoppingBag, Apple, Download, CheckCircle2, Zap, Star } from "lucide-react";
import { SiGoogleplay } from "react-icons/si";

const PLAY_STORE = "https://play.google.com/store/apps/details?id=com.apmo.souqmarket";
const APP_STORE  = "https://apps.apple.com/app/id6743621961";

const INSTALLMENT_PLANS = [
  { months: 3,  label: "3 شهور",  badge: null,           extraPct: 0 },
  { months: 6,  label: "6 شهور",  badge: "الأكثر طلباً", extraPct: 0 },
  { months: 12, label: "12 شهر",  badge: null,           extraPct: 0 },
];

interface Props {
  price?: number;
  label?: string;
  className?: string;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "secondary";
}

export function PayFromAppButton({ price, label, className = "", size = "default", variant = "default" }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(1);

  const plan = INSTALLMENT_PLANS[selectedPlan];
  const monthly = price ? Math.ceil((price * (1 + plan.extraPct)) / plan.months) : null;

  return (
    <>
      <button
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        className={`flex items-center justify-center gap-2 rounded-full font-bold transition-all
          ${size === "sm" ? "text-xs py-1.5 px-3" : size === "lg" ? "text-base py-3 px-6" : "text-sm py-2 px-4"}
          ${variant === "outline"
            ? "border-2 border-primary text-primary hover:bg-primary hover:text-white"
            : variant === "secondary"
            ? "bg-muted text-foreground hover:bg-muted/80"
            : "bg-gradient-to-r from-primary to-secondary text-white hover:opacity-90 shadow-md"}
          ${className}`}
        data-testid="btn-pay-from-app"
      >
        <ShoppingBag className={size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} />
        {label || "ادفع من تطبيق سوق"}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-w-sm rounded-3xl p-0 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-br from-primary to-secondary p-6 text-white text-center relative">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 80%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
            <div className="relative">
              <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                <ShoppingBag className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-black">ادفع من تطبيق سوق ماركات</h2>
              <p className="text-sm opacity-80 mt-1">خيارات دفع مرنة مع التقسيط</p>
              {price && (
                <div className="mt-3 bg-white/20 backdrop-blur rounded-2xl px-4 py-2 inline-block">
                  <span className="text-2xl font-black">{price.toLocaleString()} ج.م</span>
                </div>
              )}
            </div>
          </div>

          <div className="p-5 space-y-5">
            {/* Installment Plans */}
            {price && (
              <div>
                <p className="text-sm font-bold mb-3 text-center">🎯 اختر خطة التقسيط</p>
                <div className="grid grid-cols-3 gap-2">
                  {INSTALLMENT_PLANS.map((p, i) => (
                    <button
                      key={p.months}
                      onClick={() => setSelectedPlan(i)}
                      className={`relative rounded-2xl p-3 text-center border-2 transition-all ${
                        selectedPlan === i ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                      }`}
                    >
                      {p.badge && (
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-white text-[9px] font-bold rounded-full px-1.5 py-0.5 whitespace-nowrap">
                          {p.badge}
                        </span>
                      )}
                      <div className="text-lg font-black text-primary">
                        {Math.ceil((price * (1 + p.extraPct)) / p.months).toLocaleString()}
                      </div>
                      <div className="text-[10px] text-muted-foreground">ج.م / شهر</div>
                      <div className="text-xs font-bold mt-1">{p.label}</div>
                    </button>
                  ))}
                </div>
                {plan && (
                  <div className="mt-3 bg-primary/5 border border-primary/20 rounded-2xl p-3 text-center">
                    <p className="text-xs text-muted-foreground">إجمالي {plan.months} دفعة شهرية</p>
                    <p className="text-lg font-black text-primary">
                      {Math.ceil((price * (1 + plan.extraPct)) / plan.months).toLocaleString()} ج.م × {plan.months} = {(Math.ceil((price * (1 + plan.extraPct)) / plan.months) * plan.months).toLocaleString()} ج.م
                    </p>
                    {plan.extraPct === 0 && (
                      <Badge variant="secondary" className="mt-1 text-[10px]">
                        <CheckCircle2 className="w-2.5 h-2.5 ms-0.5" /> بدون فوائد
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Features */}
            <div className="space-y-2">
              {[
                { icon: "🔒", text: "دفع آمن ومضمون 100%" },
                { icon: "⚡", text: "تفعيل فوري بعد الدفع" },
                { icon: "🎁", text: "ميزات حصرية لمستخدمي التطبيق" },
                { icon: "💬", text: "دعم على مدار الساعة" },
              ].map(f => (
                <div key={f.text} className="flex items-center gap-2 text-sm">
                  <span>{f.icon}</span>
                  <span className="text-muted-foreground">{f.text}</span>
                </div>
              ))}
            </div>

            {/* Download Buttons */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-center text-muted-foreground">حمّل التطبيق وادفع بسهولة</p>
              <a
                href={PLAY_STORE}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 w-full bg-[#01875f] hover:bg-[#017a57] text-white rounded-2xl px-4 py-3 transition-colors"
                onClick={e => e.stopPropagation()}
              >
                <SiGoogleplay className="w-7 h-7 flex-shrink-0" />
                <div className="text-right">
                  <div className="text-[10px] opacity-80">متوفر على</div>
                  <div className="font-bold text-sm">Google Play</div>
                </div>
                <Download className="w-4 h-4 ms-auto opacity-70" />
              </a>
              <a
                href={APP_STORE}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 w-full bg-black hover:bg-gray-900 text-white rounded-2xl px-4 py-3 transition-colors"
                onClick={e => e.stopPropagation()}
              >
                <Apple className="w-7 h-7 flex-shrink-0" />
                <div className="text-right">
                  <div className="text-[10px] opacity-80">متوفر على</div>
                  <div className="font-bold text-sm">App Store</div>
                </div>
                <Download className="w-4 h-4 ms-auto opacity-70" />
              </a>
            </div>

            <p className="text-[10px] text-center text-muted-foreground">
              بعد تحميل التطبيق، افتح الإعلان وستجد خيارات الدفع والتقسيط متاحة مباشرة
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
