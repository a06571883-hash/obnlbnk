import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, Info } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

// Типизация ответа сервера
interface NFTServerStatusResponse {
  available: boolean;
  port: number;
  timestamp: string;
  directories: {
    [key: string]: {
      total: number;
      png: number;
      svg: number;
      error?: string;
    };
  };
}

/**
 * Компонент для отображения статуса NFT сервера
 * Запрашивает информацию о состоянии NFT сервера и отображает статистику по наличию файлов
 */
export function NFTServerStatus() {
  const [status, setStatus] = useState<NFTServerStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Загружаем информацию о статусе NFT сервера
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setLoading(true);
        const response = await apiRequest('GET', '/api/nft/server-status');
        const data = await response.json() as NFTServerStatusResponse;
        setStatus(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching NFT server status:', err);
        setError('Не удалось получить информацию о статусе NFT сервера');
        toast({
          title: 'Ошибка',
          description: 'Не удалось получить информацию о статусе NFT сервера',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    // Обновляем информацию каждые 30 секунд
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [toast]);

  // Определяем общую статистику
  const getTotalStats = () => {
    if (!status) return { total: 0, png: 0, svg: 0 };
    
    const totals = { total: 0, png: 0, svg: 0 };
    
    Object.values(status.directories).forEach(dir => {
      if (!dir.error) {
        totals.total += dir.total || 0;
        totals.png += dir.png || 0;
        totals.svg += dir.svg || 0;
      }
    });
    
    return totals;
  };

  const totalStats = getTotalStats();

  // Форматирование даты
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch (err) {
      return dateString;
    }
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            Проверка статуса NFT сервера...
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center p-8">
          <Progress value={100} className="w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full border-red-300">
        <CardHeader>
          <CardTitle className="text-red-600 flex items-center">
            <XCircle className="h-5 w-5 mr-2" />
            Ошибка получения статуса
          </CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          {status?.available ? (
            <>
              <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
              <span>NFT сервер работает</span>
            </>
          ) : (
            <>
              <XCircle className="h-5 w-5 mr-2 text-red-500" />
              <span>NFT сервер не доступен</span>
            </>
          )}
        </CardTitle>
        <CardDescription>
          Порт: {status?.port || 'N/A'} | Обновлено: {status?.timestamp ? formatDate(status.timestamp) : 'N/A'}
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col space-y-2">
            <h4 className="text-sm font-medium flex items-center">
              <Info className="h-4 w-4 mr-2" />
              Общая статистика изображений
            </h4>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md bg-slate-100 p-2">
                <div className="text-2xl font-semibold">{totalStats.total}</div>
                <div className="text-xs text-muted-foreground">Всего файлов</div>
              </div>
              <div className="rounded-md bg-slate-100 p-2">
                <div className="text-2xl font-semibold">{totalStats.png}</div>
                <div className="text-xs text-muted-foreground">PNG файлов</div>
              </div>
              <div className="rounded-md bg-slate-100 p-2">
                <div className="text-2xl font-semibold">{totalStats.svg}</div>
                <div className="text-xs text-muted-foreground">SVG файлов</div>
              </div>
            </div>
          </div>
          
          <Separator />
          
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Статистика по директориям</h4>
            {status && Object.entries(status.directories).map(([dirName, dirInfo]) => (
              <div key={dirName} className="bg-slate-50 rounded-md p-3">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-sm font-medium">
                    {dirName}
                    {dirInfo.error ? (
                      <Badge variant="destructive" className="ml-2">Ошибка</Badge>
                    ) : (
                      <Badge variant="outline" className="ml-2">{dirInfo.total} файлов</Badge>
                    )}
                  </h5>
                </div>
                
                {dirInfo.error ? (
                  <p className="text-xs text-red-500">{dirInfo.error}</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-xs">
                      <span className="text-muted-foreground">PNG: </span>
                      <span className="font-medium">{dirInfo.png}</span>
                    </div>
                    <div className="text-xs">
                      <span className="text-muted-foreground">SVG: </span>
                      <span className="font-medium">{dirInfo.svg}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="text-xs text-muted-foreground">
        NFT сервер обрабатывает запросы на изображения из коллекций NFT
      </CardFooter>
    </Card>
  );
}
