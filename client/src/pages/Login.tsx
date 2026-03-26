import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Megaphone, CheckCircle2,
  LogIn, Sparkles, Shield, Star, Tv, ShoppingBag, KeyRound, Mail, Phone
} from "lucide-react";

const ROLES = [
  {
    id: "advertiser",
    icon: Megaphone,
    emoji: "📢",
    title: "معلن",
    subtitle: "أريد نشر إعلاناتي وحملاتي",
    features: ["رفع إعلانات مرئية وصورية", "إنشاء حملات CPM بالجنيه المصري", "استهداف 26 محافظة مصرية", "تتبع الأداء والنتائج"],
    gradient: "from-violet-600/20 via-purple-500/10 to-violet-600/5",
    border: "border-violet-400/40 hover:border-violet-500",
    ring: "ring-violet-500",
    iconBg: "bg-violet-500",
    badge: "أكثر استخداماً",
    badgeColor: "bg-violet-500",
  },
  {
    id: "channel",
    icon: Tv,
    emoji: "📡",
    title: "صاحب قناة",
    subtitle: "أريد البث وإنشاء المحتوى",
    features: ["قناة يوتيوب بجودة عالية", "بث مباشر WebRTC HD", "نشر ريلز TikTok-Style", "أرباح 60% من الإعلانات"],
    gradient: "from-red-600/20 via-rose-500/10 to-red-600/5",
    border: "border-red-400/40 hover:border-red-500",
    ring: "ring-red-500",
    iconBg: "bg-red-500",
    badge: "دخل شهري",
    badgeColor: "bg-red-500",
  },
  {
    id: "client",
    icon: ShoppingBag,
    emoji: "🛍️",
    title: "مستخدم",
    subtitle: "أريد التصفح والتسوق",
    features: ["تصفح آلاف الإعلانات", "شاهد البث المباشر مجاناً", "تواصل مع البائعين", "إشعارات ذكية مخصصة"],
    gradient: "from-emerald-600/20 via-green-500/10 to-emerald-600/5",
    border: "border-emerald-400/40 hover:border-emerald-500",
    ring: "ring-emerald-500",
    iconBg: "bg-emerald-500",
    badge: "مجاني دائماً",
    badgeColor: "bg-emerald-500",
  },
];

export default function Login() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [animStep, setAnimStep] = useState(0);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState<"input" | "sent">("input");
  const [forgotValue, setForgotValue] = useState("");

  useEffect(() => {
    if (user) {
      const role = localStorage.getItem("souq_role");
      if (role === "advertiser") setLocation("/create");
      else if (role === "channel") setLocation("/channels");
      else setLocation("/");
    }
  }, [user]);

  useEffect(() => {
    const t = setInterval(() => setAnimStep(s => (s + 1) % 3), 3500);
    return () => clearInterval(t);
  }, []);

  const handleLogin = () => {
    if (selectedRole) localStorage.setItem("souq_role", selectedRole);
    window.location.href = "/api/login";
  };

  const handleForgotSubmit = () => {
    if (!forgotValue.trim()) return;
    setForgotStep("sent");
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden"
      dir="rtl"
      style={{ background: "radial-gradient(ellipse at top, hsl(var(--primary)/15%) 0%, transparent 60%), radial-gradient(ellipse at bottom, hsl(var(--secondary)/10%) 0%, transparent 60%)" }}
    >
      {/* Ambient blobs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-secondary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-2xl">

        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-tr from-primary to-secondary shadow-2xl shadow-primary/30 mb-4 relative">
            <Megaphone className="w-9 h-9 text-white" />
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-background animate-pulse" />
          </div>
          <h1 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-primary via-violet-500 to-secondary mb-1">
            شبكة سوق للإعلانات
          </h1>
          <p className="text-muted-foreground text-sm flex items-center justify-center gap-2">
            <span className="text-lg">🇪🇬</span>
            المنصة الإعلانية الأولى في مصر · مئات المعلنين والمبدعين
          </p>

          {/* Live stats */}
          <div className="flex items-center justify-center gap-6 mt-4">
            {[
              { label: "معلن نشط", value: "2.4K+" },
              { label: "بث يومي", value: "150+" },
              { label: "إعلان منشور", value: "18K+" },
            ].map(stat => (
              <div key={stat.label} className="text-center">
                <div className="text-base font-extrabold text-foreground">{stat.value}</div>
                <div className="text-[10px] text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Role Selection */}
        <div className="mb-4">
          <p className="text-center text-sm font-semibold text-muted-foreground mb-4">اختر نوع حسابك للبدء</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {ROLES.map((role, idx) => {
              const selected = selectedRole === role.id;
              return (
                <button
                  key={role.id}
                  onClick={() => setSelectedRole(role.id)}
                  data-testid={`role-${role.id}`}
                  className={`relative text-right p-4 rounded-2xl border-2 bg-gradient-to-br transition-all duration-200 group
                    ${role.gradient} ${role.border}
                    ${selected ? `${role.ring} ring-2 ring-offset-2 ring-offset-background shadow-lg scale-[1.02]` : "hover:scale-[1.01]"}
                  `}
                >
                  {/* Badge */}
                  <span className={`absolute -top-2 -right-2 text-[10px] text-white font-bold px-2 py-0.5 rounded-full ${role.badgeColor}`}>
                    {role.badge}
                  </span>

                  {/* Icon & Title */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${role.iconBg}`}>
                      <role.icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="font-extrabold flex items-center gap-1.5">
                        {role.emoji} {role.title}
                        {selected && <CheckCircle2 className="w-4 h-4 text-primary" />}
                      </div>
                      <div className="text-[11px] text-muted-foreground leading-tight">{role.subtitle}</div>
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-1">
                    {role.features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="w-1 h-1 rounded-full bg-primary/60 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>
        </div>

        {/* Login Button */}
        <div className="space-y-3">
          <Button
            size="lg"
            onClick={handleLogin}
            disabled={!selectedRole}
            className="w-full h-14 text-base gap-3 rounded-2xl shadow-xl shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            data-testid="btn-login"
          >
            <LogIn className="w-5 h-5" />
            {selectedRole
              ? `ادخل كـ${ROLES.find(r => r.id === selectedRole)?.title} — مجاناً`
              : "اختر نوع حسابك أولاً"}
          </Button>

          {/* Trust Badges */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: Shield, text: "تسجيل آمن 100%" },
              { icon: Sparkles, text: "3 رصيد AI مجاناً" },
              { icon: Star, text: "بدون رسوم خفية" },
            ].map(badge => (
              <div key={badge.text} className="flex items-center justify-center gap-1.5 py-2 px-2 bg-muted/40 rounded-xl text-[11px] text-muted-foreground">
                <badge.icon className="w-3 h-3 text-primary flex-shrink-0" />
                {badge.text}
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-4">
          بالدخول فأنت توافق على شروط الخدمة وسياسة الخصوصية
        </p>

        {/* Forgot Password Link */}
        <div className="text-center mt-3">
          <button
            type="button"
            onClick={() => { setShowForgot(true); setForgotStep("input"); setForgotValue(""); }}
            className="text-xs text-primary hover:underline flex items-center justify-center gap-1 mx-auto"
            data-testid="btn-forgot-password"
          >
            <KeyRound className="w-3 h-3" />
            نسيت كلمة المرور؟
          </button>
        </div>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={showForgot} onOpenChange={setShowForgot}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              استرجاع كلمة المرور
            </DialogTitle>
          </DialogHeader>

          {forgotStep === "input" ? (
            <div className="space-y-4 pt-1">
              <p className="text-sm text-muted-foreground">
                أدخل بريدك الإلكتروني أو رقم هاتفك المسجّل وسنرسل لك رابط إعادة التعيين.
              </p>
              <div className="space-y-2">
                <label className="text-xs font-bold">البريد الإلكتروني أو رقم الهاتف</label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="example@email.com أو 01XXXXXXXXX"
                    value={forgotValue}
                    onChange={e => setForgotValue(e.target.value)}
                    className="pr-9 text-sm"
                    dir="ltr"
                    data-testid="input-forgot-value"
                  />
                </div>
              </div>
              <Button
                className="w-full gap-2"
                disabled={!forgotValue.trim()}
                onClick={handleForgotSubmit}
                data-testid="btn-forgot-submit"
              >
                <Mail className="w-4 h-4" />
                إرسال رابط الاسترجاع
              </Button>
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-xs font-bold mb-2 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-primary" />
                  تواصل مباشر معنا
                </p>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">📱 فودافون كاش: <span className="font-mono font-bold">01098553911</span></p>
                  <p className="text-xs text-muted-foreground">📲 اتصالات: <span className="font-mono font-bold">01126665741</span></p>
                  <p className="text-xs text-muted-foreground">💳 InstaPay: <span className="font-mono font-bold">01285558567</span></p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pt-1 text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-base mb-1">تم الإرسال بنجاح!</h3>
                <p className="text-sm text-muted-foreground">
                  تم إرسال رابط استرجاع كلمة المرور إلى:
                </p>
                <p className="font-mono font-bold text-sm mt-1 text-primary">{forgotValue}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                تحقّق من بريدك الوارد أو رسائل الـ SMS · قد يستغرق حتى 5 دقائق
              </p>
              <Button variant="outline" className="w-full" onClick={() => setShowForgot(false)}>
                العودة لتسجيل الدخول
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
