import { Card } from "@shared/schema";
import { Card as UICard, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger
} from "@/components/ui/dialog";
import { CreditCard, Wallet, ArrowUpCircle, ArrowDownCircle, RefreshCw, Loader2, Bitcoin, Coins, QrCode } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useGyroscope } from "@/hooks/use-gyroscope";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { QRCodeSVG } from 'qrcode.react';
import QRScanner from "./qr-scanner";

// Add recipient type enum
type RecipientType = 'usd_card' | 'crypto_wallet';

const cardColors = {
  crypto: "bg-gradient-to-br from-yellow-400 to-yellow-600",
  usd: "bg-gradient-to-br from-green-400 to-green-600",
  uah: "bg-gradient-to-br from-blue-400 to-blue-600",
} as const;

const QRCodeGenerator = ({ card, type }: { card: Card; type: 'btc' | 'eth' | 'card' }) => {
  const data = {
    type: type === 'card' ? 'usd_card' : 'crypto_wallet',
    ...(type === 'card'
      ? { cardNumber: card.number }
      : { walletAddress: type === 'btc' ? card.btcAddress : card.ethAddress }
    )
  };

  return (
    <div className="flex justify-center">
      <QRCodeSVG
        value={JSON.stringify(data)}
        size={200}
        level="H"
        includeMargin
        bgColor="#ffffff"
        fgColor="#000000"
      />
    </div>
  );
};

export default function VirtualCard({ card }: { card: Card }) {
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
  const [showQRScanner, setShowQRScanner] = useState(false);

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

  const transferMutation = useMutation({
    mutationFn: async ({ fromCardId, toCardNumber, amount, wallet, recipientType }: { fromCardId: number; toCardNumber: string; amount: string; wallet?: 'btc' | 'eth'; recipientType: RecipientType }) => {
      const response = await apiRequest("POST", "/api/transfer", {
        fromCardId,
        toCardNumber: toCardNumber.replace(/\s+/g, ''),
        amount: parseFloat(amount),
        wallet,
        recipientType
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка при переводе');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cards'] });
      setIsTransferring(false);
      setTransferAmount('');
      setRecipientCardNumber('');
      setTransferError('');
    },
    onError: (error: Error) => {
      setTransferError(error.message);
      setIsTransferring(false);
    }
  });

  return (
    <div
      ref={cardRef}
      className="perspective-[1000px] w-full max-w-[400px] mx-auto px-4 sm:px-0"
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
        className={`relative h-40 sm:h-48 w-full rounded-xl ${cardColors[card.type as keyof typeof cardColors]} p-3 sm:p-6 text-white shadow-xl transform transition-all duration-300`}
        style={{
          boxShadow: `
            0 10px 20px rgba(0,0,0,0.19), 
            0 6px 6px rgba(0,0,0,0.23),
            ${Math.abs(rotation.y)}px ${Math.abs(rotation.x)}px 20px rgba(0,0,0,0.1)
          `
        }}
      >
        <div className="flex flex-col justify-between h-full">
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
            <div className="flex space-x-1 sm:space-x-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="flex-1 text-white hover:bg-white/20 bg-white/10 backdrop-blur-sm text-[10px] sm:text-sm py-0.5 h-6 sm:h-8">
                    <ArrowUpCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-2" />
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
                          <QRCodeGenerator card={card} type="btc" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">ETH Address</p>
                          <p className="font-mono text-sm break-all">{card.ethAddress}</p>
                          <QRCodeGenerator card={card} type="eth" />
                        </div>
                      </>
                    ) : (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Card Number</p>
                        <p className="font-mono">{card.number}</p>
                        <QRCodeGenerator card={card} type="card" />
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="flex-1 text-white hover:bg-white/20 bg-white/10 backdrop-blur-sm text-[10px] sm:text-sm py-0.5 h-6 sm:h-8">
                    <ArrowDownCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-2" />
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
                  <Button size="sm" variant="ghost" className="flex-1 text-white hover:bg-white/20 bg-white/10 backdrop-blur-sm text-[10px] sm:text-sm py-0.5 h-6 sm:h-8">
                    <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-2" />
                    <span className="hidden sm:inline">Transfer</span>
                    <span className="sm:hidden">Trans</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Transfer Funds</DialogTitle>
                    <DialogDescription>
                      Transfer funds to another card or wallet
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <form onSubmit={async (e) => {
                      e.preventDefault();

                      if (!transferAmount || !recipientCardNumber || parseFloat(transferAmount) <= 0) {
                        setTransferError('Пожалуйста, введите корректную сумму и номер карты/адрес кошелька');
                        return;
                      }

                      if (recipientType === 'usd_card') {
                        const cleanCardNumber = recipientCardNumber.replace(/\s+/g, '');
                        if (cleanCardNumber.length !== 16 || !/^\d+$/.test(cleanCardNumber)) {
                          setTransferError('Номер карты должен состоять из 16 цифр');
                          return;
                        }
                      } else {
                        // Validate crypto wallet address
                        if (recipientCardNumber.length < 26 || recipientCardNumber.length > 35) {
                          setTransferError('Неверный формат адреса криптокошелька');
                          return;
                        }
                      }

                      setIsTransferring(true);
                      setTransferError('');

                      try {
                        await transferMutation.mutateAsync({
                          fromCardId: card.id,
                          toCardNumber: recipientCardNumber.replace(/\s+/g, ''),
                          amount: transferAmount,
                          wallet: card.type === 'crypto' ? selectedWallet : undefined,
                          recipientType
                        });
                      } catch (error: any) {
                        console.error("Transfer error:", error);
                        setTransferError(error.message || "Произошла ошибка при переводе");
                      } finally {
                        setIsTransferring(false);
                      }
                    }}>
                      {card.type === 'crypto' && (
                        <>
                          <div className="mb-4">
                            <label className="block text-sm font-medium mb-2">Выберите кошелек отправителя</label>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant={selectedWallet === 'btc' ? 'default' : 'outline'}
                                className="flex-1"
                                onClick={() => setSelectedWallet('btc')}
                              >
                                <Bitcoin className="h-4 w-4 mr-2" />
                                BTC
                              </Button>
                              <Button
                                type="button"
                                variant={selectedWallet === 'eth' ? 'default' : 'outline'}
                                className="flex-1"
                                onClick={() => setSelectedWallet('eth')}
                              >
                                <Coins className="h-4 w-4 mr-2" />
                                ETH
                              </Button>
                            </div>
                          </div>

                          <div className="mb-4">
                            <label className="block text-sm font-medium mb-2">Тип получателя</label>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant={recipientType === 'usd_card' ? 'default' : 'outline'}
                                className="flex-1"
                                onClick={() => setRecipientType('usd_card')}
                              >
                                <CreditCard className="h-4 w-4 mr-2" />
                                USD Карта
                              </Button>
                              <Button
                                type="button"
                                variant={recipientType === 'crypto_wallet' ? 'default' : 'outline'}
                                className="flex-1"
                                onClick={() => setRecipientType('crypto_wallet')}
                              >
                                <Wallet className="h-4 w-4 mr-2" />
                                Крипто кошелек
                              </Button>
                            </div>
                          </div>
                        </>
                      )}

                      <div className="mb-4">
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full mb-2"
                          onClick={() => setShowQRScanner(true)}
                        >
                          <QrCode className="h-4 w-4 mr-2" />
                          Сканировать QR-код
                        </Button>

                        {showQRScanner && (
                          <Dialog open={showQRScanner} onOpenChange={setShowQRScanner}>
                            <DialogContent className="sm:max-w-lg">
                              <DialogHeader>
                                <DialogTitle>Сканировать QR-код</DialogTitle>
                                <DialogDescription>
                                  Нажмите "Включить камеру" и разрешите доступ к камере устройства
                                </DialogDescription>
                              </DialogHeader>
                              <QRScanner
                                onScanSuccess={(recipient, type) => {
                                  setRecipientType(type);
                                  setRecipientCardNumber(recipient);
                                  setShowQRScanner(false);
                                }}
                                onClose={() => setShowQRScanner(false)}
                              />
                            </DialogContent>
                          </Dialog>
                        )}

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
                          placeholder={recipientType === 'usd_card' ? 'Номер USD карты получателя' : `Адрес ${selectedWallet.toUpperCase()} кошелька`}
                          className="w-full p-2 border rounded"
                          maxLength={recipientType === 'usd_card' ? 19 : 35}
                          required
                        />
                      </div>

                      <input
                        type="number"
                        value={transferAmount}
                        onChange={e => setTransferAmount(e.target.value)}
                        placeholder={recipientType === 'usd_card' ? 'Сумма в USD' : `Сумма в ${selectedWallet.toUpperCase()}`}
                        className="w-full p-2 border rounded mb-4"
                        step="0.01"
                        min="0.01"
                        required
                      />


                      {transferError && <p className="text-red-500 text-sm mt-2">{transferError}</p>}
                      <Button
                        type="submit"
                        disabled={isTransferring}
                        className="w-full"
                      >
                        {isTransferring ? (
                          <>
                            <Loader2 className="animate-spin h-4 w-4 mr-2" />
                            Выполняется перевод...
                          </>
                        ) : (
                          "Перевести"
                        )}
                      </Button>
                    </form>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}