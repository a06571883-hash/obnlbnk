import { useQuery } from "@tanstack/react-query";
import { Card as CardType } from "@shared/schema";
import CardCarousel from "@/components/card-carousel";
import { Loader2 } from "lucide-react";

export default function CardsPage() {
  const { data: cards, isLoading } = useQuery<CardType[]>({
    queryKey: ["/api/cards"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-primary text-primary-foreground p-4">
        <h1 className="text-xl font-bold mb-1">My Cards</h1>
        <p className="text-sm text-primary-foreground/80">Manage your cards and transactions</p>
      </div>

      <div className="p-4 -mt-4">
        {cards && cards.length > 0 ? (
          <CardCarousel cards={cards} />
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No cards found</p>
          </div>
        )}
      </div>
    </div>
  );
}