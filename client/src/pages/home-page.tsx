import { useEffect, useState } from "react";
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
import { Loader2, Bitcoin, DollarSign, Coins, RefreshCw, Clock } from "lucide-react";

interface ExchangeRateResponse {
  btcToUsd: string;
  ethToUsd: string;
  usdToUah: string;
  timestamp: number;
}

const handleExchange = async (formData: FormData, cards: Card[], toast: any) => {
  try {
    if (!cards || cards.length === 0) {
      throw new Error('Карты не загружены. Пожалуйста, обновите страницу.');
    }

    console.log('Available cards:', cards); 

    const cryptoCard = cards.find(card => card.type === 'crypto');
    console.log('Looking for crypto card. Found:', cryptoCard); 

    if (!cryptoCard) {
      throw new Error('Криптовалютная карта не найдена. Пожалуйста, сгенерируйте карты заново.');
    }

    if (!cryptoCard.btcBalance || !cryptoCard.ethBalance || !cryptoCard.btcAddress) {
      console.log('Invalid crypto card configuration:', cryptoCard); 
      throw new Error('Криптовалютный кошелек настроен неправильно. Обратитесь в поддержку.');
    }

    const amount = formData.get("amount");
    const fromCurrency = formData.get("fromCurrency");
    const cardNumber = formData.get("cardNumber");

    if (!amount || !fromCurrency || !cardNumber) {
      throw new Error('Заполните все поля формы');
    }

    const response = await apiRequest("POST", "/api/exchange/create", {
      fromCurrency: fromCurrency.toString(),
      toCurrency: "uah",
      fromAmount: amount.toString(),
      address: cardNumber.toString(),
      cryptoCard: {
        btcBalance: cryptoCard.btcBalance,
        ethBalance: cryptoCard.ethBalance,
        btcAddress: cryptoCard.btcAddress
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Ошибка обмена");
    }

    const result = await response.json();
    console.log('Exchange result:', result);

    toast({
      title: "Успех",
      description: "Обмен инициирован успешно"
    });

    return result;
  } catch (error: any) {
    console.error("Exchange error:", error);
    toast({
      title: "Ошибка обмена",
      description: error.message || "Произошла ошибка при обмене",
      variant: "destructive"
    });
    throw error;
  }
};

export default function HomePage() {
  const { toast } = useToast();
  const { user, logoutMutation } = useAuth();
  const [showWelcome, setShowWelcome] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [rates, setRates] = useState<ExchangeRateResponse | null>(null);
  const [prevRates, setPrevRates] = useState<ExchangeRateResponse | null>(null);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');

  useEffect(() => {
    const isNewRegistration = sessionStorage.getItem('isNewRegistration');
    if (isNewRegistration === 'true' && user) {
      setShowWelcome(true);
      const timer = setTimeout(() => {
        setShowWelcome(false);
        sessionStorage.removeItem('isNewRegistration');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [user]);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setWsStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const newRates = JSON.parse(event.data);
        setPrevRates(rates);
        setRates(newRates);
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setWsStatus('error');
    };

    const fetchRates = async () => {
      try {
        const response = await fetch('/api/rates');
        if (response.ok) {
          const data = await response.json();
          setRates(data);
        }
      } catch (error) {
        console.error('Fallback rates fetch error:', error);
      }
    };

    fetchRates();

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  const { data: cards = [], isLoading: isLoadingCards, error: cardsError } = useQuery<Card[]>({
    queryKey: ["/api/cards"],
    enabled: !!user, 
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

  const handleGenerateCards = async () => {
    try {
      setIsGenerating(true);
      const response = await apiRequest("POST", "/api/cards/generate");
      if (!response.ok) {
        throw new Error("Failed to generate cards");
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      toast({
        title: "Успех",
        description: "Ваши мультивалютные карты успешно созданы",
      });
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: "Не удалось сгенерировать карты",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const cryptoCard = cards.find(card => card.type === 'crypto');
  const hasCryptoWallet = cryptoCard && cryptoCard.btcBalance && cryptoCard.ethBalance && cryptoCard.btcAddress;

  const { data: transactions = [], isLoading: isLoadingTransactions } = useQuery({
    queryKey: ["/api/transactions"],
    enabled: !!user && cards.length > 0,
  });


  if (isLoadingCards) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (cardsError) {
    return (
      <div className="flex items-center justify-center min-h-screen flex-col gap-4">
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
        <div className={`transition-all duration-500 ease-in-out transform ${
          showWelcome ? 'opacity-100 translate-y-0 h-[100px] mb-8' : 'opacity-0 -translate-y-full h-0'
        }`}>
          <h2 className="text-2xl font-medium mb-2 text-center">
            С возвращением, <span className="text-primary">{user?.username}</span>
          </h2>
          <p className="text-muted-foreground text-center">
            Управляйте своими мультивалютными картами
          </p>
        </div>

        {cards && cards.length > 0 ? (
          <div className={`transition-all duration-500 ease-in-out transform ${!showWelcome ? '-translate-y-16' : ''} mt-16 pt-8 space-y-8`}>
            <CardCarousel cards={cards} />

            <div className="space-y-6">
              {hasCryptoWallet ? (
                <Dialog>
                  <DialogTrigger asChild>
                    <CardUI className="p-4 hover:bg-accent transition-colors cursor-pointer backdrop-blur-sm bg-background/80">
                      <div className="p-2 flex flex-col items-center">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                          <RefreshCw className="h-6 w-6 text-primary" />
                        </div>
                        <h3 className="font-medium">Обмен валюты</h3>
                      </div>
                    </CardUI>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Обмен валюты</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <form onSubmit={async (e) => {
                        e.preventDefault();
                        try {
                          await handleExchange(new FormData(e.currentTarget), cards, toast);
                          e.currentTarget.reset();
                          queryClient.invalidateQueries({ queryKey: ['/api/cards'] });
                        } catch (error) {
                        }
                      }}>
                        <select
                          name="fromCurrency"
                          className="w-full p-2 border rounded mb-4"
                          required
                        >
                          <option value="btc">BTC → UAH</option>
                          <option value="eth">ETH → UAH</option>
                        </select>
                        <input
                          type="number"
                          name="amount"
                          placeholder="Сумма"
                          className="w-full p-2 border rounded mb-4"
                          step="0.00000001"
                          min="0.00000001"
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
                          Обменять
                        </Button>
                      </form>
                    </div>
                  </DialogContent>
                </Dialog>
              ) : (
                <CardUI className="p-4 backdrop-blur-sm bg-background/80">
                  <div className="p-2 flex flex-col items-center">
                    <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
                      <RefreshCw className="h-6 w-6 text-destructive" />
                    </div>
                    <h3 className="font-medium text-destructive">Криптовалютный кошелек не настроен</h3>
                    <p className="text-sm text-muted-foreground mt-2 text-center">
                      Для обмена валют необходимо сгенерировать карты заново
                    </p>
                    <Button
                      onClick={handleGenerateCards}
                      className="mt-4"
                      disabled={isGenerating}
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
                </CardUI>
              )}

              <CardUI className="p-4 backdrop-blur-sm bg-background/80">
                <div className="space-y-4">
                  <h3 className="font-medium text-center">Текущие курсы валют</h3>

                  {rates === null ? (
                    <div className="flex justify-center p-4">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="space-y-4">
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

              <CardUI className="p-4 backdrop-blur-sm bg-background/80">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      История транзакций
                    </h3>
                  </div>

                  {isLoadingTransactions ? (
                    <div className="flex justify-center p-4">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : transactions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">
                      У вас пока нет транзакций
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {transactions.map((transaction) => (
                        <Dialog key={transaction.id}>
                          <DialogTrigger asChild>
                            <div className="p-3 rounded-lg bg-accent/50 hover:bg-accent cursor-pointer transition-colors">
                              <div className="flex justify-between items-center">
                                <div>
                                  <p className="font-medium">{transaction.type === 'transfer' ? 'Перевод' : 'Комиссия'}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {new Date(transaction.createdAt).toLocaleString()}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className={`font-medium ${transaction.type === 'commission' ? 'text-destructive' : ''}`}>
                                    {parseFloat(transaction.amount).toFixed(transaction.type === 'commission' ? 8 : 2)}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {transaction.fromCardNumber} → {transaction.toCardNumber}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Детали транзакции</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-sm text-muted-foreground">Тип</p>
                                  <p className="font-medium">
                                    {transaction.type === 'transfer' ? 'Перевод' : 'Комиссия'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Статус</p>
                                  <p className="font-medium">
                                    {transaction.status === 'completed' ? 'Выполнено' : 'В обработке'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Сумма</p>
                                  <p className="font-medium">
                                    {parseFloat(transaction.amount).toFixed(transaction.type === 'commission' ? 8 : 2)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Конвертированная сумма</p>
                                  <p className="font-medium">
                                    {parseFloat(transaction.convertedAmount).toFixed(8)}
                                  </p>
                                </div>
                                <div className="col-span-2">
                                  <p className="text-sm text-muted-foreground">Описание</p>
                                  <p className="font-medium">{transaction.description}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Отправитель</p>
                                  <p className="font-medium">{transaction.fromCardNumber}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Получатель</p>
                                  <p className="font-medium">
                                    {transaction.wallet || transaction.toCardNumber}
                                  </p>
                                </div>
                                <div className="col-span-2">
                                  <p className="text-sm text-muted-foreground">Дата</p>
                                  <p className="font-medium">
                                    {new Date(transaction.createdAt).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      ))}
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
                className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
                disabled={isGenerating}
                onClick={handleGenerateCards}
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