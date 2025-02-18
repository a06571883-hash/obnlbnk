import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Logo from "@/components/logo";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface ReceiptProps {
  transaction: {
    id: number;
    type: string;
    amount: string;
    currency: string;
    date: string;
    status: string;
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Чек транзакции</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="flex justify-center">
            <Logo size={60} className="text-primary" />
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b">
              <span className="text-sm text-muted-foreground">ID транзакции</span>
              <span className="font-mono">{transaction.id}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Тип</span>
              <span className="capitalize">
                {transaction.type === 'deposit' && 'Пополнение'}
                {transaction.type === 'withdraw' && 'Вывод'}
                {transaction.type === 'transfer' && 'Перевод'}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Сумма</span>
              <span className="font-semibold">
                {transaction.currency === 'BTC' && '₿'}
                {transaction.currency === 'USD' && '$'}
                {transaction.currency === 'UAH' && '₴'}
                {transaction.amount}
              </span>
            </div>

            {transaction.from && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Откуда</span>
                <span className="font-mono text-sm">{transaction.from}</span>
              </div>
            )}

            {transaction.to && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Куда</span>
                <span className="font-mono text-sm">{transaction.to}</span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Дата</span>
              <span>
                {format(new Date(transaction.date), "PPpp", { locale: ru })}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Статус</span>
              <span className={transaction.status === "completed" ? "text-emerald-500" : "text-amber-500"}>
                {transaction.status === "completed" ? "Выполнено" : "В обработке"}
              </span>
            </div>

            {transaction.description && (
              <div className="pt-4 border-t">
                <span className="text-sm text-muted-foreground">Описание</span>
                <p className="mt-1">{transaction.description}</p>
              </div>
            )}
          </div>

          <div className="text-center text-xs text-muted-foreground">
            <p>Поддержка: @KA7777AA</p>
            <p>BNAL Bank © {new Date().getFullYear()}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}