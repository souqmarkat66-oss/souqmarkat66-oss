import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutGrid, Cast, Tv, PlusCircle, UserCircle2,
} from "lucide-react";

export default function BottomNav() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();

  const { data: settings } = useQuery<any>({
    queryKey: ["/api/settings"],
    staleTime: 60000,
  });

  const feat = (key: string) => settings?.[key] !== "0";

  const { data: liveStreams = [] } = useQuery<any[]>({
    queryKey: ["/api/streams", "live"],
    queryFn: () => fetch("/api/streams?status=live", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30000,
    enabled: feat("feature_livestream"),
  });

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

  const hiddenOn = ["/streams/", "/stream/start", "/login", "/register"];
  const shouldHide = hiddenOn.some(p => location.startsWith(p));
  if (shouldHide) return null;

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border pb-safe"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 8px)" }}
    >
      <div className="flex items-center justify-around h-14 px-2">

        {/* Ads */}
        {feat("feature_ads") && (
          <Link href="/ads">
            <button
              className={`flex flex-col items-center gap-0.5 min-w-[44px] transition-colors ${
                isActive("/ads") ? "text-primary" : "text-muted-foreground"
              }`}
              data-testid="bottom-nav-ads"
            >
              <LayoutGrid className="w-5 h-5" strokeWidth={isActive("/ads") ? 2.5 : 1.75} />
              <span className="text-[10px] font-medium">إعلانات</span>
            </button>
          </Link>
        )}

        {/* Channels */}
        {feat("feature_channels") && (
          <Link href="/channels">
            <button
              className={`flex flex-col items-center gap-0.5 min-w-[44px] transition-colors ${
                isActive("/channels") ? "text-primary" : "text-muted-foreground"
              }`}
              data-testid="bottom-nav-channels"
            >
              <Tv className="w-5 h-5" strokeWidth={isActive("/channels") ? 2.5 : 1.75} />
              <span className="text-[10px] font-medium">قنوات</span>
            </button>
          </Link>
        )}

        {/* Create — center FAB */}
        <Link href={user ? "/create" : "/login"}>
          <button
            className="flex flex-col items-center gap-0.5 min-w-[48px] -mt-4"
            data-testid="bottom-nav-create"
          >
            <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/40 border-4 border-background">
              <PlusCircle className="w-6 h-6" />
            </div>
          </button>
        </Link>

        {/* Livestream */}
        {feat("feature_livestream") && (
          <Link href="/livestream">
            <button
              className={`flex flex-col items-center gap-0.5 min-w-[44px] relative transition-colors ${
                isActive("/livestream") ? "text-red-500" : "text-muted-foreground"
              }`}
              data-testid="bottom-nav-livestream"
            >
              <div className="relative">
                <Cast className="w-5 h-5" strokeWidth={isActive("/livestream") ? 2.5 : 1.75} />
                {liveStreams.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border border-background animate-pulse" />
                )}
              </div>
              <span className="text-[10px] font-medium">مباشر</span>
            </button>
          </Link>
        )}

        {/* Profile / Login */}
        <Link href={user ? `/profile/${user.id}` : "/login"}>
          <button
            className={`flex flex-col items-center gap-0.5 min-w-[44px] transition-colors ${
              (user && isActive(`/profile/${user.id}`)) ? "text-primary" : "text-muted-foreground"
            }`}
            data-testid="bottom-nav-profile"
          >
            <UserCircle2 className="w-5 h-5" strokeWidth={1.75} />
            <span className="text-[10px] font-medium">{user ? "حسابي" : "دخول"}</span>
          </button>
        </Link>
      </div>
    </nav>
  );
}
