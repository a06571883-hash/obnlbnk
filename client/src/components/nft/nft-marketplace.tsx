import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/queryClient';

// Импортируем сервис для звука и утилиты для изображений
import { playSound } from '../../lib/sound-service';
import { getProxiedImageUrl } from '../../lib/image-utils';

// Helper function for sound playback
const playSoundWithLog = (sound: string) => {
  console.log(`Playing sound: ${sound}`);
  playSound(sound as any);
};

type NFT = {
  id: number;
  collectionId: number;
  ownerId: number;
  name: string;
  description: string;
  imagePath: string;
  rarity: string;
  mintedAt: string;
  tokenId: string;
  price: string;
  forSale: boolean;
  collectionName?: string; // Добавляем название коллекции
  owner?: {
    id: number;
    username: string;
  };
  attributes: {
    power: number;
    agility: number;
    wisdom: number;
    luck: number;
  };
};

export const NFTMarketplace: React.FC = () => {
  const [selectedNFT, setSelectedNFT] = useState<NFT | null>(null);
  const [giftRecipient, setGiftRecipient] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [isGiftDialogOpen, setIsGiftDialogOpen] = useState(false);
  const [isSellDialogOpen, setIsSellDialogOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc'); // asc = от низкой к высокой, desc = от высокой к низкой
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50; // Ограничиваем количество NFT на странице для лучшей производительности
  const queryClient = useQueryClient();
  
  // Получаем данные о текущем пользователе
  const { data: currentUser } = useQuery({
    queryKey: ['/api/user'],
    retry: 1
  });
  
  // Получаем все NFT текущего пользователя
  const { 
    data: myNfts = [], 
    isLoading: isLoadingMyNfts,
    isError: isErrorMyNfts
  } = useQuery<NFT[]>({
    queryKey: ['/api/nft/gallery'],
    retry: 1
  });
  
  // API с маркетплейсом версии V2 для расширенных возможностей
  // Получаем NFT с маркетплейса с использованием API v2
  const { 
    data: marketplaceData, 
    isLoading: isLoadingMarketplace,
    isError: isErrorMarketplace
  } = useQuery<{
    items: NFT[],
    pagination: {
      page: number;
      limit: number;
      totalItems: number;
      totalPages: number;
    },
    filters: {
      sortBy: string;
      sortOrder: string;
      minPrice?: number;
      maxPrice?: number;
      rarity?: string;
      search?: string;
      collection?: string;
    }
  }>({
    queryKey: ['/api/nft/marketplace/v2', currentPage, sortOrder],
    queryFn: () => fetch(`/api/nft/marketplace/v2?page=${currentPage}&limit=${itemsPerPage}&sortBy=price&sortOrder=${sortOrder}`)
      .then(res => {
        if (!res.ok) throw new Error('Ошибка получения NFT');
        return res.json();
      }),
    retry: 3
  });
  
  // Получаем NFT и информацию о пагинации из ответа API v2
  const items = marketplaceData?.items || [];
  const pagination = marketplaceData?.pagination || { 
    page: 1, 
    limit: itemsPerPage, 
    totalItems: 0, 
    totalPages: 0 
  };
  
  // Отфильтровываем только обезьян BAYC и MAYC, которые на продаже
  // и гарантируем уникальность tokenId
  const marketplaceNfts = React.useMemo(() => {
    // Используем Map для сохранения только одного NFT для каждого tokenId
    const uniqueMap = new Map<string, NFT>();
    
    items.forEach(nft => {
      // Проверки:
      // 1. NFT доступен для продажи
      // 2. Проверка имени коллекции или путь к изображению содержит "bored_ape" или "mutant_ape"
      const isApeNft = 
        (nft.collectionName === 'Bored Ape Yacht Club' || nft.collectionName === 'Mutant Ape Yacht Club') || 
        (nft.imagePath && (
          nft.imagePath.includes('bored_ape') || 
          nft.imagePath.includes('mutant_ape') || 
          nft.imagePath.includes('official_bored_ape') ||
          nft.imagePath.includes('bayc_official')
        ));
      
      if (nft.forSale && isApeNft) {
        // При совпадении tokenId перезаписываем, чтобы избежать дубликатов
        uniqueMap.set(nft.tokenId, nft);
      }
    });
    
    // Преобразуем Map обратно в массив
    return Array.from(uniqueMap.values());
  }, [items]);
  
  // Используем данные о пагинации из API
  const totalItems = pagination.totalItems;
  const totalPages = pagination.totalPages;
  
  // Мутация для выставления NFT на продажу
  const sellNftMutation = useMutation({
    mutationFn: (data: { nftId: number, price: string }) => {
      return fetch(`/api/nft/${data.nftId}/sell`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ price: data.price }),
      }).then(res => {
        if (!res.ok) throw new Error('Не удалось выставить NFT на продажу');
        return res.json();
      });
    },
    onSuccess: () => {
      toast({
        title: 'NFT выставлен на продажу',
        description: 'Ваш NFT теперь доступен для покупки другими пользователями',
      });
      playSoundWithLog('success');
      queryClient.invalidateQueries({ queryKey: ['/api/nft/gallery'] });
      queryClient.invalidateQueries({ queryKey: ['/api/nft/marketplace'] });
      queryClient.invalidateQueries({ queryKey: ['/api/nft/marketplace/v2'] });
      setIsSellDialogOpen(false);
      setSalePrice('');
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось выставить NFT на продажу',
        variant: 'destructive',
      });
      playSoundWithLog('error');
    }
  });
  
  // Мутация для снятия NFT с продажи
  const cancelSaleMutation = useMutation({
    mutationFn: (nftId: number) => {
      return fetch(`/api/nft/${nftId}/cancel-sale`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      }).then(res => {
        if (!res.ok) throw new Error('Не удалось снять NFT с продажи');
        return res.json();
      });
    },
    onSuccess: () => {
      toast({
        title: 'NFT снят с продажи',
        description: 'Ваш NFT больше не доступен для покупки',
      });
      playSoundWithLog('success');
      queryClient.invalidateQueries({ queryKey: ['/api/nft/gallery'] });
      queryClient.invalidateQueries({ queryKey: ['/api/nft/marketplace'] });
      queryClient.invalidateQueries({ queryKey: ['/api/nft/marketplace/v2'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось снять NFT с продажи',
        variant: 'destructive',
      });
      playSoundWithLog('error');
    }
  });
  
  // Мутация для покупки NFT
  const buyNftMutation = useMutation({
    mutationFn: (nftId: number) => {
      return fetch(`/api/nft/${nftId}/buy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      }).then(res => {
        if (!res.ok) throw new Error('Не удалось купить NFT');
        return res.json();
      });
    },
    onSuccess: (data) => {
      toast({
        title: 'NFT куплен',
        description: 'Поздравляем с покупкой! NFT добавлен в вашу коллекцию',
      });
      playSoundWithLog('success');
      queryClient.invalidateQueries({ queryKey: ['/api/nft/gallery'] });
      queryClient.invalidateQueries({ queryKey: ['/api/nft/marketplace'] });
      queryClient.invalidateQueries({ queryKey: ['/api/nft/marketplace/v2'] });
      setSelectedNFT(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось купить NFT',
        variant: 'destructive',
      });
      playSoundWithLog('error');
    }
  });
  
  // Мутация для дарения NFT
  const giftNftMutation = useMutation({
    mutationFn: (data: { nftId: number, recipientUsername: string }) => {
      return fetch(`/api/nft/${data.nftId}/gift`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ recipientUsername: data.recipientUsername }),
      }).then(res => {
        if (!res.ok) throw new Error('Не удалось подарить NFT');
        return res.json();
      });
    },
    onSuccess: () => {
      toast({
        title: 'NFT подарен',
        description: `Вы успешно подарили NFT пользователю ${giftRecipient}`,
      });
      playSoundWithLog('success');
      queryClient.invalidateQueries({ queryKey: ['/api/nft/gallery'] });
      queryClient.invalidateQueries({ queryKey: ['/api/nft/marketplace'] });
      queryClient.invalidateQueries({ queryKey: ['/api/nft/marketplace/v2'] });
      setIsGiftDialogOpen(false);
      setGiftRecipient('');
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось подарить NFT',
        variant: 'destructive',
      });
      playSoundWithLog('error');
    }
  });
  
  const rarityColors: {[key: string]: string} = {
    common: 'bg-slate-500',
    uncommon: 'bg-green-500',
    rare: 'bg-blue-500',
    epic: 'bg-purple-500',
    legendary: 'bg-yellow-500',
  };
  
  const formatDate = (dateString: string | Date) => {
    try {
      const date = dateString instanceof Date ? dateString : new Date(dateString);
      
      // Проверяем валидность даты
      if (isNaN(date.getTime())) {
        return 'Недоступно';
      }
      
      return new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (error) {
      console.error('Ошибка форматирования даты:', error);
      return 'Недоступно';
    }
  };
  
  const calculatePower = (nft: NFT) => {
    const { power, agility, wisdom, luck } = nft.attributes || { power: 0, agility: 0, wisdom: 0, luck: 0 };
    return Math.floor((power + agility + wisdom + luck) / 4);
  };
  
  const handleSellNft = () => {
    if (!selectedNFT) return;
    
    if (!salePrice || isNaN(parseFloat(salePrice)) || parseFloat(salePrice) <= 0) {
      toast({
        title: 'Ошибка',
        description: 'Пожалуйста, укажите корректную цену',
        variant: 'destructive',
      });
      return;
    }
    
    sellNftMutation.mutate({
      nftId: selectedNFT.id,
      price: salePrice
    });
  };
  
  const handleGiftNft = () => {
    if (!selectedNFT) return;
    
    if (!giftRecipient) {
      toast({
        title: 'Ошибка',
        description: 'Пожалуйста, укажите имя пользователя получателя',
        variant: 'destructive',
      });
      return;
    }
    
    giftNftMutation.mutate({
      nftId: selectedNFT.id,
      recipientUsername: giftRecipient
    });
  };
  
  const handleBuyNft = () => {
    if (!selectedNFT) return;
    
    buyNftMutation.mutate(selectedNFT.id);
  };
  
  // Рассчитываем минимальную и максимальную цену отображаемых NFT
  const minMaxPrices = React.useMemo(() => {
    if (!marketplaceNfts.length) return { min: 0, max: 0 };
    
    let min = Infinity;
    let max = 0;
    
    marketplaceNfts.forEach(nft => {
      try {
        // Безопасное преобразование цены
        const price = typeof nft.price === 'string' ? parseFloat(nft.price) : nft.price;
        if (!isNaN(price)) {
          if (price < min) min = price;
          if (price > max) max = price;
        }
      } catch (e) {
        console.error('Ошибка при расчете мин-макс цен:', e);
      }
    });
    
    // Если после обработки всех NFT у нас нет действительных цен
    if (min === Infinity || max === 0) {
      return { min: 30, max: 20000 }; // Используем значения по умолчанию
    }
    
    return { 
      min: Math.floor(min), // Округляем до целого числа вниз
      max: Math.ceil(max)   // Округляем до целого числа вверх
    };
  }, [marketplaceNfts]);

  const isLoading = isLoadingMyNfts || isLoadingMarketplace || sellNftMutation.isPending || buyNftMutation.isPending || giftNftMutation.isPending || cancelSaleMutation.isPending;
  
  if (isErrorMyNfts || isErrorMarketplace) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Ошибка загрузки</AlertTitle>
        <AlertDescription>
          Не удалось загрузить данные о NFT. Пожалуйста, обновите страницу.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-10">
      {/* Маркетплейс */}
      <div>
        {/* Заголовок и фильтры - адаптивная версия */}
        <div className="flex flex-col gap-3 mb-6">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h2 className="text-2xl font-bold">NFT Маркетплейс</h2>
            <div className="text-xs bg-slate-100 dark:bg-slate-800 rounded-full px-3 py-1">
              Всего: {totalItems} NFT • Цены: ${minMaxPrices.min} - ${minMaxPrices.max}
            </div>
          </div>
          
          {/* Сортировка по цене - адаптируется под размер экрана */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium whitespace-nowrap">Цена:</span>
            <div className="flex flex-grow max-w-xs">
              <Button
                variant={sortOrder === 'asc' ? "default" : "outline"}
                size="sm"
                onClick={() => setSortOrder('asc')}
                className="rounded-r-none border-r-0 whitespace-nowrap flex-1 text-xs sm:text-sm px-2 sm:px-3"
              >
                <span className="hidden sm:inline">От низкой к высокой</span>
                <span className="sm:hidden">↑ Возрастание</span>
              </Button>
              <Button
                variant={sortOrder === 'desc' ? "default" : "outline"}
                size="sm"
                onClick={() => setSortOrder('desc')}
                className="rounded-l-none whitespace-nowrap flex-1 text-xs sm:text-sm px-2 sm:px-3"
              >
                <span className="hidden sm:inline">От высокой к низкой</span>
                <span className="sm:hidden">↓ Убывание</span>
              </Button>
            </div>
          </div>
        </div>
        
        {isLoadingMarketplace ? (
          <div className="flex justify-center items-center h-[200px]">
            <LoadingSpinner size="lg" />
          </div>
        ) : marketplaceNfts.length === 0 ? (
          <Alert>
            <AlertDescription>
              На маркетплейсе пока нет доступных NFT для покупки.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-4">
              {marketplaceNfts.map((nft) => (
                <Card 
                  key={nft.id} 
                  className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow w-full max-w-full"
                  onClick={() => {
                    setSelectedNFT(nft);
                    playSoundWithLog('click');
                  }}
                >
                  <div className="relative aspect-square">
                    <img 
                      src={getProxiedImageUrl(nft.imagePath)} 
                      alt={nft.name} 
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <Badge className={`absolute top-1 right-1 text-[10px] px-1 py-0 sm:text-xs sm:px-2 sm:py-0.5 ${rarityColors[nft.rarity]}`}>
                      {nft.rarity}
                    </Badge>
                    <Badge className="absolute top-1 left-1 text-[10px] px-1 py-0 sm:text-xs sm:px-2 sm:py-0.5 bg-amber-500">
                      {(() => {
                        try {
                          // Обрабатываем цену, учитывая возможные ошибки с парсингом
                          const price = typeof nft.price === 'string' ? parseFloat(nft.price) : nft.price;
                          return isNaN(price) ? '30' : price.toFixed(0);
                        } catch (e) {
                          console.error('Ошибка при обработке цены:', e);
                          return '30';
                        }
                      })()} USD
                    </Badge>
                  </div>
                  <CardContent className="p-2 sm:p-3">
                    <h3 className="font-semibold text-xs sm:text-sm truncate">{nft.name}</h3>
                    {/* Добавляем отображение названия коллекции */}
                    <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 mb-0.5 truncate">
                      {nft.collectionName || 'Bored Ape Yacht Club'}
                    </div>
                    <div className="flex justify-between items-center mt-0.5">
                      <span className="text-[10px] sm:text-xs text-muted-foreground">Сила: {calculatePower(nft)}</span>
                      <span className="text-[10px] sm:text-xs text-muted-foreground truncate max-w-[70px] sm:max-w-[120px]">
                        {nft.owner ? `@${nft.owner.username}` : 'Неизвестно'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {/* Пагинация */}
            {totalPages > 0 && (
              <div className="flex justify-center items-center gap-2 mt-4">
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => {
                    const newPage = Math.max(currentPage - 1, 1);
                    setCurrentPage(newPage);
                    // Прокручиваем страницу вверх
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  Назад
                </Button>
                
                <div className="flex items-center gap-1 flex-wrap justify-center">
                  {(() => {
                    // Создаем массив номеров страниц для отображения
                    const pageButtons = [];
                    
                    // Максимальное количество кнопок страниц для отображения
                    const maxPageButtons = 5;
                    
                    // Вычисляем диапазон страниц для отображения
                    let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
                    let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);
                    
                    // Корректируем начальную страницу, если достигли конца
                    if (endPage - startPage + 1 < maxPageButtons) {
                      startPage = Math.max(1, endPage - maxPageButtons + 1);
                    }
                    
                    // Добавляем первую страницу и многоточие если нужно
                    if (startPage > 1) {
                      pageButtons.push(
                        <Button
                          key={1}
                          variant={currentPage === 1 ? "default" : "outline"}
                          size="sm"
                          className="w-8 h-8 p-0"
                          onClick={() => {
                            setCurrentPage(1);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                        >
                          1
                        </Button>
                      );
                      
                      if (startPage > 2) {
                        pageButtons.push(
                          <span key="ellipsis1" className="px-1">...</span>
                        );
                      }
                    }
                    
                    // Добавляем кнопки для страниц в диапазоне
                    for (let page = startPage; page <= endPage; page++) {
                      pageButtons.push(
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          className="w-8 h-8 p-0"
                          onClick={() => {
                            setCurrentPage(page);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                        >
                          {page}
                        </Button>
                      );
                    }
                    
                    // Добавляем многоточие и последнюю страницу если нужно
                    if (endPage < totalPages) {
                      if (endPage < totalPages - 1) {
                        pageButtons.push(
                          <span key="ellipsis2" className="px-1">...</span>
                        );
                      }
                      
                      pageButtons.push(
                        <Button
                          key={totalPages}
                          variant={currentPage === totalPages ? "default" : "outline"}
                          size="sm"
                          className="w-8 h-8 p-0"
                          onClick={() => {
                            setCurrentPage(totalPages);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                        >
                          {totalPages}
                        </Button>
                      );
                    }
                    
                    return pageButtons;
                  })()}
                </div>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => {
                    const newPage = Math.min(currentPage + 1, totalPages);
                    setCurrentPage(newPage);
                    // Прокручиваем страницу вверх
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  Вперед
                </Button>
                
                <div className="text-xs text-muted-foreground ml-2">
                  Страница {currentPage} из {totalPages} • {totalItems} NFT
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Модальное окно с деталями NFT - мобильно-адаптивная версия */}
      {selectedNFT && (
        <Dialog open={!!selectedNFT} onOpenChange={(open) => !open && setSelectedNFT(null)}>
          <DialogContent className="max-w-[95%] sm:max-w-md max-h-[90vh] overflow-auto p-3 sm:p-6">
            <DialogHeader className="pb-2 sm:pb-4">
              <DialogTitle className="text-base sm:text-lg">{selectedNFT.name}</DialogTitle>
              <DialogDescription className="text-[10px] sm:text-xs">
                Token ID: {selectedNFT.tokenId}
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex flex-col gap-3 sm:gap-4">
              <div className="relative aspect-square rounded-md overflow-hidden">
                <img 
                  src={getProxiedImageUrl(selectedNFT.imagePath)} 
                  alt={selectedNFT.name} 
                  className="w-full h-full object-cover"
                />
                <Badge className={`absolute top-2 right-2 text-xs ${rarityColors[selectedNFT.rarity]}`}>
                  {selectedNFT.rarity}
                </Badge>
                {selectedNFT.forSale && (
                  <Badge className="absolute top-2 left-2 text-xs bg-amber-500">
                    {(() => {
                      try {
                        const price = typeof selectedNFT.price === 'string' ? parseFloat(selectedNFT.price) : selectedNFT.price;
                        return isNaN(price) ? '30' : price.toFixed(0);
                      } catch (e) {
                        console.error('Ошибка при обработке цены в модальном окне:', e);
                        return '30';
                      }
                    })()} USD
                  </Badge>
                )}
              </div>
              
              <div className="space-y-3 sm:space-y-4">
                {/* Добавляем отображение названия коллекции */}
                <div>
                  <h4 className="text-xs sm:text-sm font-medium mb-0.5 sm:mb-1">Коллекция</h4>
                  <p className="text-xs text-muted-foreground">{selectedNFT.collectionName || 'Bored Ape Yacht Club'}</p>
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-medium mb-0.5 sm:mb-1">Описание</h4>
                  <p className="text-xs text-muted-foreground">{selectedNFT.description}</p>
                </div>
                
                <div>
                  <h4 className="text-xs font-medium mb-0.5 sm:mb-1">Характеристики</h4>
                  <div className="grid grid-cols-2 gap-y-1 gap-x-2">
                    {selectedNFT.attributes && (
                      <>
                        <div className="flex items-center">
                          <span className="text-[10px] sm:text-xs mr-1">Сила:</span>
                          <Badge variant="outline" className="text-[10px] sm:text-xs">{selectedNFT.attributes.power}</Badge>
                        </div>
                        <div className="flex items-center">
                          <span className="text-[10px] sm:text-xs mr-1">Ловкость:</span>
                          <Badge variant="outline" className="text-[10px] sm:text-xs">{selectedNFT.attributes.agility}</Badge>
                        </div>
                        <div className="flex items-center">
                          <span className="text-[10px] sm:text-xs mr-1">Мудрость:</span>
                          <Badge variant="outline" className="text-[10px] sm:text-xs">{selectedNFT.attributes.wisdom}</Badge>
                        </div>
                        <div className="flex items-center">
                          <span className="text-[10px] sm:text-xs mr-1">Удача:</span>
                          <Badge variant="outline" className="text-[10px] sm:text-xs">{selectedNFT.attributes.luck}</Badge>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <h4 className="text-[10px] sm:text-xs font-medium mb-0.5">Владелец</h4>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">
                      {selectedNFT.owner ? selectedNFT.owner.username : 'Неизвестно'}
                      {selectedNFT.ownerId === (currentUser as any)?.id ? ' (Вы)' : ''}
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="text-[10px] sm:text-xs font-medium mb-0.5">Дата создания</h4>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">{formatDate(selectedNFT.mintedAt)}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-3 sm:mt-4">
              {selectedNFT.ownerId === (currentUser as any)?.id ? (
                // Если текущий пользователь - владелец NFT
                <>
                  {selectedNFT.forSale ? (
                    <Button 
                      variant="outline" 
                      onClick={() => cancelSaleMutation.mutate(selectedNFT.id)}
                      disabled={isLoading}
                      className="text-xs sm:text-sm py-1 px-2 h-8 sm:h-9"
                    >
                      {cancelSaleMutation.isPending ? <LoadingSpinner className="mr-1 h-3 w-3" /> : null}
                      Снять с продажи
                    </Button>
                  ) : (
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setIsSellDialogOpen(true);
                        setSalePrice('');
                      }}
                      disabled={isLoading}
                      className="text-xs sm:text-sm py-1 px-2 h-8 sm:h-9"
                    >
                      Продать
                    </Button>
                  )}
                  <Button 
                    onClick={() => {
                      setIsGiftDialogOpen(true);
                      setGiftRecipient('');
                    }}
                    disabled={isLoading || selectedNFT.forSale}
                    className="text-xs sm:text-sm py-1 px-2 h-8 sm:h-9"
                  >
                    Подарить
                  </Button>
                </>
              ) : (
                // Если текущий пользователь не владелец NFT
                <>
                  {selectedNFT.forSale && (
                    <Button 
                      onClick={handleBuyNft}
                      disabled={isLoading}
                      className="text-xs sm:text-sm py-1 px-2 h-8 sm:h-9"
                    >
                      {buyNftMutation.isPending ? <LoadingSpinner className="mr-1 h-3 w-3" /> : null}
                      Купить за {(() => {
                        try {
                          const price = typeof selectedNFT.price === 'string' ? parseFloat(selectedNFT.price) : selectedNFT.price;
                          return isNaN(price) ? '30' : price.toFixed(0);
                        } catch (e) {
                          console.error('Ошибка при обработке цены кнопки покупки:', e);
                          return '30';
                        }
                      })()} USD
                    </Button>
                  )}
                </>
              )}
              <Button 
                variant="secondary" 
                onClick={() => setSelectedNFT(null)}
                className="text-xs sm:text-sm py-1 px-2 h-8 sm:h-9"
              >
                Закрыть
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      
      {/* Диалог для дарения NFT - мобильно-адаптивная версия */}
      <Dialog open={isGiftDialogOpen} onOpenChange={setIsGiftDialogOpen}>
        <DialogContent className="max-w-[95%] sm:max-w-[425px] p-3 sm:p-6">
          <DialogHeader className="pb-2 sm:pb-4 space-y-1">
            <DialogTitle className="text-base sm:text-lg">Подарить NFT</DialogTitle>
            <DialogDescription className="text-xs">
              Укажите имя пользователя (username), которому хотите подарить этот NFT.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2 sm:py-4">
            <div className="grid sm:grid-cols-4 items-center gap-2 sm:gap-4">
              <Label htmlFor="recipient" className="sm:text-right text-xs sm:text-sm">
                Получатель
              </Label>
              <Input
                id="recipient"
                placeholder="username"
                value={giftRecipient}
                onChange={(e) => setGiftRecipient(e.target.value)}
                className="sm:col-span-3 h-8 sm:h-9 text-xs sm:text-sm"
              />
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-2 mt-2 sm:mt-0">
            <Button 
              variant="secondary" 
              onClick={() => setIsGiftDialogOpen(false)}
              disabled={giftNftMutation.isPending}
              className="text-xs sm:text-sm py-1 px-3 h-8 sm:h-9"
            >
              Отмена
            </Button>
            <Button 
              onClick={handleGiftNft}
              disabled={giftNftMutation.isPending || !giftRecipient}
              className="text-xs sm:text-sm py-1 px-3 h-8 sm:h-9"
            >
              {giftNftMutation.isPending ? <LoadingSpinner className="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" /> : null}
              Подарить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Диалог для продажи NFT - мобильно-адаптивная версия */}
      <Dialog open={isSellDialogOpen} onOpenChange={setIsSellDialogOpen}>
        <DialogContent className="max-w-[95%] sm:max-w-[425px] p-3 sm:p-6">
          <DialogHeader className="pb-2 sm:pb-4 space-y-1">
            <DialogTitle className="text-base sm:text-lg">Продать NFT</DialogTitle>
            <DialogDescription className="text-xs">
              Укажите цену в USD, за которую вы хотите продать этот NFT.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2 sm:py-4">
            <div className="grid sm:grid-cols-4 items-center gap-2 sm:gap-4">
              <Label htmlFor="price" className="sm:text-right text-xs sm:text-sm">
                Цена (USD)
              </Label>
              <Input
                id="price"
                type="number"
                placeholder="0.00"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                className="sm:col-span-3 h-8 sm:h-9 text-xs sm:text-sm"
                min="0.01"
                step="0.01"
              />
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-2 mt-2 sm:mt-0">
            <Button 
              variant="secondary" 
              onClick={() => setIsSellDialogOpen(false)}
              disabled={sellNftMutation.isPending}
              className="text-xs sm:text-sm py-1 px-3 h-8 sm:h-9"
            >
              Отмена
            </Button>
            <Button 
              onClick={handleSellNft}
              disabled={sellNftMutation.isPending || !salePrice || isNaN(parseFloat(salePrice)) || parseFloat(salePrice) <= 0}
              className="text-xs sm:text-sm py-1 px-3 h-8 sm:h-9"
            >
              {sellNftMutation.isPending ? <LoadingSpinner className="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" /> : null}
              Выставить на продажу
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};