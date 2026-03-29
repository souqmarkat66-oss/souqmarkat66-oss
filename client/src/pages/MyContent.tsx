import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AdCard } from "@/components/AdCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PlusCircle, Video, Image, Play, Eye, Heart, Trash2, Edit, Pencil,
  LayoutGrid, Radio, User, LogIn, MessageSquare, RefreshCw, Clock, Bookmark
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { EditAdDialog } from "@/components/EditAdDialog";
import { EditReelDialog } from "@/components/EditReelDialog";

export default function MyContent() {
  const { user, isLoading: authLoading } = useAuth();

  if (authLoading) return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <div className="w-8 h-8 animate-spin border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );

  if (!user) return (
    <div className="container px-4 py-20 text-center" dir="rtl">
      <div className="max-w-sm mx-auto">
        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <User className="w-12 h-12 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-3">سجّل دخولك أولاً</h2>
        <p className="text-muted-foreground mb-6">يجب تسجيل الدخول لعرض المحتوى الخاص بك</p>
        <Link href="/login">
          <Button size="lg" className="gap-2 w-full max-w-xs">
            <LogIn className="w-5 h-5" />
            تسجيل الدخول
          </Button>
        </Link>
      </div>
    </div>
  );

  return <AuthenticatedContent user={user} />;
}

function AuthenticatedContent({ user }: { user: any }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editingAd, setEditingAd] = useState<any | null>(null);
  const [editingReel, setEditingReel] = useState<any | null>(null);

  const { data: allAds = [], isLoading: adsLoading } = useQuery<any[]>({
    queryKey: ["/api/ads"],
    queryFn: () => fetch("/api/ads").then(r => r.json()),
  });

  const { data: reels = [], isLoading: reelsLoading } = useQuery<any[]>({
    queryKey: ["/api/reels"],
    queryFn: () => fetch("/api/reels").then(r => r.json()),
  });

  const { data: streams = [], isLoading: streamsLoading } = useQuery<any[]>({
    queryKey: ["/api/streams"],
    queryFn: () => fetch("/api/streams").then(r => r.json()),
  });

  // Filter by current user
  const myAds = allAds.filter(ad => ad.userId === user.id);
  const myReels = reels.filter((r: any) => r.userId === user.id);
  const myStreams = streams.filter((s: any) => s.userId === user.id);

  const deleteAdMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/ads/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/ads"] }); toast({ title: "تم حذف الإعلان" }); },
  });

  const deleteReelMut = useMutation({
    mutationFn: (id: number) => fetch(`/api/reels/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/reels"] }); toast({ title: "تم حذف الريل" }); },
  });

  const { data: favorites = [] } = useQuery<any[]>({
    queryKey: ["/api/favorites"],
    queryFn: () => fetch("/api/favorites", { credentials: "include" }).then(r => r.json()),
  });

  const removeFavMut = useMutation({
    mutationFn: (adId: number) => apiRequest("POST", `/api/favorites/${adId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/favorites"] }); toast({ title: "تم الإزالة من المفضلة" }); },
  });

  const renewAdMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/ads/${id}/renew`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/ads"] }); toast({ title: "✅ تم تجديد الإعلان 30 يوماً!" }); },
  });

  return (
    <div className="container px-4 py-10 max-w-5xl" dir="rtl">
      {/* Profile Header */}
      <div className="flex items-center gap-4 mb-8 p-5 bg-gradient-to-l from-primary/5 to-secondary/5 rounded-2xl border">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-2xl font-extrabold shadow-lg">
          {user.firstName?.[0] || "U"}
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-extrabold">{user.firstName} {user.lastName}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <div className="flex gap-3 mt-2">
            <span className="text-xs font-medium text-primary">{myAds.length} إعلان</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs font-medium text-red-500">{myReels.length} ريلز</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs font-medium text-blue-500">{myStreams.length} بث مباشر</span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Link href="/create">
            <Button size="sm" className="gap-1.5 text-xs" data-testid="btn-my-create-ad">
              <PlusCircle className="w-3.5 h-3.5" /> إعلان جديد
            </Button>
          </Link>
          <Link href="/stream/start">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs bg-red-500/5 border-red-200 text-red-600 hover:bg-red-500/10">
              <Radio className="w-3.5 h-3.5" /> بث مباشر
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="ads" dir="rtl">
        <TabsList className="mb-6 h-11 rounded-xl flex-wrap gap-1">
          <TabsTrigger value="ads" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg text-xs">
            <LayoutGrid className="w-3.5 h-3.5" />
            إعلاناتي
            {myAds.length > 0 && <Badge className="h-4 min-w-[16px] text-[9px] bg-white/20">{myAds.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="favorites" className="gap-1.5 data-[state=active]:bg-red-500 data-[state=active]:text-white rounded-lg text-xs">
            <Bookmark className="w-3.5 h-3.5" />
            المفضلة
            {favorites.length > 0 && <Badge className="h-4 min-w-[16px] text-[9px] bg-white/20">{favorites.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="reels" className="gap-1.5 data-[state=active]:bg-red-500 data-[state=active]:text-white rounded-lg text-xs">
            <Video className="w-3.5 h-3.5" />
            ريلزي
            {myReels.length > 0 && <Badge className="h-4 min-w-[16px] text-[9px] bg-white/20">{myReels.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="streams" className="gap-1.5 data-[state=active]:bg-blue-500 data-[state=active]:text-white rounded-lg text-xs">
            <Radio className="w-3.5 h-3.5" />
            بثي المباشر
            {myStreams.length > 0 && <Badge className="h-4 min-w-[16px] text-[9px] bg-white/20">{myStreams.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* My Ads */}
        <TabsContent value="ads">
          {adsLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1,2,3].map(i => <Skeleton key={i} className="h-64 rounded-2xl" />)}
            </div>
          ) : myAds.length === 0 ? (
            <EmptyState
              emoji="📭"
              title="لم تنشر أي إعلان بعد"
              desc="أنشئ إعلانك الأول الآن وابدأ في الوصول للعملاء"
              action={<Link href="/create"><Button className="gap-2"><PlusCircle className="w-4 h-4" />أنشئ إعلاناً الآن</Button></Link>}
            />
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {myAds.map((ad, i) => (
                <div key={ad.id} className="relative group">
                  <AdCard ad={ad} index={i} />
                  <div className="absolute top-3 left-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link href={`/ads/${ad.id}`}>
                      <button className="w-7 h-7 rounded-full bg-white/90 text-gray-700 flex items-center justify-center shadow hover:bg-white" title="عرض">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </Link>
                    <button
                      className="w-7 h-7 rounded-full bg-blue-500/90 text-white flex items-center justify-center shadow hover:bg-blue-600"
                      title="تعديل"
                      onClick={() => setEditingAd(ad)}
                      data-testid={`btn-edit-ad-${ad.id}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      className="w-7 h-7 rounded-full bg-red-500/90 text-white flex items-center justify-center shadow hover:bg-red-500"
                      title="حذف"
                      onClick={() => { if (confirm("حذف هذا الإعلان؟")) deleteAdMut.mutate(ad.id); }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between px-1 flex-wrap gap-1">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{ad.viewsCount || 0}</span>
                      <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{ad.likesCount || 0}</span>
                      <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{ad.commentsCount || 0}</span>
                      {ad.whatsappClicks > 0 && (
                        <span className="flex items-center gap-1 text-green-600" title="نقرات واتساب">
                          <span>📱</span>{ad.whatsappClicks}
                        </span>
                      )}
                      {ad.viewsCount > 0 && (
                        <span className="text-blue-500" title="نسبة النقر للمشاهدة">
                          CTR: {(((ad.whatsappClicks || 0) / ad.viewsCount) * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={ad.status === "active" ? "default" : "secondary"} className="text-[10px] h-5">
                        {ad.status === "active" ? "✅ نشط" : ad.status}
                      </Badge>
                      <button
                        onClick={() => renewAdMut.mutate(ad.id)}
                        disabled={renewAdMut.isPending}
                        className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-600 hover:bg-blue-100 transition-colors"
                        title="تجديد الإعلان 30 يوماً"
                        data-testid={`btn-renew-ad-${ad.id}`}
                      >
                        <RefreshCw className="w-2.5 h-2.5" /> تجديد
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Favorites */}
        <TabsContent value="favorites">
          {favorites.length === 0 ? (
            <EmptyState
              emoji="❤️"
              title="لا توجد إعلانات في مفضلتك بعد"
              desc="اضغط على قلب أي إعلان لحفظه هنا"
              action={<Link href="/ads"><Button variant="outline" className="gap-2"><Bookmark className="w-4 h-4" />تصفح الإعلانات</Button></Link>}
            />
          ) : (
            <div className="space-y-3">
              {favorites.map((fav: any) => (
                <Link key={fav.id} href={`/ads/${fav.ad_id}`}>
                  <Card className="hover:border-primary/40 transition-all cursor-pointer rounded-2xl">
                    <CardContent className="p-4 flex items-center gap-4">
                      {fav.media_url && (
                        <img src={fav.media_url} alt={fav.title} className="w-16 h-16 object-cover rounded-xl flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm line-clamp-1">{fav.title}</h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {fav.price_egp > 0 && <span className="text-xs font-bold text-green-600">{fav.price_egp?.toLocaleString()} ج.م</span>}
                          {fav.target_region && <Badge variant="secondary" className="text-[10px]">📍 {fav.target_region}</Badge>}
                        </div>
                      </div>
                      <button
                        onClick={e => { e.preventDefault(); e.stopPropagation(); removeFavMut.mutate(fav.ad_id); }}
                        className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors flex-shrink-0"
                        data-testid={`btn-remove-fav-${fav.ad_id}`}
                      >
                        <Heart className="w-4 h-4 fill-current" />
                      </button>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* My Reels */}
        <TabsContent value="reels">
          {reelsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => <Skeleton key={i} className="aspect-[9/16] rounded-2xl" />)}
            </div>
          ) : myReels.length === 0 ? (
            <EmptyState
              emoji="🎬"
              title="لم تنشر أي ريلز بعد"
              desc="ارفع أول ريلز لك واجذب المتابعين"
              action={<Link href="/reels"><Button variant="outline" className="gap-2"><Video className="w-4 h-4" />اذهب للريلز</Button></Link>}
            />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {myReels.map((reel: any) => (
                <div key={reel.id} className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-black group cursor-pointer">
                  {/* Thumbnail / preview */}
                  {reel.thumbnailUrl ? (
                    <img src={reel.thumbnailUrl} alt={reel.title} className="w-full h-full object-cover" />
                  ) : reel.videoUrl ? (
                    (() => {
                      try {
                        const parsed = JSON.parse(reel.videoUrl);
                        if (Array.isArray(parsed) && parsed[0]) return <img src={parsed[0]} alt={reel.title} className="w-full h-full object-cover" />;
                      } catch {}
                      return reel.videoUrl.match(/\.(jpg|jpeg|png|gif|webp)/i)
                        ? <img src={reel.videoUrl} alt={reel.title} className="w-full h-full object-cover" />
                        : <video src={reel.videoUrl} className="w-full h-full object-cover" muted />;
                    })()
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-primary/20 to-black">
                      <Video className="w-10 h-10 text-white/50" />
                    </div>
                  )}

                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/60 transition-all" />

                  {/* Action buttons — always visible */}
                  <div className="absolute top-2 inset-x-0 flex justify-between px-2 z-10">
                    <button
                      className="w-8 h-8 rounded-full bg-blue-500/90 text-white flex items-center justify-center shadow active:scale-95"
                      title="تعديل"
                      onClick={e => { e.stopPropagation(); setEditingReel(reel); }}
                      data-testid={`btn-edit-reel-${reel.id}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex gap-1.5">
                      <Link href="/reels">
                        <button
                          className="w-8 h-8 rounded-full bg-white/70 text-gray-700 flex items-center justify-center shadow active:scale-95"
                          title="عرض"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                      </Link>
                      <button
                        className="w-8 h-8 rounded-full bg-red-500/90 text-white flex items-center justify-center shadow active:scale-95"
                        title="حذف"
                        onClick={e => { e.stopPropagation(); if (confirm("حذف هذا الريل؟")) deleteReelMut.mutate(reel.id); }}
                        data-testid={`btn-delete-reel-${reel.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Bottom info */}
                  <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/80 to-transparent z-10">
                    <p className="text-white text-xs font-medium line-clamp-2">{reel.title}</p>
                    <div className="flex items-center gap-2 mt-1 text-white/70 text-[10px]">
                      <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{reel.viewsCount || 0}</span>
                      <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" />{reel.likesCount || 0}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* My Streams */}
        <TabsContent value="streams">
          {streamsLoading ? (
            <div className="grid md:grid-cols-2 gap-4">
              {[1,2].map(i => <Skeleton key={i} className="h-40 rounded-2xl" />)}
            </div>
          ) : myStreams.length === 0 ? (
            <EmptyState
              emoji="📡"
              title="لم تبث مباشرةً بعد"
              desc="ابدأ أول بث مباشر لك الآن وتواصل مع جمهورك"
              action={<Link href="/stream/start"><Button className="gap-2 bg-red-500 hover:bg-red-600 text-white"><Radio className="w-4 h-4" />ابدأ البث الآن</Button></Link>}
            />
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {myStreams.map((stream: any) => (
                <Link href={`/streams/${stream.id}`} key={stream.id}>
                  <Card className="hover:border-primary/50 transition-all cursor-pointer rounded-2xl">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="font-bold text-sm line-clamp-1">{stream.title}</h3>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{stream.description}</p>
                        </div>
                        <Badge variant={stream.status === "live" ? "destructive" : "secondary"} className="text-xs mr-2 flex-shrink-0">
                          {stream.status === "live" ? "🔴 مباشر" : "⏹ منتهي"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3">
                        <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{stream.viewerCount || 0} مشاهد</span>
                        <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{stream.likesCount || 0} إعجاب</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Ad Dialog */}
      {editingAd && (
        <EditAdDialog
          ad={editingAd}
          open={!!editingAd}
          onClose={() => setEditingAd(null)}
        />
      )}

      {/* Edit Reel Dialog */}
      {editingReel && (
        <EditReelDialog
          reel={editingReel}
          open={!!editingReel}
          onClose={() => setEditingReel(null)}
        />
      )}
    </div>
  );
}

function EmptyState({ emoji, title, desc, action }: { emoji: string; title: string; desc: string; action: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-5 text-4xl">{emoji}</div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm mb-6 max-w-xs">{desc}</p>
      {action}
    </div>
  );
}
