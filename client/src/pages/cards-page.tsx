
import { useQuery } from "@tanstack/react-query";
import { Card } from "@shared/schema";
import VirtualCard from "@/components/virtual-card";
import { Loader2 } from "lucide-react";
import AnimatedBackground from "@/components/animated-background";

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
    <div className="min-h-screen bg-background relative">
      <AnimatedBackground />
      <div className="container mx-auto px-4 py-8 relative z-10">
        <h1 className="text-2xl font-bold mb-8">Мои карты</h1>
        <div className="grid gap-4 max-w-md mx-auto">
          {cards?.map((card) => (
            <VirtualCard key={card.id} card={card} />
          ))}
        </div>
      </div>
    </div>
  );
}
