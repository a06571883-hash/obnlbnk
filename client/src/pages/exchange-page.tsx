import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { useState, useEffect } from "react";
import TelegramBackground from "@/components/telegram-background";
import { motion, AnimatePresence } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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
  const [fromCurrency, setFromCurrency] = useState("btc");
  const [toCurrency, setToCurrency] = useState("usdt");
  const [amount, setAmount] = useState("");
  const [rateHistory, setRateHistory] = useState<RateHistory[]>([]);

  const { data: rates, isLoading } = useQuery<Rates>({
    queryKey: ["/api/rates"],
    refetchInterval: 30000
  });

  // Симулируем историю курсов для демонстрации графика
  useEffect(() => {
    if (rates) {
      const now = Date.now();
      const newHistory = Array.from({ length: 24 }, (_, i) => ({
        timestamp: now - (23 - i) * 3600000,
        rate: rates[fromCurrency === 'btc' ? 'btcToUsd' : 'ethToUsd'] * (1 + (Math.random() - 0.5) * 0.1)
      }));
      setRateHistory(newHistory);
    }
  }, [rates, fromCurrency]);

  if (isLoading) {
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

    const rate = rates[`${fromCurrency}ToUsd`];
    return formatRate(value * rate);
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
              <Card className="p-4 relative overflow-hidden">
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

              <Card className="p-4 relative overflow-hidden">
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

              <Card className="p-4 relative overflow-hidden">
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
                  <LineChart data={rateHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp"
                      tickFormatter={(timestamp) => new Date(timestamp).toLocaleTimeString()}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(timestamp) => new Date(timestamp).toLocaleString()}
                      formatter={(value: number) => [`$${formatRate(value)}`, 'Rate']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="rate" 
                      stroke="#8884d8" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Форма обмена */}
            <Card className="p-4">
              <div className="space-y-4">
                <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-center">
                  <Select value={fromCurrency} onValueChange={setFromCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="btc">Bitcoin (BTC)</SelectItem>
                        <SelectItem value="eth">Ethereum (ETH)</SelectItem>
                        <SelectItem value="usdt">USDT</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>

                  <ArrowRight className="w-4 h-4" />

                  <Select value={toCurrency} onValueChange={setToCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="usdt">USDT</SelectItem>
                        <SelectItem value="btc">Bitcoin (BTC)</SelectItem>
                        <SelectItem value="eth">Ethereum (ETH)</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
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
                    Курс обмена: 1 {fromCurrency.toUpperCase()} = {rates?.[`${fromCurrency}ToUsd`]} USD
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Вы получите: {calculateExchangeAmount()} {toCurrency.toUpperCase()}
                  </p>
                </div>

                <Button className="w-full" size="lg">
                  Обменять
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}