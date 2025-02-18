
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";

export default function RegulatorPage() {
  const [amount, setAmount] = useState("");
  
  const { data: users = [], refetch } = useQuery({
    queryKey: ["/api/users"],
    queryFn: () => apiRequest("/api/users")
  });

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
      <h1 className="text-2xl font-bold">Регулятор - Панель управления</h1>
      
      <div className="grid gap-4">
        {users.map(user => (
          <Card key={user.id}>
            <CardHeader>
              <CardTitle>
                Пользователь: {user.username}
                {user.isRegulator && " (Регулятор)"}
              </CardTitle>
              {user.isRegulator && (
                <div className="text-green-600">
                  Баланс регулятора: {user.regulatorBalance} USD
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {user.cards?.map(card => (
                  <div key={card.id} className="border p-4 rounded-lg">
                    <div>
                      <p className="font-bold">Карта: {card.number}</p>
                      <p>Тип: {card.type.toUpperCase()}</p>
                      <p className="text-xl">Баланс: {card.balance} {card.type.toUpperCase()}</p>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Input 
                        type="number"
                        placeholder="Сумма"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="max-w-[200px]"
                      />
                      <Button onClick={() => adjustBalance(user.id, card.id, 'add')}
                        variant="outline" className="bg-green-50">
                        Добавить
                      </Button>
                      <Button onClick={() => adjustBalance(user.id, card.id, 'subtract')}
                        variant="outline" className="bg-red-50">
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
