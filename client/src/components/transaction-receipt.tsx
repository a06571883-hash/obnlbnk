import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Logo from "@/components/logo";
import { format } from "date-fns";

interface ReceiptProps {
  transaction: {
    id: number;
    type: string;
    amount: string;
    convertedAmount?: string;
    currency: string;
    date: string;
    status?: string;
    from?: string;
    to?: string;
    description?: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TransactionReceipt({ transaction, open, onOpenChange }: ReceiptProps) {
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
            <div className="flex justify-between items-center pb-2 border-b">
              <span className="text-muted-foreground">ID</span>
              <span className="font-mono text-xs">{transaction.id}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Тип</span>
              <span>
                {transaction.type === 'transfer' && 'Перевод'}
                {transaction.type === 'deposit' && 'Пополнение'}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Сумма списания</span>
              <span className="font-semibold">
                {transaction.currency === 'crypto' && '₿'}
                {transaction.currency === 'usd' && '$'}
                {transaction.currency === 'uah' && '₴'}
                {transaction.amount}
              </span>
            </div>

            {transaction.convertedAmount && transaction.convertedAmount !== transaction.amount && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Сумма зачисления</span>
                <span className="font-semibold">
                  {parseFloat(transaction.convertedAmount).toFixed(2)}
                </span>
              </div>
            )}

            {transaction.from && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Откуда</span>
                <span className="font-mono text-xs">{transaction.from}</span>
              </div>
            )}

            {transaction.to && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Куда</span>
                <span className="font-mono text-xs">{transaction.to}</span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Дата</span>
              <span className="text-xs">
                {format(new Date(transaction.date), 'dd.MM.yyyy HH:mm')}
              </span>
            </div>

            {transaction.status && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Статус</span>
                <span className={transaction.status === "completed" ? "text-emerald-500" : "text-amber-500"}>
                  {transaction.status === "completed" ? "Выполнено" : "В обработке"}
                </span>
              </div>
            )}

            {transaction.description && (
              <div className="pt-2 border-t">
                <span className="text-xs text-muted-foreground">Описание</span>
                <p className="mt-1 text-xs">{transaction.description}</p>
              </div>
            )}
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