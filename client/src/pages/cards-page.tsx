import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { VirtualCard } from "@/components/virtual-card";

export default function CardsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const isAdmin = user?.username === 'admin';

  const adjustBalance = async (userId: number, cardId: number, operation: 'add' | 'subtract') => {
    try {
      await apiRequest.post('/api/regulator/adjust-balance', {
        userId,
        cardId,
        amount,
        operation
      });

      toast({
        title: "Успешно",
        description: "Баланс обновлен"
      });

      setAmount("");
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить баланс",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="container pb-32 pt-8">
      <h1 className="text-2xl font-bold mb-8">
        {isAdmin ? "Управление картами (Регулятор)" : "Мои карты"}
      </h1>

      <div className="grid gap-4">
        <VirtualCard
          type="crypto"
          adjustBalance={isAdmin ? adjustBalance : undefined}
          amount={amount}
          setAmount={setAmount}
        />
        <VirtualCard
          type="usd" 
          adjustBalance={isAdmin ? adjustBalance : undefined}
          amount={amount}
          setAmount={setAmount}
        />
        <VirtualCard
          type="uah"
          adjustBalance={isAdmin ? adjustBalance : undefined}
          amount={amount}
          setAmount={setAmount}
        />
      </div>
    </div>
  );
}