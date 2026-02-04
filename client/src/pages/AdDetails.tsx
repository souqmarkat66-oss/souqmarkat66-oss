import { useRoute } from "wouter";
import { useAd } from "@/hooks/use-ads";
import { useLanguage } from "@/components/LanguageProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Calendar, User, Share2 } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

export default function AdDetails() {
  const [match, params] = useRoute("/ads/:id");
  const id = parseInt(params?.id || "0");
  const { data: ad, isLoading } = useAd(id);
  const { t } = useLanguage();

  if (isLoading) {
    return (
      <div className="container px-4 py-12 max-w-4xl">
        <Skeleton className="h-8 w-32 mb-8" />
        <Skeleton className="aspect-video w-full rounded-3xl mb-8" />
        <Skeleton className="h-10 w-3/4 mb-4" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  if (!ad) {
    return (
      <div className="container px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Ad Not Found</h1>
        <Link href="/ads">
          <Button variant="link" className="mt-4">Back to Ads</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container px-4 py-12 max-w-4xl">
      <Link href="/ads">
        <Button variant="ghost" className="gap-2 mb-6 hover:bg-muted pl-0">
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          Back to Ads
        </Button>
      </Link>

      <div className="bg-card border rounded-3xl overflow-hidden shadow-sm">
        {/* Media */}
        <div className="aspect-video bg-black relative">
          {ad.mediaType === 'video' ? (
            <video 
              src={ad.mediaUrl} 
              className="w-full h-full object-contain" 
              controls
              autoPlay
            />
          ) : (
            <img 
              src={ad.mediaUrl} 
              alt={ad.title} 
              className="w-full h-full object-contain bg-black/5" 
            />
          )}
        </div>

        <div className="p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <Badge variant="outline" className="text-base px-4 py-1 border-primary/20 text-primary bg-primary/5">
              {ad.language === 'ar' ? 'العربية' : 'English'}
            </Badge>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {ad.createdAt && format(new Date(ad.createdAt), 'PPP')}
              </div>
              <Button variant="outline" size="sm" className="gap-2 h-8 rounded-full">
                <Share2 className="w-3 h-3" />
                Share
              </Button>
            </div>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold mb-6 leading-tight text-foreground">
            {ad.title}
          </h1>

          <div className="prose prose-lg dark:prose-invert max-w-none text-muted-foreground">
            <p className="whitespace-pre-wrap leading-relaxed">{ad.description}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
