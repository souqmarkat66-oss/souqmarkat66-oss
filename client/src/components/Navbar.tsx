import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "./LanguageProvider";
import { Button } from "@/components/ui/button";
import { 
  LogIn, LogOut, PlusCircle, Globe, LayoutGrid, Megaphone, 
  Radio, BarChart2, ShieldCheck, DollarSign, Menu, X, Tv
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";

const ADMIN_USER_ID = "54219806";

const navLinks = (user: any) => [
  { href: "/ads", label: "الإعلانات", icon: LayoutGrid },
  { href: "/channels", label: "القنوات", icon: Tv },
  { href: "/reels", label: "ريلز", icon: Radio },
  ...(user ? [
    { href: "/create", label: "إعلان جديد", icon: PlusCircle },
    { href: "/campaigns", label: "الحملات", icon: BarChart2 },
    { href: "/revenue", label: "الإيرادات", icon: DollarSign },
    ...(user.id === ADMIN_USER_ID ? [{ href: "/admin", label: "الإدارة", icon: ShieldCheck }] : []),
  ] : []),
];

export function Navbar() {
  const { user, logout } = useAuth();
  const { setLanguage, t } = useLanguage();
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
        <div className="flex items-center gap-2">
          {/* Live Stream */}
          {user && (
            <Link href="/stream/start" className="hidden md:block">
              <Button size="sm" className="gap-2 bg-red-500 hover:bg-red-600 text-white">
                <Radio className="w-3 h-3 animate-pulse" /> بث مباشر
              </Button>
            </Link>
          )}

          {/* Language */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full w-8 h-8">
                <Globe className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setLanguage('ar')} className="gap-2">🇸🇦 العربية</DropdownMenuItem>
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
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => logout()} className="gap-2 text-destructive">
                  <LogOut className="w-4 h-4" /> تسجيل الخروج
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <a href="/login">
              <Button size="sm" className="gap-2 bg-primary text-white" data-testid="btn-nav-login">
                <LogIn className="w-4 h-4" /> {t('nav.login')}
              </Button>
            </a>
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
            {links.map(l => (
              <Link key={l.href} href={l.href} onClick={() => setMobileOpen(false)}>
                <Button variant={isActive(l.href) ? "secondary" : "ghost"} className="w-full justify-start gap-2">
                  <l.icon className="w-4 h-4" /> {l.label}
                </Button>
              </Link>
            ))}
            {user && (
              <Link href="/stream/start" onClick={() => setMobileOpen(false)}>
                <Button className="w-full gap-2 bg-red-500 hover:bg-red-600 text-white mt-2">
                  <Radio className="w-4 h-4" /> بدء البث المباشر
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
