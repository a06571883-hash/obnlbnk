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
  
  // Получаем все NFT, доступные для покупки и удаляем дубликаты
  const { 
    data: rawMarketplaceNfts = [], 
    isLoading: isLoadingMarketplace,
    isError: isErrorMarketplace
  } = useQuery<NFT[]>({
    queryKey: ['/api/nft/marketplace'],
    retry: 3
  });
  
  // Состояние для пагинации
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12; // Показываем 12 NFT на страницу
  
  // Фильтруем NFT, исключая те, которые принадлежат текущему пользователю,
  // и удаляем дубликаты на основе tokenId
  const uniqueMarketplaceNfts = React.useMemo(() => {
    // Создаем Map для хранения уникальных NFT по tokenId
    const uniqueNfts = new Map();
    
    // Добавляем только уникальные NFT в Map, которые НЕ принадлежат текущему пользователю
    rawMarketplaceNfts.forEach(nft => {
      // Пропускаем NFT текущего пользователя (если не выставлен на продажу)
      const isCurrentUserNft = nft.ownerId === (currentUser as any)?.id;
      
      // Добавляем в маркетплейс только если:
      // 1. NFT НЕ принадлежит текущему пользователю ИЛИ
      // 2. NFT принадлежит текущему пользователю, но выставлен на продажу
      if (!isCurrentUserNft || (isCurrentUserNft && nft.forSale)) {
        // Если NFT с таким tokenId еще нет в Map или текущий NFT имеет более высокий ID
        if (!uniqueNfts.has(nft.tokenId) || uniqueNfts.get(nft.tokenId).id < nft.id) {
          uniqueNfts.set(nft.tokenId, nft);
        }
      }
    });
    
    // Преобразуем Map обратно в массив
    return Array.from(uniqueNfts.values());
  }, [rawMarketplaceNfts, currentUser]);
  
  // Получаем общее количество страниц
  const totalPages = Math.ceil(uniqueMarketplaceNfts.length / itemsPerPage);
  
  // Получаем NFT для текущей страницы
  const marketplaceNfts = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return uniqueMarketplaceNfts.slice(startIndex, startIndex + itemsPerPage);
  }, [uniqueMarketplaceNfts, currentPage, itemsPerPage]);
  
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
        <h2 className="text-2xl font-bold mb-6">NFT Маркетплейс</h2>
        
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {marketplaceNfts.map((nft) => (
                <Card 
                  key={nft.id} 
                  className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
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
                    />
                    <Badge className={`absolute top-2 right-2 ${rarityColors[nft.rarity]}`}>
                      {nft.rarity}
                    </Badge>
                    <Badge className="absolute top-2 left-2 bg-amber-500">
                      {nft.price} USD
                    </Badge>
                  </div>
                  <CardContent className="p-3">
                    <h3 className="font-semibold truncate">{nft.name}</h3>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs text-muted-foreground">Сила: {calculatePower(nft)}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {nft.owner ? `@${nft.owner.username}` : 'Неизвестно'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {/* Пагинация */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-4">
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                >
                  Назад
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    // Вычисляем номера страниц для отображения (до 5 страниц)
                    const pageToShow = totalPages <= 5 
                      ? i + 1 
                      : currentPage <= 3 
                        ? i + 1 
                        : currentPage >= totalPages - 2 
                          ? totalPages - 4 + i 
                          : currentPage - 2 + i;
                          
                    // Убеждаемся, что страница в пределах общего количества
                    if (pageToShow > totalPages) return null;
                    
                    return (
                      <Button
                        key={pageToShow}
                        variant={currentPage === pageToShow ? "default" : "outline"}
                        size="sm"
                        className="w-8 h-8 p-0"
                        onClick={() => setCurrentPage(pageToShow)}
                      >
                        {pageToShow}
                      </Button>
                    );
                  })}
                </div>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                >
                  Вперед
                </Button>
                
                <div className="text-xs text-muted-foreground ml-2">
                  {uniqueMarketplaceNfts.length} NFT в маркетплейсе
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Модальное окно с деталями NFT */}
      {selectedNFT && (
        <Dialog open={!!selectedNFT} onOpenChange={(open) => !open && setSelectedNFT(null)}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle className="text-lg">{selectedNFT.name}</DialogTitle>
              <DialogDescription className="text-xs">
                Token ID: {selectedNFT.tokenId}
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex flex-col gap-4">
              <div className="relative aspect-square rounded-md overflow-hidden">
                <img 
                  src={getProxiedImageUrl(selectedNFT.imagePath)} 
                  alt={selectedNFT.name} 
                  className="w-full h-full object-cover"
                />
                <Badge className={`absolute top-2 right-2 ${rarityColors[selectedNFT.rarity]}`}>
                  {selectedNFT.rarity}
                </Badge>
                {selectedNFT.forSale && (
                  <Badge className="absolute top-2 left-2 bg-amber-500">
                    {selectedNFT.price} USD
                  </Badge>
                )}
              </div>
              
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-1">Описание</h4>
                  <p className="text-sm text-muted-foreground">{selectedNFT.description}</p>
                </div>
                
                <div>
                  <h4 className="text-xs font-medium mb-1">Характеристики</h4>
                  <div className="grid grid-cols-2 gap-y-1 gap-x-2">
                    {selectedNFT.attributes && (
                      <>
                        <div className="flex items-center">
                          <span className="text-xs mr-1">Сила:</span>
                          <Badge variant="outline" className="text-xs">{selectedNFT.attributes.power}</Badge>
                        </div>
                        <div className="flex items-center">
                          <span className="text-xs mr-1">Ловкость:</span>
                          <Badge variant="outline" className="text-xs">{selectedNFT.attributes.agility}</Badge>
                        </div>
                        <div className="flex items-center">
                          <span className="text-xs mr-1">Мудрость:</span>
                          <Badge variant="outline" className="text-xs">{selectedNFT.attributes.wisdom}</Badge>
                        </div>
                        <div className="flex items-center">
                          <span className="text-xs mr-1">Удача:</span>
                          <Badge variant="outline" className="text-xs">{selectedNFT.attributes.luck}</Badge>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                
                <div>
                  <h4 className="text-xs font-medium mb-1">Владелец</h4>
                  <p className="text-xs text-muted-foreground">
                    {selectedNFT.owner ? selectedNFT.owner.username : 'Неизвестно'}
                    {selectedNFT.ownerId === (currentUser as any)?.id ? ' (Вы)' : ''}
                  </p>
                </div>
                
                <div>
                  <h4 className="text-xs font-medium mb-1">Дата создания</h4>
                  <p className="text-xs text-muted-foreground">{formatDate(selectedNFT.mintedAt)}</p>
                </div>
              </div>
            </div>
            
            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              {selectedNFT.ownerId === (currentUser as any)?.id ? (
                // Если текущий пользователь - владелец NFT
                <>
                  {selectedNFT.forSale ? (
                    <Button 
                      variant="outline" 
                      onClick={() => cancelSaleMutation.mutate(selectedNFT.id)}
                      disabled={isLoading}
                    >
                      {cancelSaleMutation.isPending ? <LoadingSpinner className="mr-2 h-4 w-4" /> : null}
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
                    >
                      {buyNftMutation.isPending ? <LoadingSpinner className="mr-2 h-4 w-4" /> : null}
                      Купить за {selectedNFT.price} USD
                    </Button>
                  )}
                </>
              )}
              <Button variant="secondary" onClick={() => setSelectedNFT(null)}>
                Закрыть
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      
      {/* Диалог для дарения NFT */}
      <Dialog open={isGiftDialogOpen} onOpenChange={setIsGiftDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Подарить NFT</DialogTitle>
            <DialogDescription>
              Укажите имя пользователя (username), которому хотите подарить этот NFT.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="recipient" className="text-right">
                Получатель
              </Label>
              <Input
                id="recipient"
                placeholder="username"
                value={giftRecipient}
                onChange={(e) => setGiftRecipient(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="secondary" 
              onClick={() => setIsGiftDialogOpen(false)}
              disabled={giftNftMutation.isPending}
            >
              Отмена
            </Button>
            <Button 
              onClick={handleGiftNft}
              disabled={giftNftMutation.isPending || !giftRecipient}
            >
              {giftNftMutation.isPending ? <LoadingSpinner className="mr-2 h-4 w-4" /> : null}
              Подарить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Диалог для продажи NFT */}
      <Dialog open={isSellDialogOpen} onOpenChange={setIsSellDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Продать NFT</DialogTitle>
            <DialogDescription>
              Укажите цену в USD, за которую вы хотите продать этот NFT.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="price" className="text-right">
                Цена (USD)
              </Label>
              <Input
                id="price"
                type="number"
                placeholder="0.00"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                className="col-span-3"
                min="0.01"
                step="0.01"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="secondary" 
              onClick={() => setIsSellDialogOpen(false)}
              disabled={sellNftMutation.isPending}
            >
              Отмена
            </Button>
            <Button 
              onClick={handleSellNft}
              disabled={sellNftMutation.isPending || !salePrice || isNaN(parseFloat(salePrice)) || parseFloat(salePrice) <= 0}
            >
              {sellNftMutation.isPending ? <LoadingSpinner className="mr-2 h-4 w-4" /> : null}
              Выставить на продажу
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};