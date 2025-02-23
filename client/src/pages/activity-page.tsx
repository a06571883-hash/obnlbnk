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
import { useAuth } from "@/hooks/use-auth";

const EmptyState = () => (
  <div className="text-center py-12">
    <p className="text-muted-foreground">Транзакций пока нет</p>
  </div>
);

export default function ActivityPage() {
  const { user } = useAuth();
  const { data: cards = [] } = useQuery({
    queryKey: ["/api/cards"],
  });

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

      const fromCard = cards.find(c => c.id === tx.fromCardId);
      const toCard = cards.find(c => c.id === tx.toCardId);

      if (type === 'incoming') return toCard?.userId === user?.id;
      if (type === 'outgoing') return fromCard?.userId === user?.id;
      return true;
    });
  };

  const getCurrencyIcon = (type: string) => {
    switch (type) {
      case 'crypto':
        return <Bitcoin className="h-4 w-4" />;
      case 'usd':
        return <DollarSign className="h-4 w-4" />;
      case 'uah':
        return <Coins className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getTransactionType = (tx: any) => {
    const fromCard = cards.find(c => c.id === tx.fromCardId);
    const toCard = cards.find(c => c.id === tx.toCardId);

    if (tx.type === 'transfer') {
      if (fromCard && toCard && fromCard.userId === toCard.userId) {
        return { type: 'Обмен', iconColor: 'text-amber-500' };
      } else if (fromCard?.userId === user?.id) {
        return { type: 'Перевод', iconColor: 'text-primary' };
      } else {
        return { type: 'Получение', iconColor: 'text-emerald-500' };
      }
    } else if (tx.type === 'deposit') {
      return { type: 'Пополнение', iconColor: 'text-emerald-500' };
    }

    return { type: 'Неизвестно', iconColor: 'text-muted-foreground' };
  };

  const getTransactionIcon = (tx: any) => {
    const { iconColor } = getTransactionType(tx);
    switch (tx.type) {
      case 'deposit':
        return <ArrowDownLeft className={`h-4 w-4 ${iconColor}`} />;
      case 'transfer':
        return <ArrowUpRight className={`h-4 w-4 ${iconColor}`} />;
      default:
        return <RefreshCw className={`h-4 w-4 text-muted-foreground`} />;
    }
  };

  const formatDate = (date: string) => {
    try {
      return format(new Date(date), 'dd.MM.yyyy HH:mm');
    } catch {
      return 'Недействительная дата';
    }
  };

  const getCurrencyLabel = (card: any) => {
    if (!card) return '';

    switch (card.type) {
      case 'crypto':
        return card.btcBalance ? 'BTC' : 'ETH';
      case 'usd':
        return 'USD';
      case 'uah':
        return 'UAH';
      default:
        return card.type.toUpperCase();
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
                  getTransactionType={getTransactionType}
                  getCurrencyIcon={getCurrencyIcon}
                  getCurrencyLabel={getCurrencyLabel}
                  formatDate={formatDate}
                  cards={cards}
                  onSelect={setSelectedTx}
                />
              </TabsContent>

              <TabsContent value="incoming" className="mt-4">
                <TransactionList 
                  transactions={filterTransactions('incoming')}
                  getTransactionIcon={getTransactionIcon}
                  getTransactionType={getTransactionType}
                  getCurrencyIcon={getCurrencyIcon}
                  getCurrencyLabel={getCurrencyLabel}
                  formatDate={formatDate}
                  cards={cards}
                  onSelect={setSelectedTx}
                />
              </TabsContent>

              <TabsContent value="outgoing" className="mt-4">
                <TransactionList 
                  transactions={filterTransactions('outgoing')}
                  getTransactionIcon={getTransactionIcon}
                  getTransactionType={getTransactionType}
                  getCurrencyIcon={getCurrencyIcon}
                  getCurrencyLabel={getCurrencyLabel}
                  formatDate={formatDate}
                  cards={cards}
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
            type: getTransactionType(selectedTx).type,
            amount: selectedTx.amount,
            convertedAmount: selectedTx.convertedAmount,
            currency: cards.find(c => c.id === selectedTx.fromCardId)?.type || 'Unknown',
            date: selectedTx.createdAt,
            status: selectedTx.status || 'completed',
            from: selectedTx.fromCardNumber,
            to: selectedTx.toCardNumber,
            description: selectedTx.description,
            fromCard: cards.find(c => c.id === selectedTx.fromCardId),
            toCard: cards.find(c => c.id === selectedTx.toCardId)
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
  getTransactionIcon: (tx: any) => JSX.Element | null;
  getTransactionType: (tx: any) => { type: string; iconColor: string };
  getCurrencyIcon: (type: string) => JSX.Element | null;
  getCurrencyLabel: (card: any) => string;
  formatDate: (date: string) => string;
  cards: any[];
  onSelect: (tx: any) => void;
}

function TransactionList({ 
  transactions, 
  getTransactionIcon, 
  getTransactionType,
  getCurrencyIcon,
  getCurrencyLabel,
  formatDate, 
  cards,
  onSelect 
}: TransactionListProps) {
  if (!transactions.length) return <EmptyState />;

  return (
    <div className="space-y-2">
      {transactions.map((tx) => {
        const { type } = getTransactionType(tx);
        const fromCard = cards.find(c => c.id === tx.fromCardId);
        const toCard = cards.find(c => c.id === tx.toCardId);
        const currency = fromCard?.type || 'unknown';

        return (
          <div
            key={tx.id}
            className="flex items-center p-3 rounded-lg bg-accent/50 hover:bg-accent transition-colors cursor-pointer"
            onClick={() => onSelect(tx)}
          >
            <div className="h-8 w-8 rounded-full bg-background flex items-center justify-center mr-3">
              {getTransactionIcon(tx)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium truncate">{type}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  • {formatDate(tx.createdAt)}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {tx.status === 'completed' ? (
                  <span className="text-emerald-500">Выполнено</span>
                ) : (
                  <span className="text-amber-500">В обработке</span>
                )}
              </div>
            </div>

            <div className="text-right ml-3 min-w-[80px]">
              <div className="flex items-center gap-1 text-sm font-medium justify-end">
                <div className="flex items-center truncate">
                  {getCurrencyIcon(currency)}
                  <span className="ml-1">{tx.amount}</span>
                </div>
              </div>
              {tx.convertedAmount && tx.convertedAmount !== tx.amount && (
                <div className="text-xs text-muted-foreground truncate">
                  → {tx.convertedAmount} {getCurrencyLabel(toCard)}
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                {getCurrencyLabel(fromCard)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}