
import { useQuery } from "@tanstack/react-query";
import CardCarousel from "@/components/card-carousel";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function CardsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  
  const { data: cards, isLoading } = useQuery<any[]>({
    queryKey: ["/api/cards"],
  });

  const { data: users = [], refetch } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiRequest("/api/users"),
    enabled: user?.is_regulator
  });

  const adjustBalance = async (userId: number, cardId: number, operation: 'add' | 'subtract') => {
    try {
      await apiRequest("/api/regulator/adjust-balance", {
        method: "POST",
        body: { userId, cardId, amount, operation }
      });
      await refetch();
      toast({
        title: "Успех",
        description: "Баланс успешно изменен"
      });
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось изменить баланс",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user?.is_regulator) {
    return (
      <div className="container p-4 space-y-4 pb-20">
        <Card className="bg-primary">
          <CardHeader>
            <CardTitle className="text-primary-foreground">Панель регулятора</CardTitle>
            <div className="text-xl font-bold text-primary-foreground">
              Баланс регулятора: ${user.regulatorBalance || '80000000'}
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
                          placeholder="Сумма"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="max-w-[200px]"
                        />
                        <Button 
                          onClick={() => adjustBalance(user.id, card.id, 'add')}
                          variant="default"
                          className="bg-green-500 hover:bg-green-600 text-white"
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

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-primary text-primary-foreground p-4">
        <h1 className="text-xl font-bold mb-1">My Cards</h1>
        <p className="text-sm text-primary-foreground/80">Manage your cards and transactions</p>
      </div>

      <div className="p-4 -mt-4">
        {cards && cards.length > 0 ? (
          <CardCarousel cards={cards} />
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No cards found</p>
          </div>
        )}
      </div>
    </div>
  );
}
