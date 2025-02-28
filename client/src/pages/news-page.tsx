import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Loader2, Bitcoin, Coins } from "lucide-react";
import { useState, useEffect } from "react";
import TelegramBackground from "@/components/telegram-background";
import { motion, AnimatePresence } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useToast } from "@/hooks/use-toast";

interface RateHistory {
  timestamp: number;
  rate: number;
}

interface Rates {
  usdToUah: number;
  btcToUsd: number;
  ethToUsd: number;
}

interface NewsItem {
  id: number;
  title: string;
  content: string;
  date: string;
  category: 'crypto' | 'fiat';
  source: string;
}

export default function NewsPage() {
  const { toast } = useToast();
  const [selectedCurrency, setSelectedCurrency] = useState<'btc' | 'eth' | 'uah'>('btc');
  const [rateHistory, setRateHistory] = useState<RateHistory[]>([]);

  // Получаем новости с сервера
  const { data: news = [], isLoading: isLoadingNews } = useQuery<NewsItem[]>({
    queryKey: ["/api/news"],
    refetchInterval: 300000, // Обновляем каждые 5 минут
  });

  const { data: rates, isLoading: ratesLoading } = useQuery<Rates>({
    queryKey: ["/api/rates"],
    refetchInterval: 30000
  });

  // Генерируем историю курсов с более плавными изменениями
  useEffect(() => {
    if (rates) {
      const now = Date.now();
      const baseRate = selectedCurrency === 'btc' ? rates.btcToUsd : 
                    selectedCurrency === 'eth' ? rates.ethToUsd :
                    rates.usdToUah;
      const newHistory = Array.from({ length: 24 }, (_, i) => {
        const hourOffset = 23 - i;
        const volatility = Math.sin(hourOffset / 4) * 0.05;
        return {
          timestamp: now - hourOffset * 3600000,
          rate: baseRate * (1 + volatility + (Math.random() - 0.5) * 0.02)
        };
      });
      setRateHistory(newHistory);
    }
  }, [rates, selectedCurrency]);

  if (ratesLoading || isLoadingNews) {
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

  return (
    <div className="min-h-screen bg-background">
      <TelegramBackground />
      <div className="flex flex-col h-[calc(100vh-48px)]">
        <h1 className="text-lg font-semibold px-4 pt-2">Новости и котировки</h1>
        <div className="flex-1 flex flex-col items-start justify-start -mt-8 pb-20 px-4">
          <div className="w-full max-w-[800px] mx-auto space-y-4">
            {/* Карточки с курсами */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card 
                className={`p-4 relative overflow-hidden bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 cursor-pointer transition-all ${selectedCurrency === 'btc' ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setSelectedCurrency('btc')}
              >
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

              <Card 
                className={`p-4 relative overflow-hidden bg-gradient-to-br from-blue-500/10 to-cyan-500/10 cursor-pointer transition-all ${selectedCurrency === 'eth' ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setSelectedCurrency('eth')}
              >
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

              <Card 
                className={`p-4 relative overflow-hidden bg-gradient-to-br from-emerald-500/10 to-teal-500/10 cursor-pointer transition-all ${selectedCurrency === 'uah' ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setSelectedCurrency('uah')}
              >
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
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedCurrency}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
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
                          formatter={(value: number) => [
                            `${selectedCurrency === 'uah' ? '₴' : '$'}${formatRate(value)}`,
                            selectedCurrency.toUpperCase()
                          ]}
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
              </motion.div>
            </AnimatePresence>

            {/* Новостная лента */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Последние новости</h2>
              {news.length === 0 ? (
                <Card className="p-4">
                  <p className="text-center text-muted-foreground">
                    Загрузка новостей...
                  </p>
                </Card>
              ) : (
                news.map((newsItem) => (
                  <Card key={newsItem.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <h3 className="text-base font-medium">{newsItem.title}</h3>
                      <span className="text-xs text-muted-foreground">{newsItem.date}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{newsItem.content}</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-primary">{newsItem.source}</span>
                      <span className={`px-2 py-1 rounded-full ${
                        newsItem.category === 'crypto' 
                          ? 'bg-violet-500/10 text-violet-500'
                          : 'bg-emerald-500/10 text-emerald-500'
                      }`}>
                        {newsItem.category === 'crypto' ? 'Крипто' : 'Фиат'}
                      </span>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}