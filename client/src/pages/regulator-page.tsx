
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import { useState } from "react";

export default function RegulatorPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  
  const { data: users = [], refetch } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiRequest("/api/users"),
    refetchInterval: 5000
  });

  if (!user?.is_regulator) {
    return (
      <div className="container p-4">
        <h1 className="text-2xl text-red-500">Доступ запрещен</h1>
      </div>
    );
  }

  const adjustBalance = async (userId: number, cardId: number, operation: 'add' | 'subtract') => {
    try {
      await apiRequest("/api/regulator/adjust-balance", {
        method: "POST",
        body: JSON.stringify({ userId, cardId, amount, operation })
      });
      await refetch();
      toast({
        title: "Успех",
        description: "Баланс успешно изменен"
      });
      setAmount("");
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось изменить баланс"
      });
    }
  };

  return (
    <div className="container p-4 space-y-4">
      <Card className="bg-primary">
        <CardHeader>
          <CardTitle className="text-primary-foreground">Панель регулятора</CardTitle>
          <div className="text-xl font-bold text-primary-foreground">
            Баланс регулятора: ${user.regulator_balance}
          </div>
        </CardHeader>
      </Card>
      
      <div className="grid gap-4">
        {users.map((user) => (
          <Card key={user.id}>
            <CardHeader>
              <CardTitle>
                Пользователь: {user.username}
                {user.is_regulator && " (Регулятор)"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {user.cards?.map((card) => (
                  <div key={card.id} className="border p-4 rounded-lg">
                    <div className="mb-4">
                      <p className="font-bold">Карта: {card.number}</p>
                      <p>Тип: {card.type.toUpperCase()}</p>
                      <p className="text-xl font-bold">
                        Баланс: {card.balance} {card.type.toUpperCase()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Input 
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Сумма"
                        className="w-32"
                      />
                      <Button onClick={() => adjustBalance(user.id, card.id, 'add')}>
                        Добавить
                      </Button>
                      <Button 
                        variant="destructive"
                        onClick={() => adjustBalance(user.id, card.id, 'subtract')}
                      >
                        Снять
                      </Button>
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
