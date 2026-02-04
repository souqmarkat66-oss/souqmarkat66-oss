import { Switch, Route, Redirect } from "wouter";
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
import NotFound from "@/pages/not-found";

// Protected Route Component
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    // Redirect to login handled by useAuth or manually here
    window.location.href = "/api/login";
    return null;
  }

  return <Component />;
}

function Router() {
  return (
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
          
          {/* Explicit Login/Logout Routes to handle API redirection gracefully if accessed directly */}
          <Route path="/login" component={() => {
            window.location.href = "/api/login"; 
            return null;
          }} />
          
          <Route component={NotFound} />
        </Switch>
      </main>
      
      {/* Footer */}
      <footer className="border-t py-8 bg-muted/20">
        <div className="container px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Souq Ads. All rights reserved.</p>
        </div>
      </footer>
    </div>
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
