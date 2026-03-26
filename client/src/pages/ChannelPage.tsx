import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Users, Radio, CheckCircle, Plus, Bell } from "lucide-react";
import { motion } from "framer-motion";
import type { Channel, LiveStream } from "@shared/schema";

export default function ChannelPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: channel, isLoading } = useQuery<Channel>({ queryKey: ["/api/channels", Number(id)], queryFn: () => fetch(`/api/channels/${id}`).then(r => r.json()) });
  const { data: streams } = useQuery<LiveStream[]>({ queryKey: ["/api/channels", Number(id), "streams"], queryFn: () => fetch(`/api/channels/${id}/streams`).then(r => r.json()) });
  const { data: followData } = useQuery<{ following: boolean }>({ queryKey: ["/api/channels", Number(id), "follow"], queryFn: () => fetch(`/api/channels/${id}/follow`, { credentials: "include" }).then(r => r.json()), enabled: !!user });

  const followMutation = useMutation({
    mutationFn: () => fetch(`/api/channels/${id}/follow`, { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/channels", Number(id), "follow"] });
      qc.invalidateQueries({ queryKey: ["/api/channels", Number(id)] });
      toast({ title: data.following ? "تم الاشتراك!" : "تم إلغاء الاشتراك" });
    },
  });

  const isOwner = user && channel?.userId === user.id;

  if (isLoading) return <div className="container py-12"><Skeleton className="h-64 rounded-2xl" /></div>;
  if (!channel) return <div className="container py-12 text-center"><h2 className="text-2xl">القناة غير موجودة</h2></div>;

  const liveStream = (streams || []).find(s => s.status === 'live');

  return (
    <div className="min-h-screen">
      <div className="relative h-48 bg-gradient-to-br from-primary/30 to-secondary/30">
        {channel.bannerUrl && <img src={channel.bannerUrl} className="w-full h-full object-cover" alt="" />}
        <div className="absolute inset-0 bg-black/20" />
      </div>

      <div className="container px-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 -mt-12 mb-8 relative z-10">
          <div className="w-24 h-24 rounded-full border-4 border-background bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-3xl font-bold shadow-xl">
            {channel.avatarUrl ? <img src={channel.avatarUrl} className="w-full h-full rounded-full object-cover" alt="" /> : channel.name[0]}
          </div>
          <div className="flex-1 bg-background/80 backdrop-blur rounded-2xl p-4 pt-6 sm:pt-4">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold">{channel.name}</h1>
              {channel.isVerified && <CheckCircle className="w-5 h-5 text-primary" />}
              {channel.isMonetized && <Badge className="bg-yellow-500 text-white">💰 مُربحة</Badge>}
              {channel.status === 'suspended' && <Badge variant="destructive">موقوفة</Badge>}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {(channel.subscriberCount || 0).toLocaleString()} مشترك</span>
              <Badge variant="outline">{channel.category}</Badge>
            </div>
          </div>
          <div className="flex gap-3 items-center">
            {liveStream && (
              <Link href={`/streams/${liveStream.id}`}>
                <Button className="gap-2 bg-red-500 hover:bg-red-600 text-white animate-pulse">
                  <Radio className="w-4 h-4" /> مباشر الآن
                </Button>
              </Link>
            )}
            {user && !isOwner && (
              <Button onClick={() => followMutation.mutate()} variant={followData?.following ? "outline" : "default"} className="gap-2">
                <Bell className="w-4 h-4" />
                {followData?.following ? "إلغاء الاشتراك" : "اشتراك"}
              </Button>
            )}
            {isOwner && (
              <Link href="/stream/start">
                <Button className="gap-2 bg-red-500 text-white">
                  <Radio className="w-4 h-4" /> ابدأ البث
                </Button>
              </Link>
            )}
          </div>
        </div>

        {channel.description && (
          <p className="text-muted-foreground mb-8 max-w-2xl">{channel.description}</p>
        )}

        <h2 className="text-xl font-bold mb-4">البثوث والمقاطع</h2>
        {!streams?.length ? (
          <div className="text-center py-16 text-muted-foreground">
            <Radio className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>لا توجد بثوث بعد</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {streams.map((s, i) => (
              <motion.div key={s.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Link href={`/streams/${s.id}`}>
                  <div className="group cursor-pointer rounded-2xl overflow-hidden border border-border/50 hover:border-primary/50 hover:shadow-xl transition-all">
                    <div className="aspect-video bg-muted relative">
                      {s.thumbnailUrl ? <img src={s.thumbnailUrl} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center"><Radio className="w-8 h-8 opacity-30" /></div>}
                      {s.status === 'live' && <Badge className="absolute top-2 end-2 bg-red-500 text-white animate-pulse">مباشر</Badge>}
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold group-hover:text-primary transition-colors line-clamp-1">{s.title}</h3>
                      <p className="text-sm text-muted-foreground">{(s.viewerCount || 0).toLocaleString()} مشاهد</p>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
