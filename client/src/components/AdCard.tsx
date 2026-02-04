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
      <Card className="group overflow-hidden border-border/50 hover:border-primary/50 transition-all hover:shadow-xl hover:shadow-primary/5 bg-card h-full flex flex-col">
        {/* Image/Video Container */}
        <div className="relative aspect-video bg-muted overflow-hidden">
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
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          )}
          
          <div className="absolute top-3 right-3 flex gap-2">
            <Badge variant="secondary" className="bg-background/80 backdrop-blur text-foreground shadow-sm">
              {ad.language === 'ar' ? 'العربية' : 'English'}
            </Badge>
          </div>
        </div>

        <CardContent className="p-5 flex-1">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-bold text-lg leading-tight line-clamp-2 text-foreground group-hover:text-primary transition-colors">
              {ad.title}
            </h3>
          </div>
          <p className="text-muted-foreground text-sm line-clamp-3 mb-4">
            {ad.description}
          </p>
          
          <div className="flex items-center text-xs text-muted-foreground gap-1">
            <Calendar className="w-3 h-3" />
            <span>
              {ad.createdAt && format(new Date(ad.createdAt), 'PPP', { 
                locale: language === 'ar' ? ar : enUS 
              })}
            </span>
          </div>
        </CardContent>

        <CardFooter className="p-4 pt-0 flex gap-2 border-t bg-muted/20 mt-auto">
          <Link href={`/ads/${ad.id}`} className="flex-1">
            <Button variant="ghost" className="w-full justify-start gap-2 hover:text-primary hover:bg-primary/10">
              <Eye className="w-4 h-4" />
              {t('common.view')}
            </Button>
          </Link>
          
          {isOwner && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={handleDelete}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </CardFooter>
      </Card>
    </motion.div>
  );
}
