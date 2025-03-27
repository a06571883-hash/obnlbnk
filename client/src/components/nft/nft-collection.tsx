import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

// Определение типов NFT и коллекций
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

type NFTCollection = {
  id: number;
  userId: number;
  name: string;
  description: string | null;
  coverImage: string | null;
  createdAt: string;
};

export const NFTCollectionView: React.FC = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [openCollectionId, setOpenCollectionId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Получение возможности генерации NFT
  const { data: canGenerateData, isLoading: isCheckingGeneration } = useQuery({
    queryKey: ['/api/nft/can-generate'],
    queryFn: () => apiRequest<{ canGenerate: boolean }>('/api/nft/can-generate'),
  });

  // Получение коллекций NFT пользователя
  const { data: collections, isLoading: isLoadingCollections } = useQuery({
    queryKey: ['/api/nft/collections'],
    queryFn: () => apiRequest<NFTCollection[]>('/api/nft/collections'),
  });

  // Получение всех NFT пользователя
  const { data: nfts, isLoading: isLoadingNFTs } = useQuery({
    queryKey: ['/api/nft/all'],
    queryFn: () => apiRequest<NFT[]>('/api/nft/all'),
  });

  // Мутация для генерации нового NFT
  const generateNFTMutation = useMutation({
    mutationFn: () => apiRequest<{ success: boolean; nft: NFT }>('/api/nft/generate', {
      method: 'POST',
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/nft/all'] });
      queryClient.invalidateQueries({ queryKey: ['/api/nft/collections'] });
      queryClient.invalidateQueries({ queryKey: ['/api/nft/can-generate'] });
      
      toast({
        title: 'NFT создан!',
        description: `Вы успешно создали NFT: ${data.nft.name}`,
        variant: 'success',
      });
      setIsGenerating(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка создания NFT',
        description: error.message || 'Не удалось создать NFT. Попробуйте позже.',
        variant: 'destructive',
      });
      setIsGenerating(false);
    },
  });

  // Обработчик генерации NFT
  const handleGenerateNFT = () => {
    setIsGenerating(true);
    generateNFTMutation.mutate();
  };

  // Получение NFT из определенной коллекции
  const getNFTsForCollection = (collectionId: number) => {
    return nfts?.filter((nft) => nft.collectionId === collectionId) || [];
  };

  // Получение цвета для редкости NFT
  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common':
        return 'bg-gray-200 text-gray-800';
      case 'uncommon':
        return 'bg-green-200 text-green-800';
      case 'rare':
        return 'bg-blue-200 text-blue-800';
      case 'epic':
        return 'bg-purple-200 text-purple-800';
      case 'legendary':
        return 'bg-amber-200 text-amber-800';
      default:
        return 'bg-gray-200 text-gray-800';
    }
  };

  // Отображение списка NFT коллекций
  if (isLoadingCollections || isLoadingNFTs || isCheckingGeneration) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px]">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-muted-foreground">Загрузка ваших NFT...</p>
      </div>
    );
  }

  // Если у пользователя нет коллекций, показываем соответствующее сообщение
  if (!collections || collections.length === 0) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertTitle>У вас пока нет NFT коллекций</AlertTitle>
          <AlertDescription>
            Создайте свой первый NFT, нажав на кнопку ниже. Коллекция будет создана автоматически.
          </AlertDescription>
        </Alert>
        
        <div className="flex justify-center mt-4">
          <Button 
            size="lg" 
            onClick={handleGenerateNFT}
            disabled={isGenerating || !canGenerateData?.canGenerate}
          >
            {isGenerating ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Создание NFT...
              </>
            ) : (
              'Создать мой первый NFT'
            )}
          </Button>
        </div>
        
        {!canGenerateData?.canGenerate && (
          <Alert variant="warning" className="mt-4">
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
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Мои NFT коллекции</h2>
        <Button
          onClick={handleGenerateNFT}
          disabled={isGenerating || !canGenerateData?.canGenerate}
        >
          {isGenerating ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              Создание NFT...
            </>
          ) : (
            'Создать новый NFT'
          )}
        </Button>
      </div>
      
      {!canGenerateData?.canGenerate && (
        <Alert variant="warning">
          <AlertTitle>Лимит достигнут</AlertTitle>
          <AlertDescription>
            Вы можете создавать новые NFT раз в 24 часа. Пожалуйста, попробуйте позже.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6">
        {collections.map((collection) => {
          const collectionNFTs = getNFTsForCollection(collection.id);
          const isOpen = openCollectionId === collection.id;
          
          return (
            <Collapsible
              key={collection.id}
              open={isOpen}
              onOpenChange={() => setOpenCollectionId(isOpen ? null : collection.id)}
              className="border rounded-lg shadow-sm"
            >
              <div className="p-4 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">{collection.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {collectionNFTs.length} NFT{collectionNFTs.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    {isOpen ? 'Скрыть' : 'Показать NFT'}
                  </Button>
                </CollapsibleTrigger>
              </div>
              
              <CollapsibleContent>
                <div className="p-4 pt-0 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {collectionNFTs.length === 0 ? (
                    <p className="text-muted-foreground col-span-full text-center py-4">
                      В этой коллекции пока нет NFT
                    </p>
                  ) : (
                    collectionNFTs.map((nft) => (
                      <Card key={nft.id} className="overflow-hidden">
                        <div className="aspect-square bg-secondary flex items-center justify-center text-4xl font-bold text-secondary-foreground">
                          {/* Заглушка для изображения NFT */}
                          NFT
                        </div>
                        <CardHeader className="p-4 pb-2">
                          <div className="flex justify-between items-start">
                            <CardTitle className="text-base">{nft.name}</CardTitle>
                            <Badge className={getRarityColor(nft.rarity)}>
                              {nft.rarity.charAt(0).toUpperCase() + nft.rarity.slice(1)}
                            </Badge>
                          </div>
                          <CardDescription className="line-clamp-2 text-xs">
                            {nft.description}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <p className="font-semibold">Сила</p>
                              <p>{nft.attributes?.power || 0}</p>
                            </div>
                            <div>
                              <p className="font-semibold">Ловкость</p>
                              <p>{nft.attributes?.agility || 0}</p>
                            </div>
                            <div>
                              <p className="font-semibold">Мудрость</p>
                              <p>{nft.attributes?.wisdom || 0}</p>
                            </div>
                            <div>
                              <p className="font-semibold">Удача</p>
                              <p>{nft.attributes?.luck || 0}</p>
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter className="p-4 pt-0 text-xs text-muted-foreground">
                          Создан: {new Date(nft.mintedAt).toLocaleDateString()}
                        </CardFooter>
                      </Card>
                    ))
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
};

export default NFTCollectionView;