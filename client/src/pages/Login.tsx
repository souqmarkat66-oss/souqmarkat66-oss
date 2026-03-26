import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Megaphone, Sparkles, Radio, BarChart2, Shield, LogIn } from "lucide-react";
import { motion } from "framer-motion";

export default function Login() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user) setLocation("/");
  }, [user]);

  const features = [
    { icon: Megaphone, label: "نشر الإعلانات", desc: "أنشئ وأدر إعلاناتك بسهولة" },
    { icon: Radio, label: "البث المباشر", desc: "بث مباشر لجمهورك الآن" },
    { icon: BarChart2, label: "إدارة الحملات", desc: "حملات إعلانية ذكية بالجنيه المصري" },
    { icon: Sparkles, label: "ذكاء اصطناعي", desc: "توليد محتوى بالـ AI مجاناً" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-tr from-primary to-secondary shadow-2xl shadow-primary/30 mb-4">
            <Megaphone className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
            شبكة سوق للإعلانات
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Souq Ads Network
          </p>
        </div>

        {/* Login Card */}
        <Card className="rounded-3xl shadow-xl border-border/50 bg-card/80 backdrop-blur">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold mb-1">أهلاً بك 👋</h2>
              <p className="text-muted-foreground text-sm">
                سجّل دخولك للوصول لمنصة الإعلانات الأقوى في مصر
              </p>
            </div>

            {/* Login Button - No Replit branding visible */}
            <a href="/api/login" className="block">
              <Button
                size="lg"
                className="w-full h-13 text-base gap-3 rounded-2xl shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all"
                data-testid="btn-login"
              >
                <LogIn className="w-5 h-5" />
                ادخل الآن — مجاناً
              </Button>
            </a>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-card px-3 text-xs text-muted-foreground">
                  منصة موثوقة وآمنة 100%
                </span>
              </div>
            </div>

            {/* Features */}
            <div className="grid grid-cols-2 gap-3">
              {features.map(f => (
                <div key={f.label} className="flex items-start gap-2.5 bg-muted/40 rounded-2xl p-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <f.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <div className="text-xs font-bold">{f.label}</div>
                    <div className="text-[10px] text-muted-foreground leading-tight">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Footer Note */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          بالدخول فأنت توافق على شروط الخدمة. <br />
          جميع التعاملات المالية بالجنيه المصري 🇪🇬
        </p>
      </motion.div>
    </div>
  );
}
