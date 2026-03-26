import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/components/LanguageProvider";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

import Home from "@/pages/Home";
import Ads from "@/pages/Ads";
import AdDetails from "@/pages/AdDetails";
import CreateAd from "@/pages/CreateAd";
import Channels from "@/pages/Channels";
import ChannelPage from "@/pages/ChannelPage";
import LiveStream from "@/pages/LiveStream";
import StartStream from "@/pages/StartStream";
import Campaigns from "@/pages/Campaigns";
import AdminPanel from "@/pages/AdminPanel";
import Revenue from "@/pages/Revenue";
import Reels from "@/pages/Reels";
import Login from "@/pages/Login";
import NotFound from "@/pages/not-found";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return (
    <div className="flex h-[80vh] items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
  if (!user) { window.location.href = "/api/login"; return null; }
  return <Component />;
}

// Reels page has its own full-screen layout (no navbar/footer)
function ReelsPage() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="h-screen bg-black flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-white" /></div>;
  return <Reels />;
}

function Router() {
  return (
    <Switch>
      <Route path="/reels" component={ReelsPage} />
      <Route>
        <div className="flex flex-col min-h-screen font-sans">
          <Navbar />
          <main className="flex-1 bg-background">
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/ads" component={Ads} />
              <Route path="/ads/:id" component={AdDetails} />
              <Route path="/create">
                <ProtectedRoute component={CreateAd} />
              </Route>
              <Route path="/channels" component={Channels} />
              <Route path="/channels/:id" component={ChannelPage} />
              <Route path="/streams/:id" component={LiveStream} />
              <Route path="/stream/start">
                <ProtectedRoute component={StartStream} />
              </Route>
              <Route path="/campaigns">
                <ProtectedRoute component={Campaigns} />
              </Route>
              <Route path="/revenue">
                <ProtectedRoute component={Revenue} />
              </Route>
              <Route path="/admin">
                <ProtectedRoute component={AdminPanel} />
              </Route>
              <Route path="/login" component={Login} />
              <Route component={NotFound} />
            </Switch>
          </main>
          <AppFooter />
        </div>
      </Route>
    </Switch>
  );
}

function AppFooter() {
  return (
    <footer className="border-t py-10 bg-muted/20">
      <div className="container px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* App Download */}
          <div>
            <h3 className="font-bold text-sm mb-3">حمّل تطبيق سوق للإعلانات</h3>
            <div className="flex flex-col gap-2">
              <a
                href="#"
                className="flex items-center gap-3 bg-black text-white rounded-xl px-4 py-2.5 hover:bg-gray-900 transition-colors"
                data-testid="btn-appstore"
              >
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white flex-shrink-0" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                <div>
                  <div className="text-[10px] opacity-70">تحميل على</div>
                  <div className="text-sm font-bold leading-tight">App Store</div>
                </div>
              </a>
              <a
                href="#"
                className="flex items-center gap-3 bg-black text-white rounded-xl px-4 py-2.5 hover:bg-gray-900 transition-colors"
                data-testid="btn-playstore"
              >
                <svg viewBox="0 0 24 24" className="w-6 h-6 flex-shrink-0" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3.18 23.45a2 2 0 0 1-.93-.87V1.42a2 2 0 0 1 .93-.87l11.47 11.45L3.18 23.45zm13.12-6.92L4.43 23.35l9.1-9.09 2.77 2.27zm2.43-5.14c.4.28.65.72.65 1.21s-.25.93-.65 1.21l-2 1.3-3.06-3.05 3.06-3.06 2 1.39zM4.43.65l11.87 6.82-2.77 2.27L4.43.65z" fill="#fff"/>
                </svg>
                <div>
                  <div className="text-[10px] opacity-70">تحميل على</div>
                  <div className="text-sm font-bold leading-tight">Google Play</div>
                </div>
              </a>
              <a
                href="#"
                className="flex items-center gap-3 bg-black text-white rounded-xl px-4 py-2.5 hover:bg-gray-900 transition-colors"
                data-testid="btn-appgallery"
              >
                <svg viewBox="0 0 24 24" className="w-6 h-6 flex-shrink-0" fill="#fff" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                </svg>
                <div>
                  <div className="text-[10px] opacity-70">تحميل على</div>
                  <div className="text-sm font-bold leading-tight">AppGallery</div>
                </div>
              </a>
            </div>
          </div>

          {/* Payment Methods */}
          <div>
            <h3 className="font-bold text-sm mb-3">طرق الدفع والشحن</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 bg-red-50 dark:bg-red-950/20 rounded-xl p-3 border border-red-200 dark:border-red-900">
                <span className="text-xl">📱</span>
                <div>
                  <div className="text-xs font-bold text-red-700 dark:text-red-400">فودافون كاش</div>
                  <div className="text-sm font-mono font-bold">01098553911</div>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-orange-50 dark:bg-orange-950/20 rounded-xl p-3 border border-orange-200 dark:border-orange-900">
                <span className="text-xl">📲</span>
                <div>
                  <div className="text-xs font-bold text-orange-700 dark:text-orange-400">اتصالات (e&) كاش</div>
                  <div className="text-sm font-mono font-bold">0112666571</div>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-950/20 rounded-xl p-3 border border-blue-200 dark:border-blue-900">
                <span className="text-xl">💳</span>
                <div>
                  <div className="text-xs font-bold text-blue-700 dark:text-blue-400">InstaPay</div>
                  <div className="text-sm font-mono font-bold">01285558567</div>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-primary/5 rounded-xl p-3 border border-primary/20">
                <span className="text-xl">🛒</span>
                <div>
                  <div className="text-xs font-bold text-primary">تطبيق سوق ماركات</div>
                  <div className="text-xs text-muted-foreground">دفع مباشر من التطبيق</div>
                </div>
              </div>
            </div>
          </div>

          {/* Links */}
          <div>
            <h3 className="font-bold text-sm mb-3">روابط مهمة</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="/ads" className="hover:text-foreground transition-colors">الإعلانات</a></li>
              <li><a href="/channels" className="hover:text-foreground transition-colors">القنوات</a></li>
              <li><a href="/reels" className="hover:text-foreground transition-colors">الريلز</a></li>
              <li><a href="/campaigns" className="hover:text-foreground transition-colors">الحملات الإعلانية</a></li>
              <li><a href="/revenue" className="hover:text-foreground transition-colors">الإيرادات</a></li>
            </ul>
          </div>
        </div>
        <div className="text-center text-sm text-muted-foreground border-t pt-6">
          <p className="font-bold text-base text-foreground mb-1">شبكة سوق للإعلانات</p>
          <p>© {new Date().getFullYear()} Souq Ads Network. جميع الحقوق محفوظة. جميع التعاملات بالجنيه المصري.</p>
        </div>
      </div>
    </footer>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
