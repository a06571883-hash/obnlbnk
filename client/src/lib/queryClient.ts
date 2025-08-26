import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorMessage = res.statusText;
    try {
      const errorData = await res.json();
      errorMessage = errorData.message || errorData.error?.message || errorMessage;
    } catch {
      // Handle authentication errors
      if (res.status === 401) {
        errorMessage = 'Сессия истекла. Пожалуйста, войдите снова.';
      }
    }
    
    // Для 401 ошибок не редиректим автоматически, пусть компоненты сами решают
    if (res.status === 401) {
      throw new Error(errorMessage);
    }
    
    throw new Error(errorMessage);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      "Accept": "application/json",
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include", // Always include credentials
    cache: "no-cache", // Prevent caching
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      const res = await fetch(queryKey[0] as string, {
        credentials: "include", // Always include credentials
        cache: "no-cache", // Prevent caching
        headers: {
          "Accept": "application/json",
        },
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    } catch (error) {
      console.error('Query error:', error);
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: false, // Отключаем автообновление при фокусе
      staleTime: 5 * 60 * 1000, // 5 минут
      retry: (failureCount, error) => {
        // Не повторяем запросы при 401 ошибках
        if (error instanceof Error && (error.message.includes('401') || error.message.includes('Сессия истекла'))) {
          return false;
        }
        return failureCount < 1;
      },
      gcTime: 10 * 60 * 1000, // 10 минут
    },
    mutations: {
      retry: (failureCount, error) => {
        // Не повторяем мутации при 401 ошибках
        if (error instanceof Error && (error.message.includes('401') || error.message.includes('Сессия истекла'))) {
          return false;
        }
        return failureCount < 1;
      },
    },
  },
});
