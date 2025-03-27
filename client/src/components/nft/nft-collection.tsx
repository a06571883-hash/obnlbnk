import React, { useState } from 'react';
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

// Helper function for sound playback simulation
const playSoundIfEnabled = (sound: string) => {
  console.log(`Playing sound: ${sound}`);
};

type NFTRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

type NFT = {
  id: number;
  name: string;
  description: string;
  imagePath: string;
  rarity: NFTRarity;
  attributes: {
    power: number;
    agility: number;
    wisdom: number;
    luck: number;
  };
};

type NFTCollection = {
  id: number;
  name: string;
  description: string;
  nfts: NFT[];
};

export const NFTCollectionView: React.FC = () => {
  const [selectedCollection, setSelectedCollection] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedRarity, setSelectedRarity] = useState<NFTRarity>('common');
  const { toast } = useToast();

  const { 
    data: collections = [], 
    isLoading: isLoadingCollections,
    isError: isErrorCollections,
    error: errorCollections
  } = useQuery<any[]>({
    queryKey: ['/api/nft/collections'],
    retry: 1
  });

  const { 
    data: nftStatus = {}, 
    isLoading: isLoadingStatus,
    refetch: refetchStatus
  } = useQuery<Record<string, any>>({
    queryKey: ['/api/nft/status'],
    retry: 1
  });

  const { 
    data: dailyLimit = { canGenerate: false }, 
    isLoading: isLoadingLimit,
    refetch: refetchLimit
  } = useQuery<{ canGenerate: boolean }>({
    queryKey: ['/api/nft/daily-limit'],
    retry: 1
  });

  const generateNFT = useMutation({
    mutationFn: async (rarity: NFTRarity) => {
      return fetch('/api/nft/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rarity }),
      }).then(res => res.json());
    },
    onMutate: () => {
      setIsGenerating(true);
      toast({
        title: 'Создаем NFT...',
        description: 'Пожалуйста, подождите...',
      });
    },
    onSuccess: (data) => {
      setIsGenerating(false);
      if (data.nft) {
        toast({
          title: 'NFT создан',
          description: `${data.nft.name} добавлен в вашу коллекцию`
        });
        playSoundIfEnabled('success');
        
        // Refresh queries
        queryClient.invalidateQueries({ queryKey: ['/api/nft/collections'] });
        queryClient.invalidateQueries({ queryKey: ['/api/nft/status'] });
        queryClient.invalidateQueries({ queryKey: ['/api/nft/daily-limit'] });
        queryClient.invalidateQueries({ queryKey: ['/api/nft/gallery'] });
        
        // Close dialog
        setOpenDialog(false);
      }
    },
    onError: (error) => {
      setIsGenerating(false);
      toast({
        title: 'Ошибка',
        description: 'Не удалось создать NFT. Пожалуйста, попробуйте позже.',
        variant: 'destructive'
      });
      playSoundIfEnabled('error');
    }
  });

  const getCollectionById = (id: number) => {
    if (!collections) return null;
    return collections.filter((nft: any) => nft.id === id)[0];
  };

  const rarityColors = {
    common: 'bg-slate-500',
    uncommon: 'bg-green-500',
    rare: 'bg-blue-500',
    epic: 'bg-purple-500',
    legendary: 'bg-yellow-500',
  };

  const rarityLabels = {
    common: 'Обычный',
    uncommon: 'Необычный',
    rare: 'Редкий',
    epic: 'Эпический',
    legendary: 'Легендарный',
  };

  if (isLoadingCollections || isLoadingStatus || isLoadingLimit) {
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

  if (collections && collections.length === 0) {
    return (
      <div className="space-y-6">
        <div className="border rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold">У вас пока нет NFT коллекций</h3>
          <p className="text-muted-foreground">
            Создайте свой первый NFT, нажав на кнопку ниже. Коллекция будет создана автоматически.
          </p>
          
          {!dailyLimit?.canGenerate ? (
            <Alert className="mt-4">
              <AlertTitle>Лимит достигнут</AlertTitle>
              <AlertDescription>
                Вы можете создавать новые NFT раз в 24 часа. Пожалуйста, попробуйте позже.
              </AlertDescription>
            </Alert>
          ) : (
            <Button 
              onClick={() => setOpenDialog(true)}
              disabled={!dailyLimit?.canGenerate}
              className="w-full"
            >
              Создать мой первый NFT
            </Button>
          )}
        </div>
        
        {!dailyLimit?.canGenerate && (
          <Alert>
            <AlertTitle>Лимит достигнут</AlertTitle>
            <AlertDescription>
              Вы можете создавать новые NFT раз в 24 часа. Пожалуйста, попробуйте позже.
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!dailyLimit?.canGenerate && (
        <Alert>
          <AlertTitle>Лимит достигнут</AlertTitle>
          <AlertDescription>
            Вы можете создавать новые NFT раз в 24 часа. Пожалуйста, попробуйте позже.
          </AlertDescription>
        </Alert>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {collections && collections.map((collection: any) => (
          <Card key={collection.id} className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle>{collection.name}</CardTitle>
              <CardDescription>{collection.description}</CardDescription>
            </CardHeader>
            <CardContent className="pb-2">
              <div className="grid grid-cols-2 gap-2">
                {collection.nfts.slice(0, 4).map((nft: any) => (
                  <div 
                    key={nft.id} 
                    className="relative rounded-md overflow-hidden aspect-square border"
                    onClick={() => {
                      setSelectedCollection(collection.id);
                      playSoundIfEnabled('click');
                    }}
                  >
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
                    <Badge className={`absolute top-1 right-1 ${rarityColors[nft.rarity as NFTRarity]}`}>
                      {rarityLabels[nft.rarity as NFTRarity]}
                    </Badge>
                  </div>
                ))}
                {Array(Math.max(0, 4 - collection.nfts.length)).fill(0).map((_, i) => (
                  <div key={i} className="rounded-md border border-dashed aspect-square flex items-center justify-center bg-muted">
                    <span className="text-xs text-muted-foreground">Empty</span>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setSelectedCollection(collection.id);
                  playSoundIfEnabled('click');
                }}
              >
                Просмотр коллекции
              </Button>
              <Button 
                size="sm"
                onClick={() => setOpenDialog(true)}
                disabled={!dailyLimit?.canGenerate}
              >
                Создать NFT
              </Button>
            </CardFooter>
          </Card>
        ))}
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
                onValueChange={(value) => setSelectedRarity(value as NFTRarity)}
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
              onClick={() => setOpenDialog(false)}
              disabled={isGenerating}
            >
              Отмена
            </Button>
            <Button
              onClick={() => generateNFT.mutate(selectedRarity)}
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
        <Dialog open={!!selectedCollection} onOpenChange={(open) => !open && setSelectedCollection(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{getCollectionById(selectedCollection)?.name}</DialogTitle>
              <DialogDescription>
                {getCollectionById(selectedCollection)?.description}
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="h-[400px] px-1">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-2">
                {getCollectionById(selectedCollection)?.nfts.map((nft: NFT) => (
                  <Card key={nft.id} className="overflow-hidden">
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
                        {rarityLabels[nft.rarity]}
                      </Badge>
                    </div>
                    <CardHeader className="py-2">
                      <CardTitle className="text-base">{nft.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="py-0 space-y-1">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>Сила: {nft.attributes.power}</div>
                        <div>Ловкость: {nft.attributes.agility}</div>
                        <div>Мудрость: {nft.attributes.wisdom}</div>
                        <div>Удача: {nft.attributes.luck}</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
            
            <DialogFooter>
              <Button onClick={() => setSelectedCollection(null)}>
                Закрыть
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};