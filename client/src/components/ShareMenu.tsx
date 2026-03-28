import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Share2, Copy, Check, ExternalLink } from "lucide-react";
import { SiWhatsapp, SiFacebook, SiTelegram, SiX } from "react-icons/si";

interface ShareMenuProps {
  url: string;
  title?: string;
  description?: string;
  size?: "sm" | "default";
  variant?: "ghost" | "outline" | "default";
  className?: string;
  label?: string;
  "data-testid"?: string;
}

export function ShareMenu({
  url,
  title = "شوف الإعلان ده على سوق",
  description = "",
  size = "sm",
  variant = "ghost",
  className = "",
  label,
  "data-testid": testId,
}: ShareMenuProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const fullUrl = url.startsWith("http") ? url : `${window.location.origin}${url}`;
  const encodedUrl = encodeURIComponent(fullUrl);
  const encodedTitle = encodeURIComponent(title);

  const platforms = [
    {
      name: "واتساب",
      icon: <SiWhatsapp className="w-5 h-5" />,
      color: "hover:bg-green-50 dark:hover:bg-green-950/30 text-green-600",
      href: `https://wa.me/?text=${encodedTitle}%0A${encodedUrl}`,
    },
    {
      name: "فيسبوك",
      icon: <SiFacebook className="w-5 h-5" />,
      color: "hover:bg-blue-50 dark:hover:bg-blue-950/30 text-blue-600",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedTitle}`,
    },
    {
      name: "تيليجرام",
      icon: <SiTelegram className="w-5 h-5" />,
      color: "hover:bg-sky-50 dark:hover:bg-sky-950/30 text-sky-500",
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
    },
    {
      name: "تويتر X",
      icon: <SiX className="w-4 h-4" />,
      color: "hover:bg-gray-100 dark:hover:bg-gray-800 text-foreground",
      href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    },
  ];

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      toast({ title: "✅ تم نسخ الرابط!" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ variant: "destructive", title: "تعذّر نسخ الرابط" });
    }
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: description || title, url: fullUrl });
        setOpen(false);
      } catch {}
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={`gap-1.5 rounded-full ${className}`}
          data-testid={testId}
          onClick={e => { e.preventDefault(); e.stopPropagation(); }}
        >
          <Share2 className="w-4 h-4" />
          {label && <span className="text-sm">{label}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-3 rounded-2xl shadow-xl border border-border/50"
        align="end"
        sideOffset={6}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <p className="text-sm font-bold text-foreground mb-1 flex items-center gap-1.5">
          <Share2 className="w-4 h-4 text-primary" /> شارك الإعلان
        </p>
        {/* Truncated URL */}
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 mb-3">
          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground truncate flex-1">{fullUrl}</span>
          <button
            onClick={copyLink}
            className="shrink-0 text-primary hover:text-primary/80 transition-colors"
            title="نسخ الرابط"
            data-testid="btn-copy-link"
          >
            {copied
              ? <Check className="w-4 h-4 text-green-500" />
              : <Copy className="w-4 h-4" />
            }
          </button>
        </div>

        {/* Platforms grid */}
        <div className="grid grid-cols-4 gap-1 mb-3">
          {platforms.map(p => (
            <a
              key={p.name}
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className={`flex flex-col items-center gap-1 rounded-xl p-2 transition-colors cursor-pointer ${p.color}`}
              data-testid={`btn-share-${p.name}`}
            >
              {p.icon}
              <span className="text-[10px] font-medium leading-none">{p.name}</span>
            </a>
          ))}
        </div>

        {/* Copy full button */}
        <button
          onClick={copyLink}
          className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold border transition-all ${
            copied
              ? "bg-green-500 text-white border-green-500"
              : "bg-primary text-primary-foreground hover:bg-primary/90 border-primary"
          }`}
          data-testid="btn-copy-link-full"
        >
          {copied ? <><Check className="w-4 h-4" /> تم النسخ!</> : <><Copy className="w-4 h-4" /> نسخ الرابط</>}
        </button>

        {/* Native share (mobile) */}
        {typeof navigator !== "undefined" && 'share' in navigator && (
          <button
            onClick={nativeShare}
            className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium border border-border hover:bg-muted/50 transition-all"
            data-testid="btn-native-share"
          >
            <Share2 className="w-4 h-4" /> مشاركة عبر التطبيقات
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
