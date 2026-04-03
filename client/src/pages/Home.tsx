import { useLanguage } from "@/components/LanguageProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { ArrowRight, Sparkles, Radio, Users, Megaphone, TrendingUp, BarChart2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { AdCard } from "@/components/AdCard";
import { Skeleton } from "@/components/ui/skeleton";

function SuggestionThumb({ src }: { src?: string | null }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div className="w-12 h-12 rounded-xl shrink-0 bg-muted flex items-center justify-center text-muted-foreground text-xl">📢</div>
    );
  }
  return (
    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-muted">
      <img src={src} alt="" className="w-full h-full object-cover" onError={() => setErr(true)} />
    </div>
  );
}

export default function Home() {
  const { t, language } = useLanguage();
  const [, setLocation] = useLocation();
  const [homeSearch, setHomeSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(homeSearch), 300);
    return () => clearTimeout(timer);
  }, [homeSearch]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const { data: suggestions = [], isFetching: suggFetching } = useQuery<any[]>({
    queryKey: ["/api/ads/search", debouncedSearch],
    queryFn: () => fetch(`/api/ads/search?q=${encodeURIComponent(debouncedSearch)}`).then(r => r.json()),
    enabled: debouncedSearch.trim().length >= 2,
  });

  const { data: adsResp, isLoading: adsLoading } = useQuery({ queryKey: ["/api/ads"], queryFn: () => fetch(`/api/ads?language=${language}&limit=8`).then(r => r.json()) });
  const ads: any[] = adsResp?.ads ?? adsResp ?? [];
  const { data: streams, isLoading: streamsLoading } = useQuery({ queryKey: ["/api/streams"], queryFn: () => fetch("/api/streams").then(r => r.json()) });
  const { data: channels } = useQuery({ queryKey: ["/api/channels"], queryFn: () => fetch("/api/channels").then(r => r.json()) });

  const liveStreams = (streams || []).filter((s: any) => s.status === 'live').slice(0, 4);
  const featuredAds = (ads || []).slice(0, 4);
  const topChannels = (channels || []).slice(0, 6);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at 50% 0%, hsl(174 100% 29% / 0.12) 0%, transparent 60%), radial-gradient(circle at 100% 0%, hsl(38 92% 50% / 0.08) 0%, transparent 50%)" }} />
        <div className="container relative px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" /> شبكة الإعلانات الذكية مع AI
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-[1.1]">
              {t('hero.title')}
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
              منصة متكاملة للإعلانات والبث المباشر وإدارة الحملات بذكاء اصطناعي
            </p>
            {/* Global Search Bar with instant suggestions */}
            <form
              className="max-w-xl mx-auto mb-8"
              onSubmit={e => {
                e.preventDefault();
                setShowSuggestions(false);
                if (homeSearch.trim()) setLocation(`/ads?q=${encodeURIComponent(homeSearch.trim())}`);
              }}
            >
              <div ref={searchRef} className="relative">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                    <Input
                      value={homeSearch}
                      onChange={e => { setHomeSearch(e.target.value); setShowSuggestions(true); }}
                      onFocus={() => homeSearch.trim().length >= 2 && setShowSuggestions(true)}
                      placeholder="ابحث عن إعلانات، منتجات، خدمات..."
                      className="pr-12 h-12 rounded-2xl text-base bg-background/80 backdrop-blur border-border/60 shadow-lg focus-visible:ring-primary"
                      data-testid="input-home-search"
                    />
                    {suggFetching && (
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground animate-pulse">جاري البحث...</span>
                    )}
                  </div>
                  <Button type="submit" size="lg" className="h-12 px-6 rounded-2xl shadow-lg shadow-primary/20 shrink-0" data-testid="btn-home-search-submit">
                    بحث
                  </Button>
                </div>
                {/* Suggestions Dropdown */}
                {showSuggestions && debouncedSearch.trim().length >= 2 && suggestions.length > 0 && (
                  <div className="absolute top-full mt-2 w-full bg-background border border-border/60 rounded-2xl shadow-xl z-50 overflow-hidden" data-testid="search-suggestions-dropdown">
                    {suggestions.slice(0, 6).map((ad: any) => (
                      <button
                        key={ad.id}
                        type="button"
                        className="flex items-center gap-3 w-full px-4 py-3 hover:bg-muted/60 transition-colors text-right border-b border-border/30 last:border-b-0"
                        data-testid={`suggestion-ad-${ad.id}`}
                        onClick={() => {
                          setShowSuggestions(false);
                          setHomeSearch(ad.title);
                          setLocation(`/ads?q=${encodeURIComponent(ad.title)}`);
                        }}
                      >
                        <SuggestionThumb src={ad.mediaType !== 'video' ? ad.mediaUrl : null} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{ad.title}</p>
                          {(ad.priceEGP ?? 0) > 0 && (
                            <p className="text-xs text-primary font-bold">{ad.priceEGP?.toLocaleString()} ج.م</p>
                          )}
                        </div>
                      </button>
                    ))}
                    {suggestions.length > 6 && (
                      <button
                        type="button"
                        className="w-full px-4 py-2.5 text-sm text-primary font-medium text-center hover:bg-muted/40 transition-colors"
                        data-testid="btn-show-all-search-results"
                        onClick={() => {
                          setShowSuggestions(false);
                          setLocation(`/ads?q=${encodeURIComponent(homeSearch.trim())}`);
                        }}
                      >
                        عرض جميع النتائج ({suggestions.length})
                      </button>
                    )}
                  </div>
                )}
                {showSuggestions && debouncedSearch.trim().length >= 2 && !suggFetching && suggestions.length === 0 && (
                  <div className="absolute top-full mt-2 w-full bg-background border border-border/60 rounded-2xl shadow-xl z-50 px-4 py-4 text-sm text-muted-foreground text-center" data-testid="search-no-results">
                    لا توجد نتائج لـ «{debouncedSearch}»
                  </div>
                )}
              </div>
            </form>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/create">
                <Button size="lg" className="h-14 px-8 text-lg gap-2 shadow-xl shadow-primary/25 hover:shadow-primary/40 transition-all hover:-translate-y-1">
                  {t('hero.cta')} <ArrowRight className="w-5 h-5 rtl:rotate-180" />
                </Button>
              </Link>
              <Link href="/stream/start">
                <Button size="lg" variant="outline" className="h-14 px-8 text-lg gap-2 bg-background/50 backdrop-blur">
                  <Radio className="w-5 h-5 text-red-500 animate-pulse" /> ابدأ بثاً مباشراً
                </Button>
              </Link>
              <Link href="/ads">
                <Button size="lg" variant="ghost" className="h-14 px-8 text-lg">
                  {t('nav.ads')}
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-12 bg-muted/30">
        <div className="container px-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Radio, title: "بث مباشر", desc: "كاميرا وصوت وصورة مع دردشة حية", color: "text-red-500", bg: "bg-red-500/10", href: "/channels" },
              { icon: Megaphone, title: "إعلانات ذكية", desc: "توليد محتوى بالذكاء الاصطناعي", color: "text-primary", bg: "bg-primary/10", href: "/create" },
              { icon: BarChart2, title: "حملات مستهدفة", desc: "استهداف حقيقي مثل Facebook Ads", color: "text-blue-500", bg: "bg-blue-500/10", href: "/campaigns" },
              { icon: TrendingUp, title: "إيرادات القنوات", desc: "اربح من قناتك مثل YouTube", color: "text-green-500", bg: "bg-green-500/10", href: "/revenue" },
            ].map(f => (
              <Link key={f.title} href={f.href}>
                <motion.div whileHover={{ y: -4 }} className="cursor-pointer">
                  <Card className="rounded-2xl hover:shadow-lg transition-all border-border/50 hover:border-primary/30">
                    <CardContent className="p-5">
                      <div className={`w-10 h-10 rounded-xl ${f.bg} flex items-center justify-center mb-3`}>
                        <f.icon className={`w-5 h-5 ${f.color}`} />
                      </div>
                      <h3 className="font-bold mb-1">{f.title}</h3>
                      <p className="text-sm text-muted-foreground">{f.desc}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Live Streams */}
      {liveStreams.length > 0 && (
        <section className="py-12">
          <div className="container px-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-extrabold flex items-center gap-2">
                <Radio className="w-6 h-6 text-red-500 animate-pulse" /> البث المباشر الآن
                <Badge className="bg-red-500 text-white animate-pulse text-xs">{liveStreams.length} مباشر</Badge>
              </h2>
              <Link href="/channels"><Button variant="ghost" size="sm" className="gap-1">عرض الكل <ArrowRight className="w-4 h-4 rtl:rotate-180" /></Button></Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {liveStreams.map((s: any, i: number) => (
                <motion.div key={s.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Link href={`/streams/${s.id}`}>
                    <Card className="overflow-hidden rounded-2xl cursor-pointer hover:shadow-xl hover:border-red-500/30 transition-all group">
                      <div className="aspect-video bg-muted relative">
                        {s.thumbnailUrl ? <img src={s.thumbnailUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="" /> : <div className="w-full h-full flex items-center justify-center"><Radio className="w-8 h-8 text-red-500 animate-pulse" /></div>}
                        <Badge className="absolute top-2 end-2 bg-red-500 text-white gap-1 text-xs animate-pulse"><Radio className="w-2 h-2" /> مباشر</Badge>
                        <div className="absolute bottom-2 start-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">{(s.viewerCount || 0).toLocaleString()} مشاهد</div>
                      </div>
                      <CardContent className="p-3">
                        <h3 className="font-bold text-sm line-clamp-1">{s.title}</h3>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured Ads */}
      <section className="py-12 bg-muted/20">
        <div className="container px-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-extrabold">{t('ads.title')}</h2>
            <Link href="/ads"><Button variant="ghost" size="sm" className="gap-1">عرض الكل <ArrowRight className="w-4 h-4 rtl:rotate-180" /></Button></Link>
          </div>
          {adsLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="aspect-[4/3] rounded-3xl" />)}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredAds.map((ad: any, i: number) => <AdCard key={ad.id} ad={ad} index={i} />)}
            </div>
          )}
        </div>
      </section>

      {/* Top Channels */}
      {topChannels.length > 0 && (
        <section className="py-12">
          <div className="container px-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-extrabold">🌟 أبرز القنوات</h2>
              <Link href="/channels"><Button variant="ghost" size="sm" className="gap-1">عرض الكل <ArrowRight className="w-4 h-4 rtl:rotate-180" /></Button></Link>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {topChannels.map((ch: any) => (
                <Link key={ch.id} href={`/channels/${ch.id}`}>
                  <motion.div whileHover={{ y: -4 }} className="flex flex-col items-center gap-2 min-w-[100px] cursor-pointer">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xl font-bold border-4 border-background shadow-lg">
                      {ch.avatarUrl ? <img src={ch.avatarUrl} className="w-full h-full rounded-full object-cover" alt="" /> : ch.name[0]}
                    </div>
                    <span className="text-xs font-medium text-center line-clamp-1 max-w-[80px]">{ch.name}</span>
                    <span className="text-xs text-muted-foreground">{ch.subscriberCount?.toLocaleString()} مشترك</span>
                  </motion.div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
