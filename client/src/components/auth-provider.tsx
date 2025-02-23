import { ReactNode } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { User as SelectUser } from "@shared/schema";
import { apiRequest } from "@/lib/api";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [location, setLocation] = useLocation();

  const { isLoading, data: user } = useQuery<SelectUser | null>({
    queryKey: ["/api/user"],
    queryFn: async () => {
      try {
        const data = await apiRequest("GET", "/api/user");
        return data || null;
      } catch (error) {
        console.error("Auth error:", error);
        return null;
      }
    },
    retry: false,
    refetchOnWindowFocus: true,
    staleTime: 30000,
    refetchInterval: location === '/auth' ? false : 30000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user && location !== '/auth') {
    setLocation('/auth');
  }

  return <>{children}</>;
}