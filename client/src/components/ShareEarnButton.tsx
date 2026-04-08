import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Copy, Check, Share2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Props {
  /** Full URL to share (current page URL by default) */
  url?: string;
  /** Short label for what is being shared, e.g. "القناة" or "البث" */
  contentLabel?: string;
}

export function ShareEarnButton({ url, contentLabel = "الصفحة" }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: referralData } = useQuery<{ code: string; stats: any }>({
    queryKey: ["/api/auth/me/referral"],
    queryFn: () => fetch("/api/auth/me/referral", { credentials: "include" }).then(r => r.json()),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const pageUrl = url || window.location.href.split("?")[0];
  const code = referralData?.code;
  const shareLink = code ? `${pageUrl}?ref=${code}` : pageUrl;

  const waMsg = encodeURIComponent(
    `👀 شوف ${contentLabel} دي على شبكة سوق الإعلانات!\n🔗 ${shareLink}` +
    (code ? `\n🎁 سجّل باستخدام كود ${code} وهتحصل على مكافأة ترحيبية!` : "")
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "✅ تم نسخ الرابط" });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5" data-testid="btn-share-earn">
          <Share2 className="w-3.5 h-3.5" />
          {user && code ? "شارك واكسب 🎁" : "شارك"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" dir="rtl">
        {user && code && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-2 mb-3 text-xs text-amber-800 dark:text-amber-400">
            💰 كل شخص يسجّل من رابطك = مكافأة في محفظتك!
          </div>
        )}
        <p className="text-xs text-muted-foreground mb-2 truncate font-mono">{shareLink}</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs" onClick={handleCopy} data-testid="btn-copy-share-link">
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "تم النسخ" : "نسخ الرابط"}
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white"
            data-testid="btn-whatsapp-share-earn"
            onClick={() => window.open(`https://wa.me/?text=${waMsg}`, "_blank")}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.854L.057 23.5l5.797-1.521A11.932 11.932 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.844 0-3.576-.49-5.073-1.346l-.364-.216-3.44.902.919-3.357-.236-.373A9.958 9.958 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
            </svg>
            واتساب
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
