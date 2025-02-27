import { useQuery } from "@tanstack/react-query";
import { Card } from "../../shared/schema";
import VirtualCard from "@/components/virtual-card";
import { Loader2 } from "lucide-react";
import TelegramBackground from "@/components/telegram-background";

export default function CardsPage() {
  const { data: cards, isLoading, error } = useQuery<Card[]>({
    queryKey: ["/api/cards"],
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    retry: 3,
    staleTime: 0,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
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
    <div className="min-h-screen bg-background/50 relative">
      <TelegramBackground />
      <div className="px-2 py-4 sm:container sm:mx-auto sm:px-4 sm:py-8">
        <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-8 text-foreground px-2">Мои карты</h1>
        <div className="space-y-4 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-6 sm:space-y-0">
          {cards && cards.length > 0 ? (
            cards.map((card) => (
              <div key={card.id} className="px-2 sm:px-0">
                <VirtualCard card={card} />
              </div>
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