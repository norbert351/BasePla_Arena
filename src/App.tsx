import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { wagmiConfig } from "./lib/wagmi";
import ErrorBoundary from "@/components/ErrorBoundary";

// Lazy load pages for faster initial load
const Home = lazy(() => import("./pages/Home"));
const Play2048 = lazy(() => import("./pages/Play2048"));
const PlayTetris = lazy(() => import("./pages/PlayTetris"));
const PlayTyping = lazy(() => import("./pages/PlayTyping"));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage"));
const Profile = lazy(() => import("./pages/Profile"));
const Admin = lazy(() => import("./pages/Admin"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  </div>
);

const App = () => (
  <ErrorBoundary>
  <WagmiProvider config={wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/play/2048" element={<Play2048 />} />
              <Route path="/play/tetris" element={<PlayTetris />} />
              <Route path="/play/typing" element={<PlayTyping />} />
              <Route path="/leaderboard/:gameType" element={<LeaderboardPage />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </WagmiProvider>
);

export default App;
