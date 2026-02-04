import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "./LanguageProvider";
import { Button } from "@/components/ui/button";
import { 
  LogIn, 
  LogOut, 
  PlusCircle, 
  Globe, 
  LayoutGrid, 
  Megaphone 
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Navbar() {
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [location] = useLocation();

  const isActive = (path: string) => location === path;

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-white shadow-lg group-hover:shadow-primary/25 transition-all">
            <Megaphone className="w-6 h-6" />
          </div>
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/80">
            {t('app.name')}
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-1">
          <Link href="/ads">
            <Button variant={isActive('/ads') ? "secondary" : "ghost"} className="gap-2">
              <LayoutGrid className="w-4 h-4" />
              {t('nav.ads')}
            </Button>
          </Link>
          
          {user && (
            <Link href="/create">
              <Button variant={isActive('/create') ? "secondary" : "ghost"} className="gap-2">
                <PlusCircle className="w-4 h-4" />
                {t('nav.create')}
              </Button>
            </Link>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* Language Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Globe className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setLanguage('ar')} className="gap-2 font-sans">
                <span>🇸🇦</span> العربية
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLanguage('en')} className="gap-2 font-sans">
                <span>🇺🇸</span> English
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Auth */}
          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-medium">{user.firstName}</span>
                <span className="text-xs text-muted-foreground">{user.email}</span>
              </div>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => logout()}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="w-4 h-4 rtl:rotate-180" />
              </Button>
            </div>
          ) : (
            <a href="/api/login">
              <Button className="gap-2 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20">
                <LogIn className="w-4 h-4 rtl:rotate-180" />
                {t('nav.login')}
              </Button>
            </a>
          )}
        </div>
      </div>
    </nav>
  );
}
