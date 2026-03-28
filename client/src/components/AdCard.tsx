import { useState, useRef, useEffect } from "react";
import { Ad } from "@shared/schema";
import { Link } from "wouter";
import { useLanguage } from "./LanguageProvider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Trash2, Calendar, Play, Volume2, VolumeX, Loader2, Headphones, Square, Heart } from "lucide-react";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { useAuth } from "@/hooks/use-auth";
import { useDeleteAd } from "@/hooks/use-ads";
import { useToast } from "@/hooks/use-toast";
import { useTTS } from "@/hooks/use-tts";
import { motion } from "framer-motion";
import { LikeCommentBar } from "./LikeCommentBar";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export function AdCard({ ad, index }: { ad: Ad; index: number }) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { mutate: deleteAd } = useDeleteAd();
  const { toast } = useToast();
  const qc = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const tts = useTTS();
  const [cardVoice, setCardVoice] = useState<"nova" | "onyx">("nova");

  const { data: favData } = useQuery<{ favorited: boolean }>({
    queryKey: ["/api/favorites", ad.id, "check"],
    queryFn: () => fetch(`/api/favorites/${ad.id}/check`, { credentials: "include" }).then(r => r.json()),
    enabled: !!user,
  });

  const favMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/favorites/${ad.id}`),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/favorites", ad.id, "check"] });
      qc.invalidateQueries({ queryKey: ["/api/favorites"] });
      toast({ title: data.favorited ? "❤️ أُضيف للمفضلة!" : "تم الإزالة من المفضلة" });
    },
  });

  const isOwner = user?.id === ad.userId;
  const isVideo = ad.mediaType === 'video';

  // Sync muted state to DOM (React muted prop bug)
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
    }
  }, [muted]);

  const handlePlayClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
      setPlaying(false);
    } else {
      videoRef.current.muted = false; // unmute on explicit play
      setMuted(false);
      videoRef.current.play().then(() => setPlaying(true)).catch(() => {
        // If autoplay blocked, try muted
        videoRef.current!.muted = true;
        setMuted(true);
        videoRef.current!.play().then(() => setPlaying(true));
      });
    }
  };

  const handleToggleMute = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newMuted = !muted;
    setMuted(newMuted);
    if (videoRef.current) {
      videoRef.current.muted = newMuted;
      videoRef.current.volume = newMuted ? 0 : 1;
    }
  };

  const handleDelete = () => {
    if (confirm("هل أنت متأكد من الحذف؟")) {
      deleteAd(ad.id, {
        onSuccess: () => toast({ title: "تم الحذف" }),
      });
    }
  };

  const hasMedia = ad.mediaUrl && ad.mediaUrl.trim() !== "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Card className="group overflow-hidden border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/10 bg-card h-full flex flex-col rounded-3xl">

        {/* Media Area */}
        <div className="relative aspect-[4/3] bg-muted overflow-hidden">
          {isVideo && hasMedia ? (
            <>
              <video
                ref={videoRef}
                src={ad.mediaUrl}
                className="w-full h-full object-cover"
                loop
                playsInline
                muted
                onEnded={() => setPlaying(false)}
                onPause={() => setPlaying(false)}
                onPlay={() => setPlaying(true)}
              />

              {/* Play/Pause overlay */}
              {!playing && (
                <button
                  onClick={handlePlayClick}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/50 transition-colors cursor-pointer"
                  data-testid={`btn-play-video-${ad.id}`}
                >
                  <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-2xl hover:scale-110 transition-transform">
                    <Play className="w-7 h-7 text-gray-900 fill-gray-900 ms-1" />
                  </div>
                  <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-white text-xs font-bold bg-black/50 rounded-full px-3 py-1">
                    🎬 فيديو • اضغط للتشغيل بصوت
                  </span>
                </button>
              )}

              {/* Volume button — always visible when playing */}
              {playing && (
                <button
                  onClick={handleToggleMute}
                  className={`absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-xs font-bold shadow-lg transition-all ${
                    muted
                      ? 'bg-red-500/90 hover:bg-red-500 border border-red-400/50'
                      : 'bg-green-500/90 hover:bg-green-600 border border-green-400/50'
                  }`}
                  data-testid={`btn-mute-${ad.id}`}
                >
                  {muted ? <><VolumeX className="w-3.5 h-3.5" /> انقر للصوت</> : <><Volume2 className="w-3.5 h-3.5" /> صوت شغال</>}
                </button>
              )}

              {/* Pause button when playing */}
              {playing && (
                <button
                  onClick={handlePlayClick}
                  className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                  data-testid={`btn-pause-${ad.id}`}
                >
                  <span className="text-xs">⏸</span>
                </button>
              )}
            </>
          ) : hasMedia ? (
            <img
              src={ad.mediaUrl}
              alt={ad.title}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
          ) : (
            /* Placeholder when no media */
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-gradient-to-br from-muted to-muted/50">
              <div className="text-4xl mb-2">📢</div>
              <span className="text-xs">إعلان نصي</span>
            </div>
          )}

          {/* Language badge */}
          <div className="absolute top-3 end-3 flex gap-2">
            <Badge variant="secondary" className="bg-background/90 backdrop-blur-md text-foreground shadow-sm px-3 py-1 rounded-full border-none font-medium text-xs">
              {ad.language === 'ar' ? '🇪🇬 عربي' : '🇺🇸 EN'}
            </Badge>
          </div>

          {/* Favorite button */}
          {user && (
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); favMutation.mutate(); }}
              className={`absolute top-3 start-3 w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90 ${
                favData?.favorited
                  ? 'bg-red-500 text-white'
                  : 'bg-white/80 backdrop-blur text-gray-500 hover:text-red-500'
              }`}
              data-testid={`btn-favorite-${ad.id}`}
            >
              <Heart className={`w-4 h-4 ${favData?.favorited ? 'fill-current' : ''}`} />
            </button>
          )}

          {/* View button on hover (for non-video or image) */}
          {!isVideo && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
              <Link href={`/ads/${ad.id}`} className="w-full" onClick={e => e.stopPropagation()}>
                <Button variant="secondary" size="sm" className="w-full rounded-full bg-white/20 backdrop-blur-md border-white/30 text-white hover:bg-white/40 gap-2">
                  <Eye className="w-3 h-3" /> {t('common.view')}
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Content */}
        <CardContent className="p-5 flex-1 flex flex-col">
          <Link href={`/ads/${ad.id}`}>
            <h3 className="font-bold text-lg leading-snug line-clamp-2 text-foreground hover:text-primary transition-colors cursor-pointer mb-2">
              {ad.title}
            </h3>
          </Link>
          <p className="text-muted-foreground text-sm line-clamp-2 flex-1">
            {ad.description}
          </p>

          {/* Price if set */}
          {ad.priceEGP && (
            <div className="mt-2">
              <span className="text-lg font-bold text-green-600 dark:text-green-400">
                {ad.priceEGP.toLocaleString()} ج.م
              </span>
            </div>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40">
            <div className="flex items-center text-xs text-muted-foreground/80 gap-1.5">
              <Calendar className="w-3 h-3" />
              {ad.createdAt && format(new Date(ad.createdAt), 'MMM d', { locale: language === 'ar' ? ar : enUS })}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Eye className="w-3 h-3" />
              {(ad.viewsCount || 0).toLocaleString()}
              {isOwner && (
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground/50 hover:text-destructive rounded-full ms-1" onClick={handleDelete}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>

          <LikeCommentBar targetType="ad" targetId={ad.id} initialLikes={ad.likesCount || 0} ownerId={ad.userId} />

          {/* 🔊 Listen (TTS) button */}
          {user && (
            <div className="mt-2 space-y-1.5" onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
              {/* Gender toggle */}
              {!tts.playing && !tts.loading && (
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setCardVoice("nova")}
                    className={`flex-1 text-xs py-1 rounded-full border font-bold transition-all ${cardVoice === "nova" ? "bg-pink-500 text-white border-pink-500" : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"}`}
                    data-testid={`btn-female-${ad.id}`}
                  >👩 أنثى</button>
                  <button
                    onClick={() => setCardVoice("onyx")}
                    className={`flex-1 text-xs py-1 rounded-full border font-bold transition-all ${cardVoice === "onyx" ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"}`}
                    data-testid={`btn-male-${ad.id}`}
                  >👨 ذكر</button>
                </div>
              )}
              <button
                onClick={() => {
                  if (tts.playing) { tts.stop(); return; }
                  const text = `${ad.title}. ${ad.description || ''}`;
                  tts.generate(text, cardVoice, true).catch(() =>
                    toast({ variant: "destructive", title: "فشل تشغيل الصوت", description: "تأكد من اتصالك بالإنترنت" })
                  );
                }}
                disabled={tts.loading}
                className={`w-full flex items-center justify-center gap-2 rounded-full py-2 text-sm font-bold border transition-all ${
                  tts.playing
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 text-red-600 hover:bg-red-100'
                    : 'bg-primary/5 border-primary/20 text-primary hover:bg-primary/10'
                }`}
                data-testid={`btn-listen-ad-${ad.id}`}
              >
                {tts.loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري التوليد...</>
                  : tts.playing
                  ? <><Square className="w-3.5 h-3.5 fill-current" /> إيقاف</>
                  : <><Headphones className="w-4 h-4" /> استمع بالعربي 🎙</>
                }
              </button>
            </div>
          )}

          {/* WhatsApp CTA */}
          {ad.whatsappNumber && (
            <a
              href={`https://wa.me/2${ad.whatsappNumber.replace(/^0/, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center justify-center gap-2 w-full rounded-full py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-bold transition-colors"
              data-testid={`btn-whatsapp-${ad.id}`}
              onClick={e => e.stopPropagation()}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
              واتساب
            </a>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
