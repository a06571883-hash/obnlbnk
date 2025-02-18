
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";

export default function RegulatorPage() {
  const [selectedUser, setSelectedUser] = useState(null);
  const [amount, setAmount] = useState("");
  
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    queryFn: () => apiRequest("/api/users")
  });

  const adjustBalance = async (userId: number, cardId: number, operation: 'add' | 'subtract') => {
    await apiRequest("/api/regulator/adjust-balance", {
      method: "POST",
      body: { userId, cardId, amount, operation }
    });
  };

  return (
    <div className="container p-4 space-y-4">
      <h1 className="text-2xl font-bold">Regulator Dashboard</h1>
      
      <div className="grid gap-4">
        {users.map(user => (
          <Card key={user.id} className="cursor-pointer" onClick={() => setSelectedUser(user)}>
            <CardHeader>
              <CardTitle>{user.username}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {user.cards?.map(card => (
                  <div key={card.id} className="flex items-center justify-between">
                    <div>
                      <p>Card: {card.number}</p>
                      <p>Balance: {card.balance} {card.type}</p>
                    </div>
                    <div className="space-x-2">
                      <Input 
                        type="number" 
                        placeholder="Amount"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                      <Button onClick={() => adjustBalance(user.id, card.id, 'add')}>
                        Add
                      </Button>
                      <Button onClick={() => adjustBalance(user.id, card.id, 'subtract')}>
                        Subtract
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
