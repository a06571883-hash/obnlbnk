import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import CardsPage from "@/pages/cards-page";
import ActivityPage from "@/pages/activity-page";
import ProfilePage from "@/pages/profile-page";
import RegulatorPage from "@/pages/regulator-page";
import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "./hooks/use-auth";
import BottomNav from "@/components/bottom-nav";
import { useLocation } from "wouter";

import React from 'react';

const Router = React.memo(function Router() {
  const [location] = useLocation();
  const showNav = location !== "/auth";

  return (
    <>
      <Switch>
        <Route path="/auth" component={AuthPage} />
        <Route path="/" component={HomePage} />
        <Route path="/cards" component={CardsPage} />
        <Route path="/activity" component={ActivityPage} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/regulator" component={RegulatorPage} />
        <Route component={NotFound} />
      </Switch>
      {showNav && <BottomNav />}
    </>
  );
});

function App() {
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