import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Megaphone, Radio, User, BarChart2, Sparkles, LogIn, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const ROLES = [
  {
    id: "advertiser",
    icon: Megaphone,
    title: "معلن",
    subtitle: "أريد نشر إعلاناتي",
    desc: "أنشئ حملات إعلانية، ارفع إعلاناتك، وتتبع النتائج بالجنيه المصري",
    color: "from-primary/20 to-primary/5 border-primary/30 hover:border-primary",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
  },
  {
    id: "channel",
    icon: Radio,
    title: "صاحب قناة",
    subtitle: "أريد بث وإنشاء محتوى",
    desc: "أنشئ قناتك، ابث مباشراً، ونشر ريلز لجمهورك وكسب أرباح",
    color: "from-red-500/20 to-red-500/5 border-red-400/30 hover:border-red-400",
    iconBg: "bg-red-500/10",
    iconColor: "text-red-500",
  },
  {
    id: "client",
    icon: User,
    title: "عميل عادي",
    subtitle: "أريد التصفح والتسوق",
    desc: "تصفح الإعلانات، شاهد البث المباشر، وتفاعل مع المحتوى بحرية",
    color: "from-green-500/20 to-green-500/5 border-green-400/30 hover:border-green-400",
    iconBg: "bg-green-500/10",
    iconColor: "text-green-600",
  },
];

export default function Login() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      const role = localStorage.getItem("souq_role");
      if (role === "advertiser") setLocation("/create");
      else if (role === "channel") setLocation("/channels/mine");
      else setLocation("/");
    }
  }, [user]);

  const handleLogin = () => {
    if (selectedRole) localStorage.setItem("souq_role", selectedRole);
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background flex flex-col items-center justify-center p-4" dir="rtl">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-tr from-primary to-secondary shadow-2xl shadow-primary/30 mb-4">
            <Megaphone className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
            شبكة سوق للإعلانات
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">منصة الإعلانات الأولى في مصر 🇪🇬</p>
        </div>

        <Card className="rounded-3xl shadow-xl border-border/50 bg-card/90 backdrop-blur">
          <CardContent className="p-6">
            <div className="text-center mb-5">
              <h2 className="text-xl font-bold mb-1">أهلاً بك 👋</h2>
              <p className="text-muted-foreground text-sm">اختر نوع حسابك للمتابعة</p>
            </div>

            {/* Role Selection */}
            <div className="space-y-3 mb-6">
              {ROLES.map(role => (
                <motion.button
                  key={role.id}
                  onClick={() => setSelectedRole(role.id)}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className={`w-full text-right p-4 rounded-2xl border-2 bg-gradient-to-r transition-all duration-200 ${role.color} ${
                    selectedRole === role.id ? 'ring-2 ring-primary ring-offset-2 ring-offset-card' : ''
                  }`}
                  data-testid={`role-${role.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${role.iconBg}`}>
                      <role.icon className={`w-5 h-5 ${role.iconColor}`} />
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-sm flex items-center gap-2">
                        {role.title}
                        {selectedRole === role.id && <CheckCircle2 className="w-4 h-4 text-primary" />}
                      </div>
                      <div className="text-xs text-muted-foreground font-medium">{role.subtitle}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{role.desc}</div>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>

            {/* Login Button */}
            <AnimatePresence>
              {selectedRole && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                >
                  <Button
                    size="lg"
                    onClick={handleLogin}
                    className="w-full h-12 text-base gap-3 rounded-2xl shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all"
                    data-testid="btn-login"
                  >
                    <LogIn className="w-5 h-5" />
                    ادخل الآن — مجاناً
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {!selectedRole && (
              <p className="text-center text-xs text-muted-foreground">
                ← اختر نوع حسابك أعلاه للمتابعة
              </p>
            )}

            <div className="flex items-center gap-3 mt-4 p-3 bg-muted/40 rounded-xl">
              <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                3 رصيد AI مجاناً عند التسجيل · جميع التعاملات بالجنيه المصري
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-5">
          بالدخول فأنت توافق على شروط الخدمة. منصة آمنة 100% 🔒
        </p>
      </motion.div>
    </div>
  );
}
