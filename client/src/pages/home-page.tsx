import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import type { Card } from "@shared/schema";
import { Card as CardUI } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { queryClient, apiRequest } from "@/lib/queryClient";
import CardCarousel from "@/components/card-carousel";
import { Loader2, Bitcoin, DollarSign, Coins } from "lucide-react";
import { useEffect, useState } from "react";

// Ключ для отслеживания состояния приветственного сообщения
const WELCOME_MESSAGE_KEY = 'welcomeMessageShown';

interface ExchangeRateResponse {
  btcToUsd: string;
  ethToUsd: string;
  usdToUah: string;
  timestamp: number;
}

export default function HomePage() {
  const { toast } = useToast();
  const { user, logoutMutation } = useAuth();
  const [showWelcome, setShowWelcome] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [rates, setRates] = useState<ExchangeRateResponse | null>(null);
  const [prevRates, setPrevRates] = useState<ExchangeRateResponse | null>(null);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');

  // Инициализация WebSocket подключения
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onopen = () => {
      console.log('WebSocket подключение установлено');
      setWsStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const newRates = JSON.parse(event.data);
        setPrevRates(rates);
        setRates(newRates);
      } catch (error) {
        console.error('Ошибка обработки данных WebSocket:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket ошибка:', error);
      setWsStatus('error');
      toast({
        title: "Ошибка соединения",
        description: "Проблема с получением обновлений курсов валют",
        variant: "destructive"
      });
    };

    ws.onclose = () => {
      console.log('WebSocket соединение закрыто');
      setWsStatus('error');
    };

    // Получаем начальные курсы через HTTP
    if (!rates) {
      fetch('/api/rates')
        .then(res => res.json())
        .then(initialRates => {
          setRates(initialRates);
        })
        .catch(error => {
          console.error('Ошибка получения начальных курсов:', error);
        });
    }

    return () => {
      ws.close();
    };
  }, []);

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

  const { data: cards = [], isLoading: isLoadingCards, error: cardsError } = useQuery<Card[]>({
    queryKey: ["/api/cards"],
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    retry: 3,
    staleTime: 0,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const getPriceChangeColor = (current: string | undefined, previous: string | undefined) => {
    if (!current || !previous) return '';
    const currentValue = parseFloat(current);
    const previousValue = parseFloat(previous);
    if (isNaN(currentValue) || isNaN(previousValue)) return '';
    if (currentValue > previousValue) return 'text-emerald-500';
    if (currentValue < previousValue) return 'text-red-500';
    return '';
  };

  if (isLoadingCards) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (cardsError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background flex-col gap-4">
        <p className="text-destructive">Ошибка загрузки данных</p>
        <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/cards"] })}>
          Попробовать снова
        </Button>
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
          Выход
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
            С возвращением, <span className="text-primary">{user?.username}</span>
          </h2>
          <p className="text-muted-foreground text-center">
            Управляйте своими мультивалютными картами
          </p>
        </div>

        {cards && cards.length > 0 ? (
          <div className={`
            transition-all duration-500 ease-in-out transform
            ${!showWelcome ? '-translate-y-16' : ''}
            mt-16 pt-8 space-y-8
          `}>
            <CardCarousel cards={cards} />

            {/* Quick Actions */}
            <div className="space-y-6">
              <Dialog>
                <DialogTrigger asChild>
                  <CardUI className="p-4 hover:bg-accent transition-colors cursor-pointer backdrop-blur-sm bg-background/80">
                    <div className="p-2 flex flex-col items-center">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                        <svg className="h-6 w-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path d="M12 6v6m0 0v6m0-6h6m-6 0H6" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </div>
                      <h3 className="font-medium">Быстрый перевод</h3>
                    </div>
                  </CardUI>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Быстрый перевод</DialogTitle>
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

                        if (!response.ok) {
                          const error = await response.json();
                          throw new Error(error.message || "Ошибка перевода");
                        }

                        toast({
                          title: "Успех",
                          description: "Перевод выполнен успешно"
                        });

                        e.currentTarget.reset();
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

              {/* Exchange Rates */}
              <CardUI className="p-4 backdrop-blur-sm bg-background/80">
                <div className="space-y-4">
                  <h3 className="font-medium text-center">Текущие курсы валют</h3>

                  {rates === null ? (
                    <div className="flex justify-center p-4">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Main Rates */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-accent/50">
                          <div className="flex items-center gap-2">
                            <Bitcoin className="h-5 w-5 text-amber-500" />
                            <span>BTC/USD</span>
                          </div>
                          <span className={`font-medium transition-colors duration-300 ${getPriceChangeColor(rates.btcToUsd, prevRates?.btcToUsd)}`}>
                            ${parseFloat(rates.btcToUsd).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-accent/50">
                          <div className="flex items-center gap-2">
                            <Coins className="h-5 w-5 text-blue-500" />
                            <span>ETH/USD</span>
                          </div>
                          <span className={`font-medium transition-colors duration-300 ${getPriceChangeColor(rates.ethToUsd, prevRates?.ethToUsd)}`}>
                            ${parseFloat(rates.ethToUsd).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-accent/50">
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-5 w-5 text-green-500" />
                            <span>USD/UAH</span>
                          </div>
                          <span className={`font-medium transition-colors duration-300 ${getPriceChangeColor(rates.usdToUah, prevRates?.usdToUah)}`}>
                            ₴{parseFloat(rates.usdToUah).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Calculated Cross Rates */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                        <div className="p-2 rounded bg-accent/30">
                          <div className="text-muted-foreground">BTC/UAH</div>
                          <div className={`font-medium transition-colors duration-300 ${getPriceChangeColor(
                            (parseFloat(rates.btcToUsd) * parseFloat(rates.usdToUah)).toString(),
                            prevRates ? (parseFloat(prevRates.btcToUsd) * parseFloat(prevRates.usdToUah)).toString() : undefined
                          )}`}>
                            ₴{(parseFloat(rates.btcToUsd) * parseFloat(rates.usdToUah)).toLocaleString()}
                          </div>
                        </div>
                        <div className="p-2 rounded bg-accent/30">
                          <div className="text-muted-foreground">ETH/UAH</div>
                          <div className={`font-medium transition-colors duration-300 ${getPriceChangeColor(
                            (parseFloat(rates.ethToUsd) * parseFloat(rates.usdToUah)).toString(),
                            prevRates ? (parseFloat(prevRates.ethToUsd) * parseFloat(prevRates.usdToUah)).toString() : undefined
                          )}`}>
                            ₴{(parseFloat(rates.ethToUsd) * parseFloat(rates.usdToUah)).toLocaleString()}
                          </div>
                        </div>
                        <div className="p-2 rounded bg-accent/30">
                          <div className="text-muted-foreground">ETH/BTC</div>
                          <div className={`font-medium transition-colors duration-300 ${getPriceChangeColor(
                            (parseFloat(rates.ethToUsd) / parseFloat(rates.btcToUsd)).toString(),
                            prevRates ? (parseFloat(prevRates.ethToUsd) / parseFloat(prevRates.btcToUsd)).toString() : undefined
                          )}`}>
                            {(parseFloat(rates.ethToUsd) / parseFloat(rates.btcToUsd)).toFixed(6)}
                          </div>
                        </div>
                        <div className="p-2 rounded bg-accent/30">
                          <div className="text-muted-foreground">UAH/USD</div>
                          <div className={`font-medium transition-colors duration-300 ${getPriceChangeColor(
                            (1 / parseFloat(rates.usdToUah)).toString(),
                            prevRates ? (1 / parseFloat(prevRates.usdToUah)).toString() : undefined
                          )}`}>
                            ${(1 / parseFloat(rates.usdToUah)).toFixed(4)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardUI>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 px-4">
            <div className="max-w-md mx-auto">
              <h3 className="text-xl font-semibold mb-4">Карты не найдены</h3>
              <p className="text-muted-foreground mb-8">
                Начните с генерации ваших мультивалютных карт
              </p>
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 w-full sm:w-auto relative"
                disabled={isGenerating}
                onClick={async () => {
                  try {
                    setIsGenerating(true);
                    const response = await apiRequest("POST", "/api/cards/generate");

                    if (!response.ok) {
                      const errorData = await response.json().catch(() => ({}));
                      throw new Error(errorData.message || "Failed to generate cards");
                    }

                    // Invalidate cards query to trigger refresh
                    await queryClient.invalidateQueries({ queryKey: ["/api/cards"] });

                    toast({
                      title: "Карты сгенерированы",
                      description: "Ваши мультивалютные карты успешно созданы",
                    });
                  } catch (error: any) {
                    console.error("Error generating cards:", error);
                    toast({
                      title: "Ошибка",
                      description: error.message || "Не удалось сгенерировать карты. Попробуйте снова.",
                      variant: "destructive",
                    });
                  } finally {
                    setIsGenerating(false);
                  }
                }}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Генерация...
                  </>
                ) : (
                  'Сгенерировать карты'
                )}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}