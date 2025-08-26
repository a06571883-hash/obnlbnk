import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth.js";
import { Button } from "@/components/ui/button.js";
import { useToast } from "@/hooks/use-toast.js";
import { useQuery } from "@tanstack/react-query";
import type { Card } from "@shared/schema.js";
import { Card as CardUI } from "@/components/ui/card.js";
import TelegramBackground from "@/components/telegram-background.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.js";
import { queryClient, apiRequest } from "@/lib/queryClient.js";
import CardCarousel from "@/components/card-carousel.js";
import { Loader2, Bitcoin, DollarSign, Coins, Truck, BarChart3, MessageSquare, RefreshCw, Shield, Database, Upload } from "lucide-react";

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

    const cryptoCard = cards?.find(card => card.type === 'crypto');
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
    // Определение, запущено ли приложение в Telegram WebApp
    const isTelegramWebApp = window.Telegram && window.Telegram.WebApp;
    
    // Определяем, нужно ли использовать WebSocket или REST API
    // Если приложение запущено в Telegram по HTTPS, но WebSocket должен быть wss://
    const useWebSocket = !(isTelegramWebApp && window.location.protocol === 'https:' && window.location.host.includes('replit'));
    
    let ws: WebSocket | null = null;
    let rateUpdateInterval: ReturnType<typeof setInterval> | null = null;
    
    const fetchRatesFromAPI = async () => {
      try {
        const response = await fetch('/api/rates');
        if (response.ok) {
          const data = await response.json();
          setPrevRates(rates);
          setRates(data);
          return true;
        }
        return false;
      } catch (error) {
        console.error('API rates fetch error:', error);
        return false;
      }
    };
    
    // Всегда делаем начальную загрузку курсов через REST API
    fetchRatesFromAPI();
    
    if (useWebSocket) {
      try {
        // Определяем протокол в зависимости от текущего протокола страницы
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
        
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
          
          // При ошибке WebSocket переключаемся на REST API для обновления курсов
          if (!rateUpdateInterval) {
            rateUpdateInterval = setInterval(fetchRatesFromAPI, 30000); // 30 секунд
          }
        };
        
        ws.onclose = () => {
          console.log('WebSocket connection closed');
          setWsStatus('error');
          
          // При закрытии WebSocket переключаемся на REST API для обновления курсов
          if (!rateUpdateInterval) {
            rateUpdateInterval = setInterval(fetchRatesFromAPI, 30000); // 30 секунд
          }
        };
      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        setWsStatus('error');
        
        // При ошибке создания WebSocket переключаемся на REST API для обновления курсов
        if (!rateUpdateInterval) {
          rateUpdateInterval = setInterval(fetchRatesFromAPI, 30000); // 30 секунд
        }
      }
    } else {
      // Если WebSocket не используется (например, в Telegram WebApp), 
      // устанавливаем интервал для обновления курсов через REST API
      console.log('Using REST API for rates updates instead of WebSocket');
      rateUpdateInterval = setInterval(fetchRatesFromAPI, 30000); // 30 секунд
    }
    
    // Очистка ресурсов при размонтировании компонента
    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      
      if (rateUpdateInterval) {
        clearInterval(rateUpdateInterval);
      }
    };
  }, [rates]);

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

  const cryptoCard = cards?.find(card => card.type === 'crypto');
  const hasCryptoWallet = cryptoCard && cryptoCard.btcBalance && cryptoCard.ethBalance && cryptoCard.btcAddress;
  
  // Проверяем, является ли пользователь регулятором
  const isRegulator = user?.is_regulator === true;
  
  // Функции регулятора
  const handleCreateBackup = async () => {
    try {
      const response = await apiRequest("GET", "/api/backup");
      if (!response.ok) {
        throw new Error("Failed to create backup");
      }
      const data = await response.json();
      toast({
        title: "Успех",
        description: "Резервная копия успешно создана",
      });
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: "Не удалось создать резервную копию",
        variant: "destructive",
      });
    }
  };
  
  const handleRestoreBackup = async () => {
    try {
      const response = await apiRequest("POST", "/api/restore");
      if (!response.ok) {
        throw new Error("Failed to restore backup");
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      toast({
        title: "Успех", 
        description: "Данные успешно восстановлены из резервной копии",
      });
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: "Не удалось восстановить данные",
        variant: "destructive",
      });
    }
  };

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
      <TelegramBackground />
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
                          <Truck className="h-6 w-6 text-primary" />
                        </div>
                        <h3 className="font-medium">Доставка налички</h3>
                      </div>
                    </CardUI>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Доставка наличных</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <p className="text-sm">
                        Для заказа наличных, пишите менеджеру:
                        <br />- Ваш город
                        <br />- Сумма в долларах\евро\гривнах
                        <br />Ожидайте ответа о возможном времени доставки.
                      </p>
                      <p className="text-sm font-medium">
                        ПРИМЕЧАНИЕ: Доставка по Киеву происходит от 2 до 5 часов.
                        <br />Минимальная сумма доставки от 10 000$
                        <br />Комиссия при любой доставке 1%
                      </p>
                      <Button 
                        className="w-full"
                        onClick={() => window.open('https://t.me/OOO_BNAL_BANK', '_blank')}
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Написать менеджеру
                      </Button>
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

              {/* Панель регулятора */}
              {isRegulator && (
                <CardUI className="p-4 backdrop-blur-sm bg-background/80 border-2 border-primary/20">
                  <div className="space-y-4">
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <Shield className="h-6 w-6 text-primary" />
                      <h3 className="font-bold text-lg text-primary">Панель регулятора</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Button
                        onClick={handleCreateBackup}
                        variant="outline"
                        className="flex items-center gap-2 p-4 h-auto"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <Database className="h-6 w-6 text-blue-500" />
                          <div className="text-center">
                            <div className="font-medium">Создать резервную копию</div>
                            <div className="text-sm text-muted-foreground">Сохранить данные</div>
                          </div>
                        </div>
                      </Button>
                      
                      <Button
                        onClick={handleRestoreBackup}
                        variant="outline"
                        className="flex items-center gap-2 p-4 h-auto"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <Upload className="h-6 w-6 text-green-500" />
                          <div className="text-center">
                            <div className="font-medium">Восстановить данные</div>
                            <div className="text-sm text-muted-foreground">Из резервной копии</div>
                          </div>
                        </div>
                      </Button>
                    </div>
                    
                    <div className="text-center text-sm text-muted-foreground">
                      <Shield className="h-4 w-4 inline mr-1" />
                      Административные функции доступны только регулятору
                    </div>
                  </div>
                </CardUI>
              )}

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


// Added components for the stats page.  Replace with your actual implementation.
function StatsPage() {
  return (
    <div>
      <h1>Account Statistics</h1>
      {/* Add your statistics display here */}
      <p>This is a placeholder for account statistics.  Implement your desired UI here.</p>
    </div>
  );
}

export {StatsPage};
