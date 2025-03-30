import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { NFTTabNavigation } from '../../pages/nft-page';
import { toast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
  price?: string;
  forSale?: boolean;
  attributes: {
    power: number;
    agility: number;
    wisdom: number;
    luck: number;
  };
};

interface NFTGalleryProps {
  navigation: NFTTabNavigation;
}

export const NFTGallery: React.FC<NFTGalleryProps> = ({ navigation }) => {
  const [selectedNFT, setSelectedNFT] = useState<NFT | null>(null);
  const [isSellDialogOpen, setIsSellDialogOpen] = useState(false);
  const [isGiftDialogOpen, setIsGiftDialogOpen] = useState(false);
  const [salePrice, setSalePrice] = useState('');
  const [giftRecipient, setGiftRecipient] = useState('');
  const queryClient = useQueryClient();

  const { 
    data: nfts = [], 
    isLoading: isLoadingNFTs,
    isError: isErrorNFTs
  } = useQuery<NFT[]>({
    queryKey: ['/api/nft/user'],
    retry: 3
  });
  
  // Получаем данные о текущем пользователе
  const { data: currentUser } = useQuery({
    queryKey: ['/api/user'],
    retry: 1
  });

  const calculatePower = (nft: NFT) => {
    const { power, agility, wisdom, luck } = nft.attributes;
    return Math.floor((power + agility + wisdom + luck) / 4);
  };

  const rarityColors: {[key: string]: string} = {
    common: 'bg-slate-500',
    uncommon: 'bg-green-500',
    rare: 'bg-blue-500',
    epic: 'bg-purple-500',
    legendary: 'bg-yellow-500',
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Обработчик для навигации на вкладку коллекций
  const handleNavigateToCollections = () => {
    console.log('Переход к коллекциям из компонента NFTGallery');
    navigation.switchToCollections(); // Используем функцию из переданного пропс
    playSoundWithLog('click');
  };
  
  // Обработчик для навигации на вкладку маркетплейса
  const handleNavigateToMarketplace = () => {
    console.log('Переход к маркетплейсу из компонента NFTGallery');
    navigation.switchToMarketplace(); // Используем функцию из переданного пропс
    playSoundWithLog('click');
  };
  
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
      queryClient.invalidateQueries({ queryKey: ['/api/nft/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/nft/marketplace'] });
      setIsSellDialogOpen(false);
      setSalePrice('');
      setSelectedNFT(null);
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
  
  // Мутация для подарка NFT другому пользователю
  const giftNftMutation = useMutation({
    mutationFn: (data: { nftId: number, recipientUsername: string }) => {
      return fetch(`/api/nft/gift`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          nftId: data.nftId,
          recipientUsername: data.recipientUsername 
        }),
      }).then(res => {
        if (!res.ok) throw new Error('Не удалось подарить NFT');
        return res.json();
      });
    },
    onSuccess: () => {
      toast({
        title: 'NFT успешно подарен',
        description: 'Ваш NFT успешно передан указанному пользователю',
      });
      playSoundWithLog('success');
      queryClient.invalidateQueries({ queryKey: ['/api/nft/user'] });
      setIsGiftDialogOpen(false);
      setGiftRecipient('');
      setSelectedNFT(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Пользователь не найден или произошла другая ошибка',
        variant: 'destructive',
      });
      playSoundWithLog('error');
    }
  });
  
  // Обработчик продажи NFT
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
  
  // Обработчик для подарка NFT
  const handleGiftNft = () => {
    if (!selectedNFT) return;
    
    if (!giftRecipient || giftRecipient.trim() === '') {
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

  useEffect(() => {
    console.log('NFTGallery компонент инициализирован');
  }, []);

  if (isLoadingNFTs) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isErrorNFTs) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Ошибка загрузки</AlertTitle>
        <AlertDescription>
          Не удалось загрузить данные о ваших NFT. Пожалуйста, обновите страницу.
        </AlertDescription>
      </Alert>
    );
  }

  if (!nfts || nfts.length === 0) {
    return (
      <div className="border rounded-lg p-6 text-center">
        <h3 className="text-lg font-semibold mb-2">У вас пока нет NFT</h3>
        <p className="text-muted-foreground mb-4">
          Купите свой первый NFT на Маркетплейсе и начните свою коллекцию!
        </p>
        <div className="flex justify-center gap-4">
          <Button
            variant="default"
            onClick={handleNavigateToMarketplace}
          >
            Перейти на Маркетплейс
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        {nfts.map((nft: NFT) => (
          <Card 
            key={nft.id} 
            className="overflow-hidden cursor-pointer transform transition-transform hover:scale-[1.02]"
            onClick={() => {
              setSelectedNFT(nft);
              playSoundWithLog('click');
            }}
          >
            <div className="relative aspect-square">
              <div className="w-full h-full relative">
                {nft.imagePath.endsWith('.svg') ? (
                  <object
                    data={getProxiedImageUrl(nft.imagePath)}
                    type="image/svg+xml"
                    className="w-full h-full"
                    aria-label={nft.name}
                  >
                    <img 
                      src={`/assets/nft/fallback/${nft.rarity.toLowerCase()}_nft.png`}
                      alt={nft.name} 
                      className="w-full h-full object-cover"
                    />
                  </object>
                ) : (
                  <img 
                    src={getProxiedImageUrl(nft.imagePath)} 
                    alt={nft.name} 
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <Badge className={`absolute top-2 right-2 ${rarityColors[nft.rarity]}`}>
                {nft.rarity}
              </Badge>
              {nft.forSale && (
                <Badge className="absolute top-2 left-2 bg-amber-500">
                  {nft.price} USD
                </Badge>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                <h3 className="text-white font-semibold text-lg truncate">{nft.name}</h3>
                <div className="flex items-center justify-between text-white/80 text-sm">
                  <span>Сила: {calculatePower(nft)}</span>
                  {nft.forSale && (
                    <span className="text-amber-300">В продаже</span>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

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
                <div className="w-full h-full relative">
                  {selectedNFT.imagePath.endsWith('.svg') ? (
                    <object
                      data={getProxiedImageUrl(selectedNFT.imagePath)}
                      type="image/svg+xml"
                      className="w-full h-full"
                      aria-label={selectedNFT.name}
                    >
                      <img 
                        src={`/assets/nft/fallback/${selectedNFT.rarity.toLowerCase()}_nft.png`}
                        alt={selectedNFT.name} 
                        className="w-full h-full object-cover"
                      />
                    </object>
                  ) : (
                    <img 
                      src={getProxiedImageUrl(selectedNFT.imagePath)} 
                      alt={selectedNFT.name} 
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <Badge className={`absolute top-2 right-2 ${rarityColors[selectedNFT.rarity]}`}>
                  {selectedNFT.rarity}
                </Badge>
                {selectedNFT.forSale && (
                  <Badge className="absolute top-2 left-2 bg-amber-500">
                    {selectedNFT.price} USD
                  </Badge>
                )}
              </div>
              
              <div className="space-y-3">
                <div>
                  <h4 className="text-xs font-medium mb-1">Описание</h4>
                  <p className="text-xs text-muted-foreground">{selectedNFT.description}</p>
                </div>
                
                <div>
                  <h4 className="text-xs font-medium mb-1">Характеристики</h4>
                  <div className="grid grid-cols-2 gap-y-1 gap-x-2">
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
                  </div>
                </div>
                
                <div>
                  <h4 className="text-xs font-medium mb-1">Дата создания</h4>
                  <p className="text-xs text-muted-foreground">{formatDate(selectedNFT.mintedAt)}</p>
                </div>
                
                {selectedNFT.forSale && (
                  <div>
                    <h4 className="text-xs font-medium mb-1">Статус</h4>
                    <p className="text-xs text-amber-500">
                      Выставлен на продажу за {selectedNFT.price} USD
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            <DialogFooter className="flex space-x-2 pt-3">
              <div className="flex flex-wrap gap-2 w-full justify-between">
                {selectedNFT.forSale ? (
                  <Button 
                    variant="default" 
                    size="sm"
                    onClick={() => {
                      handleNavigateToMarketplace();
                      setSelectedNFT(null);
                    }}
                  >
                    На Маркетплейс
                  </Button>
                ) : (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setIsSellDialogOpen(true);
                        setSalePrice('');
                      }}
                    >
                      Продать NFT
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setIsGiftDialogOpen(true);
                        setGiftRecipient('');
                      }}
                    >
                      Подарить NFT
                    </Button>
                  </>
                )}
                <Button variant="secondary" size="sm" onClick={() => setSelectedNFT(null)}>
                  Закрыть
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      
      {/* Диалог для выставления NFT на продажу */}
      <Dialog open={isSellDialogOpen} onOpenChange={setIsSellDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Выставить NFT на продажу</DialogTitle>
            <DialogDescription>
              Укажите цену в USD, за которую вы хотите продать NFT "{selectedNFT?.name}".
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
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="secondary" 
              onClick={() => setIsSellDialogOpen(false)}
            >
              Отмена
            </Button>
            <Button 
              onClick={handleSellNft}
              disabled={sellNftMutation.isPending}
            >
              {sellNftMutation.isPending && <LoadingSpinner className="mr-2 h-4 w-4" />}
              Выставить на продажу
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Диалог для подарка NFT другому пользователю */}
      <Dialog open={isGiftDialogOpen} onOpenChange={setIsGiftDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Подарить NFT</DialogTitle>
            <DialogDescription>
              Укажите имя пользователя, которому вы хотите подарить NFT "{selectedNFT?.name}".
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="username" className="text-right">
                Пользователь
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="Имя пользователя"
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
            >
              Отмена
            </Button>
            <Button 
              onClick={handleGiftNft}
              disabled={giftNftMutation.isPending}
            >
              {giftNftMutation.isPending && <LoadingSpinner className="mr-2 h-4 w-4" />}
              Подарить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};