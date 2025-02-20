
import { useQuery } from "@tanstack/react-query";
import { Card } from "@shared/schema";
import VirtualCard from "@/components/virtual-card";
import { Loader2 } from "lucide-react";

export default function CardsPage() {
  const { data: cards, isLoading, error } = useQuery<Card[]>({
    queryKey: ["/api/cards"],
    refetchInterval: 5000,
    retry: false,
    staleTime: 0
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <h2 className="text-xl text-red-500">Ошибка загрузки карт</h2>
          <p className="text-muted-foreground">Попробуйте обновить страницу</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-8 text-foreground">Мои карты</h1>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {cards && cards.length > 0 ? (
            cards.map((card) => (
              <VirtualCard key={card.id} card={card} />
            ))
          ) : (
            <div className="col-span-full text-center text-muted-foreground">
              У вас пока нет карт
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
