import { useAds } from "@/hooks/use-ads";
import { useLanguage } from "@/components/LanguageProvider";
import { AdCard } from "@/components/AdCard";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

export default function Ads() {
  const { t, language } = useLanguage();
  const { data: ads, isLoading } = useAds(); // Fetch all initially, filter client side if needed or update API

  // Filter ads based on current language if strictly required, 
  // currently fetching based on hook logic (which optionally filters).
  // For browse page, let's show all but prioritize language matches visually or sorted.
  
  const filteredAds = ads?.filter(ad => ad.language === language) || [];
  const otherAds = ads?.filter(ad => ad.language !== language) || [];
  const allAds = [...filteredAds, ...otherAds];

  return (
    <div className="container px-4 py-12">
      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl font-extrabold mb-4 tracking-tight">{t('nav.ads')}</h1>
          <p className="text-muted-foreground text-xl max-w-2xl leading-relaxed">
            Discover a curated selection of smart advertisements from our community, optimized for impact.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-48 w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : allAds.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {allAds.map((ad, i) => (
            <AdCard key={ad.id} ad={ad} index={i} />
          ))}
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-32 text-center"
        >
          <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
            <span className="text-4xl">📭</span>
          </div>
          <h2 className="text-2xl font-bold mb-2">{t('ads.no_ads')}</h2>
          <p className="text-muted-foreground">Be the first to create an ad on our platform!</p>
        </motion.div>
      )}
    </div>
  );
}
