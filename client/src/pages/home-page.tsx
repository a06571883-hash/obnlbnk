import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import CardCarousel from "@/components/card-carousel";
import { Loader2 } from "lucide-react";

export default function HomePage() {
  const { user, logoutMutation } = useAuth();
  
  const { data: cards, isLoading } = useQuery<Card[]>({
    queryKey: ["/api/cards"],
  });

  const generateCardsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cards/generate");
      return await res.json();
    },
    onSuccess: (newCards) => {
      queryClient.setQueryData(["/api/cards"], newCards);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="p-4 flex justify-between items-center border-b">
        <h1 className="text-2xl font-bold">OOOBNAL Bank</h1>
        <Button variant="ghost" onClick={() => logoutMutation.mutate()}>
          Logout
        </Button>
      </header>

      <main className="p-4 max-w-md mx-auto">
        <h2 className="text-lg font-medium mb-4">Welcome, {user?.username}</h2>
        
        {cards && cards.length > 0 ? (
          <CardCarousel cards={cards} />
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">No cards found</p>
            <Button
              onClick={() => generateCardsMutation.mutate()}
              disabled={generateCardsMutation.isPending}
            >
              {generateCardsMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Generate Cards
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
