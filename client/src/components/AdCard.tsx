import { Ad } from "@shared/schema";
import { Link } from "wouter";
import { useLanguage } from "./LanguageProvider";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Trash2, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { useAuth } from "@/hooks/use-auth";
import { useDeleteAd } from "@/hooks/use-ads";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

export function AdCard({ ad, index }: { ad: Ad; index: number }) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { mutate: deleteAd } = useDeleteAd();
  const { toast } = useToast();

  const isOwner = user?.id === ad.userId;

  const handleDelete = () => {
    if (confirm("Are you sure?")) {
      deleteAd(ad.id, {
        onSuccess: () => {
          toast({
            title: "Deleted",
            description: "Ad has been removed",
          });
        }
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
    >
      <Card className="group overflow-hidden border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/10 bg-card h-full flex flex-col rounded-3xl">
        {/* Image/Video Container */}
        <div className="relative aspect-[4/3] bg-muted overflow-hidden">
          {ad.mediaType === 'video' ? (
            <video 
              src={ad.mediaUrl} 
              className="w-full h-full object-cover"
              muted
              loop
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
          
          <div className="absolute top-4 right-4 flex gap-2">
            <Badge variant="secondary" className="bg-background/90 backdrop-blur-md text-foreground shadow-sm px-3 py-1 rounded-full border-none font-medium">
              {ad.language === 'ar' ? 'العربية' : 'English'}
            </Badge>
          </div>

          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
             <Link href={`/ads/${ad.id}`} className="w-full">
               <Button variant="secondary" size="sm" className="w-full rounded-full bg-white/20 backdrop-blur-md border-white/30 text-white hover:bg-white/40">
                 {t('common.view')}
               </Button>
             </Link>
          </div>
        </div>

        <CardContent className="p-6 flex-1 flex flex-col">
          <h3 className="font-bold text-xl leading-snug line-clamp-2 text-foreground group-hover:text-primary transition-colors mb-3">
            {ad.title}
          </h3>
          <p className="text-muted-foreground text-sm line-clamp-2 mb-4 flex-1">
            {ad.description}
          </p>
          
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
            <div className="flex items-center text-xs text-muted-foreground/80 gap-1.5 font-medium">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                {ad.createdAt && format(new Date(ad.createdAt), 'MMM d, yyyy', { 
                  locale: language === 'ar' ? ar : enUS 
                })}
              </span>
            </div>
            
            {isOwner && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                onClick={handleDelete}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
