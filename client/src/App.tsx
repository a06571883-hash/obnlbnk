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
import TelegramMusicPlayer from "./components/telegram-music-player"; // Импорт компонента плеера для Telegram

import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "./components/auth-provider";
import BottomNav from "@/components/bottom-nav";
import { useLocation } from "wouter";
import React, { useEffect } from 'react';
import './App.css';
import { preloadSounds, playSoundIfEnabled } from './lib/sound-service'; // Fix: added playSoundIfEnabled import

// Расширяем типы Window для функций фонового джаза
declare global {
  interface Window {
    startBackgroundJazz?: () => void;
    stopBackgroundJazz?: () => void;
  }
}


function Router() {
  const [location] = useLocation();
  const showNav = location !== "/auth";

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
        <Route component={NotFound} />
      </Switch>
      {showNav && <BottomNav />}
    </>
  );
}

function App() {
  useEffect(() => {
    // Preload sounds on component mount
    console.log('Preloading sound effects...');
    preloadSounds();
    
    // Переменная для хранения статуса фонового джаза
    let backgroundJazzPlaying = false;
    let backgroundJazzAudio: HTMLAudioElement | null = null;

    // Функция для запуска фонового джаза
    const startBackgroundJazz = () => {
      if (backgroundJazzPlaying) return;
      
      try {
        // Проверяем наличие глобального объекта для фонового джаза
        if (typeof window !== 'undefined' && 'startBackgroundJazz' in window && window.startBackgroundJazz) {
          console.log('Starting background jazz using Web Audio API...');
          window.startBackgroundJazz();
          backgroundJazzPlaying = true;
        } else {
          // Если API не доступно, используем обычный тег audio
          console.log('Starting background jazz using Audio element...');
          backgroundJazzAudio = new Audio('/audio/light-jazz.mp3');
          backgroundJazzAudio.volume = 0.1; // Очень тихо (10% громкости)
          backgroundJazzAudio.loop = true;
          
          backgroundJazzAudio.play()
            .then(() => {
              console.log('Background jazz started successfully');
              backgroundJazzPlaying = true;
            })
            .catch(e => {
              console.log('Could not autoplay background jazz:', e);
            });
        }
      } catch (error) {
        console.error('Error starting background jazz:', error);
      }
    };

    // Attempt to play a silent sound to initialize audio context (helps with mobile browsers)
    const initAudio = () => {
      console.log('Initializing audio context...');
      const silentSound = new Audio('/sounds/silent.mp3');
      silentSound.volume = 0.1;
      silentSound.play()
        .then(() => {
          console.log('Audio context initialized successfully');
          // Play a test sound after initialization
          setTimeout(() => {
            playSoundIfEnabled('click');
            // Start background jazz after user interaction
            startBackgroundJazz();
          }, 500);
        })
        .catch(e => {
          console.log('Audio context initialization might require user interaction', e);
          // Try to start background jazz anyway
          setTimeout(startBackgroundJazz, 1000);
        });

      // Remove this event listener after first click
      document.removeEventListener('click', initAudio);
      document.removeEventListener('touchstart', initAudio);
    };

    // Initialize audio on first user interaction
    document.addEventListener('click', initAudio);
    document.addEventListener('touchstart', initAudio);

    // Load the background jazz script
    const jazzScript = document.createElement('script');
    jazzScript.src = '/js/background-jazz.js';
    jazzScript.async = true;
    document.body.appendChild(jazzScript);

    return () => {
      document.removeEventListener('click', initAudio);
      document.removeEventListener('touchstart', initAudio);
      
      // Cleanup background jazz
      if (typeof window !== 'undefined' && 'stopBackgroundJazz' in window && window.stopBackgroundJazz) {
        window.stopBackgroundJazz();
      }
      
      if (backgroundJazzAudio) {
        backgroundJazzAudio.pause();
        backgroundJazzAudio = null;
      }
      
      // Remove the script
      if (jazzScript.parentNode) {
        jazzScript.parentNode.removeChild(jazzScript);
      }
    };
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