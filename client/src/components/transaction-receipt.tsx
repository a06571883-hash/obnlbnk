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
          <DialogTitle className="text-center">Transaction Receipt</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="flex justify-center">
            <Logo size={60} className="text-primary" />
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b">
              <span className="text-sm text-muted-foreground">Transaction ID</span>
              <span className="font-mono">{transaction.id}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Type</span>
              <span className="capitalize">{transaction.type}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Amount</span>
              <span className="font-semibold">
                {transaction.currency} {transaction.amount}
              </span>
            </div>

            {transaction.from && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">From</span>
                <span className="font-mono text-sm">{transaction.from}</span>
              </div>
            )}

            {transaction.to && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">To</span>
                <span className="font-mono text-sm">{transaction.to}</span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Date</span>
              <span>{format(new Date(transaction.date), "PPpp")}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Status</span>
              <span className={transaction.status === "completed" ? "text-emerald-500" : "text-amber-500"}>
                {transaction.status}
              </span>
            </div>

            {transaction.description && (
              <div className="pt-4 border-t">
                <span className="text-sm text-muted-foreground">Description</span>
                <p className="mt-1">{transaction.description}</p>
              </div>
            )}
          </div>

          <div className="text-center text-xs text-muted-foreground">
            <p>Support: @KA7777AA</p>
            <p>OOOBNAL Bank © {new Date().getFullYear()}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}