import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw,
  Bitcoin,
  DollarSign,
  Coins
} from "lucide-react";
import { useState } from "react";
import TransactionReceipt from "@/components/transaction-receipt";
import AnimatedBackground from "@/components/animated-background";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";


const EmptyState = () => (
  <div className="text-center py-12">
    <p className="text-muted-foreground">No transactions yet</p>
  </div>
);

// Demo transactions as fallback when no data
const demoTransactions: any[] = [
  {
    id: 1,
    type: "deposit",
    amount: "0.015",
    currency: "BTC",
    date: "2024-02-18",
    status: "completed",
    to: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    description: "Crypto deposit to wallet"
  },
  {
    id: 2,
    type: "withdraw",
    amount: "1500",
    currency: "USD",
    date: "2024-02-17",
    status: "completed",
    from: "Main USD Account",
    to: "External Bank Account",
    description: "Withdrawal to external account"
  },
  {
    id: 3,
    type: "transfer",
    amount: "25000",
    currency: "UAH",
    date: "2024-02-16",
    status: "pending",
    from: "Main UAH Account",
    to: "Savings Account",
    description: "Internal transfer between accounts"
  },
];

export default function ActivityPage() {
  const { data: transactions = [] } = useQuery({
    queryKey: ["/api/transactions"],
    queryFn: async () => {
      const response = await fetch('/api/transactions');
      if (!response.ok) return [];
      return response.json();
    }
  });
  const [selectedTx, setSelectedTx] = useState<typeof transactions[0] | null>(null);

  const getCurrencyIcon = (currency: string) => {
    switch (currency) {
      case 'BTC':
        return <Bitcoin className="h-5 w-5" />;
      case 'USD':
        return <DollarSign className="h-5 w-5" />;
      case 'UAH':
        return <Coins className="h-5 w-5" />;
      default:
        return null;
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return <ArrowDownLeft className="h-5 w-5 text-emerald-500" />;
      case 'withdraw':
        return <ArrowUpRight className="h-5 w-5 text-red-500" />;
      case 'transfer':
        return <RefreshCw className="h-5 w-5 text-blue-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <AnimatedBackground />

      <div className="bg-primary text-primary-foreground p-4 relative">
        <h1 className="text-xl font-bold mb-1">Activity</h1>
        <p className="text-sm text-primary-foreground/80">Track your transactions</p>
      </div>

      <div className="p-4 -mt-4 relative">
        <Card className="backdrop-blur-sm bg-background/80">
          <CardContent className="p-6">
            <Tabs defaultValue="all" className="mb-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="incoming">Incoming</TabsTrigger>
                <TabsTrigger value="outgoing">Outgoing</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="space-y-4">
              {(transactions.length > 0 ? transactions : demoTransactions).map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center p-4 rounded-lg bg-accent/50 hover:bg-accent transition-colors cursor-pointer"
                  onClick={() => setSelectedTx(tx)}
                >
                  <div className="h-10 w-10 rounded-full bg-background flex items-center justify-center mr-4">
                    {getTransactionIcon(tx.type)}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium capitalize">{tx.type}</span>
                      <span className="text-sm text-muted-foreground">
                        • {new Date(tx.date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      Status: 
                      <span className={tx.status === 'completed' ? 'text-emerald-500' : 'text-amber-500'}>
                        {tx.status}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center gap-1 font-medium">
                      {getCurrencyIcon(tx.currency)}
                      {tx.amount}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {tx.currency}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {selectedTx && (
        <TransactionReceipt
          transaction={selectedTx}
          open={!!selectedTx}
          onOpenChange={(open) => !open && setSelectedTx(null)}
        />
      )}
    </div>
  );
}