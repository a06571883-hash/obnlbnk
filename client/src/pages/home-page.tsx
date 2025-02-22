import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Card } from "../../shared/schema";
import { Card as CardUI, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { queryClient, apiRequest } from "@/lib/queryClient";
import CardCarousel from "@/components/card-carousel";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export default function HomePage() {
  const { toast } = useToast();
  const { user, logoutMutation } = useAuth();
  const [showWelcome, setShowWelcome] = useState(true);

  const { data: cards, isLoading } = useQuery<Card[]>({
    queryKey: ["/api/cards"],
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    retry: 3,
    staleTime: 0,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowWelcome(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const generateCardsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cards/generate");
      return await res.json();
    },
    onSuccess: (newCards) => {
      queryClient.invalidateQueries({ queryKey: ['/api/cards'] });
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
      <header className="p-4 flex justify-between items-center border-b backdrop-blur-sm bg-background/50 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary-foreground">
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
        <div className={`mb-8 text-center transition-all duration-500 ease-in-out transform ${showWelcome ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full h-0 overflow-hidden'}`}>
          <h2 className="text-2xl font-medium mb-2">
            Welcome back, <span className="text-primary">{user?.username}</span>
          </h2>
          <p className="text-muted-foreground">
            Manage your multi-currency cards and transactions
          </p>
        </div>

        {cards && cards.length > 0 ? (
          <div className={`space-y-8 transition-all duration-500 ease-in-out transform ${!showWelcome ? '-translate-y-16' : ''}`}>
            <CardCarousel cards={cards} />

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-4 mt-8">
              <Dialog>
                <DialogTrigger asChild>
                  <CardUI className="p-4 hover:bg-accent transition-colors cursor-pointer backdrop-blur-sm bg-background/80">
                    <CardContent className="p-2 flex flex-col items-center">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                        <svg className="h-6 w-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path d="M12 6v6m0 0v6m0-6h6m-6 0H6" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <h3 className="font-medium">Quick Transfer</h3>
                    </CardContent>
                  </CardUI>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Quick Transfer</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 p-4">
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      const amount = formData.get("amount");
                      const cardNumber = formData.get("cardNumber");

                      if (!amount || !cardNumber || parseFloat(amount.toString()) <= 0) {
                        toast({
                          title: "Ошибка",
                          description: "Введите корректную сумму и номер карты",
                          variant: "destructive"
                        });
                        return;
                      }

                      try {
                        const response = await apiRequest("POST", "/api/transfer", {
                          fromCardId: cards[0].id,
                          toCardNumber: cardNumber,
                          amount: parseFloat(amount.toString())
                        });

                        toast({
                          title: "Успех",
                          description: "Перевод выполнен успешно"
                        });

                        // Очищаем форму
                        e.currentTarget.reset();

                        // Обновляем данные карт
                        queryClient.invalidateQueries({ queryKey: ['/api/cards'] });
                      } catch (error: any) {
                        console.error("Transfer error:", error);
                        toast({
                          title: "Ошибка перевода",
                          description: error.message || "Произошла ошибка при переводе",
                          variant: "destructive"
                        });
                      }
                    }}>
                      <input 
                        type="number" 
                        name="amount"
                        placeholder="Сумма" 
                        className="w-full p-2 border rounded mb-4" 
                        step="0.01"
                        min="0.01"
                        required 
                      />
                      <input 
                        type="text" 
                        name="cardNumber"
                        placeholder="Номер карты получателя" 
                        className="w-full p-2 border rounded mb-4"
                        pattern="\d{16}"
                        title="Номер карты должен состоять из 16 цифр"
                        required
                      />
                      <Button type="submit" className="w-full">
                        Перевести
                      </Button>
                    </form>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog>
                <DialogTrigger asChild>
                  <CardUI className="p-4 hover:bg-accent transition-colors cursor-pointer backdrop-blur-sm bg-background/80">
                    <CardContent className="p-2 flex flex-col items-center">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                        <svg className="h-6 w-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2m-4 0V3a1 1 0 00-1-1h-2a1 1 0 00-1 1v2H9z" strokeWidth="2"/>
                        </svg>
                      </div>
                      <h3 className="font-medium">Scan QR</h3>
                    </CardContent>
                  </CardUI>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Scan QR Code</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 p-4 text-center">
                    <div className="bg-muted p-8 rounded-lg">
                      <p>Camera access required</p>
                    </div>
                    <Button className="w-full">Enable Camera</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Recent Activity Preview */}
            <CardUI className="backdrop-blur-sm bg-background/80">
              <CardHeader>
                <CardTitle className="text-lg">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {cards?.slice(0, 3).map((card) => (
                    <div key={card.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-medium">{card.type.charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Last transaction</p>
                          <p className="text-xs text-muted-foreground">{card.number.slice(-4)}</p>
                        </div>
                      </div>
                      <span className="text-sm font-medium">{card.balance} {card.type}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </CardUI>
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