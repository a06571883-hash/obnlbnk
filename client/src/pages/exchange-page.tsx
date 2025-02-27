import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";
import TelegramBackground from "@/components/telegram-background";

export default function ExchangePage() {
  const [fromCurrency, setFromCurrency] = useState("btc");
  const [toCurrency, setToCurrency] = useState("usdt");
  const [amount, setAmount] = useState("");

  const { data: rates, isLoading } = useQuery({
    queryKey: ["/api/rates"],
    refetchInterval: 30000
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TelegramBackground />
      <div className="flex flex-col h-[calc(100vh-48px)]">
        <h1 className="text-lg font-semibold px-4 pt-2">Обмен валют</h1>
        <div className="flex-1 flex items-start justify-center -mt-24 pb-20">
          <Card className="w-full max-w-[400px] p-4 mx-4">
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
                  Курс обмена: 1 {fromCurrency.toUpperCase()} = {rates?.[`${fromCurrency}To${toCurrency}`]} {toCurrency.toUpperCase()}
                </p>
                <p className="text-sm text-muted-foreground">
                  Вы получите: {amount ? (parseFloat(amount) * rates?.[`${fromCurrency}To${toCurrency}`]).toFixed(8) : '0.00'} {toCurrency.toUpperCase()}
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
  );
}
