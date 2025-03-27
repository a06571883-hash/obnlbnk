import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Определение типов
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
  const { data: nfts, isLoading, error } = useQuery({
    queryKey: ['/api/nft/all'],
    queryFn: () => apiRequest<NFT[]>('/api/nft/all'),
  });

  // Расчет общей "силы" NFT на основе атрибутов
  const calculatePower = (nft: NFT) => {
    const { power, agility, wisdom, luck } = nft.attributes || {};
    return ((power || 0) + (agility || 0) + (wisdom || 0) + (luck || 0)) / 4;
  };

  // Сортировка NFT по редкости и мощности
  const sortedNFTs = React.useMemo(() => {
    if (!nfts) return [];
    
    const rarityWeight = {
      'legendary': 5,
      'epic': 4,
      'rare': 3,
      'uncommon': 2,
      'common': 1
    };
    
    return [...nfts].sort((a, b) => {
      // Сначала сортируем по редкости
      const rarityA = rarityWeight[a.rarity as keyof typeof rarityWeight] || 0;
      const rarityB = rarityWeight[b.rarity as keyof typeof rarityWeight] || 0;
      
      if (rarityB !== rarityA) {
        return rarityB - rarityA;
      }
      
      // Затем по общей мощности
      return calculatePower(b) - calculatePower(a);
    });
  }, [nfts]);

  // Получение цвета фона для NFT на основе редкости
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

  // Получение градиента для карточки на основе редкости
  const getCardGradient = (rarity: string) => {
    switch (rarity) {
      case 'common':
        return 'bg-gradient-to-br from-gray-100 to-gray-300';
      case 'uncommon':
        return 'bg-gradient-to-br from-green-100 to-green-300';
      case 'rare':
        return 'bg-gradient-to-br from-blue-100 to-blue-300';
      case 'epic':
        return 'bg-gradient-to-br from-purple-100 to-purple-300';
      case 'legendary':
        return 'bg-gradient-to-br from-amber-100 to-amber-300';
      default:
        return 'bg-gradient-to-br from-gray-100 to-gray-300';
    }
  };

  // Показываем загрузку
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px]">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-muted-foreground">Загрузка вашей коллекции NFT...</p>
      </div>
    );
  }

  // Показываем ошибку, если она есть
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Ошибка загрузки</AlertTitle>
        <AlertDescription>
          Не удалось загрузить вашу коллекцию NFT. Пожалуйста, попробуйте позже.
        </AlertDescription>
      </Alert>
    );
  }

  // Показываем сообщение, если нет NFT
  if (!nfts || nfts.length === 0) {
    return (
      <Alert>
        <AlertTitle>У вас пока нет NFT</AlertTitle>
        <AlertDescription>
          Создайте свой первый NFT во вкладке "Коллекции".
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Моя галерея NFT</h2>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {sortedNFTs.map((nft) => (
          <Card 
            key={nft.id} 
            className={`overflow-hidden hover:shadow-lg transition-shadow ${getCardGradient(nft.rarity)}`}
          >
            <div className="aspect-square flex items-center justify-center text-4xl font-bold relative overflow-hidden">
              {/* Заглушка для изображения NFT */}
              <div className="absolute inset-0 flex items-center justify-center bg-opacity-80">
                <div className="text-6xl font-extrabold text-white opacity-30">NFT</div>
              </div>
              <div className="absolute bottom-2 right-2">
                <Badge className={getRarityColor(nft.rarity)}>
                  {nft.rarity.charAt(0).toUpperCase() + nft.rarity.slice(1)}
                </Badge>
              </div>
            </div>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base">{nft.name}</CardTitle>
              <CardDescription className="line-clamp-2 text-xs">
                {nft.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold">Сила</p>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-red-500" 
                      style={{ width: `${nft.attributes?.power || 0}%` }}
                    ></div>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold">Ловкость</p>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500" 
                      style={{ width: `${nft.attributes?.agility || 0}%` }}
                    ></div>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold">Мудрость</p>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500" 
                      style={{ width: `${nft.attributes?.wisdom || 0}%` }}
                    ></div>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold">Удача</p>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-purple-500" 
                      style={{ width: `${nft.attributes?.luck || 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="p-4 pt-0 flex justify-between items-center text-xs text-muted-foreground">
              <span>ID: {nft.tokenId.substring(0, 8)}...</span>
              <span>{new Date(nft.mintedAt).toLocaleDateString()}</span>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default NFTGallery;