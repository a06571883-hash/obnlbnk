import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { NFTTabNavigation } from '../../pages/nft-page';

// Импортируем сервис для звука
import { playSound } from '../../lib/sound-service';

// Helper function for sound playback
const playSoundWithLog = (sound: string) => {
  console.log(`Playing sound: ${sound}`);
  playSound(sound as any);
};

type NFTRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

type NFTAttributes = {
  power: number;
  agility: number;
  wisdom: number;
  luck: number;
};

type NFT = {
  id: number;
  collectionId: number;
  name: string;
  description: string;
  imagePath: string;
  rarity: NFTRarity;
  mintedAt: string;
  tokenId: string;
  attributes: NFTAttributes;
};

type NFTCollection = {
  id: number;
  name: string;
  description: string;
  imageUrl: string;
  nfts: NFT[];
};

type DailyLimitResponse = {
  canGenerate: boolean;
  nextAvailableAt?: string;
  remainingTime?: string;
  message?: string;
};

interface NFTCollectionViewProps {
  navigation: NFTTabNavigation;
}

export const NFTCollectionView: React.FC<NFTCollectionViewProps> = ({ navigation }) => {
  const { toast } = useToast();
  const [selectedRarity, setSelectedRarity] = useState<NFTRarity>('common');
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<number | null>(null);

  const { 
    data: collections = [], 
    isLoading: isLoadingCollections,
    isError: isErrorCollections,
    refetch: refetchCollections
  } = useQuery<NFTCollection[]>({
    queryKey: ['/api/nft/collections'],
    retry: 3
  });
  
  // Выводим коллекции для отладки
  useEffect(() => {
    console.log('Загруженные коллекции NFT:', collections);
  }, [collections]);

  const { 
    data: dailyLimit, 
    isLoading: isLoadingLimit
  } = useQuery<DailyLimitResponse>({
    queryKey: ['/api/nft/daily-limit'],
    retry: 1
  });

  useEffect(() => {
    console.log('NFTCollectionView компонент инициализирован');
  }, []);

  // Обработчик для навигации на вкладку галереи
  const handleNavigateToGallery = () => {
    console.log('Переход к галерее из компонента NFTCollectionView');
    navigation.switchToGallery(); // Используем функцию из переданного пропс
    playSoundWithLog('click');
  };
  
  // Обработчик для навигации на вкладку маркетплейса
  const handleNavigateToMarketplace = () => {
    console.log('Переход к маркетплейсу из компонента NFTCollectionView');
    navigation.switchToMarketplace(); // Используем функцию из переданного пропс
    playSoundWithLog('click');
  };

  const generateNFT = useMutation({
    mutationFn: async (rarity: NFTRarity) => {
      console.log('Отправка запроса для генерации NFT с редкостью:', rarity);
      const response = await fetch('/api/nft/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rarity }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Не удалось создать NFT');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      console.log('NFT успешно создан:', data);
      toast({
        title: "NFT успешно создан!",
        description: `Ваш новый NFT "${data.name}" добавлен в коллекцию.`,
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/nft/collections'] });
      queryClient.invalidateQueries({ queryKey: ['/api/nft/gallery'] });
      queryClient.invalidateQueries({ queryKey: ['/api/nft/daily-limit'] });
      setOpenDialog(false);
      playSoundWithLog('success');
      // После успешного создания NFT переключаемся на вкладку галереи для просмотра нового NFT
      setTimeout(() => {
        handleNavigateToGallery();
      }, 1000); // Небольшая задержка для анимации уведомления
    },
    onError: (error: Error) => {
      console.error('Ошибка при создании NFT:', error);
      toast({
        title: "Ошибка при создании NFT",
        description: error.message,
        variant: "destructive",
      });
      playSoundWithLog('error');
    }
  });
  
  const clearAllNFTs = useMutation({
    mutationFn: async () => {
      console.log('Отправка запроса на очистку всех NFT');
      const response = await fetch('/api/nft/clear-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Не удалось очистить NFT');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      console.log('NFT успешно очищены:', data);
      toast({
        title: "NFT успешно удалены!",
        description: "Все NFT были удалены. Теперь вы можете создать новые в роскошном стиле.",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/nft/collections'] });
      queryClient.invalidateQueries({ queryKey: ['/api/nft/gallery'] });
      queryClient.invalidateQueries({ queryKey: ['/api/nft/daily-limit'] });
      playSoundWithLog('success');
    },
    onError: (error: Error) => {
      console.error('Ошибка при очистке NFT:', error);
      toast({
        title: "Ошибка при удалении NFT",
        description: error.message,
        variant: "destructive",
      });
      playSoundWithLog('error');
    }
  });

  const isGenerating = generateNFT.isPending;

  const getCollectionById = (id: number): NFTCollection | undefined => {
    return collections.find(collection => collection.id === id);
  };

  const rarityLabels: {[key in NFTRarity]: string} = {
    common: 'Обычный',
    uncommon: 'Необычный',
    rare: 'Редкий',
    epic: 'Эпический',
    legendary: 'Легендарный',
  };

  const rarityColors: {[key in NFTRarity]: string} = {
    common: 'bg-slate-500',
    uncommon: 'bg-green-500',
    rare: 'bg-blue-500',
    epic: 'bg-purple-500',
    legendary: 'bg-yellow-500',
  };

  const formatTimeRemaining = (time?: string) => {
    if (!time) return '';
    return time;
  };

  if (isLoadingCollections || isLoadingLimit) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isErrorCollections) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Ошибка загрузки</AlertTitle>
        <AlertDescription>
          Не удалось загрузить данные о коллекциях NFT. Пожалуйста, обновите страницу.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-lg border bg-card shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-xl font-semibold">Коллекция NFT</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Создавайте уникальные фотореалистичные NFT премиум-класса с элитными автомобилями, часами, бриллиантами и пачками денег
            </p>
          </div>
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
            <Button 
              variant="outline"
              size="sm"
              className="sm:w-auto w-full"
              onClick={() => {
                console.log('Запрос на очистку всех NFT');
                if (window.confirm('Вы уверены, что хотите удалить все NFT? Это действие нельзя отменить.')) {
                  clearAllNFTs.mutate();
                }
              }}
              disabled={clearAllNFTs.isPending}
            >
              {clearAllNFTs.isPending ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Удаление...
                </>
              ) : (
                'Очистить все NFT'
              )}
            </Button>
            <Button 
              size="sm"
              className="sm:w-auto w-full"
              onClick={() => {
                console.log('Открытие диалога генерации NFT');
                setOpenDialog(true);
              }}
            >
              Создать новый NFT
            </Button>
          </div>
        </div>
      </div>




      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создать новый NFT</DialogTitle>
            <DialogDescription>
              Выберите редкость NFT, который хотите создать. Более редкие NFT имеют лучшие характеристики.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Редкость</label>
              <Select 
                value={selectedRarity} 
                onValueChange={(value) => {
                  console.log('Выбор редкости:', value);
                  setSelectedRarity(value as NFTRarity);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите редкость" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="common">Обычный (70%)</SelectItem>
                  <SelectItem value="uncommon">Необычный (20%)</SelectItem>
                  <SelectItem value="rare">Редкий (7%)</SelectItem>
                  <SelectItem value="epic">Эпический (2%)</SelectItem>
                  <SelectItem value="legendary">Легендарный (1%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                console.log('Закрытие диалога создания NFT');
                setOpenDialog(false);
              }}
              disabled={isGenerating}
            >
              Отмена
            </Button>
            <Button
              onClick={() => {
                console.log('Отправка запроса на генерацию NFT с редкостью:', selectedRarity);
                generateNFT.mutate(selectedRarity);
              }}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Создание...
                </>
              ) : (
                'Создать NFT'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedCollection && (
        <Dialog open={!!selectedCollection} onOpenChange={(open) => {
          if (!open) {
            console.log('Закрытие просмотра коллекции');
            setSelectedCollection(null);
          }
        }}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{getCollectionById(selectedCollection)?.name}</DialogTitle>
              <DialogDescription>
                {getCollectionById(selectedCollection)?.description}
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="h-[400px] px-1">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-2">
                {(() => {
                  const collection = getCollectionById(selectedCollection);
                  
                  // Если коллекция не найдена или не содержит NFT
                  if (!collection || !collection.nfts || collection.nfts.length === 0) {
                    return (
                      <div className="col-span-full text-center p-4">
                        <p className="text-muted-foreground">В этой коллекции пока нет NFT</p>
                      </div>
                    );
                  }
                  
                  // Отображаем NFT из коллекции
                  return collection.nfts.map((nft: NFT) => {
                    // Безопасная обработка отсутствующих атрибутов
                    const attributes = nft.attributes || {
                      power: 0,
                      agility: 0,
                      wisdom: 0,
                      luck: 0
                    };
                    
                    return (
                      <Card key={nft.id} className="overflow-hidden">
                        <div className="relative aspect-square">
                          <div className="w-full h-full relative">
                            {nft.imagePath && nft.imagePath.endsWith('.svg') ? (
                              <object
                                data={nft.imagePath}
                                type="image/svg+xml"
                                className="w-full h-full"
                                aria-label={nft.name}
                              >
                                <img 
                                  src="/assets/nft/fallback-nft.svg" 
                                  alt={nft.name} 
                                  className="w-full h-full object-cover"
                                />
                              </object>
                            ) : (
                              <img 
                                src={nft.imagePath || "/assets/nft/fallback-nft.svg"} 
                                alt={nft.name} 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = "/assets/nft/fallback-nft.svg";
                                  console.error("Failed to load NFT image:", nft.imagePath);
                                }}
                              />
                            )}
                          </div>
                          <Badge className={`absolute top-2 right-2 ${rarityColors[nft.rarity]}`}>
                            {rarityLabels[nft.rarity]}
                          </Badge>
                        </div>
                        <CardHeader className="py-2">
                          <CardTitle className="text-base">{nft.name}</CardTitle>
                        </CardHeader>
                        <CardContent className="py-0 space-y-1">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>Сила: {attributes.power}</div>
                            <div>Ловкость: {attributes.agility}</div>
                            <div>Мудрость: {attributes.wisdom}</div>
                            <div>Удача: {attributes.luck}</div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  });
                })()}
              </div>
            </ScrollArea>
            
            <DialogFooter>
              <Button onClick={() => {
                console.log('Закрытие просмотра коллекции');
                setSelectedCollection(null);
              }}>
                Закрыть
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};