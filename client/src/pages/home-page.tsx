import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Card, Transaction } from "../../shared/schema";
import { Card as CardUI, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { queryClient, apiRequest } from "@/lib/queryClient";
import CardCarousel from "@/components/card-carousel";
import { Loader2, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import TransactionReceipt from "@/components/transaction-receipt";

export default function HomePage() {
  const { toast } = useToast();
  const { user, logoutMutation } = useAuth();
  const [showWelcome, setShowWelcome] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const { data: cards, isLoading: isLoadingCards } = useQuery<Card[]>({
    queryKey: ["/api/cards"],
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    retry: 3,
    staleTime: 0,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const { data: transactions, isLoading: isLoadingTransactions } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
    enabled: !!cards?.length,
    refetchInterval: 5000,
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

  if (isLoadingCards) {
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

      <main className="container mx-auto p-4 pt-8 max-w-4xl">
        <div 
          className={`
            transition-all duration-500 ease-in-out transform
            ${showWelcome 
              ? 'opacity-100 translate-y-0 h-[100px] mb-8' 
              : 'opacity-0 -translate-y-full h-0 overflow-hidden mb-0'
            }
          `}
        >
          <h2 className="text-2xl font-medium mb-2 text-center">
            Welcome back, <span className="text-primary">{user?.username}</span>
          </h2>
          <p className="text-muted-foreground text-center">
            Manage your multi-currency cards and transactions
          </p>
        </div>

        {cards && cards.length > 0 ? (
          <div className={`
            space-y-8 transition-all duration-500 ease-in-out transform
            ${!showWelcome ? '-translate-y-16' : ''}
            mt-16 pt-8
          `}>
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

                        const data = await response.json();

                        toast({
                          title: "Успех",
                          description: "Перевод выполнен успешно"
                        });

                        // Очищаем форму
                        e.currentTarget.reset();

                        // Обновляем данные карт и транзакций
                        queryClient.invalidateQueries({ queryKey: ['/api/cards'] });
                        queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
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

            {/* Recent Activity */}
            <CardUI className="backdrop-blur-sm bg-background/80">
              <CardHeader>
                <CardTitle className="text-lg">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {isLoadingTransactions ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : transactions && transactions.length > 0 ? (
                    transactions.slice(0, 5).map((transaction) => (
                      <div
                        key={transaction.id}
                        onClick={() => setSelectedTransaction(transaction)}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            {transaction.type === 'transfer' && (
                              <ArrowUpRight className="h-4 w-4 text-primary" />
                            )}
                            {transaction.type === 'deposit' && (
                              <ArrowDownLeft className="h-4 w-4 text-emerald-500" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {transaction.type === 'transfer' ? 'Перевод' : 'Пополнение'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(transaction.createdAt), 'dd.MM.yyyy HH:mm')}
                            </p>
                          </div>
                        </div>
                        <span className="text-sm font-medium">
                          {transaction.amount} {cards.find(c => c.id === transaction.fromCardId)?.type.toUpperCase()}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      No transactions yet
                    </div>
                  )}
                </div>
              </CardContent>
            </CardUI>

            {/* Transaction Receipt Dialog */}
            {selectedTransaction && (
              <TransactionReceipt
                transaction={{
                  ...selectedTransaction,
                  currency: cards.find(c => c.id === selectedTransaction.fromCardId)?.type || 'Unknown',
                  from: cards.find(c => c.id === selectedTransaction.fromCardId)?.number || 'Unknown',
                  to: cards.find(c => c.id === selectedTransaction.toCardId)?.number || 'Unknown',
                  date: selectedTransaction.createdAt,
                }}
                open={!!selectedTransaction}
                onOpenChange={(open) => !open && setSelectedTransaction(null)}
              />
            )}
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