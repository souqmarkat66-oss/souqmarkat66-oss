import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "./LanguageProvider";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "./NotificationBell";
import {
  LogIn, LogOut, PlusCircle, Globe, LayoutGrid, Megaphone,
  Radio, BarChart2, ShieldCheck, DollarSign, Menu, X, Tv, UserCircle2, MessageSquare, Receipt, FolderOpen, PieChart, Users, HelpCircle
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

const ADMIN_USER_ID = "54219806";

const navLinks = (user: any) => [
  { href: "/ads", label: "الإعلانات", icon: LayoutGrid },
  { href: "/channels", label: "القنوات", icon: Tv },
  { href: "/reels", label: "ريلز", icon: Radio },
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

  const links = navLinks(user);

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/90 backdrop-blur-md">
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
          {/* Live Stream */}
          {user && (
            <Link href="/stream/start" className="hidden md:block">
              <Button size="sm" className="gap-2 bg-red-500 hover:bg-red-600 text-white">
                <Radio className="w-3 h-3 animate-pulse" /> بث مباشر
              </Button>
            </Link>
          )}

          {/* Messages */}
          {user && <MessagesBadge />}

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
                <DropdownMenuItem asChild>
                  <Link href="/messages" className="gap-2 cursor-pointer flex items-center">
                    <MessageSquare className="w-4 h-4 text-green-500" /> الرسائل
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/create" className="gap-2 cursor-pointer flex items-center">
                    <PlusCircle className="w-4 h-4 text-green-500" /> إعلان جديد
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/reels" className="gap-2 cursor-pointer flex items-center">
                    <Radio className="w-4 h-4 text-red-500" /> الريلز
                  </Link>
                </DropdownMenuItem>
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
                <Link href="/messages" onClick={() => setMobileOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start gap-2">
                    <MessageSquare className="w-4 h-4" /> الرسائل
                  </Button>
                </Link>
                <Link href="/social" onClick={() => setMobileOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start gap-2">
                    <Users className="w-4 h-4 text-pink-500" /> الميزات الاجتماعية
                  </Button>
                </Link>
                <Link href="/stream/start" onClick={() => setMobileOpen(false)}>
                  <Button className="w-full gap-2 bg-red-500 hover:bg-red-600 text-white mt-2">
                    <Radio className="w-4 h-4" /> بدء البث المباشر
                  </Button>
                </Link>
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
