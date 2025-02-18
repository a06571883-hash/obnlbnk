
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

export default function RegulatorPage() {
  const { user } = useAuth();
  const [amount, setAmount] = useState("");
  
  const { data: users = [], refetch } = useQuery({
    queryKey: ["/api/users"],
    queryFn: () => apiRequest("/api/users")
  });

  if (!user?.isRegulator) {
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
        body: { userId, cardId, amount, operation }
      });
      refetch();
    } catch (error) {
      console.error('Error adjusting balance:', error);
    }
  };

  return (
    <div className="container p-4 space-y-4">
      <Card className="bg-primary text-primary-foreground">
        <CardHeader>
          <CardTitle>Панель регулятора</CardTitle>
          <div className="text-2xl font-bold">
            Баланс регулятора: ${user.regulatorBalance}
          </div>
        </CardHeader>
      </Card>
      
      <div className="grid gap-4">
        {users.map(user => (
          <Card key={user.id} className="border-2">
            <CardHeader>
              <CardTitle className="flex justify-between">
                <span>
                  Пользователь: {user.username}
                  {user.isRegulator && " (Регулятор)"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {user.cards?.map(card => (
                  <div key={card.id} className="border p-4 rounded-lg bg-muted">
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
                        placeholder="Сумма"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="max-w-[200px]"
                      />
                      <Button 
                        onClick={() => adjustBalance(user.id, card.id, 'add')}
                        variant="default"
                        className="bg-green-500 hover:bg-green-600"
                      >
                        Добавить
                      </Button>
                      <Button 
                        onClick={() => adjustBalance(user.id, card.id, 'subtract')}
                        variant="destructive"
                      >
                        Вычесть
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
