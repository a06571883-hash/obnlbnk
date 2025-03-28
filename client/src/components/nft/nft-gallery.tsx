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

// Импортируем сервис для звука
import { playSound } from '../../lib/sound-service';

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
          Создайте свой первый NFT во вкладке Коллекции или купите на Маркетплейсе.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Button
            variant="outline"
            onClick={handleNavigateToCollections}
          >
            Перейти к Коллекциям
          </Button>
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
                    src={nft.imagePath} 
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
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedNFT.name}</DialogTitle>
              <DialogDescription>
                Token ID: {selectedNFT.tokenId}
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative aspect-square rounded-md overflow-hidden">
                <div className="w-full h-full relative">
                  {selectedNFT.imagePath.endsWith('.svg') ? (
                    <object
                      data={selectedNFT.imagePath}
                      type="image/svg+xml"
                      className="w-full h-full"
                      aria-label={selectedNFT.name}
                    >
                      <img 
                        src="/assets/nft/fallback-nft.svg" 
                        alt={selectedNFT.name} 
                        className="w-full h-full object-cover"
                      />
                    </object>
                  ) : (
                    <img 
                      src={selectedNFT.imagePath} 
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
              
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-1">Описание</h4>
                  <p className="text-sm text-muted-foreground">{selectedNFT.description}</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium mb-2">Характеристики</h4>
                  <div className="grid grid-cols-2 gap-y-2">
                    <div className="flex items-center">
                      <span className="text-sm mr-2">Сила:</span>
                      <Badge variant="outline">{selectedNFT.attributes.power}</Badge>
                    </div>
                    <div className="flex items-center">
                      <span className="text-sm mr-2">Ловкость:</span>
                      <Badge variant="outline">{selectedNFT.attributes.agility}</Badge>
                    </div>
                    <div className="flex items-center">
                      <span className="text-sm mr-2">Мудрость:</span>
                      <Badge variant="outline">{selectedNFT.attributes.wisdom}</Badge>
                    </div>
                    <div className="flex items-center">
                      <span className="text-sm mr-2">Удача:</span>
                      <Badge variant="outline">{selectedNFT.attributes.luck}</Badge>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium mb-1">Дата создания</h4>
                  <p className="text-sm text-muted-foreground">{formatDate(selectedNFT.mintedAt)}</p>
                </div>
                
                {selectedNFT.forSale && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">Статус</h4>
                    <p className="text-sm text-amber-500">
                      Выставлен на продажу за {selectedNFT.price} USD
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            <DialogFooter>
              {selectedNFT.forSale ? (
                <Button 
                  variant="default" 
                  onClick={() => {
                    handleNavigateToMarketplace();
                    setSelectedNFT(null);
                  }}
                >
                  Перейти на Маркетплейс
                </Button>
              ) : null}
              <Button variant="secondary" onClick={() => setSelectedNFT(null)}>
                Закрыть
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};