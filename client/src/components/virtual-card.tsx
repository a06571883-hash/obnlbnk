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
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { CreditCard, Wallet, ArrowUpCircle, ArrowDownCircle, RefreshCw, Loader2, Bitcoin, Coins, MessageSquare } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useGyroscope } from "@/hooks/use-gyroscope";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Constants - улучшенные градиенты для красивого переливания
const cardColors = {
  crypto: "bg-gradient-to-br from-violet-700 via-violet-500 to-fuchsia-600 animate-gradient-slow",
  usd: "bg-gradient-to-tr from-emerald-700 via-green-500 to-emerald-600 animate-gradient-slow backdrop-blur-md",
  uah: "bg-gradient-to-tr from-blue-700 via-sky-500 to-blue-600 animate-gradient-slow backdrop-blur-md",
  kichcoin: "bg-gradient-to-br from-orange-700 via-orange-500 to-amber-600 animate-gradient-slow backdrop-blur-md",
} as const;

// Utility functions для проверки криптоадресов
function validateBtcAddress(address: string): boolean {
  // Улучшенная регулярка для Legacy и P2SH адресов (начинаются с 1 или 3)
  const legacyRegex = /^[13][a-km-zA-HJ-NP-Z0-9]{24,33}$/;

  // Регулярка для SegWit адресов (bc1...)
  const bech32Regex = /^bc1[a-zA-HJ-NP-Z0-9]{39,59}$/;

  // Регулярка для Taproot адресов (начинаются с bc1p)
  const taprootRegex = /^bc1p[a-km-zA-HJ-NP-Z0-9]{58,89}$/;

  // Проверяем дополнительно, чтобы отсечь явно некорректные адреса
  const hasInvalidPattern =
    address.includes('BTC') ||
    address.includes('btc') ||
    /^1[0-9]{6,}$/.test(address); // Отсекаем адреса вида 10000000...

  // Проверяем все допустимые форматы и отсутствие недопустимых паттернов
  return (legacyRegex.test(address) || bech32Regex.test(address) || taprootRegex.test(address)) && !hasInvalidPattern;
}

/**
 * Проверяет валидность Ethereum-адреса
 * Использует стандартные правила проверки ETH адресов
 * @param address Адрес для проверки
 * @returns true если адрес валидный
 */
function validateEthAddress(address: string): boolean {
  // Проверяем формат - должен быть 0x + 40 шестнадцатеричных символов
  const formatRegex = /^0x[a-fA-F0-9]{40}$/i;

  // Проверяем на явно некорректные паттерны
  const hasInvalidPattern =
    address.includes('ETH') ||
    address.includes('eth');

  return formatRegex.test(address) && !hasInvalidPattern;
}

// Component
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
  const [withdrawalMethod, setWithdrawalMethod] = useState<string | null>(null);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [exchangeRate, setExchangeRate] = useState<ExchangeRate | null>(null);
  const [bankCardNumber, setBankCardNumber] = useState('');
  const [bankCardError, setBankCardError] = useState('');
  const [exchangeStatus, setExchangeStatus] = useState<string>('');
  const [isProcessingExchange, setIsProcessingExchange] = useState(false);

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

  useEffect(() => {
    if (withdrawalAmount && withdrawalMethod && rates) {
      const amount = parseFloat(withdrawalAmount);
      if (isNaN(amount)) return;

      let estimatedAmount = '0';
      let rate = '0';

      if (withdrawalMethod === 'btc') {
        rate = (rates.btcToUsd * rates.usdToUah).toString();
        estimatedAmount = (amount * parseFloat(rate)).toString();
      } else if (withdrawalMethod === 'eth') {
        rate = (rates.ethToUsd * rates.usdToUah).toString();
        estimatedAmount = (amount * parseFloat(rate)).toString();
      }

      setExchangeRate({
        estimatedAmount,
        rate,
        transactionSpeedForecast: "15-30 minutes"
      });
    }
  }, [withdrawalAmount, withdrawalMethod, rates]);

  const sensitivity = isIOS ? 0.3 : 0.5; // Уменьшаем чувствительность для более плавного поворота
  const springFactor = 0.08; // Добавляем пружинный эффект для более естественного движения

  useEffect(() => {
    if (gyroscope && isMobile) {
      const targetX = -gyroscope.beta * sensitivity;
      const targetY = gyroscope.gamma * sensitivity;

      requestAnimationFrame(() => {
        setRotation(prev => ({
          x: prev.x + (targetX - prev.x) * springFactor,
          y: prev.y + (targetY - prev.y) * springFactor
        }));
      });
    }
  }, [gyroscope, isMobile, isIOS]);

  const withdrawalMutation = useMutation({
    mutationFn: async (request: ExchangeRequest) => {
      setIsProcessingExchange(true);
      setBankCardError('');

      const cleanCardNumber = bankCardNumber.replace(/\s+/g, '');
      if (!/^\d{16}$/.test(cleanCardNumber)) {
        throw new Error('Номер карты должен содержать 16 цифр');
      }

      const response = await apiRequest("POST", "/api/exchange/create", request);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Exchange failed');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cards'] });
      setExchangeStatus('pending');
      toast({
        title: "Успех",
        description: "Обмен создан успешно. Средства поступят на карту в ближайшее время.",
      });
      setWithdrawalMethod(null);
      setWithdrawalAmount('');
      setBankCardNumber('');
      setExchangeRate(null);
    },
    onError: (error: Error) => {
      setBankCardError(error.message);
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive"
      });
    },
    onSettled: () => {
      setIsProcessingExchange(false);
    }
  });

  const transferMutation = useMutation({
    mutationFn: async () => {
      setTransferError('');

      if (!transferAmount || isNaN(parseFloat(transferAmount)) || parseFloat(transferAmount) <= 0) {
        throw new Error('Пожалуйста, введите корректную сумму');
      }

      if (!recipientCardNumber.trim()) {
        throw new Error('Пожалуйста, введите номер карты/адрес получателя');
      }

      if (card.type === 'crypto') {
        const cryptoBalance = selectedWallet === 'btc' ? parseFloat(card.btcBalance || '0') : parseFloat(card.ethBalance || '0');
        if (parseFloat(transferAmount) > cryptoBalance) {
          throw new Error(`Недостаточно ${selectedWallet.toUpperCase()}. Доступно: ${cryptoBalance.toFixed(8)} ${selectedWallet.toUpperCase()}`);
        }
      } else {
        if (parseFloat(transferAmount) > parseFloat(card.balance)) {
          throw new Error(`Недостаточно средств. Доступно: ${card.balance} ${card.type.toUpperCase()}`);
        }
      }

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
        cryptoType: card.type === 'crypto' ? selectedWallet : (recipientType === 'crypto_wallet' ? selectedWallet : undefined)
      };

      const response = await apiRequest("POST", "/api/transfer", transferRequest);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при переводе');
      }

      return response.json();
    },
    onMutate: () => {
      setIsTransferring(true);
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
    },
    onSettled: () => {
      setIsTransferring(false);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isTransferring || transferMutation.isPending) {
      return;
    }
    transferMutation.mutate();
  };

  const getConvertedAmount = () => {
    if (!rates || !transferAmount) return null;
    const amount = parseFloat(transferAmount);
    if (isNaN(amount)) return null;

    if (card.type === 'crypto') {
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

    const rotateY = ((e.clientX - centerX) / (rect.width / 2)) * 12; // Уменьшаем угол поворота
    const rotateX = -((e.clientY - centerY) / (rect.height / 2)) * 12;

    setRotation({ x: rotateX, y: rotateY });
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setRotation({ x: 0, y: 0 });
    setIsHovered(false);
  };

  const calculateExchangeAmount = (amount: string, fromCurrency: string, toCurrency: string, rates: any) => {
    const value = parseFloat(amount);
    if (isNaN(value)) return '0.00';

    if (toCurrency === 'btc') {
      return (value / rates.btcToUsd).toFixed(8);
    } else if (toCurrency === 'eth') {
      return (value / rates.ethToUsd).toFixed(8);
    } else if (toCurrency === 'usdt') {
      return value.toFixed(2);
    } else if (toCurrency === 'usd') {
      return value.toFixed(2);
    } else if (toCurrency === 'eur') {
      return (value * 0.92).toFixed(2);
    } else if (toCurrency === 'uah') {
      return (value * rates.usdToUah).toFixed(2);
    }
    return '0.00';
  };

  const calculateExchangeAmountUpdated = () => {
    if (!rates || !withdrawalAmount || !withdrawalMethod) return 0;
    const amount = parseFloat(withdrawalAmount);
    if (isNaN(amount)) return 0;
    return calculateExchangeAmount(withdrawalAmount, card.type, withdrawalMethod, rates);
  }

  const handleWithdrawal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawalMethod || !withdrawalAmount || !bankCardNumber) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    // Create exchange request
    const request: ExchangeRequest = {
      fromCurrency: withdrawalMethod,
      toCurrency: "uah",
      fromAmount: withdrawalAmount,
      address: bankCardNumber.replace(/\s+/g, ''),
      cryptoCard: card // Pass the entire card object
    };

    // Execute exchange
    withdrawalMutation.mutate(request);
  };

  return (
    <div
      ref={cardRef}
      className="w-[280px] h-[280px] mx-auto flex items-center justify-center"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `
          perspective(1000px) 
          rotateX(${rotation.x}deg) 
          rotateY(${rotation.y}deg)
          scale3d(${isHovered ? 0.98 : 0.95}, ${isHovered ? 0.98 : 0.95}, 1)
        `,
        transition: isHovered ? 'transform 0.1s ease-out' : 'transform 0.5s ease-out',
        transformStyle: 'preserve-3d'
      }}
    >
      {/* Добавляем эффект блика/блеска вокруг всей карты */}
      <div 
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{
          background: isHovered 
            ? `radial-gradient(circle at ${rotation.y + 50}% ${rotation.x + 50}%, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 60%)` 
            : 'none',
          transform: 'translateZ(30px)',
          transition: 'all 0.5s ease-out',
          opacity: isHovered ? 1 : 0,
          zIndex: 12,
          borderRadius: '0.75rem'
        }} 
      />
      
      <div
        className={`relative h-[160px] w-full rounded-xl ${cardColors[card.type as keyof typeof cardColors]} p-3 text-white shadow-xl overflow-hidden backdrop-blur-sm bg-gradient-pos`}
        style={{
          boxShadow: `
            0 10px 20px rgba(0,0,0,0.19), 
            0 6px 6px rgba(0,0,0,0.23),
            ${Math.abs(rotation.y)}px ${Math.abs(rotation.x)}px ${20 + Math.abs(rotation.x + rotation.y) / 2}px rgba(0,0,0,${0.1 + Math.abs(rotation.x + rotation.y) / 100}),
            inset 0 0 15px rgba(255,255,255,0.3),
            inset 0 0 8px rgba(255,255,255,0.5)
          `,
          transform: `translateZ(${isHovered ? '20px' : '10px'})`,
          transition: 'transform 0.3s ease-out, box-shadow 0.3s ease-out'
        }}
      >
        {/* Добавление эффекта световых бликов */}
        <div 
          className="absolute inset-0 opacity-50 pointer-events-none overflow-hidden"
          style={{ transform: `translateZ(5px)` }}
        >
          <div 
            className="absolute w-[60%] h-[20px] bg-white/30 blur-xl rounded-full -translate-x-full"
            style={{
              top: '20%',
              left: '50%',
              transform: `translateX(${isHovered ? '150%' : '-150%'}) rotate(-35deg)`,
              transition: 'transform 0.8s ease-in-out',
            }}
          />
          <div
            className="absolute w-[25%] h-[140%] bg-white/20 blur-lg rounded-full -translate-x-full"
            style={{
              top: '-20%',
              left: '60%',
              transform: `translateX(${isHovered ? '50%' : '-50%'}) rotate(35deg)`,
              transition: 'transform 0.5s ease-in-out',
            }}
          />
        </div>
        
        <div
          className="relative z-10 flex flex-col justify-between h-full p-1"
          style={{
            transform: `translateZ(${isHovered ? '15px' : '5px'})`,
            transition: 'transform 0.3s ease-out'
          }}
        >
          <div className="space-y-0.5">
            <div className="opacity-80 text-[11px]">OOO BNAL BANK</div>
            <div className="font-bold tracking-wider text-[11px]">
              {card.number.replace(/(\d{4})/g, "$1 ").trim()}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between">
              {card.type === 'crypto' ? (
                <div className="space-y-0.5">
                  <div className="flex items-center">
                    <Bitcoin className="h-3.5 w-3.5 mr-1" />
                    <div className="opacity-80 text-[10px]">BTC Balance</div>
                  </div>
                  <div className="font-semibold text-[10px]">
                    {card.btcBalance} BTC
                  </div>
                  <div className="flex items-center mt-0.5">
                    <Coins className="h-3.5 w-3.5 mr-1" />
                    <div className="opacity-80 text-[10px]">ETH Balance</div>
                  </div>
                  <div className="font-semibold text-[10px]">
                    {card.ethBalance} ETH
                  </div>
                </div>
              ) : (
                <div>
                  <div className="opacity-80 text-[11px]">Balance</div>
                  <div className="font-semibold text-[11px]">
                    {card.balance} {card.type.toUpperCase()}
                  </div>
                </div>
              )}
              <div>
                <div className="opacity-80 text-[11px]">Expires</div>
                <div className="font-semibold text-[11px]">{card.expiry}</div>
              </div>
            </div>

            <div className="flex space-x-1">
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="flex-1 text-white hover:bg-white/20 bg-white/10 backdrop-blur-sm h-6 px-2">
                    <ArrowUpCircle className="h-3.5 w-3.5 mr-1" />
                    <span className="hidden sm:inline">Deposit</span>
                    <span className="sm:hidden text-[10px]">Dep</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Deposit Funds</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    {card.type === 'crypto' ? (
                      <>
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">BTC Address</p>
                          <div
                            className="font-mono text-sm break-all p-2 border rounded cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-between"
                            onClick={() => {
                              navigator.clipboard.writeText(card.btcAddress || '');
                              toast({
                                title: "Скопировано!",
                                description: "BTC адрес скопирован в буфер обмена"
                              });
                            }}
                          >
                            <span>{card.btcAddress}</span>
                            <Button size="sm" variant="ghost" className="h-6 px-2 ml-2">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                            </Button>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">ETH Address</p>
                          <div
                            className="font-mono text-sm break-all p-2 border rounded cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-between"
                            onClick={() => {
                              navigator.clipboard.writeText(card.ethAddress || '');
                              toast({
                                title: "Скопировано!",
                                description: "ETH адрес скопирован в буфер обмена"
                              });
                            }}
                          >
                            <span>{card.ethAddress}</span>
                            <Button size="sm" variant="ghost" className="h-6 px-2 ml-2">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                            </Button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Card Number</p>
                        <div
                          className="font-mono text-sm flex items-center justify-between p-2 border rounded cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          onClick={() => {
                            navigator.clipboard.writeText(card.number);
                            toast({
                              title: "Скопировано!",
                              description: "Номер карты скопирован в буфер обмена"
                            });
                          }}
                        >
                          <span>{card.number}</span>
                          <Button size="sm" variant="ghost" className="h-6 px-2 ml-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="flex-1 text-white hover:bg-white/20 bg-white/10 backdrop-blur-sm h-6 px-2">
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    <span className="hidden sm:inline">Transfer</span>
                    <span className="sm:hidden text-[10px]">Trans</span>
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
                          <CreditCard className="h-4 w-4 mr-1" />
                          Фиат карта
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={recipientType === 'crypto_wallet' ? 'default' : 'outline'}
                          className="h-8 text-xs sm:text-sm"
                          onClick={() => setRecipientType('crypto_wallet')}
                        >
                          <Wallet className="h-4 w-4 mr-1" />
                          Крипто адрес
                        </Button>
                      </div>
                    </div>

                    {recipientType === 'crypto_wallet' && (
                      <div className="space-y-2">
                        <label className="block text-sm font-medium">
                          Выберите криптовалюту {card.type === 'crypto' ? 'для отправки' : 'для получения'}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={selectedWallet === 'btc' ? 'default' : 'outline'}
                            className="h-8 text-xs sm:text-sm"
                            onClick={() => setSelectedWallet('btc')}
                          >
                            <Bitcoin className="h-4 w-4 mr-1" />
                            BTC
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={selectedWallet === 'eth' ? 'default' : 'outline'}
                            className="h-8 text-xs sm:text-sm"
                            onClick={() => setSelectedWallet('eth')}
                          >
                            <Coins className="h-4 w-4 mr-1" />
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
                    
                    {/* Информация о блокчейн-транзакциях при переводе на внешний адрес */}
                    {recipientType === 'crypto_wallet' && (
                      <div className="text-xs p-3 rounded my-2 border border-green-200 bg-green-50">
                        <div className="flex items-start gap-2">
                          <div className="text-green-500 mt-0.5">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="lucide lucide-check-circle"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                          </div>
                          <div>
                            <span className="font-semibold text-green-700">Реальные блокчейн-транзакции</span>
                            <p className="text-green-700">
                              Переводы {selectedWallet.toUpperCase()} на внешний адрес будут выполнены как реальные транзакции в блокчейне. 
                              API ключи BlockDaemon настроены, и система готова к работе с блокчейном.
                            </p>
                            <p className="mt-1 text-green-700">
                              <span className="font-medium">Доступные сети:</span> Bitcoin (BTC) и Ethereum (ETH) mainnet.
                            </p>
                            <p className="mt-1 text-green-600">
                              Проверяйте правильность адреса получателя перед отправкой - блокчейн-транзакции необратимы.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <Button
                      type="submit"
                      disabled={isTransferring || transferMutation.isPending}
                      className="w-full h-9 text-sm"
                    >
                      {(isTransferring || transferMutation.isPending) ? (
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

              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="flex-1 text-white hover:bg-white/20 bg-white/10 backdrop-blur-sm h-6 px-2">
                    <ArrowDownCircle className="h-3.5 w-3.5 mr-1" />
                    <span className="hidden sm:inline">Withdraw</span>
                    <span className="sm:hidden text-[10px]">With</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Exchange & Withdraw</DialogTitle>
                    <DialogDescription>
                      Convert your crypto to fiat and withdraw to your card
                    </DialogDescription>
                  </DialogHeader>
                  <form className="space-y-4" onSubmit={handleWithdrawal}>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Select source cryptocurrency</label>
                      <Select
                        value={withdrawalMethod || ""}
                        onValueChange={setWithdrawalMethod}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select cryptocurrency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel>Available Cryptocurrencies</SelectLabel>
                            {parseFloat(card.btcBalance) > 0 && (
                              <SelectItem value="btc">
                                Bitcoin (BTC) - Balance: {card.btcBalance}
                              </SelectItem>
                            )}
                            {parseFloat(card.ethBalance) > 0 && (
                              <SelectItem value="eth">
                                Ethereum (ETH) - Balance: {card.ethBalance}
                              </SelectItem>
                            )}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Amount to exchange</label>
                      <div className="relative">
                        <Input
                          type="number"
                          placeholder="0.00000000"
                          className="pr-16"
                          value={withdrawalAmount}
                          onChange={(e) => {
                            setWithdrawalAmount(e.target.value);
                            setExchangeRate(null);
                          }}
                          step="0.00000001"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                          {withdrawalMethod?.toUpperCase()}
                        </div>
                      </div>
                      <p className="text-sm text-mutedforeground">
                        Available: {withdrawalMethod === 'btc' ? card.btcBalance : card.ethBalance} {withdrawalMethod?.toUpperCase()}
                      </p>
                    </div>

                    {exchangeRate && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Exchange Rate Information</label>
                        <div className="p-3 rounded-lg bg-muted">
                          <p className="text-lg font-semibold">
                            ≈ ${parseFloat(exchangeRate.estimatedAmount).toFixed(2)} UAH
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Rate: 1 {withdrawalMethod?.toUpperCase()} = {parseFloat(exchangeRate.rate).toFixed(2)} UAH
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Estimated processing time: {exchangeRate.transactionSpeedForecast}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Enter Ukrainian Bank Card Number</label>
                      <Input
                        type="text"
                        placeholder="0000 0000 0000 0000"
                        value={bankCardNumber}
                        maxLength={19}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          const parts = value.match(/.{1,4}/g) || [];
                          setBankCardNumber(parts.join(' '));
                          setBankCardError('');
                        }}
                      />
                      {bankCardError && (
                        <p className="text-sm text-red-500">{bankCardError}</p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        Enter your Ukrainian bank card number where you want to receive the funds
                      </p>
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isProcessingExchange || !withdrawalMethod || !withdrawalAmount || !bankCardNumber}
                    >
                      {isProcessingExchange ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing Exchange...
                        </>
                      ) : (
                        "Continue with Exchange"
                      )}
                    </Button>
                    <Button
                      className="w-full mt-2"
                      onClick={() => window.open('@OOO_BNAL_BANK', '_blank')}
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Написать в Telegram
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

type RecipientType = 'usd_card' | 'crypto_wallet';

interface ExchangeRate {
  estimatedAmount: string;
  rate: string;
  transactionSpeedForecast: string;
}

interface ExchangeRequest {
  fromCurrency: string;
  toCurrency: string;
  fromAmount: string;
  address: string;
  cryptoCard?: Card;
}