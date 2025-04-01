import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import NewsPage from "@/pages/news-page";
import ActivityPage from "@/pages/activity-page";
import ProfilePage from "@/pages/profile-page";
import StatisticsPage from "./pages/statistics-page"; // Added import for StatisticsPage
import NFTPage from "./pages/nft-page"; // Fix: direct import instead of alias
import AdminPage from "./pages/admin-page"; // Admin panel page
import TelegramTestPage from "./pages/telegram-test-page"; // Тестовая страница для Telegram WebApp
import TelegramMusicPlayer from "./components/telegram-music-player"; // Импорт компонента плеера для Telegram

import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "./components/auth-provider";
import BottomNav from "@/components/bottom-nav";
import { useLocation } from "wouter";
import React, { useEffect } from 'react';
import './App.css';
// Импорт заглушек звуковых сервисов
import { preloadSounds, playSoundIfEnabled } from './lib/sound-service';


function Router() {
  const [location] = useLocation();
  const showNav = location !== "/auth" && location !== "/telegram-test";

  return (
    <>
      <Switch>
        <Route path="/auth" component={AuthPage} />
        <ProtectedRoute path="/" component={HomePage} />
        <ProtectedRoute path="/news" component={NewsPage} />
        <ProtectedRoute path="/activity" component={ActivityPage} />
        <ProtectedRoute path="/profile" component={ProfilePage} />
        <ProtectedRoute path="/nft" component={() => <NFTPage />} />
        <ProtectedRoute path="/nft/marketplace" component={() => <NFTPage />} />
        <ProtectedRoute path="/nft/gallery" component={() => <NFTPage />} />
        <ProtectedRoute path="/nft-marketplace" component={() => <NFTPage />} />
        <ProtectedRoute path="/marketplace" component={() => <NFTPage />} /> {/* Added direct marketplace route */}
        <ProtectedRoute path="/admin" component={AdminPage} /> {/* Admin panel route */}
        <Route path="/stats" component={StatisticsPage} /> {/* Added route for statistics page */}
        <Route path="/telegram-test" component={TelegramTestPage} /> {/* Тестовая страница для Telegram WebApp */}
        <Route component={NotFound} />
      </Switch>
      {showNav && <BottomNav />}
    </>
  );
}

function App() {
  useEffect(() => {
    // Звуки отключены - пустой эффект
    console.log('Звуковой сервис отключен');
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <div id="app-root" className="min-h-screen bg-background">
          <Router />
          <TelegramMusicPlayer />
          <Toaster />
        </div>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;