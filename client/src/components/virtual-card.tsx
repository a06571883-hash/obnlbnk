import { Card } from "@shared/schema";
import { Card as UICard, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CreditCard, Wallet, ArrowUpCircle, ArrowDownCircle, RefreshCw, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useGyroscope } from "@/hooks/use-gyroscope";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const cardColors = {
  crypto: "bg-gradient-to-br from-yellow-400 to-yellow-600",
  usd: "bg-gradient-to-br from-green-400 to-green-600",
  uah: "bg-gradient-to-br from-blue-400 to-blue-600",
} as const;

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
      const targetX = -gyroscope.beta / 3;
      const targetY = gyroscope.gamma / 3;

      // Плавная анимация для мобильных устройств
      setRotation(prev => ({
        x: prev.x + (targetX - prev.x) * 0.1,
        y: prev.y + (targetY - prev.y) * 0.1
      }));
    }
  }, [gyroscope, isMobile]);

  const transferMutation = useMutation({
    mutationFn: async (data: { fromCardId: number; toCardNumber: string; amount: string }) => {
      const response = await fetch('/api/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        // Add retry logic for fetch
        retry: 3,
        retryDelay: (retryCount) => Math.min(1000 * 2 ** retryCount, 30000),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Ошибка сервера' }));
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
      setIsTransferring(false);
      setTransferError(error.message || 'Ошибка при переводе.');
    },
    retry: 3,
    retryDelay: (retryCount) => Math.min(1000 * 2 ** retryCount, 30000),
  });

  const handleTransfer = async () => {
    if (!transferAmount || !recipientCardNumber) {
      setTransferError('Please fill in all fields');
      return;
    }

    setIsTransferring(true);
    try {
      await transferMutation.mutateAsync({
        fromCardId: card.id,
        toCardNumber: recipientCardNumber,
        amount: transferAmount
      });
    } catch (error) {
      console.error("Transfer error:", error);
    }
  };

  return (
    <div
      ref={cardRef}
      className="perspective-[1000px]"
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
        className={`relative h-56 w-full rounded-xl ${cardColors[card.type as keyof typeof cardColors]} p-6 text-white shadow-xl transform transition-all duration-300`}
        style={{
          boxShadow: `
            0 10px 20px rgba(0,0,0,0.19), 
            0 6px 6px rgba(0,0,0,0.23),
            ${Math.abs(rotation.y)}px ${Math.abs(rotation.x)}px 20px rgba(0,0,0,0.1)
          `
        }}
      >
        <div className="flex flex-col justify-between h-full">
          <div className="space-y-4">
            <div className="text-xs opacity-80">Virtual Card</div>
            <div className="text-2xl font-bold tracking-wider">
              {card.number.replace(/(\d{4})/g, "$1 ").trim()}
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between">
              <div>
                <div className="text-xs opacity-80">Balance</div>
                <div className="font-semibold">
                  {card.balance} {card.type.toUpperCase()}
                </div>
              </div>
              <div>
                <div className="text-xs opacity-80">Expires</div>
                <div className="font-semibold">{card.expiry}</div>
              </div>
            </div>
            <div className="flex space-x-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="flex-1 text-white hover:bg-white/20 bg-white/10 backdrop-blur-sm">
                    <ArrowUpCircle className="h-4 w-4 mr-2" />
                    Deposit
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
                          <p className="text-sm text-muted-foreground">BTC Address</p>
                          <p className="font-mono text-sm break-all">{card.btcAddress}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">ETH Address</p>
                          <p className="font-mono text-sm break-all">{card.ethAddress}</p>
                        </div>
                      </>
                    ) : (
                      <div>
                        <p className="text-sm text-muted-foreground">Card Number</p>
                        <p className="font-mono">{card.number}</p>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="flex-1 text-white hover:bg-white/20 bg-white/10 backdrop-blur-sm">
                    <ArrowDownCircle className="h-4 w-4 mr-2" />
                    Withdraw
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md" aria-describedby="withdraw-description">
                  <DialogHeader>
                    <DialogTitle>Withdraw Funds</DialogTitle>
                    <DialogDescription id="withdraw-description">
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
                  <Button size="sm" variant="ghost" className="flex-1 text-white hover:bg-white/20 bg-white/10 backdrop-blur-sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Transfer
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md" aria-describedby="transfer-description">
                  <DialogHeader>
                    <DialogTitle>Transfer Funds</DialogTitle>
                    <DialogDescription id="transfer-description">
                      Transfer funds to another card
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <input
                      type="number"
                      value={transferAmount}
                      onChange={e => setTransferAmount(e.target.value)}
                      placeholder="Amount"
                      className="w-full p-2 border rounded"
                    />
                    <input
                      type="text"
                      value={recipientCardNumber}
                      onChange={e => setRecipientCardNumber(e.target.value)}
                      placeholder="Recipient Card Number"
                      className="w-full p-2 border rounded"
                    />
                    {transferError && <p className="text-red-500">{transferError}</p>}
                    <Button onClick={handleTransfer} disabled={isTransferring} className="w-full">
                      {isTransferring ? <Loader2 className="animate-spin h-4 w-4 mr-2"/> : "Transfer"}
                    </Button>
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