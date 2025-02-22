import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { format } from "date-fns";

const EmptyState = () => (
  <div className="text-center py-12">
    <p className="text-muted-foreground">Транзакций пока нет</p>
  </div>
);

export default function ActivityPage() {
  const { data: transactions = [] } = useQuery({
    queryKey: ["/api/transactions"],
    queryFn: async () => {
      const response = await fetch('/api/transactions');
      if (!response.ok) return [];
      return response.json();
    }
  });

  const [selectedTx, setSelectedTx] = useState<any>(null);

  const filterTransactions = (type: 'all' | 'incoming' | 'outgoing') => {
    return transactions.filter((tx: any) => {
      if (type === 'all') return true;
      if (type === 'incoming') return tx.type === 'deposit';
      if (type === 'outgoing') return tx.type === 'transfer';
      return true;
    });
  };

  const getCurrencyIcon = (type: string) => {
    switch (type) {
      case 'crypto':
        return <Bitcoin className="h-5 w-5" />;
      case 'usd':
        return <DollarSign className="h-5 w-5" />;
      case 'uah':
        return <Coins className="h-5 w-5" />;
      default:
        return null;
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return <ArrowDownLeft className="h-5 w-5 text-emerald-500" />;
      case 'transfer':
        return <ArrowUpRight className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  const formatDate = (date: string) => {
    try {
      return format(new Date(date), 'dd.MM.yyyy HH:mm');
    } catch {
      return 'Недействительная дата';
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
                <TabsTrigger value="all">Все</TabsTrigger>
                <TabsTrigger value="incoming">Входящие</TabsTrigger>
                <TabsTrigger value="outgoing">Исходящие</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-4">
                <TransactionList 
                  transactions={filterTransactions('all')}
                  getTransactionIcon={getTransactionIcon}
                  getCurrencyIcon={getCurrencyIcon}
                  formatDate={formatDate}
                  onSelect={setSelectedTx}
                />
              </TabsContent>

              <TabsContent value="incoming" className="mt-4">
                <TransactionList 
                  transactions={filterTransactions('incoming')}
                  getTransactionIcon={getTransactionIcon}
                  getCurrencyIcon={getCurrencyIcon}
                  formatDate={formatDate}
                  onSelect={setSelectedTx}
                />
              </TabsContent>

              <TabsContent value="outgoing" className="mt-4">
                <TransactionList 
                  transactions={filterTransactions('outgoing')}
                  getTransactionIcon={getTransactionIcon}
                  getCurrencyIcon={getCurrencyIcon}
                  formatDate={formatDate}
                  onSelect={setSelectedTx}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {selectedTx && (
        <TransactionReceipt
          transaction={{
            id: selectedTx.id,
            type: selectedTx.type,
            amount: selectedTx.amount,
            currency: selectedTx.currency || 'USD',
            date: selectedTx.createdAt,
            status: selectedTx.status || 'completed',
            from: selectedTx.from || selectedTx.fromCardNumber,
            to: selectedTx.to || selectedTx.toCardNumber,
            description: selectedTx.description
          }}
          open={!!selectedTx}
          onOpenChange={(open) => !open && setSelectedTx(null)}
        />
      )}
    </div>
  );
}

interface TransactionListProps {
  transactions: any[];
  getTransactionIcon: (type: string) => JSX.Element | null;
  getCurrencyIcon: (type: string) => JSX.Element | null;
  formatDate: (date: string) => string;
  onSelect: (tx: any) => void;
}

function TransactionList({ transactions, getTransactionIcon, getCurrencyIcon, formatDate, onSelect }: TransactionListProps) {
  if (!transactions.length) return <EmptyState />;

  return (
    <div className="space-y-4">
      {transactions.map((tx) => (
        <div
          key={tx.id}
          className="flex items-center p-4 rounded-lg bg-accent/50 hover:bg-accent transition-colors cursor-pointer"
          onClick={() => onSelect(tx)}
        >
          <div className="h-10 w-10 rounded-full bg-background flex items-center justify-center mr-4">
            {getTransactionIcon(tx.type)}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {tx.type === 'transfer' ? 'Перевод' : 'Пополнение'}
              </span>
              <span className="text-sm text-muted-foreground">
                • {formatDate(tx.createdAt)}
              </span>
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              {tx.status === 'completed' ? (
                <span className="text-emerald-500">Выполнено</span>
              ) : (
                <span className="text-amber-500">В обработке</span>
              )}
            </div>
          </div>

          <div className="text-right">
            <div className="flex items-center gap-1 font-medium">
              {getCurrencyIcon(tx.currency || 'usd')}
              {tx.amount}
            </div>
            <div className="text-sm text-muted-foreground">
              {tx.currency || 'USD'}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}