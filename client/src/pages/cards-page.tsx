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
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
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
      <div className="p-4">
        <h1 className="text-lg font-semibold mb-4">Мои карты</h1>
        <div className="w-full max-w-[280px] mx-auto space-y-2">
          {cards && cards.length > 0 ? (
            cards.map((card) => (
              <div key={card.id}>
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
  );
}