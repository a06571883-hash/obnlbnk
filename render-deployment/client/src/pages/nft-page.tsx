import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import type { NFT, NFTCollection } from "@shared/schema";
import { useState } from "react";

export default function NFTPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: nfts, isLoading: isLoadingNFTs } = useQuery<NFT[]>({
    queryKey: ["/api/nfts"],
    refetchInterval: 5000,
  });

  const { data: collections } = useQuery<NFTCollection[]>({
    queryKey: ["/api/nft-collections"],
  });

  const handleGenerateNFT = async () => {
    try {
      setIsGenerating(true);
      const response = await fetch("/api/nfts/generate", {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Ошибка генерации NFT");
      }

      const data = await response.json();
      toast({
        title: "NFT сгенерирован",
        description: "Ваш NFT успешно создан",
      });
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось сгенерировать NFT",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoadingNFTs) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Мои NFT</h1>
        <Button 
          onClick={handleGenerateNFT} 
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Генерация...
            </>
          ) : (
            'Сгенерировать NFT'
          )}
        </Button>
      </div>

      {collections?.length === 0 && nfts?.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            У вас пока нет NFT. Создайте свой первый NFT!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {nfts?.map((nft) => (
            <Card key={nft.id} className="p-4">
              <img 
                src={nft.imageUrl} 
                alt={nft.name} 
                className="w-full h-48 object-cover rounded-lg mb-4"
              />
              <h3 className="font-semibold mb-2">{nft.name}</h3>
              <p className="text-sm text-muted-foreground">{nft.description}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
