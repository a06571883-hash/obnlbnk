import { createContext, ReactNode, useContext } from "react";
import { useQuery, useMutation, UseMutationResult, useQueryClient } from "@tanstack/react-query";
import { insertUserSchema, type User as SelectUser, type InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { useToast } from "./use-toast";
import { useLocation } from "wouter";

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
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
      queryClient.invalidateQueries({ queryKey: ["/api"] });
      toast({
        title: "Успешный вход",
        description: `Добро пожаловать, ${user.username}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка входа",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      const res = await apiRequest("POST", "/api/register", credentials);
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
      queryClient.invalidateQueries({ queryKey: ["/api"] });
      toast({
        title: "Регистрация успешна",
        description: `Аккаунт ${user.username} создан!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка регистрации",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      queryClient.invalidateQueries();
      setLocation("/auth");
      toast({
        title: "Выход выполнен",
        description: "Вы успешно вышли из системы",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка выхода",
        description: error.message,
        variant: "destructive",
      });
      // Force clear user data even if logout fails
      queryClient.setQueryData(["/api/user"], null);
      setLocation("/auth");
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading,
        error,
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