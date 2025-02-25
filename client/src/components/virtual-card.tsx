import { Card } from "@shared/schema";
import {
  Card as UICard,
  CardContent
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CreditCard, Wallet, ArrowUpCircle, ArrowDownCircle, RefreshCw, Loader2, Bitcoin, Coins } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useGyroscope } from "@/hooks/use-gyroscope";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type RecipientType = 'usd_card' | 'crypto_wallet';

const cardColors = {
  crypto: "bg-gradient-to-br from-violet-600 via-indigo-500 via-blue-500 via-cyan-500 via-green-500 via-yellow-500 to-orange-600 before:absolute before:inset-0 before:bg-gradient-to-t before:from-black/20 before:to-transparent before:rounded-xl hover:before:opacity-30 transition-all duration-15000 ease-in-out animate-shimmer",
  usd: "bg-gradient-to-br from-emerald-600 via-teal-500 via-sky-500 via-blue-500 via-indigo-500 to-purple-600 hover:shadow-emerald-200/20 transition-all duration-15000 ease-in-out animate-shimmer",
  uah: "bg-gradient-to-br from-blue-600 via-sky-500 via-teal-500 via-green-500 via-yellow-500 to-orange-600 hover:shadow-blue-200/20 transition-all duration-15000 ease-in-out animate-shimmer",
} as const;

function validateBtcAddress(address: string): boolean {
  const legacyRegex = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
  const bech32Regex = /^bc1[a-zA-HJ-NP-Z0-9]{39,59}$/;
  return legacyRegex.test(address) || bech32Regex.test(address);
}

function validateEthAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/i.test(address);
}

export default function VirtualCard({ card }: { card: Card }) {
  const { toast } = useToast();
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const gyroscope = useGyroscope();
  const queryClient = useQueryClient();
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferAmount, setTransferAmount] = useState('');
  const [recipientCardNumber, setRecipientCardNumber] = useState('');
  const [transferError, setTransferError] = useState('');
  const [isMobile] = useState(() => window.innerWidth < 768);
  const [isHovered, setIsHovered] = useState(false);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const [selectedWallet, setSelectedWallet] = useState<'btc' | 'eth'>('btc');
  const [recipientType, setRecipientType] = useState<RecipientType>('usd_card');
  const [rates, setRates] = useState<{ usdToUah: number; btcToUsd: number; ethToUsd: number } | null>(null);

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const response = await fetch('/api/rates');
        const data = await response.json();
        setRates({
          usdToUah: parseFloat(data.usdToUah),
          btcToUsd: parseFloat(data.btcToUsd),
          ethToUsd: parseFloat(data.ethToUsd)
        });
      } catch (error) {
        console.error('Failed to fetch rates:', error);
      }
    };
    fetchRates();
  }, []);

  const transferMutation = useMutation({
    mutationFn: async () => {
      if (!transferAmount || isNaN(parseFloat(transferAmount)) || parseFloat(transferAmount) <= 0) {
        throw new Error('Пожалуйста, введите корректную сумму');
      }

      if (!recipientCardNumber.trim()) {
        throw new Error('Пожалуйста, введите номер карты/адрес получателя');
      }

      // Проверяем баланс отправителя
      if (card.type === 'crypto') {
        // Для крипто карты проверяем баланс в выбранной криптовалюте
        const cryptoBalance = selectedWallet === 'btc' ? parseFloat(card.btcBalance || '0') : parseFloat(card.ethBalance || '0');
        if (parseFloat(transferAmount) > cryptoBalance) {
          throw new Error(`Недостаточно ${selectedWallet.toUpperCase()}. Доступно: ${cryptoBalance.toFixed(8)} ${selectedWallet.toUpperCase()}`);
        }
      } else {
        // Для фиатной карты проверяем баланс в USD/UAH
        if (parseFloat(transferAmount) > parseFloat(card.balance)) {
          throw new Error(`Недостаточно средств. Доступно: ${card.balance} ${card.type.toUpperCase()}`);
        }
      }

      // Валидация криптоадреса
      if (recipientType === 'crypto_wallet') {
        const address = recipientCardNumber.trim();
        if (selectedWallet === 'btc' && !validateBtcAddress(address)) {
          throw new Error('Неверный формат BTC адреса');
        } else if (selectedWallet === 'eth' && !validateEthAddress(address)) {
          throw new Error('Неверный формат ETH адреса');
        }
      }

      const transferRequest = {
        fromCardId: card.id,
        recipientAddress: recipientCardNumber.replace(/\s+/g, ''),
        amount: parseFloat(transferAmount),
        transferType: recipientType === 'crypto_wallet' ? 'crypto' : 'fiat',
        // Для крипто карты всегда указываем её криптовалюту
        cryptoType: card.type === 'crypto' ? selectedWallet : (recipientType === 'crypto_wallet' ? selectedWallet : undefined)
      };

      const response = await apiRequest("POST", "/api/transfer", transferRequest);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при переводе');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cards'] });
      setIsTransferring(false);
      setTransferAmount('');
      setRecipientCardNumber('');
      setTransferError('');

      toast({
        title: "Успешно!",
        description: "Перевод выполнен успешно",
      });
    },
    onError: (error: Error) => {
      setTransferError(error.message);
      setIsTransferring(false);

      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsTransferring(true);
    transferMutation.mutate();
  };

  // Функция для конвертации и отображения суммы
  const getConvertedAmount = () => {
    if (!rates || !transferAmount) return null;
    const amount = parseFloat(transferAmount);
    if (isNaN(amount)) return null;

    if (card.type === 'crypto' ) { //Always show conversion for crypto to fiat
      const rate = selectedWallet === 'btc' ? rates.btcToUsd : rates.ethToUsd;
      return `≈ ${(amount * rate).toFixed(2)} USD`;
    }
    return null;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || isMobile) return;

    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const rotateY = ((e.clientX - centerX) / (rect.width / 2)) * 15;
    const rotateX = -((e.clientY - centerY) / (rect.height / 2)) * 15;

    setRotation({ x: rotateX, y: rotateY });
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setRotation({ x: 0, y: 0 });
    setIsHovered(false);
  };

  useEffect(() => {
    if (gyroscope && isMobile) {
      const sensitivity = isIOS ? 0.5 : 0.7;
      const targetX = -gyroscope.beta * sensitivity;
      const targetY = gyroscope.gamma * sensitivity;

      requestAnimationFrame(() => {
        setRotation(prev => ({
          x: prev.x + (targetX - prev.x) * (isIOS ? 0.05 : 0.1),
          y: prev.y + (targetY - prev.y) * (isIOS ? 0.05 : 0.1)
        }));
      });
    }
  }, [gyroscope, isMobile, isIOS]);

  return (
    <div
      ref={cardRef}
      className="perspective-[1000px] w-full max-w-[400px] mx-auto px-4 py-2 sm:px-0"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `
          perspective(1000px) 
          rotateX(${rotation.x}deg) 
          rotateY(${rotation.y}deg)
        `,
        transition: isHovered ? 'transform 0.1s ease-out' : 'transform 0.5s ease-out',
        transformStyle: 'preserve-3d'
      }}
    >
      <div
        className={`relative h-44 sm:h-48 w-full rounded-xl ${cardColors[card.type as keyof typeof cardColors]} p-4 sm:p-6 text-white shadow-xl overflow-hidden backdrop-blur-sm hover:scale-[1.02] transition-all duration-15000 ease-in-out`}
        style={{
          boxShadow: `
            0 10px 20px rgba(0,0,0,0.19), 
            0 6px 6px rgba(0,0,0,0.23),
            ${Math.abs(rotation.y)}px ${Math.abs(rotation.x)}px 20px rgba(0,0,0,0.1)
          `,
          backgroundSize: '200% 200%'
        }}
      >
        {card.type === 'crypto' && (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 hover:opacity-20 transition-opacity duration-15000 ease-in-out pointer-events-none" />
            <div 
              className="absolute inset-0 opacity-30 pointer-events-none transition-opacity duration-15000 ease-in-out"
              style={{
                background: 'radial-gradient(circle at 0% 0%, rgba(255,255,255,0.3) 0%, transparent 50%)'
              }}
            />
          </>
        )}

        <div className={`relative z-10 flex flex-col justify-between h-full`}>
          <div className="space-y-1 sm:space-y-2">
            <div className="text-[10px] sm:text-xs opacity-80">OOO BNAL BANK</div>
            <div className="text-sm sm:text-2xl font-bold tracking-wider">
              {card.number.replace(/(\d{4})/g, "$1 ").trim()}
            </div>
          </div>

          <div className="space-y-2 sm:space-y-3">
            <div className="flex justify-between">
              {card.type === 'crypto' ? (
                <div className="space-y-0.5 sm:space-y-1">
                  <div className="flex items-center">
                    <Bitcoin className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />
                    <div className="text-[9px] sm:text-[11px] opacity-80">BTC Balance</div>
                  </div>
                  <div className="text-[11px] sm:text-sm font-semibold">
                    {card.btcBalance} BTC
                  </div>
                  <div className="flex items-center mt-0.5">
                    <Coins className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />
                    <div className="text-[9px] sm:text-[11px] opacity-80">ETH Balance</div>
                  </div>
                  <div className="text-[11px] sm:text-sm font-semibold">
                    {card.ethBalance} ETH
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-[10px] sm:text-xs opacity-80">Balance</div>
                  <div className="text-xs sm:text-base font-semibold">
                    {card.balance} {card.type.toUpperCase()}
                  </div>
                </div>
              )}
              <div>
                <div className="text-[10px] sm:text-xs opacity-80">Expires</div>
                <div className="text-xs sm:text-base font-semibold">{card.expiry}</div>
              </div>
            </div>

            <div className="flex space-x-1">
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="flex-1 text-white hover:bg-white/20 bg-white/10 backdrop-blur-sm text-[10px] sm:text-xs py-0.5 h-6 sm:h-7">
                    <ArrowUpCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    <span className="hidden sm:inline">Deposit</span>
                    <span className="sm:hidden">Dep</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Deposit Funds</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    {card.type === 'crypto' ? (
                      <>
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">BTC Address</p>
                          <p className="font-mono text-sm break-all">{card.btcAddress}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">ETH Address</p>
                          <p className="font-mono text-sm break-all">{card.ethAddress}</p>
                        </div>
                      </>
                    ) : (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Card Number</p>
                        <p className="font-mono">{card.number}</p>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="flex-1 text-white hover:bg-white/20 bg-white/10 backdrop-blur-sm text-[10px] sm:text-xs py-0.5 h-6 sm:h-7">
                    <ArrowDownCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    <span className="hidden sm:inline">Withdraw</span>
                    <span className="sm:hidden">With</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Withdraw Funds</DialogTitle>
                    <DialogDescription>
                      Process your withdrawal request
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p className="text-center text-muted-foreground">
                      Contact support @KA7777AA to process your withdrawal
                    </p>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="flex-1 text-white hover:bg-white/20 bg-white/10 backdrop-blur-sm text-[10px] sm:text-xs py-0.5 h-6 sm:h-7">
                    <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    <span className="hidden sm:inline">Transfer</span>
                    <span className="sm:hidden">Trans</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[calc(100vw-2rem)] sm:w-auto max-w-md mx-auto max-h-[calc(100vh-4rem)] overflow-y-auto p-3 sm:p-6 rounded-lg">
                  <DialogHeader className="space-y-2 mb-4">
                    <DialogTitle className="text-lg sm:text-xl">Transfer Funds</DialogTitle>
                    <DialogDescription className="text-sm">
                      Transfer funds to another card or wallet
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium">Тип получателя</label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={recipientType === 'usd_card' ? 'default' : 'outline'}
                          className="h-8 text-xs sm:text-sm"
                          onClick={() => setRecipientType('usd_card')}
                        >
                          <CreditCard className="h-3 w-3 mr-1" />
                          Фиат карта
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={recipientType === 'crypto_wallet' ? 'default' : 'outline'}
                          className="h-8 text-xs sm:text-sm"
                          onClick={() => setRecipientType('crypto_wallet')}
                        >
                          <Wallet className="h-3 w-3 mr-1" />
                          Крипто адрес
                        </Button>
                      </div>
                    </div>

                    {recipientType === 'crypto_wallet' && card.type !== 'crypto' && (
                      <div className="space-y-2">
                        <label className="block text-sm font-medium">
                          Выберите криптовалюту для получения
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={selectedWallet === 'btc' ? 'default' : 'outline'}
                            className="h-8 text-xs sm:text-sm"
                            onClick={() => setSelectedWallet('btc')}
                          >
                            <Bitcoin className="h-3 w-3 mr-1" />
                            BTC
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={selectedWallet === 'eth' ? 'default' : 'outline'}
                            className="h-8 text-xs sm:text-sm"
                            onClick={() => setSelectedWallet('eth')}
                          >
                            <Coins className="h-3 w-3 mr-1" />
                            ETH
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="block text-sm font-medium">
                        {recipientType === 'crypto_wallet' ?
                          `Адрес ${selectedWallet.toUpperCase()} кошелька` :
                          'Номер карты получателя'
                        }
                      </label>
                      <input
                        type="text"
                        value={recipientCardNumber}
                        onChange={e => {
                          if (recipientType === 'usd_card') {
                            const value = e.target.value.replace(/\D/g, '');
                            const parts = value.match(/.{1,4}/g) || [];
                            setRecipientCardNumber(parts.join(' '));
                          } else {
                            setRecipientCardNumber(e.target.value);
                          }
                        }}
                        className="w-full p-2 border rounded text-sm"
                        maxLength={recipientType === 'usd_card' ? 19 : undefined}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium">
                        {card.type === 'crypto' ?
                          `Сумма в ${selectedWallet.toUpperCase()}` :
                          `Сумма в ${card.type.toUpperCase()}`
                        }
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={transferAmount}
                          onChange={e => setTransferAmount(e.target.value)}
                          className="w-full p-2 border rounded text-sm pr-12"
                          step={card.type === 'crypto' ? "0.00000001" : "0.01"}
                          min={card.type === 'crypto' ? "0.00000001" : "0.01"}
                          required
                        />
                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">
                          {card.type === 'crypto' ? selectedWallet.toUpperCase() : card.type.toUpperCase()}
                        </span>
                      </div>

                      {getConvertedAmount() && (
                        <p className="text-xs text-muted-foreground">
                          {getConvertedAmount()}
                        </p>
                      )}

                      <p className="text-xs text-muted-foreground">
                        Доступно: {
                          card.type === 'crypto' ?
                            `${selectedWallet === 'btc' ? card.btcBalance : card.ethBalance} ${selectedWallet.toUpperCase()}` :
                            `${card.balance} ${card.type.toUpperCase()}`
                        }
                      </p>
                    </div>

                    {transferError && (
                      <p className="text-xs text-red-500">{transferError}</p>
                    )}

                    <Button
                      type="submit"
                      disabled={isTransferring}
                      className="w-full h-9 text-sm"
                    >
                      {isTransferring ? (
                        <>
                          <Loader2 className="animate-spin h-3 w-3 mr-1" />
                          Выполняется перевод...
                        </>
                      ) : (
                        "Перевести"
                      )}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}