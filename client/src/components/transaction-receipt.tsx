import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Logo from "@/components/logo";
import { format } from "date-fns";
import { Bitcoin, DollarSign, Coins, RefreshCw, ArrowUpRight, Banknote } from "lucide-react";

interface ReceiptProps {
  transaction: {
    id: number;
    type: string;
    amount: string;
    convertedAmount?: string;
    currency: string;
    date: string;
    status: string;
    from: string;
    to: string;
    description: string;
    fromCard?: any;
    toCard?: any;
    wallet?: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TransactionReceipt({ transaction, open, onOpenChange }: ReceiptProps) {
  const getTypeIcon = () => {
    switch (transaction.type.toLowerCase()) {
      case 'обмен':
        return <RefreshCw className="h-5 w-5 text-amber-500" />;
      case 'перевод':
        return <ArrowUpRight className="h-5 w-5 text-primary" />;
      case 'получение':
        return <ArrowUpRight className="h-5 w-5 text-emerald-500" />;
      case 'комиссия':
        return <Coins className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
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

  const getCardDetails = (card: any) => {
    if (!card) return '';
    const number = card.number.replace(/(\d{4})/g, "$1 ").trim();
    return `${number} (${card.type.toUpperCase()})`;
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="text-center">Чек</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex justify-center">
            <Logo size={40} className="text-primary" />
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between pb-2 border-b">
              <span className="text-muted-foreground">Тип</span>
              <div className="flex items-center gap-2">
                {getTypeIcon()}
                <span>{transaction.type}</span>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">ID</span>
              <span className="font-mono text-xs">{transaction.id}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Сумма</span>
              <div className="flex items-center gap-1">
                {getCurrencyIcon(transaction.currency)}
                <span className="font-semibold">
                  {formatAmount(transaction.amount, transaction.currency)} {transaction.currency.toUpperCase()}
                </span>
              </div>
            </div>

            {transaction.convertedAmount && transaction.convertedAmount !== transaction.amount && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Конвертировано в</span>
                <div className="flex items-center gap-1">
                  {getCurrencyIcon(transaction.toCard?.type)}
                  <span className="font-semibold">
                    {formatAmount(transaction.convertedAmount, transaction.toCard?.type)} {transaction.toCard?.type.toUpperCase()}
                  </span>
                </div>
              </div>
            )}

            {transaction.from && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Откуда</span>
                <div className="text-right">
                  <span className="font-mono text-xs block">{getCardDetails(transaction.fromCard)}</span>
                  {transaction.fromCard?.userId && (
                    <span className="text-xs text-muted-foreground">
                      {transaction.fromCard.userId === transaction.toCard?.userId ? 'Ваша карта' : transaction.fromCard.username}
                    </span>
                  )}
                </div>
              </div>
            )}

            {transaction.to && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Куда</span>
                <div className="text-right">
                  <span className="font-mono text-xs block">
                    {transaction.to === "REGULATOR" ? "Регулятор" : getCardDetails(transaction.toCard)}
                  </span>
                  {transaction.toCard?.userId && transaction.to !== "REGULATOR" && (
                    <span className="text-xs text-muted-foreground">
                      {transaction.toCard.userId === transaction.fromCard?.userId ? 'Ваша карта' : transaction.toCard.username}
                    </span>
                  )}
                </div>
              </div>
            )}

            {transaction.wallet && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Адрес кошелька</span>
                <span className="font-mono text-xs">{transaction.wallet}</span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Статус</span>
              <span className={transaction.status === 'completed' ? 'text-emerald-500' : 'text-amber-500'}>
                {transaction.status === 'completed' ? 'Выполнено' : 'В обработке'}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Дата</span>
              <span className="text-xs">
                {format(new Date(transaction.date), 'dd.MM.yyyy HH:mm')}
              </span>
            </div>
          </div>

          <div className="text-center text-[10px] text-muted-foreground pt-2 border-t">
            <p>Поддержка: @KA7777AA</p>
            <p>BNAL Bank © {new Date().getFullYear()}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}