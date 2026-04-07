import { Link } from "wouter";
import { Home, Megaphone, Radio, Tv, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4" dir="rtl">
      <div className="text-center max-w-md w-full">

        {/* 404 number */}
        <div className="relative mb-6">
          <span
            className="text-[120px] sm:text-[160px] font-black leading-none select-none"
            style={{
              background: "linear-gradient(135deg, hsl(var(--primary)), #f97316)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center opacity-5">
            <Search className="w-32 h-32 text-foreground" />
          </div>
        </div>

        {/* Message */}
        <h1 className="text-xl sm:text-2xl font-extrabold mb-2 text-foreground">
          الصفحة غير موجودة
        </h1>
        <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
          الرابط الذي تبحث عنه غير موجود أو تم حذفه.<br />
          يمكنك العودة للرئيسية أو تصفح أقسام المنصة.
        </p>

        {/* Primary CTA */}
        <Link href="/">
          <Button className="gap-2 mb-6 px-6" size="lg" data-testid="btn-go-home">
            <Home className="w-4 h-4" />
            العودة للرئيسية
          </Button>
        </Link>

        {/* Quick links */}
        <div className="grid grid-cols-3 gap-3 mt-2">
          {[
            { href: "/ads",     icon: Megaphone, label: "الإعلانات", color: "text-violet-500",  bg: "bg-violet-500/10" },
            { href: "/streams", icon: Radio,     label: "البث",       color: "text-red-500",     bg: "bg-red-500/10"    },
            { href: "/channels",icon: Tv,        label: "القنوات",    color: "text-orange-500",  bg: "bg-orange-500/10" },
          ].map(item => (
            <Link key={item.href} href={item.href}>
              <div
                className={`flex flex-col items-center gap-2 p-3 rounded-2xl border border-border/50 hover:border-primary/40 transition-colors cursor-pointer ${item.bg}`}
                data-testid={`link-404-${item.label}`}
              >
                <item.icon className={`w-5 h-5 ${item.color}`} />
                <span className="text-xs font-medium text-foreground">{item.label}</span>
              </div>
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}
