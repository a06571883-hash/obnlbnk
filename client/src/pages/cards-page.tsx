
import { useQuery } from "@tanstack/react-query";
import { Card } from "@shared/schema";
import VirtualCard from "@/components/virtual-card";
import { Loader2 } from "lucide-react";

export default function CardsPage() {
  const { data: cards, isLoading } = useQuery<Card[]>({
    queryKey: ["/api/cards"],
    refetchInterval: 5000
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-8 text-black dark:text-white">Мои карты</h1>
        <div className="grid gap-6">
          {cards?.map((card) => (
            <VirtualCard key={card.id} card={card} />
          ))}
        </div>
      </div>
    </div>
  );
}
