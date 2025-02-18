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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <header className="p-6 flex justify-between items-center border-b backdrop-blur-sm bg-background/50 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary-foreground">
            BNAL Bank
          </h1>
        </div>
        <Button 
          variant="ghost" 
          onClick={() => logoutMutation.mutate()}
          className="hover:bg-destructive/10 hover:text-destructive"
        >
          Logout
        </Button>
      </header>

      <main className="container mx-auto p-4 max-w-4xl">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-medium mb-2">
            Welcome back, <span className="text-primary">{user?.username}</span>
          </h2>
          <p className="text-muted-foreground">
            Manage your multi-currency cards and transactions
          </p>
        </div>

        {cards && cards.length > 0 ? (
          <div className="space-y-8">
            <CardCarousel cards={cards} />
          </div>
        ) : (
          <div className="text-center py-12 px-4">
            <div className="max-w-md mx-auto">
              <h3 className="text-xl font-semibold mb-4">No Cards Found</h3>
              <p className="text-muted-foreground mb-8">
                Get started by generating your multi-currency cards
              </p>
              <Button
                size="lg"
                onClick={() => generateCardsMutation.mutate()}
                disabled={generateCardsMutation.isPending}
                className="bg-primary hover:bg-primary/90"
              >
                {generateCardsMutation.isPending && (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                )}
                Generate Cards
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}