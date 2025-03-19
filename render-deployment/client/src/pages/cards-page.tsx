import { useQuery } from "@tanstack/react-query";
import { Card } from "@shared/schema";
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
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl text-destructive">Ошибка загрузки карт</h2>
          <p className="text-muted-foreground">Попробуйте обновить страницу</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TelegramBackground />
      <div className="flex flex-col h-[calc(100vh-48px)]">
        <h1 className="text-lg font-semibold px-4 pt-2">Мои карты</h1>
        <div className="flex-1 flex items-start justify-center -mt-24 pb-20">
          <div className="w-full max-w-[400px] space-y-4">
            {cards && cards.length > 0 ? (
              cards.map((card) => (
                <div key={card.id} className="px-8 h-[400px] flex items-center">
                  <VirtualCard card={card} />
                </div>
              ))
            ) : (
              <div className="text-center text-muted-foreground">
                У вас пока нет карт
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}