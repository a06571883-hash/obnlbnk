import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '../../components/ui/loading-spinner';

// Helper function for sound playback simulation
const playSoundIfEnabled = (sound: string) => {
  console.log(`Playing sound: ${sound}`);
};

type NFT = {
  id: number;
  collectionId: number;
  name: string;
  description: string;
  imagePath: string;
  rarity: string;
  mintedAt: string;
  tokenId: string;
  attributes: {
    power: number;
    agility: number;
    wisdom: number;
    luck: number;
  };
};

export const NFTGallery: React.FC = () => {
  const [selectedNFT, setSelectedNFT] = useState<NFT | null>(null);

  const { 
    data: nfts = [], 
    isLoading: isLoadingNFTs,
    isError: isErrorNFTs
  } = useQuery<NFT[]>({
    queryKey: ['/api/nft/gallery'],
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
          Создайте свой первый NFT во вкладке Коллекции.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            document.querySelector('[value="collections"]')?.dispatchEvent(
              new MouseEvent('click', { bubbles: true })
            );
            playSoundIfEnabled('click');
          }}
        >
          Перейти к Коллекциям
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {nfts.map((nft: NFT) => (
          <Card 
            key={nft.id} 
            className="overflow-hidden cursor-pointer transform transition-transform hover:scale-[1.02]"
            onClick={() => {
              setSelectedNFT(nft);
              playSoundIfEnabled('click');
            }}
          >
            <div className="relative aspect-square">
              <img 
                src={nft.imagePath} 
                alt={nft.name} 
                className="w-full h-full object-cover"
              />
              <Badge className={`absolute top-2 right-2 ${rarityColors[nft.rarity]}`}>
                {nft.rarity}
              </Badge>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                <h3 className="text-white font-semibold text-lg">{nft.name}</h3>
                <div className="flex items-center text-white/80 text-sm">
                  <span>Сила: {calculatePower(nft)}</span>
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
                <img 
                  src={selectedNFT.imagePath} 
                  alt={selectedNFT.name} 
                  className="w-full h-full object-cover"
                />
                <Badge className={`absolute top-2 right-2 ${rarityColors[selectedNFT.rarity]}`}>
                  {selectedNFT.rarity}
                </Badge>
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
              </div>
            </div>
            
            <DialogFooter>
              <Button onClick={() => setSelectedNFT(null)}>
                Закрыть
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};