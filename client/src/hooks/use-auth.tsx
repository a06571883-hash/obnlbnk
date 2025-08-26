import { createContext, ReactNode, useContext } from "react";
import { useQuery, useMutation, UseMutationResult } from "@tanstack/react-query";
import { insertUserSchema, type User as SelectUser, type InsertUser } from "@shared/schema.js";
import { apiRequest, queryClient } from "@/lib/queryClient.js";
import { useToast } from "./use-toast.js";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { playSoundIfEnabled } from "@/lib/sound-service.js";

type LoginData = Pick<InsertUser, "username" | "password">;

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, InsertUser>;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser | null>({
    queryKey: ["/api/user"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/user", {
          credentials: "include",
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });

        if (response.status === 401) {
          return null;
        }

        if (!response.ok) {
          console.error('Failed to fetch user data:', response.status, response.statusText);
          throw new Error(`Failed to fetch user data: ${response.status}`);
        }

        const data = await response.json();
        console.log('User data fetched successfully:', data?.username);
        return data;
      } catch (error) {
        console.error("Auth error:", error);
        return null;
      }
    },
    retry: (failureCount, error) => {
      // Не повторяем запросы при 401 ошибках
      if (error instanceof Error && error.message.includes('401')) {
        return false;
      }
      return failureCount < 1;
    },
    staleTime: 5 * 60 * 1000, // 5 минут
    refetchOnWindowFocus: false, // Отключаем автообновление при фокусе
    refetchInterval: false, // Отключаем поллинг
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      console.log('Attempting login for:', credentials.username);
      const res = await apiRequest("POST", "/api/login", credentials);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Ошибка сервера' }));
        console.error('Login failed:', res.status, errorData);
        throw new Error(errorData.message || "Ошибка входа");
      }
      const userData = await res.json();
      console.log('Login successful for:', userData.username);
      return userData;
    },
    onSuccess: (user: SelectUser) => {
      console.log('Setting user data in cache:', user.username);
      queryClient.setQueryData(["/api/user"], user);
      // Обновляем кэш немедленно
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      playSoundIfEnabled('success');
      toast({
        title: "Успешный вход",
        description: `Добро пожаловать, ${user.username}!`,
      });
      // Небольшая задержка перед перенаправлением
      setTimeout(() => {
        setLocation("/");
      }, 100);
    },
    onError: (error: Error) => {
      console.error('Login mutation error:', error);
      playSoundIfEnabled('error');
      toast({
        title: "Ошибка входа",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      console.log('Attempting registration for:', credentials.username);
      const res = await apiRequest("POST", "/api/register", credentials);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Ошибка сервера' }));
        console.error('Registration failed:', res.status, errorData);
        throw new Error(errorData.message || "Ошибка регистрации");
      }
      const userData = await res.json();
      console.log('Registration successful for:', userData.username || credentials.username);
      return userData;
    },
    onSuccess: (user: SelectUser) => {
      console.log('Setting registered user data in cache:', user.username);
      queryClient.setQueryData(["/api/user"], user);
      // Обновляем кэш немедленно
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      playSoundIfEnabled('success');
      toast({
        title: "Регистрация успешна",
        description: `Аккаунт ${user.username} создан!`,
      });
      // Небольшая задержка перед перенаправлением
      setTimeout(() => {
        setLocation("/");
      }, 100);
    },
    onError: (error: Error) => {
      console.error('Registration mutation error:', error);
      playSoundIfEnabled('error');
      toast({
        title: "Ошибка регистрации",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      console.log('Attempting logout');
      const res = await apiRequest("POST", "/api/logout");
      if (!res.ok) {
        console.error('Logout failed:', res.status);
        const error = await res.json().catch(() => ({ message: 'Ошибка выхода' }));
        throw new Error(error.message || "Ошибка выхода");
      }
      console.log('Logout successful');
    },
    onSuccess: () => {
      console.log('Clearing user cache and redirecting');
      // Очищаем кэш пользователя
      queryClient.setQueryData(["/api/user"], null);
      // Очищаем все данные кэша
      queryClient.clear();
      
      // Удаляем данные из storage
      sessionStorage.clear();
      localStorage.clear();
      
      playSoundIfEnabled('notification');
      toast({
        title: "Выход выполнен",
        description: "Вы успешно вышли из системы",
      });
      setLocation("/auth");
    },
    onError: (error: Error) => {
      console.error('Logout mutation error:', error);
      // В случае ошибки все равно очищаем данные локально
      queryClient.setQueryData(["/api/user"], null);
      queryClient.clear();
      sessionStorage.clear();
      localStorage.clear();
      
      playSoundIfEnabled('error');
      toast({
        title: "Ошибка выхода",
        description: error.message,
        variant: "destructive",
      });
      setLocation("/auth");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading,
        error: error as Error | null,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
