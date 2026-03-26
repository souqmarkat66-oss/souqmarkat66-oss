import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/components/LanguageProvider";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Users, Radio, Plus, Search, CheckCircle } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import type { Channel } from "@shared/schema";

export default function Channels() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  const { data: channels, isLoading } = useQuery<Channel[]>({
    queryKey: ["/api/channels"],
  });

  const { data: myChannel } = useQuery<Channel | null>({
    queryKey: ["/api/channels/mine"],
    enabled: !!user,
  });

  const { data: streams } = useQuery<any[]>({
    queryKey: ["/api/streams"],
  });

  const liveChannelIds = new Set((streams || []).map((s: any) => s.channelId));

  const filtered = (channels || []).filter(ch =>
    ch.name.toLowerCase().includes(search.toLowerCase()) ||
    (ch.description || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container px-4 py-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-extrabold mb-2">📺 القنوات</h1>
          <p className="text-muted-foreground text-lg">اكتشف القنوات المباشرة والمنتجين</p>
        </div>
        <div className="flex gap-3">
          {user && !myChannel && (
            <Link href="/channels/create">
              <Button className="gap-2 bg-primary text-white">
                <Plus className="w-4 h-4" />
                إنشاء قناة
              </Button>
            </Link>
          )}
          {user && myChannel && (
            <Link href={`/channels/${myChannel.id}`}>
              <Button variant="outline" className="gap-2">
                <Radio className="w-4 h-4 text-red-500" />
                قناتي
              </Button>
            </Link>
          )}
          <Link href="/stream/start">
            <Button className="gap-2 bg-red-500 hover:bg-red-600 text-white">
              <Radio className="w-4 h-4" />
              بث مباشر
            </Button>
          </Link>
        </div>
      </div>

      <div className="relative mb-8 max-w-md">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="ابحث عن قناة..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="ps-10"
        />
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24">
          <div className="text-6xl mb-4">📭</div>
          <h2 className="text-2xl font-bold mb-2">لا توجد قنوات بعد</h2>
          <p className="text-muted-foreground">كن أول من ينشئ قناة على المنصة!</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map((ch, i) => (
            <motion.div
              key={ch.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link href={`/channels/${ch.id}`}>
                <Card className="hover:shadow-xl hover:border-primary/50 transition-all duration-300 cursor-pointer overflow-hidden rounded-2xl group">
                  <div className="h-28 bg-gradient-to-br from-primary/20 to-secondary/20 relative">
                    {ch.bannerUrl && <img src={ch.bannerUrl} className="w-full h-full object-cover" alt="" />}
                    {liveChannelIds.has(ch.id) && (
                      <div className="absolute top-2 end-2">
                        <Badge className="bg-red-500 text-white gap-1 animate-pulse">
                          <Radio className="w-3 h-3" /> مباشر
                        </Badge>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4 -mt-6">
                    <div className="flex items-end gap-3 mb-3">
                      <div className="w-14 h-14 rounded-full border-4 border-background bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xl font-bold shadow-lg shrink-0">
                        {ch.avatarUrl ? <img src={ch.avatarUrl} className="w-full h-full rounded-full object-cover" alt="" /> : ch.name[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <h3 className="font-bold truncate">{ch.name}</h3>
                          {ch.isVerified && <CheckCircle className="w-4 h-4 text-primary shrink-0" />}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Users className="w-3 h-3" />
                          <span>{(ch.subscriberCount || 0).toLocaleString()} مشترك</span>
                        </div>
                      </div>
                    </div>
                    {ch.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{ch.description}</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
