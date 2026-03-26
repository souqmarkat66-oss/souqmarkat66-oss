import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Users, Radio, CheckCircle, Plus, Bell, Megaphone, Film, Play } from "lucide-react";
import { motion } from "framer-motion";
import { AdCard } from "@/components/AdCard";
import type { Channel, LiveStream, Ad } from "@shared/schema";

export default function ChannelPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: channel, isLoading } = useQuery<Channel>({
    queryKey: ["/api/channels", Number(id)],
    queryFn: () => fetch(`/api/channels/${id}`).then(r => r.json())
  });

  const { data: streams } = useQuery<LiveStream[]>({
    queryKey: ["/api/channels", Number(id), "streams"],
    queryFn: () => fetch(`/api/channels/${id}/streams`).then(r => r.json())
  });

  const { data: followData } = useQuery<{ following: boolean }>({
    queryKey: ["/api/channels", Number(id), "follow"],
    queryFn: () => fetch(`/api/channels/${id}/follow`, { credentials: "include" }).then(r => r.json()),
    enabled: !!user
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

  if (isLoading) return <div className="container py-12"><Skeleton className="h-64 rounded-2xl" /></div>;
  if (!channel) return <div className="container py-12 text-center"><h2 className="text-2xl">القناة غير موجودة</h2></div>;

  const liveStream = (streams || []).find(s => s.status === 'live');

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
          <p className="text-muted-foreground mb-8 max-w-2xl">{channel.description}</p>
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
