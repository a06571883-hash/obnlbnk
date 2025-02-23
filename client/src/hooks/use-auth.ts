import { create } from "zustand";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ReactNode } from "react";

interface User {
  id: number;
  username: string;
  is_regulator: boolean;
  regulator_balance?: string;
}

interface AuthStore {
  user: User | null;
  setUser: (user: User | null) => void;
}

const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));

export function useAuth() {
  const [, setLocation] = useLocation();
  const { user, setUser } = useAuthStore();

  const { isLoading } = useQuery<User>({
    queryKey: ["/api/user"],
    retry: false,
    onSuccess: (data) => {
      setUser(data);
    },
    onError: () => {
      setUser(null);
      setLocation("/auth");
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return <>{children}</>;
}