import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Progress } from '@/components/ui/progress';

// Типы для ответов API
interface NFTImageInfo {
  total: number;
  png: number;
  avif: number;
}

interface NFTImportResponse {
  success: boolean;
  data: {
    created: number;
    skipped: number;
    errors: number;
  };
  error?: string;
}

interface NFTInfoResponse {
  success: boolean;
  data: NFTImageInfo;
}

/**
 * Компонент панели администратора для импорта NFT коллекции
 */
export function NFTImportAdmin() {
  const { toast } = useToast();
  const [importInProgress, setImportInProgress] = useState(false);

  // Получаем информацию о доступных изображениях
  const { data: nftInfo, isLoading: isLoadingInfo, isError: isErrorInfo, refetch } = useQuery<NFTInfoResponse>({
    queryKey: ['/api/nft-import/info'],
    retry: 1
  });

  // Мутация для запуска импорта NFT
  const importNFTMutation = useMutation<NFTImportResponse>({
    mutationFn: async () => {
      const response = await fetch('/api/nft-import/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка при импорте NFT');
      }

      return response.json();
    },
    onMutate: () => {
      setImportInProgress(true);
      toast({
        title: 'Запуск импорта',
        description: 'Начинаем импорт NFT коллекции. Это может занять некоторое время...'
      });
    },
    onSuccess: (data) => {
      toast({
        title: 'Импорт успешно завершен',
        description: `Создано: ${data.data.created}, пропущено: ${data.data.skipped}, ошибок: ${data.data.errors}`,
        variant: 'default'
      });
      // Обновляем информацию после успешного импорта
      refetch();
      // Обновляем список NFT на странице маркетплейса
      queryClient.invalidateQueries({ queryKey: ['/api/nft/marketplace'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Ошибка импорта',
        description: error.message,
        variant: 'destructive'
      });
      // Предлагаем альтернативный способ импорта
      runDirectImport();
    },
    onSettled: () => {
      setImportInProgress(false);
    }
  });

  // Функция для запуска прямого импорта через скрипт
  const runDirectImport = async () => {
    try {
      setImportInProgress(true);
      toast({
        title: 'Запуск прямого импорта',
        description: 'Используем альтернативный метод импорта через Node.js скрипт...',
        variant: 'default'
      });
      
      // Выполняем Node.js скрипт напрямую через bash
      const response = await fetch('/api/admin/run-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          script: 'node import-all-nft-to-marketplace.js'
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка при прямом импорте');
      }
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Прямой импорт успешно завершен',
          description: result.output || 'Скрипт выполнен успешно',
          variant: 'default'
        });
        // Обновляем информацию и кэш
        refetch();
        queryClient.invalidateQueries({ queryKey: ['/api/nft/marketplace'] });
      } else {
        throw new Error(result.error || 'Неизвестная ошибка при выполнении прямого импорта');
      }
    } catch (error) {
      toast({
        title: 'Ошибка прямого импорта',
        description: error instanceof Error ? error.message : 'Неизвестная ошибка',
        variant: 'destructive'
      });
    } finally {
      setImportInProgress(false);
    }
  };

  // Функция для запуска импорта NFT
  const handleImportNFT = () => {
    importNFTMutation.mutate();
  };
  
  // Функция для запуска прямого импорта из UI
  const handleDirectImport = () => {
    runDirectImport();
  };

  if (isLoadingInfo) {
    return (
      <div className="flex justify-center items-center h-[200px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isErrorInfo) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Ошибка загрузки</AlertTitle>
        <AlertDescription>
          Не удалось получить информацию о доступных NFT изображениях. Возможно, у вас нет прав администратора.
        </AlertDescription>
      </Alert>
    );
  }

  const imageInfo = nftInfo?.data || { total: 0, png: 0, avif: 0 };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle>Импорт NFT коллекции</CardTitle>
        <CardDescription>
          Импортируйте NFT из коллекции Bored Ape Yacht Club в маркетплейс для продажи
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-secondary p-4 rounded-lg text-center">
              <div className="text-2xl font-bold">{imageInfo.total}</div>
              <div className="text-sm text-muted-foreground">Всего изображений</div>
            </div>
            <div className="bg-secondary p-4 rounded-lg text-center">
              <div className="text-2xl font-bold">{imageInfo.png}</div>
              <div className="text-sm text-muted-foreground">PNG формат</div>
            </div>
            <div className="bg-secondary p-4 rounded-lg text-center">
              <div className="text-2xl font-bold">{imageInfo.avif}</div>
              <div className="text-sm text-muted-foreground">AVIF формат</div>
            </div>
          </div>

          {importInProgress && (
            <div className="space-y-2">
              <p className="text-sm text-center">Выполняется импорт NFT...</p>
              <Progress value={importNFTMutation.isPending ? undefined : 100} />
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row gap-2">
        <Button
          onClick={handleImportNFT}
          disabled={importInProgress || imageInfo.total === 0}
          className="w-full"
        >
          {importInProgress ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              Импорт в процессе...
            </>
          ) : (
            'Начать импорт коллекции'
          )}
        </Button>
        
        <Button
          onClick={handleDirectImport}
          variant="outline"
          disabled={importInProgress || imageInfo.total === 0}
          className="w-full"
        >
          Прямой импорт через скрипт
        </Button>
      </CardFooter>
    </Card>
  );
}