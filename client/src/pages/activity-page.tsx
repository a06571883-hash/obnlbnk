import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowUpRight,
  Bitcoin,
  DollarSign,
  Coins,
  RefreshCw,
  Banknote
} from "lucide-react";
import { useState } from "react";
import TransactionReceipt from "@/components/transaction-receipt";
import AnimatedBackground from "@/components/animated-background";
import TelegramBackground from "@/components/telegram-background";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";

interface Transaction {
  id: number;
  type: string;
  status: string;
  amount: string;
  convertedAmount?: string;
  fromCardId: number;
  toCardId?: number | null;
  createdAt: string;
  fromCardNumber: string;
  toCardNumber: string;
  description: string;
  wallet?: string;
}

interface Card {
  id: number;
  userId: number;
  type: string;
  number: string;
  balance: string;
  btcBalance?: string;
  ethBalance?: string;
}

const EmptyState = () => (
  <div className="text-center py-12">
    <p className="text-muted-foreground">Транзакций пока нет</p>
  </div>
);

export default function ActivityPage() {
  const { user } = useAuth();
  const { data: cards = [] } = useQuery<Card[]>({
    queryKey: ["/api/cards"],
    enabled: !!user,
    retry: false, // Не повторяем запрос при ошибке
    refetchOnMount: true,
    staleTime: 0
  });

  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
    enabled: !!user,
    refetchInterval: 5000,
  });

  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const filterTransactions = (type: 'all' | 'incoming' | 'outgoing') => {
    if (!cards || !Array.isArray(cards)) return [];
    
    return transactions.filter((tx) => {
      if (type === 'all') return true;

      const fromCard = cards.find(c => c.id === tx.fromCardId);
      const toCard = cards.find(c => c.id === tx.toCardId);

      if (type === 'incoming') return toCard?.userId === user?.id;
      if (type === 'outgoing') return fromCard?.userId === user?.id;
      return true;
    });
  };

  const getCurrencyIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'crypto':
        return <Bitcoin className="h-4 w-4" />;
      case 'usd':
        return <DollarSign className="h-4 w-4" />;
      case 'uah':
        return <Banknote className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getTransactionType = (tx: Transaction) => {
    if (!cards || !Array.isArray(cards)) return { type: 'Unknown', iconColor: 'text-gray-500' };
    
    const fromCard = cards.find(c => c.id === tx.fromCardId);
    const toCard = cards.find(c => c.id === tx.toCardId);

    if (tx.type === 'commission') {
      return { type: 'Комиссия', iconColor: 'text-red-500' };
    }

    if (tx.type === 'exchange') {
      return { type: 'Обмен', iconColor: 'text-amber-500' };
    }

    if (tx.type === 'transfer') {
      if (fromCard?.userId === user?.id) {
        return { type: 'Перевод', iconColor: 'text-primary' };
      } else {
        return { type: 'Получение', iconColor: 'text-emerald-500' };
      }
    }

    return { type: 'Неизвестно', iconColor: 'text-muted-foreground' };
  };

  const getTransactionIcon = (tx: Transaction) => {
    const { iconColor } = getTransactionType(tx);
    switch (tx.type) {
      case 'commission':
        return <Coins className={`h-4 w-4 ${iconColor}`} />;
      case 'exchange':
        return <RefreshCw className={`h-4 w-4 ${iconColor}`} />;
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

  const formatAmount = (amount: string, currency: string) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return amount;

    if (currency.toLowerCase() === 'crypto') {
      return num.toFixed(8);
    }
    return num.toFixed(2);
  };

  return (
    <div className="min-h-screen bg-background">
      <TelegramBackground />
      <AnimatedBackground />

      <div className="bg-primary text-primary-foreground p-4 relative">
        <h1 className="text-xl font-bold mb-1">Activity</h1>
        <p className="text-sm text-primary-foreground/80">Track your transactions</p>
      </div>

      <div className="p-2 -mt-4 relative">
        <Card className="backdrop-blur-sm bg-background/80">
          <CardContent className="p-3">
            <Tabs defaultValue="all" className="mb-2">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all">Все</TabsTrigger>
                <TabsTrigger value="incoming">Входящие</TabsTrigger>
                <TabsTrigger value="outgoing">Исходящие</TabsTrigger>
              </TabsList>

              {['all', 'incoming', 'outgoing'].map((tabValue) => (
                <TabsContent key={tabValue} value={tabValue} className="mt-2">
                  <TransactionList
                    transactions={filterTransactions(tabValue as 'all' | 'incoming' | 'outgoing')}
                    getTransactionIcon={getTransactionIcon}
                    getTransactionType={getTransactionType}
                    getCurrencyIcon={getCurrencyIcon}
                    formatDate={formatDate}
                    formatAmount={formatAmount}
                    cards={cards}
                    onSelect={setSelectedTx}
                  />
                </TabsContent>
              ))}
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
            currency: cards?.find(c => c.id === selectedTx.fromCardId)?.type || 'Unknown',
            date: selectedTx.createdAt,
            status: selectedTx.status || 'completed',
            from: selectedTx.fromCardNumber,
            to: selectedTx.toCardNumber,
            description: selectedTx.description,
            fromCard: cards?.find(c => c.id === selectedTx.fromCardId),
            toCard: cards?.find(c => c.id === selectedTx.toCardId),
            wallet: selectedTx.wallet
          }}
          open={!!selectedTx}
          onOpenChange={(open) => !open && setSelectedTx(null)}
        />
      )}
    </div>
  );
}

interface TransactionListProps {
  transactions: Transaction[];
  getTransactionIcon: (tx: Transaction) => JSX.Element | null;
  getTransactionType: (tx: Transaction) => { type: string; iconColor: string };
  getCurrencyIcon: (type: string) => JSX.Element | null;
  formatDate: (date: string) => string;
  formatAmount: (amount: string, currency: string) => string;
  cards: Card[];
  onSelect: (tx: Transaction) => void;
}

function TransactionList({
  transactions,
  getTransactionIcon,
  getTransactionType,
  getCurrencyIcon,
  formatDate,
  formatAmount,
  cards,
  onSelect
}: TransactionListProps) {
  if (!transactions.length) return <EmptyState />;

  return (
    <div className="space-y-1">
      {transactions.map((tx) => {
        const { type } = getTransactionType(tx);
        const fromCard = cards?.find(c => c.id === tx.fromCardId);
        const toCard = cards?.find(c => c.id === tx.toCardId);
        const fromCurrency = fromCard?.type || 'unknown';
        const toCurrency = toCard?.type || 'unknown';

        return (
          <div
            key={tx.id}
            className="flex items-center p-1.5 rounded-lg bg-accent/50 hover:bg-accent transition-colors cursor-pointer"
            onClick={() => onSelect(tx)}
          >
            <div className="h-5 w-5 rounded-full bg-background flex items-center justify-center mr-2">
              {getTransactionIcon(tx)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-[8px] font-medium truncate">{type}</span>
                <span className="text-[8px] text-muted-foreground whitespace-nowrap">
                  • {formatDate(tx.createdAt)}
                </span>
                {/* Индикатор симуляции в списке транзакций */}
                {tx.description && tx.description.includes('СИМУЛЯЦИЯ') && (
                  <span className="text-[7px] text-amber-600 bg-amber-50 border border-amber-200 px-1 rounded-sm ml-1 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-0.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>
                    <span>симуляция</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-[8px] text-muted-foreground">
                {tx.status === 'completed' ? (
                  <span className="text-emerald-500">Выполнено</span>
                ) : (
                  <span className="text-amber-500">В обработке</span>
                )}
              </div>
            </div>

            <div className="text-right ml-2 min-w-[60px]">
              <div className="flex items-center gap-1 text-[8px] font-medium justify-end">
                <div className="flex items-center truncate">
                  {getCurrencyIcon(fromCurrency)}
                  <span className="ml-0.5">{formatAmount(tx.amount, fromCurrency)}</span>
                </div>
              </div>
              {tx.convertedAmount && tx.convertedAmount !== tx.amount && (
                <div className="text-[7px] text-muted-foreground truncate">
                  → {formatAmount(tx.convertedAmount, toCurrency)} {toCurrency.toUpperCase()}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
