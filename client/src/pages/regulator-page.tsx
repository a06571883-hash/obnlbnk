import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

export default function RegulatorPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch exchange rates
  const { data: rates = {} } = useQuery<Record<string, string>>({
    queryKey: ["/api/rates"],
    refetchInterval: 30000,
  });

  // Fetch all users
  const { data: users = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/users"],
    enabled: user?.is_regulator,
    refetchInterval: 5000
  });

  if (!user?.is_regulator) {
    return (
      <div className="container p-4">
        <h1 className="text-2xl text-red-500">Доступ запрещен</h1>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const adjustBalance = async (
    userId: number, 
    cardId: number, 
    operation: 'add' | 'subtract',
    cardType: string
  ) => {
    try {
      setIsProcessing(true);
      const response = await apiRequest("/api/regulator/adjust-balance", {
        method: "POST",
        body: JSON.stringify({
          userId,
          cardId,
          amount,
          operation
        })
      });

      if (!response.ok) {
        throw new Error("Failed to adjust balance");
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/users"] });

      toast({
        title: "Успешно",
        description: operation === 'add' ? "Баланс пополнен" : "Средства списаны",
      });

      setAmount("");
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось изменить баланс",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="container p-4 space-y-6">
      {/* Exchange Rates Panel */}
      <Card className="bg-primary text-primary-foreground">
        <CardHeader>
          <CardTitle>Панель регулятора</CardTitle>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <div className="p-3 rounded-lg bg-primary-foreground/10">
              <div className="text-sm opacity-90">BTC/USD</div>
              <div className="text-xl font-bold">${(rates as any).btcToUsd || 'N/A'}</div>
            </div>
            <div className="p-3 rounded-lg bg-primary-foreground/10">
              <div className="text-sm opacity-90">ETH/USD</div>
              <div className="text-xl font-bold">${(rates as any).ethToUsd || 'N/A'}</div>
            </div>
            <div className="p-3 rounded-lg bg-primary-foreground/10">
              <div className="text-sm opacity-90">USD/UAH</div>
              <div className="text-xl font-bold">₴{(rates as any).usdToUah || 'N/A'}</div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Users List */}
      <div className="grid gap-4">
        {users.map((user: any) => (
          <Card key={user.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div>
                  Пользователь: {user.username}
                  {user.is_regulator && " (Регулятор)"}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {user.cards?.map((card: any) => (
                  <div key={card.id} className="border p-4 rounded-lg">
                    <div className="mb-4">
                      <p className="font-medium">Карта: {card.number}</p>
                      <p>Тип: {card.type.toUpperCase()}</p>
                      {card.type === 'crypto' ? (
                        <>
                          <p className="text-lg font-bold">
                            BTC: {card.btcBalance}
                          </p>
                          <p className="text-lg font-bold">
                            ETH: {card.ethBalance}
                          </p>
                        </>
                      ) : (
                        <p className="text-lg font-bold">
                          Баланс: {card.balance} {card.type.toUpperCase()}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button className="flex-1">Пополнить</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Пополнение баланса</DialogTitle>
                            <DialogDescription>
                              Введите сумму для пополнения
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 mt-4">
                            <div className="space-y-2">
                              <Label>Сумма</Label>
                              <Input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder={`Сумма в ${card.type.toUpperCase()}`}
                              />
                            </div>
                            <Button 
                              className="w-full"
                              disabled={isProcessing || !amount}
                              onClick={() => adjustBalance(user.id, card.id, 'add', card.type)}
                            >
                              {isProcessing ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Обработка...
                                </>
                              ) : (
                                'Пополнить'
                              )}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="destructive" className="flex-1">
                            Снять
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Снятие средств</DialogTitle>
                            <DialogDescription>
                              Введите сумму для снятия. Средства будут переведены на ваш счет регулятора.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 mt-4">
                            <div className="space-y-2">
                              <Label>Сумма</Label>
                              <Input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder={`Сумма в ${card.type.toUpperCase()}`}
                              />
                            </div>
                            <Button 
                              variant="destructive"
                              className="w-full"
                              disabled={isProcessing || !amount}
                              onClick={() => adjustBalance(user.id, card.id, 'subtract', card.type)}
                            >
                              {isProcessing ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Обработка...
                                </>
                              ) : (
                                'Снять'
                              )}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}