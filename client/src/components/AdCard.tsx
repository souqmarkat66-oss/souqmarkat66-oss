import { Ad } from "@shared/schema";
import { Link } from "wouter";
import { useLanguage } from "./LanguageProvider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Trash2, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { useAuth } from "@/hooks/use-auth";
import { useDeleteAd } from "@/hooks/use-ads";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { LikeCommentBar } from "./LikeCommentBar";

export function AdCard({ ad, index }: { ad: Ad; index: number }) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { mutate: deleteAd } = useDeleteAd();
  const { toast } = useToast();

  const isOwner = user?.id === ad.userId;

  const handleDelete = () => {
    if (confirm("هل أنت متأكد من الحذف؟")) {
      deleteAd(ad.id, {
        onSuccess: () => toast({ title: "تم الحذف" }),
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Card className="group overflow-hidden border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/10 bg-card h-full flex flex-col rounded-3xl">
        <div className="relative aspect-[4/3] bg-muted overflow-hidden">
          {ad.mediaType === 'video' ? (
            <video
              src={ad.mediaUrl}
              className="w-full h-full object-cover"
              muted loop
              onMouseOver={e => e.currentTarget.play()}
              onMouseOut={e => e.currentTarget.pause()}
            />
          ) : (
            <img
              src={ad.mediaUrl}
              alt={ad.title}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
          )}
          <div className="absolute top-3 end-3 flex gap-2">
            <Badge variant="secondary" className="bg-background/90 backdrop-blur-md text-foreground shadow-sm px-3 py-1 rounded-full border-none font-medium text-xs">
              {ad.language === 'ar' ? '🇸🇦 عربي' : '🇺🇸 EN'}
            </Badge>
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
            <Link href={`/ads/${ad.id}`} className="w-full">
              <Button variant="secondary" size="sm" className="w-full rounded-full bg-white/20 backdrop-blur-md border-white/30 text-white hover:bg-white/40 gap-2">
                <Eye className="w-3 h-3" /> {t('common.view')}
              </Button>
            </Link>
          </div>
        </div>

        <CardContent className="p-5 flex-1 flex flex-col">
          <h3 className="font-bold text-lg leading-snug line-clamp-2 text-foreground group-hover:text-primary transition-colors mb-2">
            {ad.title}
          </h3>
          <p className="text-muted-foreground text-sm line-clamp-2 flex-1">
            {ad.description}
          </p>

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

          <LikeCommentBar targetType="ad" targetId={ad.id} initialLikes={ad.likesCount || 0} />
        </CardContent>
      </Card>
    </motion.div>
  );
}
