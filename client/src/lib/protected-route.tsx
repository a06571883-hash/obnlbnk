import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  const { user, isLoading, error } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Загрузка...</span>
        </div>
      </Route>
    );
  }

  // Если есть ошибка и нет пользователя, перенаправляем на авторизацию
  if ((error && !user) || !user) {
    console.log('Protected route: redirecting to auth, user:', !!user, 'error:', !!error);
    return <Redirect to="/auth" />;
  }

  return (
    <Route path={path}>
      <Component />
    </Route>
  );
}
