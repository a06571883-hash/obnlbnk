import { ReactNode } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [location, setLocation] = useLocation();

  const { isLoading } = useQuery({
    queryKey: ["/api/user"],
    retry: false,
    refetchOnWindowFocus: true,
    staleTime: 30000, // Cache for 30 seconds
    refetchInterval: location === '/auth' ? false : 30000, // Only refetch if not on auth page
    onSettled: (data, error) => {
      if (error && location !== '/auth') {
        setLocation('/auth');
      }
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}