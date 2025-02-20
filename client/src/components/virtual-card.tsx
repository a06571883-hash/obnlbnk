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

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const rotateY = ((e.clientX - centerX) / (rect.width / 2)) * 15;
    const rotateX = -((e.clientY - centerY) / (rect.height / 2)) * 15;

    setRotation({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setRotation({ x: 0, y: 0 });
  };

  useEffect(() => {
    if (gyroscope) {
      setRotation({
        x: -gyroscope.beta / 3,
        y: gyroscope.gamma / 3
      });
    }
  }, [gyroscope]);

  const transferMutation = useMutation({
    mutationFn: (data: any) => {
      return fetch('/api/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      }).then(res => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['card']);
      setIsTransferring(false);
      setTransferAmount('');
      setRecipientCardNumber('');
      setTransferError('');
    },
    onError: (error: any) => {
      setIsTransferring(false);
      setTransferError(error.message || 'Transfer failed.');
    },
  });

  const handleTransfer = async () => {
    setIsTransferring(true);
    try {
      await transferMutation.mutateAsync({
        fromCard: card.id,
        toCard: recipientCardNumber,
        amount: transferAmount,
        currency: card.type,
      });
    } catch (error) {
      console.error("Transfer error:", error);
    }
  };

  const cardColor = {
    crypto: "bg-gradient-to-br from-purple-500 to-pink-500",
    usd: "bg-gradient-to-br from-green-500 to-emerald-500",
    uah: "bg-gradient-to-br from-blue-500 to-cyan-500"
  }[card.type];

  return (
    <div
      ref={cardRef}
      className="perspective-[1000px]"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: isMobile ? `perspective(1000px) rotateX(${gyroscope ? gyroscope.beta / 4 : 0}deg) rotateY(${gyroscope ? gyroscope.gamma / 4 : 0}deg)`
                           : `perspective(1000px) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
        transition: 'transform 0.2s ease-out',
        transformStyle: 'preserve-3d'
      }}
    >
      <div className={`relative h-56 w-full rounded-xl ${cardColors[card.type]} p-6 text-white shadow-xl transform transition-transform duration-300 hover:scale-105`}>
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
                    <Button size="sm" variant="ghost" className="flex-1 text-white hover:bg-white/20 bg-white/10 backdrop-blur-sm" data-dialog="deposit">
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
                    <Button size="sm" variant="ghost" className="flex-1 text-white hover:bg-white/20 bg-white/10 backdrop-blur-sm" data-dialog="withdraw">
                      <ArrowDownCircle className="h-4 w-4 mr-2" />
                      Withdraw
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Withdraw Funds</DialogTitle>
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
                    <Button size="sm" variant="ghost" className="flex-1 text-white hover:bg-white/20 bg-white/10 backdrop-blur-sm" data-dialog="transfer">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Transfer
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Transfer Funds</DialogTitle>
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