import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
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

// Create a key for sessionStorage to track welcome message state
const WELCOME_MESSAGE_KEY = 'welcomeMessageShown';

export default function HomePage() {
  const { toast } = useToast();
  const { user, logoutMutation } = useAuth();
  const [showWelcome, setShowWelcome] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  // Show welcome message only on fresh login and track it in sessionStorage
  useEffect(() => {
    if (!user) return;

    const hasShownWelcome = sessionStorage.getItem(WELCOME_MESSAGE_KEY);
    if (!hasShownWelcome) {
      setShowWelcome(true);
      sessionStorage.setItem(WELCOME_MESSAGE_KEY, 'true');

      // Hide after 4 seconds
      const timer = setTimeout(() => {
        setShowWelcome(false);
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [user]);

  // Clear welcome flag on logout
  useEffect(() => {
    const cleanup = () => {
      sessionStorage.removeItem(WELCOME_MESSAGE_KEY);
    };

    // Add cleanup to logout mutation
    if (logoutMutation.isSuccess) {
      cleanup();
    }

    return cleanup;
  }, [logoutMutation.isSuccess]);

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

  if (isLoadingCards) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="p-4 flex justify-between items-center border-b backdrop-blur-sm bg-background/50 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary-foreground">
            OOO BNAL BANK
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
            <div className="grid grid-cols-1 gap-4 mt-8">
              <Dialog>
                <DialogTrigger asChild>
                  <CardUI className="p-4 hover:bg-accent transition-colors cursor-pointer backdrop-blur-sm bg-background/80">
                    <CardContent className="p-2 flex flex-col items-center">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                        <svg className="h-6 w-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path d="M12 6v6m0 0v6m0-6h6m-6 0H6" strokeWidth="2" strokeLinecap="round" />
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
                  <div className="space-y-4">
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

                        e.currentTarget.reset();

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
                    transactions.slice(0, 5).map((transaction) => {
                      let transactionType = 'Перевод';
                      let iconColor = 'text-primary';

                      if (transaction.type === 'transfer') {
                        const fromCard = cards.find(c => c.id === transaction.fromCardId);
                        const toCard = cards.find(c => c.id === transaction.toCardId);

                        if (fromCard && toCard && fromCard.userId === toCard.userId) {
                          transactionType = 'Обмен';
                          iconColor = 'text-amber-500';
                        } else if (fromCard?.userId === user?.id) {
                          transactionType = 'Перевод';
                          iconColor = 'text-primary';
                        } else {
                          transactionType = 'Получение';
                          iconColor = 'text-emerald-500';
                        }
                      } else if (transaction.type === 'deposit') {
                        transactionType = 'Пополнение';
                        iconColor = 'text-emerald-500';
                      }

                      return (
                        <div
                          key={transaction.id}
                          onClick={() => setSelectedTransaction(transaction)}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              {transaction.type === 'transfer' && (
                                <ArrowUpRight className={`h-4 w-4 ${iconColor}`} />
                              )}
                              {transaction.type === 'deposit' && (
                                <ArrowDownLeft className="h-4 w-4 text-emerald-500" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {transactionType}
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
                      );
                    })
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
                className="bg-primary hover:bg-primary/90"
              >
                Generate Cards
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}