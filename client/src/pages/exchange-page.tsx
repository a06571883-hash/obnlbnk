import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { useState, useEffect } from "react";
import TelegramBackground from "@/components/telegram-background";
import { motion, AnimatePresence } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { useToast } from "@/hooks/use-toast";
import { Card as CardType } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface RateHistory {
  timestamp: number;
  rate: number;
}

interface Rates {
  usdToUah: number;
  btcToUsd: number;
  ethToUsd: number;
  history?: {
    btc: RateHistory[];
    eth: RateHistory[];
  };
}

export default function ExchangePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [fromCurrency, setFromCurrency] = useState("btc");
  const [toCurrency, setToCurrency] = useState("usdt");
  const [amount, setAmount] = useState("");
  const [rateHistory, setRateHistory] = useState<RateHistory[]>([]);
  const [selectedFromCard, setSelectedFromCard] = useState<string>("");
  const [selectedToCard, setSelectedToCard] = useState<string>("");

  const { data: rates, isLoading: ratesLoading } = useQuery<Rates>({
    queryKey: ["/api/rates"],
    refetchInterval: 30000
  });

  const { data: cards, isLoading: cardsLoading } = useQuery<CardType[]>({
    queryKey: ["/api/cards"]
  });

  // Генерируем историю курсов с более плавными изменениями
  useEffect(() => {
    if (rates) {
      const now = Date.now();
      const baseRate = fromCurrency === 'btc' ? rates.btcToUsd : rates.ethToUsd;
      const newHistory = Array.from({ length: 24 }, (_, i) => {
        const hourOffset = 23 - i;
        const volatility = Math.sin(hourOffset / 4) * 0.05; // Создаем более плавные колебания
        return {
          timestamp: now - hourOffset * 3600000,
          rate: baseRate * (1 + volatility + (Math.random() - 0.5) * 0.02) // Добавляем небольшой случайный шум
        };
      });
      setRateHistory(newHistory);
    }
  }, [rates, fromCurrency]);

  const exchangeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFromCard || !selectedToCard || !amount) {
        throw new Error("Пожалуйста, заполните все поля");
      }

      const exchangeRequest = {
        fromCardId: selectedFromCard,
        toCardId: selectedToCard,
        amount: parseFloat(amount),
        fromCurrency,
        toCurrency
      };

      const response = await apiRequest("POST", "/api/exchange", exchangeRequest);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Ошибка при обмене");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      toast({
        title: "Успешно!",
        description: "Обмен выполнен успешно",
      });
      setAmount("");
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  if (ratesLoading || cardsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const formatRate = (rate: number) => rate.toLocaleString('en-US', { 
    minimumFractionDigits: 2,
    maximumFractionDigits: 2 
  });

  const calculateExchangeAmount = () => {
    if (!rates || !amount) return '0.00';
    const value = parseFloat(amount);
    if (isNaN(value)) return '0.00';

    if (fromCurrency === 'btc') {
      return formatRate(value * rates.btcToUsd);
    } else if (fromCurrency === 'eth') {
      return formatRate(value * rates.ethToUsd);
    }
    return formatRate(value);
  };

  return (
    <div className="min-h-screen bg-background">
      <TelegramBackground />
      <div className="flex flex-col h-[calc(100vh-48px)]">
        <h1 className="text-lg font-semibold px-4 pt-2">Обмен валют</h1>
        <div className="flex-1 flex flex-col items-start justify-start -mt-8 pb-20 px-4">
          <div className="w-full max-w-[800px] mx-auto space-y-4">
            {/* Карточки с курсами */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4 relative overflow-hidden bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2"
                >
                  <div className="text-sm text-muted-foreground">BTC/USD</div>
                  <div className="text-2xl font-bold">${formatRate(rates?.btcToUsd || 0)}</div>
                  <div className="flex items-center text-emerald-500">
                    <TrendingUp className="h-4 w-4 mr-1" />
                    <span className="text-sm">+2.5%</span>
                  </div>
                </motion.div>
              </Card>

              <Card className="p-4 relative overflow-hidden bg-gradient-to-br from-blue-500/10 to-cyan-500/10">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="space-y-2"
                >
                  <div className="text-sm text-muted-foreground">ETH/USD</div>
                  <div className="text-2xl font-bold">${formatRate(rates?.ethToUsd || 0)}</div>
                  <div className="flex items-center text-red-500">
                    <TrendingDown className="h-4 w-4 mr-1" />
                    <span className="text-sm">-1.2%</span>
                  </div>
                </motion.div>
              </Card>

              <Card className="p-4 relative overflow-hidden bg-gradient-to-br from-emerald-500/10 to-teal-500/10">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-2"
                >
                  <div className="text-sm text-muted-foreground">USD/UAH</div>
                  <div className="text-2xl font-bold">₴{formatRate(rates?.usdToUah || 0)}</div>
                  <div className="flex items-center text-emerald-500">
                    <TrendingUp className="h-4 w-4 mr-1" />
                    <span className="text-sm">+0.3%</span>
                  </div>
                </motion.div>
              </Card>
            </div>

            {/* График курсов */}
            <Card className="p-4">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={rateHistory}>
                    <defs>
                      <linearGradient id="rateColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#666" opacity={0.1} />
                    <XAxis 
                      dataKey="timestamp"
                      tickFormatter={(timestamp) => new Date(timestamp).toLocaleTimeString()}
                      stroke="#666"
                    />
                    <YAxis stroke="#666" />
                    <Tooltip 
                      labelFormatter={(timestamp) => new Date(timestamp).toLocaleString()}
                      formatter={(value: number) => [`$${formatRate(value)}`, 'Rate']}
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="rate" 
                      stroke="#8884d8"
                      fillOpacity={1}
                      fill="url(#rateColor)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Форма обмена */}
            <Card className="p-4">
              <div className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Карта списания</label>
                    <Select value={selectedFromCard} onValueChange={setSelectedFromCard}>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите карту" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {cards?.map(card => (
                            <SelectItem key={card.id} value={card.id.toString()}>
                              {card.type === 'crypto' 
                                ? `Crypto Card (BTC: ${card.btcBalance}, ETH: ${card.ethBalance})`
                                : `${card.type.toUpperCase()} Card (${card.balance})`}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-center">
                    <ArrowRight className="w-6 h-6 text-muted-foreground" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Карта зачисления</label>
                    <Select value={selectedToCard} onValueChange={setSelectedToCard}>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите карту" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {cards?.map(card => (
                            <SelectItem key={card.id} value={card.id.toString()}>
                              {card.type === 'crypto' 
                                ? `Crypto Card (BTC: ${card.btcBalance}, ETH: ${card.ethBalance})`
                                : `${card.type.toUpperCase()} Card (${card.balance})`}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Сумма</label>
                  <Input 
                    type="number" 
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>

                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">
                    Курс обмена: 1 {fromCurrency.toUpperCase()} = ${formatRate(fromCurrency === 'btc' ? rates?.btcToUsd || 0 : rates?.ethToUsd || 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Вы получите: ${calculateExchangeAmount()} {toCurrency.toUpperCase()}
                  </p>
                </div>

                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={() => exchangeMutation.mutate()}
                  disabled={exchangeMutation.isPending || !selectedFromCard || !selectedToCard || !amount}
                >
                  {exchangeMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Обмен выполняется...
                    </>
                  ) : (
                    "Обменять"
                  )}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}