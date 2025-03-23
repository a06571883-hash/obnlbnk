import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Logo from "@/components/logo";
import { format } from "date-fns";
import { Bitcoin, DollarSign, Coins, RefreshCw, ArrowUpRight, Banknote, CheckCircle2, Clock, AlertCircle } from "lucide-react";

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
        return <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-500" />;
      case 'перевод':
        return <ArrowUpRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />;
      case 'получение':
        return <ArrowUpRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500" />;
      case 'комиссия':
        return <Coins className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getCurrencyIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'crypto':
        return <Bitcoin className="h-3 w-3 sm:h-3.5 sm:w-3.5" />;
      case 'usd':
        return <DollarSign className="h-3 w-3 sm:h-3.5 sm:w-3.5" />;
      case 'uah':
        return <Banknote className="h-3 w-3 sm:h-3.5 sm:w-3.5" />;
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
    if (!amount) return '0';
    const num = parseFloat(amount);
    if (isNaN(num)) return '0';

    // Сократим количество знаков после запятой для крипты
    if (currency?.toLowerCase() === 'crypto') {
      if (num < 0.0001) {
        return num.toFixed(8); // Для очень маленьких сумм показываем все знаки
      }
      return num.toFixed(4); // Для обычных сумм показываем 4 знака
    }
    return num.toFixed(2);
  };

  // Функция для сокращения длинных адресов
  const formatAddress = (address: string) => {
    if (!address) return '';
    if (address.length > 12) {
      return `${address.slice(0, 6)}...${address.slice(-6)}`;
    }
    return address;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="text-center">Чек</DialogTitle>
        </DialogHeader>
        <div className="space-y-2.5">
          <div className="flex justify-center">
            <Logo size={28} className="text-primary" />
          </div>

          <div className="space-y-2 text-[10px] sm:text-xs">
            <div className="flex items-center justify-between pb-2 border-b">
              <span className="text-muted-foreground">Тип</span>
              <div className="flex items-center gap-1">
                {getTypeIcon()}
                <span>{transaction.type}</span>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">ID</span>
              <span className="font-mono text-[9px] sm:text-[10px]">{transaction.id}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Сумма</span>
              <div className="flex items-center gap-1">
                {getCurrencyIcon(transaction.currency)}
                <span className="font-semibold">
                  {formatAmount(transaction.amount, transaction.currency)} {transaction.currency?.toUpperCase()}
                </span>
              </div>
            </div>

            {transaction.convertedAmount && transaction.convertedAmount !== transaction.amount && transaction.toCard?.type && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Конв.</span>
                <div className="flex items-center gap-1">
                  {getCurrencyIcon(transaction.toCard.type)}
                  <span className="font-semibold">
                    {formatAmount(transaction.convertedAmount, transaction.toCard.type)} {transaction.toCard.type.toUpperCase()}
                  </span>
                </div>
              </div>
            )}

            {transaction.from && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">От</span>
                <div className="text-right">
                  <span className="font-mono text-[9px] sm:text-[10px] block">{getCardDetails(transaction.fromCard)}</span>
                  {transaction.fromCard?.userId && (
                    <span className="text-[9px] sm:text-[10px] text-muted-foreground">
                      {transaction.fromCard.userId === transaction.toCard?.userId ? 'Ваша карта' : transaction.fromCard.username}
                    </span>
                  )}
                </div>
              </div>
            )}

            {transaction.to && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">К</span>
                <div className="text-right">
                  <span className="font-mono text-[9px] sm:text-[10px] block">
                    {transaction.to === "REGULATOR" ? "Регулятор" : getCardDetails(transaction.toCard)}
                  </span>
                  {transaction.toCard?.userId && transaction.to !== "REGULATOR" && (
                    <span className="text-[9px] sm:text-[10px] text-muted-foreground">
                      {transaction.toCard.userId === transaction.fromCard?.userId ? 'Ваша карта' : transaction.toCard.username}
                    </span>
                  )}
                </div>
              </div>
            )}

            {transaction.wallet && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Адрес</span>
                <div className="flex items-center gap-1">
                  {transaction.wallet.startsWith('0x') ? (
                    <div className="w-3 h-3 rounded-full bg-blue-400 flex items-center justify-center">
                      <span className="text-white text-[6px] font-bold">E</span>
                    </div>
                  ) : (
                    <div className="w-3 h-3 rounded-full bg-orange-400 flex items-center justify-center">
                      <span className="text-white text-[6px] font-bold">B</span>
                    </div>
                  )}
                  <span className="font-mono text-[9px] sm:text-[10px]">{formatAddress(transaction.wallet)}</span>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Статус</span>
              <div className="flex items-center gap-1.5">
                {transaction.status === 'completed' ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-emerald-500 font-medium">Выполнено ✓</span>
                  </>
                ) : transaction.status === 'failed' ? (
                  <>
                    <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-red-500 font-medium">Ошибка ⚠️</span>
                  </>
                ) : (
                  <>
                    <Clock className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                    <span className="text-amber-500 font-medium">В обработке...</span>
                  </>
                )}
              </div>
            </div>
            
            {/* Индикатор режима симуляции для крипто-переводов */}
            {transaction.description && transaction.description.includes('СИМУЛЯЦИЯ') && (
              <div className="border border-amber-200 bg-amber-50 p-2 rounded mt-2 mb-2">
                <div className="flex items-start gap-2">
                  <div className="text-amber-500 mt-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>
                  </div>
                  <div>
                    <span className="text-[9px] text-amber-700 font-semibold">Режим симуляции</span>
                    <p className="text-[8px] text-amber-700 mt-0.5">
                      Средства списаны с вашей карты, но блокчейн-транзакция не выполнена из-за отсутствия API ключей для блокчейн-операций.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Информация о подтверждениях блокчейн транзакции */}
            {transaction.wallet && !transaction.description?.includes('СИМУЛЯЦИЯ') && transaction.status === 'pending' && (
              <div className="border border-blue-100 bg-blue-50 p-2 rounded mt-2 mb-2">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-blue-700 font-semibold">
                      Подтверждения блокчейна
                    </span>
                    <span className="text-[9px] text-blue-700">
                      {transaction.wallet.startsWith('0x') ? '0/12' : '0/3'}
                    </span>
                  </div>
                  
                  <div className="w-full h-1.5 bg-blue-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-400 rounded-full animate-pulse" 
                      style={{ width: '8%' }}
                    ></div>
                  </div>

                  <p className="text-[8px] text-blue-700">
                    Транзакция находится в блокчейне и ожидает подтверждений
                  </p>
                </div>
              </div>
            )}
            
            {/* Успешная блокчейн транзакция */}
            {transaction.wallet && !transaction.description?.includes('СИМУЛЯЦИЯ') && transaction.status === 'completed' && (
              <div className="border border-emerald-100 bg-emerald-50 p-2 rounded mt-2 mb-2">
                <div className="flex items-start gap-2">
                  <div className="text-emerald-500 mt-0.5">
                    <CheckCircle2 size={14} />
                  </div>
                  <div>
                    <span className="text-[9px] text-emerald-700 font-semibold">
                      Транзакция подтверждена блокчейном
                    </span>
                    <p className="text-[8px] text-emerald-700 mt-0.5">
                      {transaction.wallet.startsWith('0x') 
                        ? 'Ethereum транзакция успешно выполнена (12+ подтверждений)'
                        : 'Bitcoin транзакция успешно выполнена (3+ подтверждений)'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Дата</span>
              <span className="text-[9px] sm:text-[10px]">
                {format(new Date(transaction.date), 'dd.MM.yyyy HH:mm')}
              </span>
            </div>
          </div>

          <div className="text-[8px] sm:text-[9px] text-muted-foreground pt-2 border-t text-center">
            <p>Поддержка: @OOO_BNAL_BANK</p>
            <p>BNAL Bank © {new Date().getFullYear()}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}