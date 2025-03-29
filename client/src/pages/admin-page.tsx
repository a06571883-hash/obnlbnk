import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { useLocation } from 'wouter';
import { NFTImportAdmin } from '@/components/admin/nft-import-admin';
import { NFTAdmin } from '@/components/admin/nft-admin';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ShieldCheck } from 'lucide-react';

// Тип для данных пользователя и ответа API
interface UserData {
  id: number;
  username: string;
  is_regulator: boolean;
}

interface UserResponse {
  isAuthenticated: boolean;
  user: UserData;
}

/**
 * Страница администратора с различными инструментами управления
 */
export default function AdminPage() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<string>('nft-import');

  // Проверяем права администратора
  const { data: userData, isLoading, isError } = useQuery<UserResponse>({
    queryKey: ['/api/user'],
    retry: 1
  });

  // Перенаправляем не-администраторов на главную страницу
  useEffect(() => {
    if (!isLoading && !isError && userData) {
      if (!userData.user || userData.user.username !== 'admin') {
        navigate('/');
      }
    }
  }, [userData, isLoading, isError, navigate]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertTitle>Ошибка доступа</AlertTitle>
          <AlertDescription>
            Не удалось проверить права доступа. Пожалуйста, авторизуйтесь и попробуйте снова.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Проверяем, является ли пользователь администратором
  if (!userData?.user || userData?.user?.username !== 'admin') {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertTitle>Доступ запрещен</AlertTitle>
          <AlertDescription>
            У вас нет прав для доступа к панели администратора.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8 flex items-center">
        <ShieldCheck className="h-8 w-8 mr-3 text-primary" />
        <h1 className="text-2xl font-bold">Панель администратора</h1>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList>
          <TabsTrigger value="nft-import">Импорт NFT</TabsTrigger>
          <TabsTrigger value="user-management" disabled>Управление пользователями</TabsTrigger>
          <TabsTrigger value="system-settings" disabled>Настройки системы</TabsTrigger>
        </TabsList>
        
        <TabsContent value="nft-import" className="space-y-6">
          <NFTAdmin />
        </TabsContent>
        
        <TabsContent value="user-management">
          <Card className="p-6">
            <div className="text-center text-muted-foreground">
              Функционал управления пользователями находится в разработке
            </div>
          </Card>
        </TabsContent>
        
        <TabsContent value="system-settings">
          <Card className="p-6">
            <div className="text-center text-muted-foreground">
              Настройки системы находятся в разработке
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}