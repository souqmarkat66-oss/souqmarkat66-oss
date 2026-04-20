import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Megaphone, CheckCircle2, Eye, EyeOff,
  LogIn, Sparkles, Shield, Star, Tv, ShoppingBag,
  Mail, Phone, Lock, UserPlus, ChevronLeft, KeyRound
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ROLES = [
  {
    id: "advertiser", icon: Megaphone, emoji: "📢", title: "معلن",
    subtitle: "أريد نشر إعلاناتي وحملاتي",
    features: ["رفع إعلانات مرئية وصورية", "حملات CPM بالجنيه المصري", "استهداف 26 محافظة مصرية", "تتبع الأداء والنتائج"],
    gradient: "from-violet-600/20 via-purple-500/10 to-violet-600/5",
    border: "border-violet-400/40 hover:border-violet-500", ring: "ring-violet-500",
    iconBg: "bg-violet-500", badge: "أكثر استخداماً", badgeColor: "bg-violet-500",
  },
  {
    id: "channel", icon: Tv, emoji: "📡", title: "صاحب قناة",
    subtitle: "أريد البث وإنشاء المحتوى",
    features: ["بث مباشر HD", "ريلز TikTok-Style", "أرباح 60%", "قناة يوتيوب"],
    gradient: "from-red-600/20 via-rose-500/10 to-red-600/5",
    border: "border-red-400/40 hover:border-red-500", ring: "ring-red-500",
    iconBg: "bg-red-500", badge: "دخل شهري", badgeColor: "bg-red-500",
  },
  {
    id: "client", icon: ShoppingBag, emoji: "🛍️", title: "مستخدم",
    subtitle: "أريد التصفح والتسوق",
    features: ["تصفح آلاف الإعلانات", "بث مباشر مجاناً", "تواصل مع البائعين", "إشعارات ذكية"],
    gradient: "from-emerald-600/20 via-green-500/10 to-emerald-600/5",
    border: "border-emerald-400/40 hover:border-emerald-500", ring: "ring-emerald-500",
    iconBg: "bg-emerald-500", badge: "مجاني دائماً", badgeColor: "bg-emerald-500",
  },
];

type Screen = "welcome" | "login" | "register" | "set-password" | "forgot";

export default function Login() {
  const { user, login, register, setPassword } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [screen, setScreen] = useState<Screen>("welcome");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  // Login form
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword2] = useState("");
  const [showPw, setShowPw] = useState(false);

  // Register form
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regShowPw, setRegShowPw] = useState(false);
  const [regIdentifierType, setRegIdentifierType] = useState<"email" | "phone">("email");

  // Set-password (first login)
  const [firstLoginUserId, setFirstLoginUserId] = useState("");
  const [newPw1, setNewPw1] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);

  // Forgot password
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [resetToken, setResetToken] = useState("");

  useEffect(() => {
    if (user) {
      const role = localStorage.getItem("souq_role");
      if (role === "advertiser") setLocation("/create");
      else if (role === "channel") setLocation("/channels");
      else setLocation("/");
    }
  }, [user]);

  const handleLogin = async () => {
    if (!identifier || !password) return toast({ variant: "destructive", title: "أدخل البيانات المطلوبة" });
    try {
      if (selectedRole) localStorage.setItem("souq_role", selectedRole);
      await login.mutateAsync({ identifier, password });
    } catch (err: any) {
      if (err?.message === "first_login" || err?.status === 403) {
        setFirstLoginUserId(err.userId || "");
        setResetToken(err.resetToken || "");
        setScreen("set-password");
      } else {
        toast({ variant: "destructive", title: err?.message || "فشل تسجيل الدخول" });
      }
    }
  };

  const handleRegister = async () => {
    if (!regFirstName) return toast({ variant: "destructive", title: "الاسم مطلوب" });
    if (regIdentifierType === "email" && !regEmail) return toast({ variant: "destructive", title: "البريد الإلكتروني مطلوب" });
    if (regIdentifierType === "phone" && !regPhone) return toast({ variant: "destructive", title: "رقم الهاتف مطلوب" });
    if (regPassword.length < 6) return toast({ variant: "destructive", title: "كلمة المرور 6 أحرف على الأقل" });
    try {
      if (selectedRole) localStorage.setItem("souq_role", selectedRole);
      await register.mutateAsync({
        firstName: regFirstName,
        lastName: regLastName,
        email: regIdentifierType === "email" ? regEmail : undefined,
        phone: regIdentifierType === "phone" ? regPhone : undefined,
        password: regPassword,
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: err?.message || "فشل التسجيل" });
    }
  };

  const handleSetPassword = async () => {
    if (newPw1.length < 6) return toast({ variant: "destructive", title: "كلمة المرور 6 أحرف على الأقل" });
    if (newPw1 !== newPw2) return toast({ variant: "destructive", title: "كلمتا المرور غير متطابقتين" });
    try {
      await setPassword.mutateAsync({ userId: firstLoginUserId, password: newPw1, resetToken });
      toast({ title: "✅ تم تغيير كلمة المرور بنجاح", description: "يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة" });
      setNewPw1("");
      setNewPw2("");
      setResetToken("");
      setFirstLoginUserId("");
      setScreen("login");
    } catch (err: any) {
      if (err?.message?.includes("انتهت صلاحية")) {
        toast({ variant: "destructive", title: "انتهت صلاحية الطلب", description: "ابدأ من 'نسيت كلمة المرور' من جديد" });
        setScreen("forgot");
      } else {
        toast({ variant: "destructive", title: err?.message || "فشل تعيين كلمة المرور" });
      }
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotIdentifier.trim()) return toast({ variant: "destructive", title: "أدخل البريد الإلكتروني أو رقم الهاتف أو الـ ID" });
    setForgotLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ identifier: forgotIdentifier.trim() }),
      });
      let json: any = {};
      try { json = await res.json(); } catch { json = {}; }

      if (!res.ok && res.status >= 500) {
        toast({ variant: "destructive", title: "خطأ في الخادم، حاول مجدداً بعد قليل" });
        return;
      }
      if (json.notFound || !json.userId) {
        toast({
          variant: "destructive",
          title: "الحساب غير موجود",
          description: "تأكد من الإيميل أو رقم الهاتف أو الـ ID. إذا نسيت بياناتك تواصل مع الدعم على واتساب."
        });
        return;
      }
      setFirstLoginUserId(json.userId);
      setResetToken(json.resetToken || "");
      setScreen("set-password");
      toast({ title: `مرحباً ${json.firstName || ""}، عيّن كلمة مرور جديدة` });
    } catch {
      toast({ variant: "destructive", title: "تعذّر الاتصال، تحقق من الإنترنت وحاول مجدداً" });
    } finally {
      setForgotLoading(false);
    }
  };

  const bg = "radial-gradient(ellipse at top, hsl(var(--primary)/15%) 0%, transparent 60%), radial-gradient(ellipse at bottom, hsl(var(--secondary)/10%) 0%, transparent 60%)";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden" dir="rtl" style={{ background: bg }}>
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-secondary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-2xl">

        {/* ── Logo ──────────────────────────────────────────── */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-tr from-primary to-secondary shadow-2xl shadow-primary/30 mb-4 relative">
            <Megaphone className="w-9 h-9 text-white" />
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-background animate-pulse" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-primary via-violet-500 to-secondary mb-1">
            شبكة سوق للإعلانات
          </h1>
          <p className="text-muted-foreground text-sm flex items-center justify-center gap-2">
            <span className="text-lg">🇪🇬</span>
            المنصة الإعلانية الأولى في مصر
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1 flex items-center justify-center gap-1">
            <span>🛒</span>
            وهى إحدى منصات تطبيق <span className="font-bold text-primary">سوق ماركات</span>
          </p>
          <div className="flex items-center justify-center gap-6 mt-3">
            {[{ label: "معلن نشط", value: "2.4K+" }, { label: "بث يومي", value: "150+" }, { label: "إعلان منشور", value: "18K+" }].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-base font-extrabold">{s.value}</div>
                <div className="text-[10px] text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════ */}
        {/* WELCOME SCREEN */}
        {/* ══════════════════════════════════════════════════════ */}
        {screen === "welcome" && (
          <div>
            <p className="text-center text-sm font-semibold text-muted-foreground mb-4">اختر نوع حسابك للبدء</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
              {ROLES.map(role => {
                const selected = selectedRole === role.id;
                return (
                  <button
                    key={role.id}
                    onClick={() => setSelectedRole(role.id)}
                    data-testid={`role-${role.id}`}
                    className={`relative text-right p-4 rounded-2xl border-2 bg-gradient-to-br transition-all duration-200
                      ${role.gradient} ${role.border}
                      ${selected ? `${role.ring} ring-2 ring-offset-2 ring-offset-background shadow-lg scale-[1.02]` : "hover:scale-[1.01]"}`}
                  >
                    <span className={`absolute -top-2 -right-2 text-[10px] text-white font-bold px-2 py-0.5 rounded-full ${role.badgeColor}`}>{role.badge}</span>
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

            <div className="grid grid-cols-2 gap-3">
              <Button
                size="lg" variant="outline"
                className="h-12 gap-2 rounded-2xl text-sm"
                onClick={() => setScreen("register")}
                data-testid="btn-go-register"
              >
                <UserPlus className="w-4 h-4" /> إنشاء حساب جديد
              </Button>
              <Button
                size="lg"
                className="h-12 gap-2 rounded-2xl shadow-xl shadow-primary/30 text-sm"
                onClick={() => setScreen("login")}
                data-testid="btn-go-login"
              >
                <LogIn className="w-4 h-4" /> تسجيل الدخول
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3">
              {[{ icon: Shield, text: "تسجيل آمن 100%" }, { icon: Sparkles, text: "3 رصيد AI مجاناً" }, { icon: Star, text: "بدون رسوم خفية" }].map(b => (
                <div key={b.text} className="flex items-center justify-center gap-1.5 py-2 px-2 bg-muted/40 rounded-xl text-[11px] text-muted-foreground">
                  <b.icon className="w-3 h-3 text-primary flex-shrink-0" /> {b.text}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* LOGIN SCREEN */}
        {/* ══════════════════════════════════════════════════════ */}
        {screen === "login" && (
          <div className="bg-card border border-border/60 rounded-3xl p-6 sm:p-8 shadow-xl">
            <div className="flex items-center gap-2 mb-6">
              <button onClick={() => setScreen("welcome")} className="p-1 rounded-lg hover:bg-muted transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-xl font-bold">تسجيل الدخول</h2>
            </div>

            <div className="space-y-4">
              {/* Identifier */}
              <div>
                <label className="text-sm font-semibold mb-1.5 block">البريد الإلكتروني أو رقم الهاتف</label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    placeholder="example@email.com أو 01XXXXXXXXX"
                    className="pr-9 h-11"
                    dir="ltr"
                    data-testid="input-identifier"
                    onKeyDown={e => e.key === "Enter" && handleLogin()}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="text-sm font-semibold mb-1.5 block">كلمة المرور</label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword2(e.target.value)}
                    placeholder="••••••••"
                    className="pr-9 pl-9 h-11"
                    dir="ltr"
                    data-testid="input-password"
                    onKeyDown={e => e.key === "Enter" && handleLogin()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                size="lg" className="w-full h-12 gap-2 rounded-xl shadow-lg shadow-primary/20"
                onClick={handleLogin}
                disabled={login.isPending}
                data-testid="btn-login"
              >
                {login.isPending
                  ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <LogIn className="w-4 h-4" />
                }
                دخول
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button onClick={() => setScreen("register")} className="text-primary hover:underline">
                  ليس لديك حساب؟ سجّل الآن
                </button>
                <button onClick={() => setScreen("forgot")} className="text-muted-foreground hover:text-primary hover:underline text-xs">
                  نسيت كلمة المرور؟
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* REGISTER SCREEN */}
        {/* ══════════════════════════════════════════════════════ */}
        {screen === "register" && (
          <div className="bg-card border border-border/60 rounded-3xl p-6 sm:p-8 shadow-xl">
            <div className="flex items-center gap-2 mb-6">
              <button onClick={() => setScreen("welcome")} className="p-1 rounded-lg hover:bg-muted transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-xl font-bold">إنشاء حساب جديد</h2>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1 block">الاسم الأول *</label>
                  <Input value={regFirstName} onChange={e => setRegFirstName(e.target.value)}
                    placeholder="أحمد" className="h-10" data-testid="input-first-name" />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block">الاسم الأخير</label>
                  <Input value={regLastName} onChange={e => setRegLastName(e.target.value)}
                    placeholder="محمد" className="h-10" data-testid="input-last-name" />
                </div>
              </div>

              {/* Identifier type toggle */}
              <div>
                <label className="text-xs font-semibold mb-1.5 block">طريقة التسجيل</label>
                <div className="flex rounded-xl border overflow-hidden mb-2">
                  <button
                    onClick={() => setRegIdentifierType("email")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors
                      ${regIdentifierType === "email" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
                  >
                    <Mail className="w-3.5 h-3.5" /> بريد إلكتروني
                  </button>
                  <button
                    onClick={() => setRegIdentifierType("phone")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors
                      ${regIdentifierType === "phone" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
                  >
                    <Phone className="w-3.5 h-3.5" /> رقم الهاتف
                  </button>
                </div>

                {regIdentifierType === "email" ? (
                  <div className="relative">
                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input value={regEmail} onChange={e => setRegEmail(e.target.value)}
                      placeholder="example@email.com" className="pr-9 h-10" dir="ltr" data-testid="input-reg-email" />
                  </div>
                ) : (
                  <div className="relative">
                    <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input value={regPhone} onChange={e => setRegPhone(e.target.value)}
                      placeholder="01XXXXXXXXX" className="pr-9 h-10" dir="ltr" data-testid="input-reg-phone" />
                  </div>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="text-xs font-semibold mb-1 block">كلمة المرور (6 أحرف على الأقل)</label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type={regShowPw ? "text" : "password"}
                    value={regPassword} onChange={e => setRegPassword(e.target.value)}
                    placeholder="••••••••" className="pr-9 pl-9 h-10" dir="ltr"
                    data-testid="input-reg-password"
                  />
                  <button type="button" onClick={() => setRegShowPw(!regShowPw)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {regShowPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                size="lg" className="w-full h-12 gap-2 rounded-xl shadow-lg shadow-primary/20"
                onClick={handleRegister}
                disabled={register.isPending}
                data-testid="btn-register"
              >
                {register.isPending
                  ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <UserPlus className="w-4 h-4" />
                }
                إنشاء الحساب
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                لديك حساب بالفعل؟{" "}
                <button onClick={() => setScreen("login")} className="text-primary hover:underline font-medium">سجّل الدخول</button>
              </p>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* SET PASSWORD SCREEN (first login) */}
        {/* ══════════════════════════════════════════════════════ */}
        {screen === "set-password" && (
          <div className="bg-card border border-border/60 rounded-3xl p-6 sm:p-8 shadow-xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <KeyRound className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold">تعيين كلمة المرور</h2>
                <p className="text-xs text-muted-foreground">عيّن كلمة مرور جديدة لحسابك — ستُحفظ وتُستخدم في المرات القادمة</p>
              </div>
            </div>

            <div className="space-y-4 mt-4">
              <div>
                <label className="text-xs font-semibold mb-1 block">كلمة المرور الجديدة</label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type={showNewPw ? "text" : "password"}
                    value={newPw1} onChange={e => setNewPw1(e.target.value)}
                    placeholder="••••••••" className="pr-9 pl-9 h-11" dir="ltr"
                    data-testid="input-new-pw1"
                  />
                  <button type="button" onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block">تأكيد كلمة المرور</label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type={showNewPw ? "text" : "password"}
                    value={newPw2} onChange={e => setNewPw2(e.target.value)}
                    placeholder="••••••••" className="pr-9 h-11" dir="ltr"
                    data-testid="input-new-pw2"
                    onKeyDown={e => e.key === "Enter" && handleSetPassword()}
                  />
                </div>
              </div>

              {newPw1 && newPw2 && newPw1 !== newPw2 && (
                <p className="text-xs text-red-500">كلمتا المرور غير متطابقتين</p>
              )}

              <Button
                size="lg" className="w-full h-12 gap-2 rounded-xl"
                onClick={handleSetPassword}
                disabled={setPassword.isPending || !newPw1 || !newPw2}
                data-testid="btn-set-password"
              >
                {setPassword.isPending
                  ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <CheckCircle2 className="w-4 h-4" />
                }
                تأكيد وتسجيل الدخول
              </Button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* FORGOT PASSWORD SCREEN */}
        {/* ══════════════════════════════════════════════════════ */}
        {screen === "forgot" && (
          <div className="bg-card border border-border/60 rounded-3xl p-6 sm:p-8 shadow-xl">
            <div className="flex items-center gap-2 mb-6">
              <button onClick={() => setScreen("login")} className="p-1 rounded-lg hover:bg-muted transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-xl font-bold">إعادة تعيين كلمة المرور</h2>
                <p className="text-xs text-muted-foreground mt-0.5">أدخل الإيميل أو رقم الهاتف أو الـ ID المسجّل</p>
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-400">
                📋 <strong>ادخل أي من:</strong> البريد الإلكتروني المسجّل، أو رقم الهاتف (مثل 01012345678)، أو رقم الـ ID الخاص بك
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold mb-1.5 block">البريد الإلكتروني / رقم الهاتف / الـ ID</label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={forgotIdentifier}
                    onChange={e => setForgotIdentifier(e.target.value)}
                    placeholder="example@email.com أو 01XXXXXXXXX"
                    className="pr-9 h-11"
                    dir="ltr"
                    data-testid="input-forgot-identifier"
                    onKeyDown={e => e.key === "Enter" && handleForgotPassword()}
                  />
                </div>
              </div>

              <Button
                size="lg" className="w-full h-12 gap-2 rounded-xl"
                onClick={handleForgotPassword}
                disabled={forgotLoading || !forgotIdentifier.trim()}
                data-testid="btn-forgot-submit"
              >
                {forgotLoading
                  ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <KeyRound className="w-4 h-4" />
                }
                إعادة تعيين كلمة المرور
              </Button>

              <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                <button onClick={() => setScreen("login")} className="text-primary hover:underline font-medium">
                  تذكرت كلمة المرور؟ سجّل الدخول
                </button>
                <a
                  href="https://wa.me/201126665741?text=أحتاج%20مساعدة%20في%20استرجاع%20حسابي"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-600 hover:text-green-700 text-xs flex items-center gap-1 hover:underline"
                >
                  💬 مشكلة في الاسترجاع؟ تواصل مع الدعم على واتساب
                </a>
              </div>
            </div>
          </div>
        )}

        <p className="text-center text-[11px] text-muted-foreground mt-4">
          بالدخول فأنت توافق على شروط الخدمة وسياسة الخصوصية · جميع التعاملات بالجنيه المصري
        </p>
      </div>
    </div>
  );
}
