import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Users, Radio, CheckCircle, Plus, Bell, Megaphone, Film, Play, Copy, CheckCheck, TrendingUp, DollarSign, Code2, ChevronDown, ChevronUp, Globe, Monitor } from "lucide-react";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { AdCard } from "@/components/AdCard";
import { AdWidget } from "@/components/AdWidget";
import type { Channel, LiveStream, Ad } from "@shared/schema";

export default function ChannelPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const numericId = Number(id);
  const isValidId = !isNaN(numericId) && numericId > 0;

  const { data: channel, isLoading } = useQuery<Channel>({
    queryKey: ["/api/channels", numericId],
    queryFn: () => fetch(`/api/channels/${id}`).then(r => r.json()),
    enabled: isValidId
  });

  const { data: streams } = useQuery<LiveStream[]>({
    queryKey: ["/api/channels", numericId, "streams"],
    queryFn: () => fetch(`/api/channels/${id}/streams`).then(r => r.json()),
    enabled: isValidId
  });

  const { data: followData } = useQuery<{ following: boolean }>({
    queryKey: ["/api/channels", numericId, "follow"],
    queryFn: () => fetch(`/api/channels/${id}/follow`, { credentials: "include" }).then(r => r.json()),
    enabled: !!user && isValidId
  });

  // Fetch ads belonging to this channel's owner
  const { data: channelAds = [] } = useQuery<Ad[]>({
    queryKey: ["/api/ads", "channel", channel?.userId],
    queryFn: () => fetch(`/api/ads?userId=${channel!.userId}`).then(r => r.json()),
    enabled: !!channel?.userId
  });

  // Fetch reels belonging to this channel's owner
  const { data: channelReels = [] } = useQuery<any[]>({
    queryKey: ["/api/reels", "channel", channel?.userId],
    queryFn: () => fetch(`/api/reels?userId=${channel!.userId}`).then(r => r.json()),
    enabled: !!channel?.userId
  });

  const followMutation = useMutation({
    mutationFn: () => fetch(`/api/channels/${id}/follow`, { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/channels", Number(id), "follow"] });
      qc.invalidateQueries({ queryKey: ["/api/channels", Number(id)] });
      toast({ title: data.following ? "✅ تم الاشتراك!" : "تم إلغاء الاشتراك" });
    },
  });

  const isOwner = user && channel?.userId === user.id;
  const [codeCopied, setCodeCopied] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyCode = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast({ title: "✅ تم نسخ الكود!" });
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleCopyCode = () => {
    if (channel?.publisherCode) {
      navigator.clipboard.writeText(channel.publisherCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
      toast({ title: "✅ تم نسخ كود الناشر!" });
    }
  };

  if (!isValidId) return <div className="container py-12 text-center"><h2 className="text-2xl">رقم القناة غير صحيح</h2></div>;
  if (isLoading) return <div className="container py-12"><Skeleton className="h-64 rounded-2xl" /></div>;
  if (!channel) return <div className="container py-12 text-center"><h2 className="text-2xl">القناة غير موجودة</h2></div>;

  const liveStream = (Array.isArray(streams) ? streams : []).find(s => s.status === 'live');

  return (
    <div className="min-h-screen" dir="rtl">
      {/* Banner */}
      <div className="relative h-52 bg-gradient-to-br from-primary/30 to-secondary/30">
        {channel.bannerUrl && <img src={channel.bannerUrl} className="w-full h-full object-cover" alt="" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
      </div>

      <div className="container px-4">
        {/* Channel Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 -mt-14 mb-8 relative z-10">
          <div className="w-28 h-28 rounded-full border-4 border-background bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-4xl font-bold shadow-xl shrink-0">
            {channel.avatarUrl
              ? <img src={channel.avatarUrl} className="w-full h-full rounded-full object-cover" alt="" />
              : channel.name[0]}
          </div>
          <div className="flex-1 bg-background/90 backdrop-blur rounded-2xl p-4 pt-6 sm:pt-4 shadow-lg border border-border/30">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold">{channel.name}</h1>
              {channel.isVerified && <CheckCircle className="w-5 h-5 text-primary shrink-0" />}
              {channel.isMonetized && <Badge className="bg-yellow-500 text-white">💰 مُربحة</Badge>}
              {channel.status === 'suspended' && <Badge variant="destructive">موقوفة</Badge>}
              {liveStream && <Badge className="bg-red-500 text-white animate-pulse gap-1"><Radio className="w-3 h-3" /> مباشر الآن</Badge>}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {(channel.subscriberCount || 0).toLocaleString()} مشترك</span>
              <Badge variant="outline">{channel.category}</Badge>
              {channelAds.length > 0 && (
                <span className="flex items-center gap-1"><Megaphone className="w-3 h-3" /> {channelAds.length} إعلان</span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 items-center flex-wrap">
            {liveStream && (
              <Link href={`/streams/${liveStream.id}`}>
                <Button className="gap-2 bg-red-500 hover:bg-red-600 text-white animate-pulse">
                  <Radio className="w-4 h-4" /> شاهد المباشر
                </Button>
              </Link>
            )}
            {user && !isOwner && (
              <Button
                onClick={() => followMutation.mutate()}
                variant={followData?.following ? "outline" : "default"}
                className="gap-2"
                disabled={followMutation.isPending}
              >
                <Bell className="w-4 h-4" />
                {followData?.following ? "إلغاء الاشتراك" : "اشترك"}
              </Button>
            )}
            {isOwner && (
              <>
                <Link href="/stream/start">
                  <Button className="gap-2 bg-red-500 text-white">
                    <Radio className="w-4 h-4" /> ابدأ البث
                  </Button>
                </Link>
                <Link href="/create">
                  <Button variant="outline" className="gap-2">
                    <Plus className="w-4 h-4" /> إعلان جديد
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {channel.description && (
          <p className="text-muted-foreground mb-6 max-w-2xl">{channel.description}</p>
        )}

        {/* ── إعلان مدمج مرئي لزوار القناة ─────────────── */}
        {channel?.isMonetized && <AdWidget variant="banner" channelId={channel?.id} className="mb-8 max-w-2xl" />}

        {/* ── PUBLISHER CODE (Owner Only) ──────────────────────── */}
        {isOwner && channel.publisherCode && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <Card className="border-2 border-yellow-400/50 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/20 rounded-2xl overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <Megaphone className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">كود الناشر الخاص بك</h3>
                    <p className="text-xs text-muted-foreground">شارك هذا الكود مع المعلنين لعرض إعلاناتهم على قناتك</p>
                  </div>
                </div>

                {/* Publisher Code Display */}
                <div className="flex items-center gap-3 bg-background/80 dark:bg-background/40 rounded-xl p-3 border border-yellow-200/60 dark:border-yellow-800/40 mb-4">
                  <code className="flex-1 text-lg font-bold tracking-widest text-yellow-700 dark:text-yellow-400 font-mono">
                    {channel.publisherCode}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyCode}
                    className="gap-1.5 border-yellow-400/50 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 shrink-0"
                    data-testid="btn-copy-publisher-code"
                  >
                    {codeCopied ? <CheckCheck className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {codeCopied ? "تم النسخ!" : "نسخ"}
                  </Button>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-white/60 dark:bg-black/20 rounded-xl p-2.5">
                    <TrendingUp className="w-4 h-4 mx-auto mb-1 text-blue-500" />
                    <div className="text-sm font-bold">{(channel.viewsCount || 0).toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">مشاهدة</div>
                  </div>
                  <div className="bg-white/60 dark:bg-black/20 rounded-xl p-2.5">
                    <DollarSign className="w-4 h-4 mx-auto mb-1 text-green-500" />
                    <div className="text-sm font-bold">{(channel.earningsEGP || 0).toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">أرباح (ج.م)</div>
                  </div>
                  <div className="bg-white/60 dark:bg-black/20 rounded-xl p-2.5">
                    <Users className="w-4 h-4 mx-auto mb-1 text-purple-500" />
                    <div className="text-sm font-bold">{(channel.subscriberCount || 0).toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">مشترك</div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mt-3 text-center">
                  💰 نسبة أرباحك من الإعلانات: <strong className="text-yellow-600 dark:text-yellow-400">60%</strong> من كل مشاهدة
                </p>

                {/* ─── Embed Codes Toggle ─────────────────────── */}
                <button
                  onClick={() => setShowEmbed(v => !v)}
                  className="w-full mt-4 flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-bold text-sm transition-all"
                  data-testid="btn-toggle-embed"
                >
                  <span className="flex items-center gap-2"><Code2 className="w-4 h-4" /> شفرات التضمين (إضافة الإعلانات للقناة والبث والريلز)</span>
                  {showEmbed ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
                </button>

                {showEmbed && channel.publisherCode && (() => {
                  const base = window.location.origin;
                  const pub = channel.publisherCode;
                  const scriptCode = `<!-- شفرة إعلانات سوق — ضعها في أي موقع أو صفحة -->
<script src="${base}/api/widget/${pub}" async></script>`;
                  const iframeCode = `<!-- شفرة iframe — مناسبة للبث الخارجي وبرنامج OBS -->
<iframe
  src="${base}/api/widget/${pub}/iframe"
  width="480" height="120"
  style="border:none;border-radius:10px"
  scrolling="no"
  allowtransparency="true">
</iframe>`;
                  const overlayCode = `// ── OBS Browser Source ──
// أضف هذا الرابط في Browser Source داخل OBS:
${base}/api/widget/${pub}/iframe

// الأبعاد المقترحة: 480 × 120 px`;
                  const apiCode = `// ── كود JavaScript/API ──
// استدعاء إعلان عشوائي وعرضه في البث أو الريلز:
fetch('${base}/api/campaigns/random')
  .then(r => r.json())
  .then(ad => {
    // ad.mediaUrl  ← رابط الصورة/الفيديو
    // ad.targetUrl ← الرابط عند الضغط
    // ad.name      ← اسم الحملة
    showAd(ad); // دالتك الخاصة
    // تسجيل ظهور الإعلان:
    fetch('/api/campaigns/' + ad.id + '/impression', {method:'POST'});
  });`;
                  const snippets = [
                    { key: "script", icon: <Globe className="w-3.5 h-3.5" />, label: "موقع ويب / HTML", code: scriptCode, lang: "html", desc: "ضعه في أي صفحة HTML قبل </body>" },
                    { key: "iframe", icon: <Monitor className="w-3.5 h-3.5" />, label: "iframe — البث الخارجي", code: iframeCode, lang: "html", desc: "مناسب لـ OBS وأي بث خارجي" },
                    { key: "overlay", icon: <Radio className="w-3.5 h-3.5" />, label: "OBS Browser Source", code: overlayCode, lang: "text", desc: "أضف الرابط مباشرة في OBS كمصدر متصفح" },
                    { key: "api", icon: <Code2 className="w-3.5 h-3.5" />, label: "JavaScript API — الريلز والتطبيقات", code: apiCode, lang: "javascript", desc: "للمطورين — يعمل مع أي تطبيق أو ريلز" },
                  ];
                  return (
                    <div className="mt-3 space-y-3">
                      {snippets.map(s => (
                        <div key={s.key} className="rounded-xl overflow-hidden border border-border/50">
                          <div className="flex items-center justify-between px-3 py-2 bg-gray-900">
                            <div className="flex items-center gap-1.5 text-gray-300 text-xs font-bold">
                              {s.icon} {s.label}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500 text-xs hidden sm:block">{s.desc}</span>
                              <button
                                onClick={() => copyCode(s.code, s.key)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all"
                                data-testid={`btn-copy-embed-${s.key}`}
                              >
                                {copiedKey === s.key ? <CheckCheck className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                                {copiedKey === s.key ? "تم!" : "نسخ"}
                              </button>
                            </div>
                          </div>
                          <pre className="bg-gray-950 text-green-400 text-xs font-mono p-3 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                            {s.code}
                          </pre>
                        </div>
                      ))}
                      <p className="text-xs text-center text-muted-foreground pt-1">
                        📖 <a href="/embed-guide" className="text-primary underline font-bold">دليل التضمين الكامل</a> — خطوات تفصيلية لكل المنصات
                      </p>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── CHANNEL ADS ─────────────────────────────────────── */}
        {channelAds.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-5">
              <Megaphone className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold">إعلانات القناة</h2>
              <Badge variant="secondary">{channelAds.length}</Badge>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {channelAds.map((ad, i) => (
                <AdCard key={ad.id} ad={ad} index={i} />
              ))}
            </div>
          </section>
        )}

        {/* ── STREAMS ─────────────────────────────────────────── */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-5">
            <Radio className="w-5 h-5 text-red-500" />
            <h2 className="text-xl font-bold">البثوث والمقاطع</h2>
            {streams?.length ? <Badge variant="secondary">{streams.length}</Badge> : null}
          </div>

          {!streams?.length ? (
            <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-2xl">
              <Radio className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-base">لا توجد بثوث بعد</p>
              {isOwner && (
                <Link href="/stream/start">
                  <Button className="mt-4 gap-2 bg-red-500 text-white">
                    <Radio className="w-4 h-4" /> ابدأ أول بث الآن
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {streams.map((s, i) => (
                <motion.div key={s.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Link href={`/streams/${s.id}`}>
                    <div className="group cursor-pointer rounded-2xl overflow-hidden border border-border/50 hover:border-primary/50 hover:shadow-xl transition-all">
                      <div className="aspect-video bg-muted relative">
                        {s.thumbnailUrl
                          ? <img src={s.thumbnailUrl} className="w-full h-full object-cover" alt="" />
                          : <div className="w-full h-full flex items-center justify-center"><Radio className="w-8 h-8 opacity-30" /></div>
                        }
                        {s.status === 'live' && (
                          <Badge className="absolute top-2 end-2 bg-red-500 text-white animate-pulse gap-1">
                            <Radio className="w-3 h-3" /> مباشر
                          </Badge>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                            <Radio className="w-5 h-5 text-red-500" />
                          </div>
                        </div>
                      </div>
                      <div className="p-4">
                        <h3 className="font-bold group-hover:text-primary transition-colors line-clamp-1">{s.title}</h3>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                          <span>{(s.viewerCount || 0).toLocaleString()} مشاهد</span>
                          {s.likesCount > 0 && <span>❤ {s.likesCount}</span>}
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* ── REELS ─────────────────────────────────────────── */}
        {channelReels.length > 0 && <section className="mb-12">
          <div className="flex items-center gap-3 mb-5">
            <Film className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold">ريلز القناة</h2>
            <Badge variant="secondary">{channelReels.length}</Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {channelReels.map((reel: any, i: number) => {
              const urls: string[] = (() => {
                try { const p = JSON.parse(reel.videoUrl); return Array.isArray(p) ? p : [reel.videoUrl]; }
                catch { return [reel.videoUrl]; }
              })();
              const isVid = /\.(mp4|mov|webm)/i.test(urls[0] ?? "");
              return (
                <Link href="/reels" key={reel.id}>
                  <motion.div
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                    className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-black cursor-pointer group"
                  >
                    {isVid
                      ? <video src={urls[0]} className="w-full h-full object-cover" muted playsInline />
                      : <img src={urls[0]} className="w-full h-full object-cover" alt={reel.title} />
                    }
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <Play className="w-10 h-10 text-white drop-shadow-lg" />
                    </div>
                    <div className="absolute bottom-0 inset-x-0 p-2.5 bg-gradient-to-t from-black/80 to-transparent">
                      <p className="text-white text-xs font-semibold line-clamp-2">{reel.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-white/60 text-[10px]">
                        <span>👁 {reel.viewsCount || 0}</span>
                        <span>❤ {reel.likesCount || 0}</span>
                        {urls.length > 1 && <span>🖼 {urls.length}</span>}
                      </div>
                    </div>
                  </motion.div>
                </Link>
              );
            })}
          </div>
        </section>}

      </div>
    </div>
  );
}
