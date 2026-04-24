import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Trophy, Crown, Medal, Star, Eye, Heart, Users, Tv, Play, TrendingUp, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="w-5 h-5 text-yellow-500" />;
  if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
  if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
  return <span className="w-5 h-5 flex items-center justify-center text-xs font-bold text-muted-foreground">#{rank}</span>;
}

function Avatar({ src, name, size = "md" }: { src?: string | null; name?: string | null; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "w-8 h-8 text-xs" : size === "lg" ? "w-14 h-14 text-lg" : "w-11 h-11 text-sm";
  if (src) return <img src={src} className={`${sz} rounded-full object-cover border-2 border-border flex-shrink-0`} alt="" />;
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {(name || "؟")[0]}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const colors = ["bg-yellow-500", "bg-gray-400", "bg-amber-600"];
  const bg = colors[rank - 1] || "bg-muted";
  return (
    <div className={`w-6 h-6 rounded-full ${bg} flex items-center justify-center text-white text-[10px] font-extrabold flex-shrink-0`}>
      {rank}
    </div>
  );
}

export default function Leaderboard() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/leaderboard"],
    queryFn: () => fetch("/api/leaderboard").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const topSellers: any[] = data?.topSellers || [];
  const topChannels: any[] = data?.topChannels || [];
  const topReels: any[] = data?.topReels || [];

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-bl from-yellow-500/20 via-primary/10 to-transparent border-b border-border/50">
        <div className="container px-4 py-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center shadow-lg">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold">لوحة الصدارة</h1>
              <p className="text-sm text-muted-foreground">أبرز البائعين والقنوات والريلز على المنصة</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container px-4 py-6">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
          </div>
        ) : (
          <Tabs defaultValue="sellers">
            <TabsList className="w-full grid grid-cols-3 mb-6 rounded-2xl">
              <TabsTrigger value="sellers" className="gap-1.5 rounded-xl data-[state=active]:bg-yellow-500 data-[state=active]:text-white">
                <Star className="w-4 h-4" /> البائعون
              </TabsTrigger>
              <TabsTrigger value="channels" className="gap-1.5 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white">
                <Tv className="w-4 h-4" /> القنوات
              </TabsTrigger>
              <TabsTrigger value="reels" className="gap-1.5 rounded-xl data-[state=active]:bg-pink-500 data-[state=active]:text-white">
                <Play className="w-4 h-4" /> الريلز
              </TabsTrigger>
            </TabsList>

            {/* TOP SELLERS */}
            <TabsContent value="sellers">
              {topSellers.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">لا يوجد بائعون بعد</div>
              ) : (
                <div className="space-y-3">
                  {/* Top 3 podium */}
                  {topSellers.length >= 3 && (
                    <div className="grid grid-cols-3 gap-3 mb-6">
                      {[topSellers[1], topSellers[0], topSellers[2]].map((seller, idx) => {
                        const realRank = idx === 0 ? 2 : idx === 1 ? 1 : 3;
                        const heights = ["h-24", "h-32", "h-20"];
                        const colors = ["bg-gray-100 dark:bg-gray-800", "bg-yellow-50 dark:bg-yellow-900/20", "bg-amber-50 dark:bg-amber-900/20"];
                        return (
                          <Link key={seller.id} href={`/profile/${seller.id}`}>
                            <div className={`${colors[idx]} rounded-2xl p-3 flex flex-col items-center gap-1.5 cursor-pointer hover:shadow-md transition-all ${heights[idx]} justify-end`}>
                              <Avatar src={seller.profile_image_url} name={seller.first_name} size={idx === 1 ? "lg" : "md"} />
                              <RankBadge rank={realRank} />
                              <p className="text-xs font-bold text-center line-clamp-1">{seller.first_name}</p>
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Eye className="w-2.5 h-2.5" />
                                {Number(seller.total_views).toLocaleString()}
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  {/* Rest of list */}
                  {topSellers.slice(3).map((seller, i) => (
                    <Link key={seller.id} href={`/profile/${seller.id}`}>
                      <Card className="rounded-2xl hover:shadow-md transition-all cursor-pointer hover:border-primary/30">
                        <CardContent className="p-3 flex items-center gap-3">
                          <span className="text-sm font-bold text-muted-foreground w-5 text-center">{i + 4}</span>
                          <Avatar src={seller.profile_image_url} name={seller.first_name} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate">{seller.first_name} {seller.last_name}</p>
                            <p className="text-xs text-muted-foreground">{seller.ads_count} إعلان نشط</p>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {Number(seller.total_views).toLocaleString()}</span>
                            <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {Number(seller.total_likes).toLocaleString()}</span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* TOP CHANNELS */}
            <TabsContent value="channels">
              {topChannels.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">لا توجد قنوات بعد</div>
              ) : (
                <div className="space-y-3">
                  {/* Top 3 podium */}
                  {topChannels.length >= 3 && (
                    <div className="grid grid-cols-3 gap-3 mb-6">
                      {[topChannels[1], topChannels[0], topChannels[2]].map((ch, idx) => {
                        const realRank = idx === 0 ? 2 : idx === 1 ? 1 : 3;
                        const heights = ["h-24", "h-32", "h-20"];
                        const colors = ["bg-gray-100 dark:bg-gray-800", "bg-blue-50 dark:bg-blue-900/20", "bg-indigo-50 dark:bg-indigo-900/20"];
                        return (
                          <Link key={ch.id} href={`/channels/${ch.id}`}>
                            <div className={`${colors[idx]} rounded-2xl p-3 flex flex-col items-center gap-1.5 cursor-pointer hover:shadow-md transition-all ${heights[idx]} justify-end`}>
                              <Avatar src={ch.avatar_url} name={ch.name} size={idx === 1 ? "lg" : "md"} />
                              <RankBadge rank={realRank} />
                              <p className="text-xs font-bold text-center line-clamp-1">{ch.name}</p>
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Users className="w-2.5 h-2.5" />
                                {Number(ch.subscriber_count || 0).toLocaleString()}
                              </div>
                              {ch.is_verified && <Badge className="text-[8px] px-1 py-0 bg-blue-500 text-white h-3">موثّق</Badge>}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  {topChannels.slice(3).map((ch, i) => (
                    <Link key={ch.id} href={`/channels/${ch.id}`}>
                      <Card className="rounded-2xl hover:shadow-md transition-all cursor-pointer hover:border-primary/30">
                        <CardContent className="p-3 flex items-center gap-3">
                          <span className="text-sm font-bold text-muted-foreground w-5 text-center">{i + 4}</span>
                          <Avatar src={ch.avatar_url} name={ch.name} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <p className="font-bold text-sm truncate">{ch.name}</p>
                              {ch.is_verified && <Badge className="text-[8px] px-1 py-0 bg-blue-500 text-white h-3.5">✓</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground">{Number(ch.subscriber_count || 0).toLocaleString()} مشترك</p>
                          </div>
                          <div className="text-xs text-emerald-600 font-bold">
                            {Number(ch.earnings_egp || 0).toFixed(0)} ج.م
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* TOP REELS */}
            <TabsContent value="reels">
              {topReels.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">لا توجد ريلز بعد</div>
              ) : (
                <div className="space-y-3">
                  {/* Top 3 as cards */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {topReels.slice(0, 3).map((reel, i) => (
                      <Link key={reel.id} href="/reels">
                        <div className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-muted cursor-pointer group hover:shadow-xl transition-all">
                          {reel.thumbnail_url
                            ? <img src={reel.thumbnail_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="" />
                            : <div className="w-full h-full bg-gradient-to-br from-pink-500/40 to-purple-500/40 flex items-center justify-center"><Play className="w-8 h-8 text-white/70" /></div>
                          }
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
                          <div className="absolute top-2 right-2">
                            <RankBadge rank={i + 1} />
                          </div>
                          <div className="absolute bottom-2 right-2 left-2">
                            <p className="text-white text-[10px] font-bold line-clamp-2">{reel.title || reel.channel_name || "ريل"}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Eye className="w-2.5 h-2.5 text-white/70" />
                              <span className="text-white/70 text-[9px]">{Number(reel.views_count || 0).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>

                  {/* Rest */}
                  {topReels.slice(3).map((reel, i) => (
                    <Link key={reel.id} href="/reels">
                      <Card className="rounded-2xl hover:shadow-md transition-all cursor-pointer hover:border-pink-500/30">
                        <CardContent className="p-3 flex items-center gap-3">
                          <span className="text-sm font-bold text-muted-foreground w-5 text-center">{i + 4}</span>
                          <div className="w-10 h-14 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                            {reel.thumbnail_url
                              ? <img src={reel.thumbnail_url} className="w-full h-full object-cover" alt="" />
                              : <div className="w-full h-full bg-gradient-to-br from-pink-500/30 to-purple-500/30 flex items-center justify-center"><Play className="w-4 h-4 text-white/70" /></div>
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate">{reel.title || "ريل بدون عنوان"}</p>
                            {reel.channel_name && <p className="text-xs text-muted-foreground">{reel.channel_name}</p>}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {Number(reel.views_count || 0).toLocaleString()}</span>
                            <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {Number(reel.likes_count || 0).toLocaleString()}</span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
