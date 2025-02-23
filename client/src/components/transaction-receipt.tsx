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
    currency: string;
    date: string;
    from?: string;
    to?: string;
    fromCard?: any;
    toCard?: any;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TransactionReceipt({ transaction, open, onOpenChange }: ReceiptProps) {
  const getCardDetails = (card: any) => {
    if (!card) return '';
    const number = card.number.replace(/(\d{4})/g, "$1 ").trim();
    return `${number} (${card.type.toUpperCase()})`;
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
            <div className="flex justify-between items-center pb-2 border-b">
              <span className="text-muted-foreground">ID</span>
              <span className="font-mono text-xs">{transaction.id}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Тип</span>
              <span>{transaction.type === 'transfer' ? 'Перевод' : 'Пополнение'}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Сумма</span>
              <span className="font-semibold">
                {transaction.amount} {transaction.currency}
              </span>
            </div>

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
                  <span className="font-mono text-xs block">{getCardDetails(transaction.toCard)}</span>
                  {transaction.toCard?.userId && (
                    <span className="text-xs text-muted-foreground">
                      {transaction.toCard.userId === transaction.fromCard?.userId ? 'Ваша карта' : transaction.toCard.username}
                    </span>
                  )}
                </div>
              </div>
            )}

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