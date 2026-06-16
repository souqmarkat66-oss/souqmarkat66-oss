import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "./LanguageProvider";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "./NotificationBell";
import {
  LogIn, LogOut, PlusCircle, Globe, LayoutGrid, Megaphone,
  Radio, BarChart2, ShieldCheck, DollarSign, Menu, X, Tv, UserCircle2, MessageSquare, Receipt, FolderOpen, PieChart, Users, HelpCircle, Cast, Loader2, AlertOctagon
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const ADMIN_USER_ID = "54219806";

const navLinks = (user: any) => [
  { href: "/ads", label: "الإعلانات", icon: LayoutGrid },
  { href: "/channels", label: "القنوات", icon: Tv },
  { href: "/reels", label: "ريلز", icon: Radio },
  { href: "/livestream", label: "مباشر", icon: Cast },
  { href: "/help", label: "المساعدة", icon: HelpCircle },
  ...(user ? [
    { href: "/my-content", label: "محتواي", icon: UserCircle2 },
    { href: "/create", label: "إعلان جديد", icon: PlusCircle },
    { href: "/media-library", label: "المكتبة", icon: FolderOpen },
    { href: "/campaigns", label: "الحملات", icon: BarChart2 },
    { href: "/revenue", label: "الإيرادات", icon: DollarSign },
    { href: "/payments", label: "المدفوعات", icon: Receipt },
    ...(user.id === ADMIN_USER_ID ? [{ href: "/admin", label: "الإدارة", icon: ShieldCheck }] : []),
  ] : []),
];

function LiveClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const cairoTime = time.toLocaleTimeString("ar-EG", {
    timeZone: "Africa/Cairo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const cairoDate = time.toLocaleDateString("ar-EG", {
    timeZone: "Africa/Cairo",
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <div
      className="hidden md:flex flex-col items-center leading-none px-3 py-1 rounded-xl bg-muted/60 border border-border/60 select-none"
      data-testid="live-clock"
      title={`توقيت القاهرة — ${cairoDate}`}
    >
      <span className="text-sm font-bold tabular-nums text-foreground tracking-wide">{cairoTime}</span>
      <span className="text-[10px] text-muted-foreground mt-0.5">{cairoDate}</span>
    </div>
  );
}

function QuickBroadcastButton() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const broadcastM = useMutation({
    mutationFn: async (msg: string) => {
      const r = await apiRequest("POST", "/api/ticker-ads", { text: msg, budgetEGP: 0, pricePerSecondEGP: 0 });
      const ad = await r.json();
      await apiRequest("POST", `/api/admin/ticker-ads/${ad.id}/start`);
      return ad;
    },
    onSuccess: () => {
      toast({ title: "🔴 الشريط شغال دلوقتي", description: "تم بث إعلانك المجاني فوراً" });
      setText("");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["/api/admin/ticker-ads/history"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/ticker-ads/stats"] });
    },
    onError: (e: any) => toast({ title: "فشل البث", description: e?.message || "خطأ", variant: "destructive" }),
  });

  return (
    <>
      <Button
        size="icon"
        onClick={() => setOpen(true)}
        className="flex w-9 h-9 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/30"
        title="بث عاجل مجاني (أدمن)"
        data-testid="btn-nav-quick-broadcast"
      >
        <AlertOctagon className="w-4 h-4 animate-pulse" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertOctagon className="w-5 h-5 animate-pulse" /> بث شريط عاجل مجاني
            </DialogTitle>
            <DialogDescription>
              النص هيظهر فوراً في شريط الأخبار العاجلة عند كل المشاهدين بدون أي خصم.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="اكتب الخبر العاجل هنا..."
            rows={3}
            data-testid="input-quick-broadcast"
          />
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} data-testid="btn-quick-broadcast-cancel">
              إلغاء
            </Button>
            <Button
              onClick={() => broadcastM.mutate(text.trim())}
              disabled={text.trim().length < 5 || broadcastM.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="btn-quick-broadcast-send"
            >
              {broadcastM.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Radio className="w-4 h-4 ml-2" />}
              بث الآن
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function MessagesBadge() {
  const { user } = useAuth();
  const { data } = useQuery<{ count: number }>({
    queryKey: ["/api/messages/unread-count"],
    queryFn: () => fetch("/api/messages/unread-count", { credentials: "include" }).then(r => r.json()),
    enabled: !!user,
    refetchInterval: 15000,
  });
  const count = data?.count || 0;
  return (
    <Link href="/messages" className="relative">
      <Button variant="ghost" size="icon" className="relative rounded-full w-9 h-9" data-testid="btn-nav-messages">
        <MessageSquare className="w-5 h-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-green-500 text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Button>
    </Link>
  );
}

export function Navbar() {
  const { user, logout } = useAuth();
  const { setLanguage } = useLanguage();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isActive = (path: string) => location === path;

  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
    queryFn: () => fetch("/api/settings").then(r => r.json()),
    staleTime: 60 * 1000,
  });

  const feat = (key: string) => settings?.[key] !== "0";

  const allLinks = navLinks(user);
  const links = allLinks.filter(l => {
    if (l.href === "/ads")         return feat("feature_ads");
    if (l.href === "/channels")    return feat("feature_channels");
    if (l.href === "/reels")       return feat("feature_reels");
    if (l.href === "/livestream")  return feat("feature_livestream");
    if (l.href === "/campaigns")   return feat("feature_campaigns");
    return true;
  });

  const bannerEnabled = settings?.promoBannerEnabled !== "0";
  const bannerText = settings?.promoBannerText || "";
  const bannerUrl  = settings?.promoBannerUrl  || "https://play.google.com/store/apps/details?id=com.apmo.souqmarket";
  const whatsapp   = settings?.contactWhatsapp || "";
  const instapay   = settings?.contactInstapay || "01285558567";

  const tickerParts = [
    ...(bannerText ? bannerText.split("|").map(s => s.trim()).filter(Boolean) : []),
    ...(whatsapp  ? [`📱 واتساب: ${whatsapp}`]  : []),
    ...(instapay  ? [`💳 InstaPay: ${instapay}`] : []),
  ];

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/90 backdrop-blur-md">
      {/* ── Contact/Promo Ticker ─────────────────────────────────────── */}
      {bannerEnabled && tickerParts.length > 0 && (
        <a
          href={bannerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full overflow-hidden bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 py-1.5 cursor-pointer hover:brightness-110 transition-all"
          data-testid="promo-ticker"
        >
          <div
            className="flex gap-12 whitespace-nowrap text-white text-xs font-bold animate-[marquee_30s_linear_infinite]"
            style={{ direction: "rtl" }}
          >
            {[...Array(4)].map((_, i) => (
              <span key={i} className="flex items-center gap-6 shrink-0">
                {tickerParts.map((part, j) => (
                  <span key={j} className="flex items-center gap-1.5">
                    {part}
                    <span className="text-white/50 mx-1">◆</span>
                  </span>
                ))}
              </span>
            ))}
          </div>
        </a>
      )}
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 group shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-white shadow-lg">
            <Megaphone className="w-5 h-5" />
          </div>
          <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary hidden sm:block">
            Souq Ads
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden lg:flex items-center gap-1 flex-1 justify-center">
          {links.map(l => (
            <Link key={l.href} href={l.href}>
              <Button variant={isActive(l.href) ? "secondary" : "ghost"} size="sm" className="gap-2 text-sm">
                <l.icon className="w-4 h-4" />
                {l.label}
              </Button>
            </Link>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          {/* Clock */}
          <LiveClock />

          {/* Admin Quick Broadcast */}
          {user && (user.isAdmin === true || user.id === ADMIN_USER_ID) && <QuickBroadcastButton />}

          {/* Live Stream */}
          {user && feat("feature_livestream") && (
            <Link href="/stream/start" className="hidden md:block">
              <Button size="sm" className="gap-2 bg-red-500 hover:bg-red-600 text-white">
                <Radio className="w-3 h-3 animate-pulse" /> بث مباشر
              </Button>
            </Link>
          )}

          {/* Messages */}
          {user && feat("feature_messages") && <MessagesBadge />}

          {/* Notifications */}
          {user && <NotificationBell />}

          {/* Language */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full w-8 h-8">
                <Globe className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setLanguage('ar')} className="gap-2">🇪🇬 العربية</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLanguage('en')} className="gap-2">🇺🇸 English</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Auth */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 hidden sm:flex">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xs font-bold">
                    {user.firstName?.[0] || "U"}
                  </div>
                  {user.firstName}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52" {...({ dir: "rtl" } as any)}>
                <DropdownMenuItem asChild>
                  <Link href={`/profile/${user.id}`} className="gap-2 cursor-pointer flex items-center">
                    <UserCircle2 className="w-4 h-4 text-primary" /> ملفي الشخصي واهتماماتي
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/my-content" className="gap-2 cursor-pointer flex items-center">
                    <LayoutGrid className="w-4 h-4 text-blue-500" /> محتواي وإعلاناتي
                  </Link>
                </DropdownMenuItem>
                {user.id !== ADMIN_USER_ID && (
                  <DropdownMenuItem asChild>
                    <Link href="/my-dashboard" className="gap-2 cursor-pointer flex items-center">
                      <PieChart className="w-4 h-4 text-teal-500" /> تقاريري ولوحتي
                    </Link>
                  </DropdownMenuItem>
                )}
                {feat("feature_messages") && (
                  <DropdownMenuItem asChild>
                    <Link href="/messages" className="gap-2 cursor-pointer flex items-center">
                      <MessageSquare className="w-4 h-4 text-green-500" /> الرسائل
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/create" className="gap-2 cursor-pointer flex items-center">
                    <PlusCircle className="w-4 h-4 text-green-500" /> إعلان جديد
                  </Link>
                </DropdownMenuItem>
                {feat("feature_reels") && (
                  <DropdownMenuItem asChild>
                    <Link href="/reels" className="gap-2 cursor-pointer flex items-center">
                      <Radio className="w-4 h-4 text-red-500" /> الريلز
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/social" className="gap-2 cursor-pointer flex items-center">
                    <Users className="w-4 h-4 text-pink-500" /> الميزات الاجتماعية
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/help" className="gap-2 cursor-pointer flex items-center">
                    <HelpCircle className="w-4 h-4 text-amber-500" /> المساعدة والشرح
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => logout()} className="gap-2 text-destructive">
                  <LogOut className="w-4 h-4" /> تسجيل الخروج
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-1.5">
              <Link href="/help">
                <Button variant="ghost" size="icon" className="rounded-full w-8 h-8 hidden sm:flex" title="المساعدة">
                  <HelpCircle className="w-4 h-4 text-amber-500" />
                </Button>
              </Link>
              <a href="/login">
                <Button size="sm" className="gap-2 bg-primary text-white shadow-md shadow-primary/30" data-testid="btn-nav-login">
                  <LogIn className="w-4 h-4" /> دخول / تسجيل
                </Button>
              </a>
            </div>
          )}

          {/* Mobile Menu Toggle */}
          <Button variant="ghost" size="icon" className="lg:hidden w-8 h-8" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="lg:hidden border-t bg-background/95 backdrop-blur">
          <div className="container px-4 py-3 flex flex-col gap-1">
            {!user && (
              <a href="/login" onClick={() => setMobileOpen(false)}>
                <Button className="w-full gap-2 bg-primary text-white mb-2">
                  <LogIn className="w-4 h-4" /> دخول / تسجيل
                </Button>
              </a>
            )}
            {links.map(l => (
              <Link key={l.href} href={l.href} onClick={() => setMobileOpen(false)}>
                <Button variant={isActive(l.href) ? "secondary" : "ghost"} className="w-full justify-start gap-2">
                  <l.icon className="w-4 h-4" /> {l.label}
                </Button>
              </Link>
            ))}
            {user && (
              <>
                <Link href={`/profile/${user.id}`} onClick={() => setMobileOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start gap-2">
                    <UserCircle2 className="w-4 h-4 text-primary" /> ملفي الشخصي واهتماماتي
                  </Button>
                </Link>
                {user.id !== ADMIN_USER_ID && (
                  <Link href="/my-dashboard" onClick={() => setMobileOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start gap-2">
                      <PieChart className="w-4 h-4 text-teal-500" /> تقاريري ولوحتي
                    </Button>
                  </Link>
                )}
                {feat("feature_messages") && (
                  <Link href="/messages" onClick={() => setMobileOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start gap-2">
                      <MessageSquare className="w-4 h-4" /> الرسائل
                    </Button>
                  </Link>
                )}
                <Link href="/social" onClick={() => setMobileOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start gap-2">
                    <Users className="w-4 h-4 text-pink-500" /> الميزات الاجتماعية
                  </Button>
                </Link>
                {feat("feature_livestream") && (
                  <Link href="/stream/start" onClick={() => setMobileOpen(false)}>
                    <Button className="w-full gap-2 bg-red-500 hover:bg-red-600 text-white mt-2">
                      <Radio className="w-4 h-4" /> بدء البث المباشر
                    </Button>
                  </Link>
                )}
                <Link href="/help" onClick={() => setMobileOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start gap-2">
                    <HelpCircle className="w-4 h-4 text-amber-500" /> المساعدة والشرح
                  </Button>
                </Link>
              </>
            )}
            {!user && (
              <Link href="/help" onClick={() => setMobileOpen(false)}>
                <Button variant="ghost" className="w-full justify-start gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-500" /> المساعدة والشرح
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
