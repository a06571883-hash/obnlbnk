
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { useToast } from './use-toast';

export function useAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['/api/user'],
    retry: false,
    refetchOnWindowFocus: true
  });

  const login = async (username: string, password: string) => {
    try {
      setIsLoading(true);
      await apiRequest('/api/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      await queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      return true;
    } catch (error) {
      toast({
        title: "Ошибка входа",
        description: error instanceof Error ? error.message : "Неизвестная ошибка"
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiRequest('/api/logout', { method: 'POST' });
      await queryClient.invalidateQueries({ queryKey: ['/api/user'] });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return {
    user,
    isLoading,
    login,
    logout,
    isAuthenticated: !!user
  };
}
