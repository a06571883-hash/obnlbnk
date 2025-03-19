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

import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "./components/auth-provider";
import BottomNav from "@/components/bottom-nav";
import { useLocation } from "wouter";
import React, { useEffect } from 'react';
import './App.css';
import { preloadSounds } from './lib/sound-service'; // Added import for sound service


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
          }, 500);
        })
        .catch(e => {
          console.log('Audio context initialization might require user interaction', e);
        });

      // Remove this event listener after first click
      document.removeEventListener('click', initAudio);
      document.removeEventListener('touchstart', initAudio);
    };

    // Initialize audio on first user interaction
    document.addEventListener('click', initAudio);
    document.addEventListener('touchstart', initAudio);

    return () => {
      document.removeEventListener('click', initAudio);
      document.removeEventListener('touchstart', initAudio);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <div id="app-root" className="min-h-screen bg-background">
          <Router />
          <Toaster />
        </div>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;